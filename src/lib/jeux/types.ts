import type { Person, QuiEstCeRound, Who } from "@/lib/types";
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
