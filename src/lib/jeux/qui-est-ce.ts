import type { Circle, HairColor, Person, PersonTraits, QuiEstCeRound } from "@/lib/types";

/**
 * Le moteur du « qui est-ce ? ».
 *
 * Une question n'est qu'un prédicat sur les attributs d'une personne. Poser une
 * question revient à demander la valeur de ce prédicat pour la personne secrète,
 * puis à écarter tous ceux qui répondent autrement — l'élimination est donc une
 * conséquence mécanique, jamais un choix de l'interface.
 */

export type GroupeQuestion = "cote" | "cercle" | "cheveux" | "allure";

export interface Question {
  id: string;
  libelle: string;
  groupe: GroupeQuestion;
  test: (traits: PersonTraits) => boolean;
}

const CERCLES: [Circle, string][] = [
  ["famille", "De la famille ?"],
  ["amis", "Dans nos amis ?"],
  ["travail", "Du travail ?"],
  ["etudes", "Des années d’études ?"],
  ["voisinage", "Du voisinage ?"],
];

const CHEVEUX: [HairColor, string][] = [
  ["brun", "Cheveux bruns ?"],
  ["blond", "Cheveux blonds ?"],
  ["noir", "Cheveux noirs ?"],
  ["roux", "Cheveux roux ?"],
  ["gris", "Cheveux gris ?"],
  ["chauve", "Sans cheveux ?"],
];

/**
 * Le côté est volontairement découpé en trois questions qui se recoupent :
 * « du côté d'Alice » englobe les personnes que les deux connaissent, ce qui
 * rend la troisième question utile même après les deux premières.
 */
export const QUESTIONS: Question[] = [
  {
    id: "cote-alice",
    libelle: "Du côté d’Alice ?",
    groupe: "cote",
    test: (t) => t.cote === "alice" || t.cote === "les-deux",
  },
  {
    id: "cote-joseph",
    libelle: "Du côté de Joseph ?",
    groupe: "cote",
    test: (t) => t.cote === "joseph" || t.cote === "les-deux",
  },
  {
    id: "cote-deux",
    libelle: "Des deux côtés ?",
    groupe: "cote",
    test: (t) => t.cote === "les-deux",
  },
  ...CERCLES.map(([valeur, libelle]) => ({
    id: `cercle-${valeur}`,
    libelle,
    groupe: "cercle" as const,
    test: (t: PersonTraits) => t.cercle === valeur,
  })),
  ...CHEVEUX.map(([valeur, libelle]) => ({
    id: `cheveux-${valeur}`,
    libelle,
    groupe: "cheveux" as const,
    test: (t: PersonTraits) => t.cheveux === valeur,
  })),
  { id: "cheveux-longs", libelle: "Cheveux longs ?", groupe: "allure", test: (t) => t.cheveuxLongs },
  { id: "lunettes", libelle: "Des lunettes ?", groupe: "allure", test: (t) => t.lunettes },
  { id: "barbe", libelle: "Une barbe ?", groupe: "allure", test: (t) => t.barbe },
  { id: "chapeau", libelle: "Un chapeau ?", groupe: "allure", test: (t) => t.chapeau },
];

const PAR_ID = new Map(QUESTIONS.map((question) => [question.id, question]));

export function question(id: string): Question | null {
  return PAR_ID.get(id) ?? null;
}

/* --------------------------------- Manche --------------------------------- */

export type Etape =
  | { type: "question"; questionId: string; reponse: boolean; elimines: number }
  | { type: "essai"; personneId: string; juste: boolean };

/**
 * Une manche telle qu'on la range vraiment : `QuiEstCeRound` plus l'historique
 * des coups, indispensable au récapitulatif de fin. Le champ est facultatif pour
 * que les manches enregistrées sans lui restent lisibles.
 */
export interface QuiEstCeManche extends QuiEstCeRound {
  etapes?: Etape[];
}

/** Une erreur coûte deux questions ; à la troisième, la manche est perdue. */
export const PENALITE_ERREUR = 2;
export const ERREURS_MAX = 3;

export function erreursDe(manche: QuiEstCeManche): number {
  return (manche.etapes ?? []).filter((etape) => etape.type === "essai" && !etape.juste).length;
}

/** Les visages encore en lice, dans l'ordre du paquet. */
export function candidats(paquet: Person[], elimines: string[]): Person[] {
  const ecartes = new Set(elimines);
  return paquet.filter((personne) => !ecartes.has(personne.id));
}

/* ------------------------------- Questions -------------------------------- */

export interface QuestionUtile {
  question: Question;
  /** Nombre de candidats pour lesquels la réponse serait « oui ». */
  oui: number;
  non: number;
}

/**
 * Les seules questions qui valent la peine d'être posées : celles dont la
 * réponse écarte au moins un candidat, triées de la plus tranchante à la moins
 * tranchante — celle qui coupe le paquet le plus près de la moitié d'abord.
 *
 * Une question déjà posée disparaît d'elle-même : tous les candidats restants y
 * répondent pareil, donc elle ne sépare plus rien.
 */
export function questionsUtiles(restants: Person[]): QuestionUtile[] {
  const total = restants.length;
  if (total <= 1) return [];

  return QUESTIONS.map((q) => {
    const oui = restants.reduce((n, personne) => n + (q.test(personne.traits) ? 1 : 0), 0);
    return { question: q, oui, non: total - oui };
  })
    .filter(({ oui }) => oui > 0 && oui < total)
    .sort((a, b) => Math.abs(a.oui - total / 2) - Math.abs(b.oui - total / 2));
}

/** Les identifiants à écarter une fois la réponse connue. */
export function aEcarter(restants: Person[], q: Question, reponse: boolean): string[] {
  return restants
    .filter((personne) => q.test(personne.traits) !== reponse)
    .map((personne) => personne.id);
}

/* --------------------------------- Scores --------------------------------- */

export interface ScoreQuiEstCe {
  jouees: number;
  gagnees: number;
  /** Le plus petit nombre de questions sur une manche gagnée. */
  meilleur: number | null;
}

export function scoreQuiEstCe(manches: QuiEstCeManche[]): ScoreQuiEstCe {
  const finies = manches.filter((m) => m.status !== "en-cours");
  const gagnees = finies.filter((m) => m.status === "gagnee");
  const meilleur = gagnees.reduce<number | null>(
    (min, m) => (min === null || m.questionsAsked < min ? m.questionsAsked : min),
    null,
  );
  return { jouees: finies.length, gagnees: gagnees.length, meilleur };
}

/** « en 5 questions », « en 1 question ». */
export function formuleQuestions(nombre: number): string {
  return `${nombre} question${nombre > 1 ? "s" : ""}`;
}
