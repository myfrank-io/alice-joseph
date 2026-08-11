import type { Person, QuiEstCeRound, Who } from "@/lib/types";
import type { Coup } from "@/lib/jeux/puissance4";
import type { Etape } from "@/lib/jeux/qui-est-ce";

/** Réponse d'une action de jeu : jamais une exception, toujours un message lisible. */
export type Reponse = { ok: true; id?: string } | { ok: false; erreur: string };

/** État d'un formulaire relié à `useActionState`. */
export interface EtatFormulaire {
  ok?: boolean;
  erreur?: string;
}

export const FORMULAIRE_VIDE: EtatFormulaire = {};

/**
 * La manche telle qu'elle part vers le navigateur.
 *
 * `secretPersonId` reste à null tant que la manche est en cours : la réponse ne
 * doit exister nulle part dans la page, même cachée dans un attribut — c'est
 * tout l'intérêt du mode défi.
 */
export interface MancheVue {
  id: string;
  player: Who;
  setBy: Who | "hasard";
  status: QuiEstCeRound["status"];
  questionsAsked: number;
  erreurs: number;
  eliminated: string[];
  etapes: Etape[];
  secretPersonId: string | null;
}

/** Une personne du paquet, telle qu'affichée sur le plateau. */
export type PersonneVue = Person;

/* ------------------------- Ce que le navigateur envoie -------------------- */

/**
 * Une partie jouée entièrement dans le navigateur, telle qu'elle remonte au
 * serveur une fois finie.
 *
 * Seuls les coups voyagent : le serveur rejoue la partie avec `etatDepuisCoups`
 * au lieu de croire une grille venue d'ailleurs. Une liste bricolée ne donne
 * donc jamais un état incohérent, au pire une partie que personne n'a jouée.
 */
export interface ChargePartie {
  /** Choisi par le navigateur, et réutilisé tel quel : réenvoyer n'ajoute rien. */
  id: string;
  mode: "local" | "solo";
  premier: Who;
  botSide?: Who;
  coups: Coup[];
}

/**
 * Une manche tirée au sort et jouée dans le navigateur.
 *
 * Même principe : seul l'historique voyage. Le serveur relit le secret dans le
 * paquet, recalcule les réponses, les éliminations, le compteur et l'issue.
 */
export interface ChargeManche {
  id: string;
  secretPersonId: string;
  etapes: Etape[];
}
