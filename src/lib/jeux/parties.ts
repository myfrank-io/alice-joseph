import type { Connect4Game, Connect4State, Doc, Who } from "@/lib/types";
import type { QuiEstCeManche } from "@/lib/jeux/qui-est-ce";

/**
 * La collection `games` mélange les deux jeux : tout passe par ces gardes de
 * type plutôt que par des transtypages disséminés dans les pages.
 */

export function estPuissance4(doc: Doc): doc is Connect4Game {
  return (doc as Connect4Game).kind === "puissance4";
}

export function estQuiEstCe(doc: Doc): doc is QuiEstCeManche {
  return (doc as QuiEstCeManche).kind === "qui-est-ce";
}

/* ------------------------------- Puissance 4 ------------------------------ */

export type ModeP4 = Connect4State["mode"];

export const MODES: { valeur: ModeP4; titre: string; detail: string }[] = [
  {
    valeur: "local",
    titre: "Sur le même téléphone",
    detail: "Chacun son tour, en se passant l’appareil.",
  },
  {
    valeur: "distance",
    titre: "Chacun de son côté",
    detail: "La partie attend. L’autre la reprend quand il peut.",
  },
  {
    valeur: "solo",
    titre: "Contre l’ordinateur",
    detail: "Il réfléchit vite et joue bien. Pas parfaitement.",
  },
];

export function libelleMode(mode: ModeP4): string {
  return MODES.find((m) => m.valeur === mode)?.titre ?? mode;
}

export interface ScoreDuel {
  alice: number;
  joseph: number;
  nulles: number;
}

/**
 * Le score cumulé ne compte que les duels : une partie contre l'ordinateur
 * n'oppose pas Alice à Joseph, elle n'a donc rien à faire dans leur compte.
 */
export function scoreDuels(parties: Connect4Game[]): ScoreDuel {
  const duels = parties.filter((p) => p.status === "terminee" && p.state.mode !== "solo");
  return {
    alice: duels.filter((p) => p.state.winner === "alice").length,
    joseph: duels.filter((p) => p.state.winner === "joseph").length,
    nulles: duels.filter((p) => p.state.draw).length,
  };
}

/** Bilan des parties en solo, du point de vue de la personne connectée. */
export function scoreSolo(parties: Connect4Game[], who: Who): { gagnees: number; jouees: number } {
  const solos = parties.filter((p) => p.status === "terminee" && p.state.mode === "solo");
  const miennes = solos.filter((p) => p.state.botSide && p.state.botSide !== who);
  return {
    gagnees: miennes.filter((p) => p.state.winner === who).length,
    jouees: miennes.length,
  };
}

/** « Alice gagne », « Match nul », « Partie abandonnée ». */
export function resultat(state: Connect4State): string {
  if (state.winner === "alice") return "Alice gagne";
  if (state.winner === "joseph") return "Joseph gagne";
  if (state.draw) return "Match nul";
  return "Partie abandonnée";
}
