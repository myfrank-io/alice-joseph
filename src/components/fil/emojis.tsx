/**
 * Le vocabulaire du fil : six réactions et huit humeurs, pas une de plus.
 *
 * Le jeu est fermé volontairement — à deux, un clavier d'emojis complet ne sert
 * qu'à diluer le geste. Ce module ne contient que des données : il est importé
 * aussi bien par les composants du navigateur que par les actions serveur, qui
 * s'en servent pour valider ce qui arrive du client.
 */

export interface ReactionKind {
  emoji: string;
  /** Nom lisible, pour les lecteurs d'écran et les libellés. */
  name: string;
}

export const REACTIONS: ReactionKind[] = [
  { emoji: "❤️", name: "cœur" },
  { emoji: "😂", name: "fou rire" },
  { emoji: "🥰", name: "tendresse" },
  { emoji: "😮", name: "surprise" },
  { emoji: "🙌", name: "bravo" },
  { emoji: "😤", name: "agacement" },
];

export function reactionName(emoji: string): string {
  return REACTIONS.find((reaction) => reaction.emoji === emoji)?.name ?? "réaction";
}

export interface Mood {
  emoji: string;
  label: string;
}

/** Écriture inclusive pour que les deux puissent piocher dans la même liste. */
export const MOODS: Mood[] = [
  { emoji: "🥰", label: "amoureux·se" },
  { emoji: "🌤️", label: "attendri·e" },
  { emoji: "🛏️", label: "tranquille" },
  { emoji: "🔥", label: "motivé·e" },
  { emoji: "🫠", label: "vidé·e" },
  { emoji: "🌙", label: "nostalgique" },
  { emoji: "☕", label: "au ralenti" },
  { emoji: "🎧", label: "dans ma bulle" },
];

export function findMood(label: string): Mood | undefined {
  return MOODS.find((mood) => mood.label === label);
}
