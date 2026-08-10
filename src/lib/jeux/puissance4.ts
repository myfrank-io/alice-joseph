import type { Connect4Cell, Connect4State, Who } from "@/lib/types";

/**
 * Règles du puissance 4, sans une ligne de React.
 *
 * La grille est indexée `board[colonne][ligne]`, la ligne 0 étant tout en bas :
 * un jeton lâché dans une colonne occupe donc la première ligne libre en partant
 * de zéro, exactement comme la gravité le ferait.
 *
 * Tout ici est pur : le serveur rejoue la partie à partir de la liste des coups
 * plutôt que de faire confiance à un état venu du navigateur.
 */

export const COLONNES = 7;
export const LIGNES = 6;

/** Les quatre directions à explorer. Les opposées sont redondantes. */
const DIRECTIONS: readonly [number, number][] = [
  [1, 0], // horizontale
  [0, 1], // verticale
  [1, 1], // diagonale montante
  [1, -1], // diagonale descendante
];

export type Coup = { by: Who; column: number; at: string };

export interface Victoire {
  who: Who;
  /** Les quatre cases alignées, en [colonne, ligne]. */
  ligne: [number, number][];
}

export function autreQue(who: Who): Who {
  return who === "alice" ? "joseph" : "alice";
}

/* --------------------------------- Grille --------------------------------- */

export function grilleVide(): Connect4Cell[][] {
  return Array.from({ length: COLONNES }, () =>
    Array.from({ length: LIGNES }, () => null as Connect4Cell),
  );
}

function copierGrille(board: Connect4Cell[][]): Connect4Cell[][] {
  return board.map((colonne) => [...colonne]);
}

/** Nombre de jetons déjà empilés dans une colonne. */
export function hauteurColonne(board: Connect4Cell[][], colonne: number): number {
  const pile = board[colonne];
  if (!pile) return LIGNES;
  let hauteur = 0;
  while (hauteur < LIGNES && pile[hauteur] !== null) hauteur += 1;
  return hauteur;
}

export function colonneJouable(board: Connect4Cell[][], colonne: number): boolean {
  return (
    Number.isInteger(colonne) &&
    colonne >= 0 &&
    colonne < COLONNES &&
    hauteurColonne(board, colonne) < LIGNES
  );
}

/** Les colonnes encore ouvertes, tant que la partie n'est pas finie. */
export function coupsPossibles(state: Connect4State): number[] {
  if (state.winner || state.draw) return [];
  const ouvertes: number[] = [];
  for (let c = 0; c < COLONNES; c += 1) {
    if (hauteurColonne(state.board, c) < LIGNES) ouvertes.push(c);
  }
  return ouvertes;
}

/* -------------------------------- Victoire -------------------------------- */

/** La première ligne de quatre trouvée, ou null. */
export function detecterVictoire(board: Connect4Cell[][]): Victoire | null {
  for (let c = 0; c < COLONNES; c += 1) {
    for (let l = 0; l < LIGNES; l += 1) {
      const who = board[c][l];
      if (!who) continue;

      for (const [dc, dl] of DIRECTIONS) {
        const cFin = c + 3 * dc;
        const lFin = l + 3 * dl;
        if (cFin < 0 || cFin >= COLONNES || lFin < 0 || lFin >= LIGNES) continue;

        if (
          board[c + dc][l + dl] === who &&
          board[c + 2 * dc][l + 2 * dl] === who &&
          board[cFin][lFin] === who
        ) {
          return {
            who,
            ligne: [
              [c, l],
              [c + dc, l + dl],
              [c + 2 * dc, l + 2 * dl],
              [cFin, lFin],
            ],
          };
        }
      }
    }
  }
  return null;
}

/** Grille pleine sans vainqueur. */
export function estNulle(board: Connect4Cell[][]): boolean {
  for (let c = 0; c < COLONNES; c += 1) {
    if (board[c][LIGNES - 1] === null) return false;
  }
  return detecterVictoire(board) === null;
}

/* ------------------------------- Jouer un coup ---------------------------- */

/**
 * Applique un coup et renvoie le nouvel état, ou null si le coup est refusé
 * (partie finie, colonne pleine ou hors grille, ou ce n'est pas son tour).
 */
export function jouer(state: Connect4State, colonne: number, who: Who): Connect4State | null {
  if (state.winner || state.draw) return null;
  if (who !== state.turn) return null;
  if (!colonneJouable(state.board, colonne)) return null;

  const board = copierGrille(state.board);
  board[colonne][hauteurColonne(board, colonne)] = who;

  const victoire = detecterVictoire(board);
  const nulle = victoire === null && estNulle(board);

  return {
    ...state,
    board,
    turn: autreQue(who),
    moves: [...state.moves, { by: who, column: colonne, at: new Date().toISOString() }],
    winner: victoire?.who ?? null,
    winningLine: victoire?.ligne ?? null,
    draw: nulle,
  };
}

/**
 * Rejoue une partie entière depuis sa liste de coups.
 *
 * C'est la seule fabrique d'état utilisée côté serveur : annuler un coup revient
 * à retirer la dernière entrée puis à tout rejouer, ce qui rend impossible une
 * grille incohérente avec son historique.
 */
export function etatDepuisCoups(
  coups: Coup[],
  base: { premier: Who; mode: Connect4State["mode"]; botSide?: Who },
): Connect4State {
  const board = grilleVide();
  const retenus: Coup[] = [];
  let tour = base.premier;

  for (const coup of coups) {
    if (coup.by !== tour) continue;
    if (!colonneJouable(board, coup.column)) continue;
    board[coup.column][hauteurColonne(board, coup.column)] = coup.by;
    retenus.push(coup);
    tour = autreQue(tour);
    if (detecterVictoire(board)) break;
  }

  const victoire = detecterVictoire(board);
  const nulle = victoire === null && estNulle(board);

  return {
    board,
    turn: tour,
    moves: retenus,
    winner: victoire?.who ?? null,
    winningLine: victoire?.ligne ?? null,
    draw: nulle,
    mode: base.mode,
    ...(base.botSide ? { botSide: base.botSide } : {}),
  };
}

export function nouvellePartie(
  premier: Who,
  mode: Connect4State["mode"],
  botSide?: Who,
): Connect4State {
  return etatDepuisCoups([], { premier, mode, botSide });
}

/* --------------------------------------------------------------------------
   L'ordinateur : minimax avec élagage alpha-bêta.

   La grille passe dans une représentation plate (0 vide, 1 le joueur au trait,
   2 son adversaire) : la recherche descend à quelques dizaines de milliers de
   nœuds, et une grille de tableaux de chaînes y coûterait dix fois plus cher.
-------------------------------------------------------------------------- */

const IDX = (c: number, l: number) => c * LIGNES + l;

/** Les 69 fenêtres de quatre cases alignées, calculées une fois pour toutes. */
const FENETRES: number[][] = (() => {
  const out: number[][] = [];
  for (let c = 0; c < COLONNES; c += 1) {
    for (let l = 0; l < LIGNES; l += 1) {
      for (const [dc, dl] of DIRECTIONS) {
        const cFin = c + 3 * dc;
        const lFin = l + 3 * dl;
        if (cFin < 0 || cFin >= COLONNES || lFin < 0 || lFin >= LIGNES) continue;
        out.push([
          IDX(c, l),
          IDX(c + dc, l + dl),
          IDX(c + 2 * dc, l + 2 * dl),
          IDX(cFin, lFin),
        ]);
      }
    }
  }
  return out;
})();

/** Les colonnes centrales d'abord : l'élagage coupe beaucoup plus tôt. */
const ORDRE = [3, 2, 4, 1, 5, 0, 6];

const GAIN = 1_000_000;
const TROIS = 60;
const DEUX = 12;
const TROIS_ADVERSE = 75;
const DEUX_ADVERSE = 14;
const CENTRE = 7;
const PRES_DU_CENTRE = 3;

interface Plateau {
  cases: Int8Array;
  hauteurs: Int8Array;
  coups: number;
}

function versPlateau(board: Connect4Cell[][], moi: Who): Plateau {
  const cases = new Int8Array(COLONNES * LIGNES);
  const hauteurs = new Int8Array(COLONNES);
  let coups = 0;
  for (let c = 0; c < COLONNES; c += 1) {
    for (let l = 0; l < LIGNES; l += 1) {
      const valeur = board[c][l];
      if (!valeur) break;
      cases[IDX(c, l)] = valeur === moi ? 1 : 2;
      hauteurs[c] = l + 1;
      coups += 1;
    }
  }
  return { cases, hauteurs, coups };
}

/** Score de la position pour le joueur 1, du point de vue positionnel seul. */
function evaluer(plateau: Plateau): number {
  const { cases } = plateau;
  let score = 0;

  for (const fenetre of FENETRES) {
    let miens = 0;
    let siens = 0;
    for (const index of fenetre) {
      const valeur = cases[index];
      if (valeur === 1) miens += 1;
      else if (valeur === 2) siens += 1;
    }
    if (miens && siens) continue; // fenêtre bouchée des deux côtés : sans valeur
    if (miens === 3) score += TROIS;
    else if (miens === 2) score += DEUX;
    else if (siens === 3) score -= TROIS_ADVERSE;
    else if (siens === 2) score -= DEUX_ADVERSE;
  }

  for (const [colonne, poids] of [
    [3, CENTRE],
    [2, PRES_DU_CENTRE],
    [4, PRES_DU_CENTRE],
  ] as const) {
    for (let l = 0; l < plateau.hauteurs[colonne]; l += 1) {
      const valeur = cases[IDX(colonne, l)];
      if (valeur === 1) score += poids;
      else if (valeur === 2) score -= poids;
    }
  }

  return score;
}

/** Le jeton qu'on vient de poser en (colonne, ligne) ferme-t-il un alignement ? */
function gagneEn(plateau: Plateau, colonne: number, ligne: number, joueur: number): boolean {
  for (const [dc, dl] of DIRECTIONS) {
    let total = 1;
    for (const sens of [1, -1]) {
      let c = colonne + dc * sens;
      let l = ligne + dl * sens;
      while (
        c >= 0 &&
        c < COLONNES &&
        l >= 0 &&
        l < LIGNES &&
        plateau.cases[IDX(c, l)] === joueur
      ) {
        total += 1;
        if (total >= 4) return true;
        c += dc * sens;
        l += dl * sens;
      }
    }
  }
  return false;
}

class TempsEcoule extends Error {}

let compteurNoeuds = 0;

function negamax(
  plateau: Plateau,
  joueur: number,
  profondeur: number,
  alpha: number,
  beta: number,
  echeance: number,
): number {
  compteurNoeuds += 1;
  if ((compteurNoeuds & 0x3ff) === 0 && Date.now() > echeance) throw new TempsEcoule();

  if (plateau.coups >= COLONNES * LIGNES) return 0;
  if (profondeur === 0) {
    const score = evaluer(plateau);
    return joueur === 1 ? score : -score;
  }

  let meilleur = -Infinity;
  let jouable = false;

  for (const colonne of ORDRE) {
    const ligne = plateau.hauteurs[colonne];
    if (ligne >= LIGNES) continue;
    jouable = true;

    plateau.cases[IDX(colonne, ligne)] = joueur;
    plateau.hauteurs[colonne] = ligne + 1;
    plateau.coups += 1;

    let score: number;
    if (gagneEn(plateau, colonne, ligne, joueur)) {
      // Une victoire proche vaut mieux qu'une victoire lointaine.
      score = GAIN + profondeur;
    } else {
      score = -negamax(plateau, joueur === 1 ? 2 : 1, profondeur - 1, -beta, -alpha, echeance);
    }

    plateau.cases[IDX(colonne, ligne)] = 0;
    plateau.hauteurs[colonne] = ligne;
    plateau.coups -= 1;

    if (score > meilleur) meilleur = score;
    if (meilleur > alpha) alpha = meilleur;
    if (alpha >= beta) break;
  }

  return jouable ? meilleur : 0;
}

export interface OptionsBot {
  /** Profondeur visée. La recherche s'arrête plus tôt si le temps manque. */
  profondeur?: number;
  /** Budget de réflexion, garde-fou dur. */
  budgetMs?: number;
  /**
   * Marge en dessous du meilleur score dans laquelle un coup reste acceptable :
   * l'ordinateur y pioche au hasard. C'est ce qui le rend battable et vivant,
   * sans jamais lui faire laisser passer une victoire ni un alignement adverse.
   */
  marge?: number;
  /** Injectable pour les tests. */
  hasard?: () => number;
}

/**
 * Le coup de l'ordinateur pour le joueur au trait, ou null si la partie est finie.
 *
 * Approfondissement itératif : on garde toujours le dernier niveau terminé, si
 * bien que le garde-fou de temps ne peut jamais renvoyer un coup non évalué.
 */
export function meilleurCoup(state: Connect4State, options: OptionsBot = {}): number | null {
  const {
    profondeur = 6,
    budgetMs = 280,
    marge = 25,
    hasard = Math.random,
  } = options;

  const ouvertes = coupsPossibles(state);
  if (ouvertes.length === 0) return null;

  const moi = state.turn;
  const plateau = versPlateau(state.board, moi);

  // 1. Gagner tout de suite si c'est possible.
  //    2. Sinon, empêcher l'adversaire de gagner au coup suivant.
  //    Ces deux cas sont forcés : inutile de les chercher, et le garde-fou de
  //    temps ne peut donc jamais faire manquer l'évidence.
  for (const joueur of [1, 2] as const) {
    for (const colonne of ORDRE) {
      if (!ouvertes.includes(colonne)) continue;
      const ligne = plateau.hauteurs[colonne];
      poser(plateau, colonne, joueur);
      const gagne = gagneEn(plateau, colonne, ligne, joueur);
      retirer(plateau, colonne);
      if (gagne) return colonne;
    }
  }

  const echeance = Date.now() + budgetMs;
  let scores = new Map<number, number>();
  compteurNoeuds = 0;

  for (let niveau = 3; niveau <= Math.max(3, profondeur); niveau += 1) {
    const tour = new Map<number, number>();
    try {
      const ordre = [...ORDRE].filter((c) => ouvertes.includes(c));
      // On commence par le meilleur coup du niveau précédent.
      ordre.sort((a, b) => (scores.get(b) ?? -Infinity) - (scores.get(a) ?? -Infinity));

      for (const colonne of ordre) {
        const ligne = plateau.hauteurs[colonne];
        poser(plateau, colonne, 1);
        // Fenêtre entière à la racine : les scores doivent être exacts pour
        // que le tirage à la marge ci-dessous ait un sens.
        const score = gagneEn(plateau, colonne, ligne, 1)
          ? GAIN + niveau
          : -negamax(plateau, 2, niveau - 1, -Infinity, Infinity, echeance);
        retirer(plateau, colonne);
        tour.set(colonne, score);
      }
      scores = tour;
    } catch (erreur) {
      if (!(erreur instanceof TempsEcoule)) throw erreur;
      break;
    }
    if (Date.now() > echeance) break;
  }

  if (scores.size === 0) return ouvertes[0];

  const meilleur = Math.max(...scores.values());
  // La marge ne s'applique jamais à une position tranchée : victoire ou défaite
  // forcée, l'ordinateur joue le coup exact.
  const tolerance = Math.abs(meilleur) > GAIN / 2 ? 0 : marge;
  const acceptables = [...scores.entries()]
    .filter(([, score]) => score >= meilleur - tolerance)
    .map(([colonne]) => colonne);

  return acceptables[Math.floor(hasard() * acceptables.length)] ?? acceptables[0];
}

function poser(plateau: Plateau, colonne: number, joueur: number): void {
  const ligne = plateau.hauteurs[colonne];
  plateau.cases[IDX(colonne, ligne)] = joueur;
  plateau.hauteurs[colonne] = ligne + 1;
  plateau.coups += 1;
}

function retirer(plateau: Plateau, colonne: number): void {
  const ligne = plateau.hauteurs[colonne] - 1;
  if (ligne < 0) return;
  plateau.cases[IDX(colonne, ligne)] = 0;
  plateau.hauteurs[colonne] = ligne;
  plateau.coups -= 1;
}
