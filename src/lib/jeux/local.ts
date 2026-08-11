import type { Who } from "@/lib/types";
import { autreQue, type Coup } from "@/lib/jeux/puissance4";
import type { Etape } from "@/lib/jeux/qui-est-ce";
import type { ChargeManche, ChargePartie } from "@/lib/jeux/types";

/**
 * La mémoire du navigateur.
 *
 * Tout ce qui se joue hors ligne vit ici : la partie en cours et les résultats
 * qui n'ont pas encore trouvé le serveur. Trois règles, sans exception.
 *
 * 1. Rien n'est lu au premier rendu. Ces fonctions renvoient `null` côté
 *    serveur, mais un composant ne doit de toute façon les appeler que dans un
 *    `useEffect` ou un gestionnaire d'événement : lire le stockage pendant le
 *    rendu ferait diverger le HTML du serveur et celui du navigateur.
 * 2. Aucune lecture ne peut faire tomber une page. Navigation privée, quota
 *    dépassé, JSON tordu à la main, version d'un ancien déploiement : dans tous
 *    ces cas on repart de rien, ce qui coûte une partie, jamais un écran blanc.
 * 3. Ce qu'on range est minimal et rejouable. Une partie, c'est sa liste de
 *    coups ; une manche, c'est son secret et ses étapes. Le reste se recalcule.
 */

const PREFIXE = "aj:jeux:";

/** À incrémenter dès que la forme rangée change : les vieilles clés sont ignorées. */
export const VERSION_LOCALE = 1;

/** Au-delà, la file d'attente perd ses plus vieilles entrées plutôt que le quota. */
const FILE_MAX = 12;

export type ModeLocal = "local" | "solo";
export type JeuLocal = "p4" | "qec";

/* ------------------------------ Ce qu'on range ---------------------------- */

/** Une partie de puissance 4 jouée sur cet appareil. */
export interface PartieLocale {
  v: number;
  id: string;
  mode: ModeLocal;
  premier: Who;
  botSide?: Who;
  coups: Coup[];
  /** Rendue avant la fin : plus de vainqueur possible, mais une partie quand même. */
  abandonnee?: boolean;
  /** Le résultat est parti (ou est en file d'attente) : on ne le renverra pas. */
  enregistree: boolean;
  majAt: string;
}

/** Une manche de « qui est-ce ? » tirée au sort sur cet appareil. */
export interface MancheLocale {
  v: number;
  id: string;
  /** Le secret, tiré ici même : personne d'autre n'a rien à cacher au joueur. */
  secretId: string;
  etapes: Etape[];
  enregistree: boolean;
  majAt: string;
}

/* --------------------------------- Le socle ------------------------------- */

function magasin(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Navigation privée verrouillée, stockage refusé par la politique du site.
    return null;
  }
}

function lire<T>(cle: string): T | null {
  const boite = magasin();
  if (!boite) return null;
  try {
    const brut = boite.getItem(cle);
    if (!brut) return null;
    const valeur = JSON.parse(brut) as unknown;
    return valeur && typeof valeur === "object" ? (valeur as T) : null;
  } catch {
    // JSON invalide : la clé sera écrasée à la prochaine écriture.
    return null;
  }
}

function ecrire(cle: string, valeur: unknown): void {
  const boite = magasin();
  if (!boite) return;
  try {
    boite.setItem(cle, JSON.stringify(valeur));
  } catch {
    // Quota dépassé : la partie continue, elle ne survivra simplement pas au rechargement.
  }
}

function effacer(cle: string): void {
  const boite = magasin();
  if (!boite) return;
  try {
    boite.removeItem(cle);
  } catch {
    // Rien à faire de plus.
  }
}

/** Une clé par jeu, par personne connectée et — pour le puissance 4 — par mode. */
const clePartie = (who: Who, mode: ModeLocal) => `${PREFIXE}p4:${who}:${mode}`;
const cleManche = (who: Who) => `${PREFIXE}qec:${who}`;
const cleFile = (jeu: JeuLocal, who: Who) => `${PREFIXE}file:${jeu}:${who}`;

export function nouvelIdLocal(): string {
  const brut = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`;
  return brut.replace(/[^a-z0-9]/gi, "").slice(0, 24);
}

function maintenant(): string {
  return new Date().toISOString();
}

/* ------------------------------- Puissance 4 ------------------------------ */

function estWho(valeur: unknown): valeur is Who {
  return valeur === "alice" || valeur === "joseph";
}

function estCoup(valeur: unknown): valeur is Coup {
  if (!valeur || typeof valeur !== "object") return false;
  const coup = valeur as Record<string, unknown>;
  return (
    estWho(coup.by) &&
    typeof coup.column === "number" &&
    Number.isInteger(coup.column) &&
    coup.column >= 0 &&
    coup.column < 7
  );
}

/** Coups normalisés : une date manquante ne doit pas empêcher de reprendre. */
function nettoieCoups(valeur: unknown): Coup[] {
  if (!Array.isArray(valeur)) return [];
  return valeur
    .filter(estCoup)
    .slice(0, 42)
    .map((coup) => ({
      by: coup.by,
      column: coup.column,
      at: typeof coup.at === "string" ? coup.at : maintenant(),
    }));
}

/** En solo, la machine tient forcément le camp d'en face : celui de l'autre. */
export function nouvellePartieLocale(who: Who, mode: ModeLocal, premier: Who): PartieLocale {
  return {
    v: VERSION_LOCALE,
    id: nouvelIdLocal(),
    mode,
    premier,
    ...(mode === "solo" ? { botSide: autreQue(who) } : {}),
    coups: [],
    enregistree: false,
    majAt: maintenant(),
  };
}

export function litPartieLocale(who: Who, mode: ModeLocal): PartieLocale | null {
  const brut = lire<Partial<PartieLocale>>(clePartie(who, mode));
  if (!brut || brut.v !== VERSION_LOCALE) return null;
  if (typeof brut.id !== "string" || !brut.id) return null;
  if (brut.mode !== mode) return null;
  if (!estWho(brut.premier)) return null;
  if (mode === "solo" && !estWho(brut.botSide)) return null;

  return {
    v: VERSION_LOCALE,
    id: brut.id,
    mode,
    premier: brut.premier,
    ...(mode === "solo" && estWho(brut.botSide) ? { botSide: brut.botSide } : {}),
    coups: nettoieCoups(brut.coups),
    abandonnee: brut.abandonnee === true,
    enregistree: brut.enregistree === true,
    majAt: typeof brut.majAt === "string" ? brut.majAt : maintenant(),
  };
}

/** Les deux modes hors ligne d'un coup, dans l'ordre où on les a touchés. */
export function litPartiesLocales(who: Who): PartieLocale[] {
  return (["local", "solo"] as const)
    .map((mode) => litPartieLocale(who, mode))
    .filter((partie): partie is PartieLocale => partie !== null)
    .sort((a, b) => b.majAt.localeCompare(a.majAt));
}

export function ecrirePartieLocale(who: Who, partie: PartieLocale): void {
  ecrire(clePartie(who, partie.mode), partie);
}

export function effacerPartieLocale(who: Who, mode: ModeLocal): void {
  effacer(clePartie(who, mode));
}

export function chargeDeLaPartie(partie: PartieLocale): ChargePartie {
  return {
    id: partie.id,
    mode: partie.mode,
    premier: partie.premier,
    ...(partie.botSide ? { botSide: partie.botSide } : {}),
    coups: partie.coups,
  };
}

/* ------------------------------- Qui est-ce ? ----------------------------- */

function estEtape(valeur: unknown): valeur is Etape {
  if (!valeur || typeof valeur !== "object") return false;
  const etape = valeur as Record<string, unknown>;
  if (etape.type === "question") {
    return typeof etape.questionId === "string" && typeof etape.reponse === "boolean";
  }
  if (etape.type === "essai") {
    return typeof etape.personneId === "string" && typeof etape.juste === "boolean";
  }
  return false;
}

function nettoieEtapes(valeur: unknown): Etape[] {
  if (!Array.isArray(valeur)) return [];
  return valeur.filter(estEtape).slice(0, 80);
}

export function nouvelleMancheLocale(secretId: string): MancheLocale {
  return {
    v: VERSION_LOCALE,
    id: nouvelIdLocal(),
    secretId,
    etapes: [],
    enregistree: false,
    majAt: maintenant(),
  };
}

export function litMancheLocale(who: Who): MancheLocale | null {
  const brut = lire<Partial<MancheLocale>>(cleManche(who));
  if (!brut || brut.v !== VERSION_LOCALE) return null;
  if (typeof brut.id !== "string" || !brut.id) return null;
  if (typeof brut.secretId !== "string" || !brut.secretId) return null;

  return {
    v: VERSION_LOCALE,
    id: brut.id,
    secretId: brut.secretId,
    etapes: nettoieEtapes(brut.etapes),
    enregistree: brut.enregistree === true,
    majAt: typeof brut.majAt === "string" ? brut.majAt : maintenant(),
  };
}

export function ecrireMancheLocale(who: Who, manche: MancheLocale): void {
  ecrire(cleManche(who), manche);
}

export function effacerMancheLocale(who: Who): void {
  effacer(cleManche(who));
}

export function chargeDeLaManche(manche: MancheLocale): ChargeManche {
  return { id: manche.id, secretPersonId: manche.secretId, etapes: manche.etapes };
}

/* ---------------------------- La file d'attente --------------------------- */

/**
 * Ce que le réseau a refusé.
 *
 * Un résultat mis en file est déjà acquis pour le joueur : l'écran a montré la
 * fin de partie, le compteur suivra dès que la connexion revient. Chaque entrée
 * porte son identifiant, si bien qu'un renvoi en double ne crée jamais deux
 * parties — le serveur reconnaît l'identifiant et ne fait rien.
 *
 * La file appartient à une personne, comme les parties : un résultat d'Alice ne
 * doit pas partir sous la session de Joseph, qui le refuserait à juste titre.
 */
export function empiler<T extends { id: string }>(jeu: JeuLocal, who: Who, entree: T): void {
  const attente = file<T>(jeu, who).filter((autre) => autre.id !== entree.id);
  attente.push(entree);
  ecrire(cleFile(jeu, who), attente.slice(-FILE_MAX));
}

export function file<T extends { id: string }>(jeu: JeuLocal, who: Who): T[] {
  const brut = lire<unknown>(cleFile(jeu, who));
  if (!Array.isArray(brut)) return [];
  return brut.filter(
    (entree): entree is T =>
      Boolean(entree) &&
      typeof entree === "object" &&
      typeof (entree as { id?: unknown }).id === "string",
  );
}

function retirer(jeu: JeuLocal, who: Who, id: string): void {
  const reste = file(jeu, who).filter((entree) => entree.id !== id);
  if (reste.length === 0) effacer(cleFile(jeu, who));
  else ecrire(cleFile(jeu, who), reste);
}

/**
 * Retente ce qui attend. À appeler au montage, sans jamais l'attendre : une
 * connexion absente ne doit pas retarder d'un millième de seconde le premier
 * jeton posé.
 *
 * Un refus argumenté du serveur (`ok: false`) est définitif — il ne changera pas
 * au prochain essai — donc l'entrée sort de la file. Une exception, elle, veut
 * dire « pas de réseau » : on garde tout et on s'arrête là.
 */
export async function viderLaFile<T extends { id: string }>(
  jeu: JeuLocal,
  who: Who,
  envoyer: (entree: T) => Promise<{ ok: boolean }>,
): Promise<void> {
  for (const entree of file<T>(jeu, who)) {
    try {
      await envoyer(entree);
      retirer(jeu, who, entree.id);
    } catch {
      return;
    }
  }
}
