import { Fraunces, Manrope } from "next/font/google";

/**
 * Fraunces sert uniquement aux titres. Ses axes SOFT/WONK arrondissent les
 * terminaisons — c'est ce qui donne le côté « doux » sans tomber dans le serif
 * de magazine. Manrope porte toute l'interface : très lisible en petit corps,
 * chiffres tabulaires disponibles.
 */
export const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
});

export const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});
