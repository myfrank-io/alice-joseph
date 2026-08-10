/** Identifiants des deux seules personnes qui utilisent la plateforme. */
export type Who = "alice" | "joseph";

/** Auteur d'un souvenir : l'un des deux, ou les deux ensemble. */
export type WhoOrBoth = Who | "les-deux";

export interface Doc {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/* --------------------------------- Le fil --------------------------------- */

export interface Reaction {
  by: Who;
  emoji: string;
  at: string;
}

export interface Comment {
  id: string;
  by: Who;
  body: string;
  at: string;
}

export interface Post extends Doc {
  by: Who;
  body: string;
  photoIds: string[];
  /** Humeur du jour, facultative : un mot + un emoji. */
  mood?: { emoji: string; label: string };
  reactions: Reaction[];
  comments: Comment[];
  pinned: boolean;
}

/* --------------------------------- Photos --------------------------------- */

export interface Photo extends Doc {
  url: string;
  /** Miniature générée à l'upload (data URL en mode démo, Blob en production). */
  thumbUrl: string;
  width: number;
  height: number;
  caption?: string;
  /** Lieu écrit à la main, indépendant de la carte. */
  place?: string;
  takenAt?: string;
  by: Who;
  favorite: boolean;
  albumIds: string[];
}

export interface Album extends Doc {
  title: string;
  description?: string;
  coverPhotoId?: string;
  by: Who;
}

/* -------------------------------- Musique --------------------------------- */

export type MusicProvider = "spotify" | "youtube" | "deezer" | "apple" | "autre";

export interface Track extends Doc {
  provider: MusicProvider;
  /** Identifiant chez le fournisseur, utilisé pour construire le lecteur intégré. */
  providerId: string;
  url: string;
  title: string;
  artist?: string;
  artworkUrl?: string;
  by: Who;
  /** Le mot qui explique pourquoi ce morceau est là. C'est tout l'intérêt. */
  note?: string;
  playlistIds: string[];
  loves: Who[];
}

export type Tint = "fil" | "photos" | "musique" | "carte" | "jeux";

export interface Playlist extends Doc {
  title: string;
  description?: string;
  tint: Tint;
  by: Who;
}

/* --------------------------------- Carte ---------------------------------- */

export interface Place extends Doc {
  name: string;
  country: string;
  lat: number;
  lng: number;
  kind: "visite" | "envie";
  /** Date du séjour, au format AAAA-MM-JJ ou AAAA-MM. */
  visitedAt?: string;
  note?: string;
  photoIds: string[];
  by: Who;
  with: WhoOrBoth;
}

/* ---------------------------- Jeux : qui est-ce --------------------------- */

export type HairColor = "brun" | "blond" | "roux" | "noir" | "gris" | "chauve";
export type Circle = "famille" | "amis" | "travail" | "etudes" | "voisinage";

export interface PersonTraits {
  /** Par qui on connaît cette personne — l'attribut le plus utile du jeu. */
  cote: WhoOrBoth;
  cercle: Circle;
  cheveux: HairColor;
  cheveuxLongs: boolean;
  lunettes: boolean;
  barbe: boolean;
  chapeau: boolean;
}

export interface Person extends Doc {
  name: string;
  photoUrl?: string;
  thumbUrl?: string;
  /** Une phrase pour se souvenir de qui c'est. */
  hint?: string;
  traits: PersonTraits;
  by: Who;
}

/* ------------------------------ Jeux : parties ---------------------------- */

/** Grille 7 colonnes × 6 lignes, indexée [colonne][ligne], ligne 0 en bas. */
export type Connect4Cell = Who | null;

export interface Connect4State {
  board: Connect4Cell[][];
  turn: Who;
  moves: { by: Who; column: number; at: string }[];
  winner: Who | null;
  /** Les quatre cases gagnantes, pour les mettre en valeur. */
  winningLine: [number, number][] | null;
  draw: boolean;
  /** « local » : même téléphone. « distance » : chacun chez soi. « solo » : contre la machine. */
  mode: "local" | "distance" | "solo";
  /** En solo, le camp tenu par la machine. */
  botSide?: Who;
}

export interface Connect4Game extends Doc {
  kind: "puissance4";
  state: Connect4State;
  status: "en-cours" | "terminee";
  startedBy: Who;
}

export interface QuiEstCeRound extends Doc {
  kind: "qui-est-ce";
  player: Who;
  /** Qui a posé la devinette : l'autre, ou le hasard. */
  setBy: Who | "hasard";
  secretPersonId: string;
  questionsAsked: number;
  status: "en-cours" | "gagnee" | "perdue";
  eliminated: string[];
}

/* ------------------------------- Réglages --------------------------------- */

export interface Settings extends Doc {
  /** Date de début du couple, sert au compteur de la page d'accueil. */
  since?: string;
  aliceLabel: string;
  josephLabel: string;
  aliceAvatar?: string;
  josephAvatar?: string;
}
