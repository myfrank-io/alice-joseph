"use client";

import { useEffect, useState } from "react";
import type { Who } from "@/lib/types";
import { etatDepuisCoups } from "@/lib/jeux/puissance4";
import { ERREURS_MAX } from "@/lib/jeux/qui-est-ce";
import { litMancheLocale, litPartiesLocales } from "@/lib/jeux/local";
import { cx } from "@/components/ui";
import { plural } from "@/lib/format";

/**
 * Ce que le hall ne peut pas savoir tout seul.
 *
 * Depuis que les jeux se jouent hors ligne, une partie en cours n'existe souvent
 * nulle part ailleurs que dans ce navigateur : le serveur qui rend la page
 * répondrait « aucune partie » alors qu'une grille attend dans le stockage.
 *
 * Ces deux composants affichent d'abord ce que le serveur a calculé — c'est ce
 * qui part dans le HTML, donc aucune divergence à l'hydratation — puis, une fois
 * montés, le remplacent par ce qu'ils trouvent sur l'appareil.
 */

export type JeuDeLaCarte = "puissance4" | "qui-est-ce";

interface Reprise {
  texte: string;
  appel: string;
}

function repriseP4(who: Who): Reprise | null {
  for (const partie of litPartiesLocales(who)) {
    const etat = etatDepuisCoups(partie.coups, {
      premier: partie.premier,
      mode: partie.mode,
      botSide: partie.botSide,
    });
    if (etat.winner || etat.draw || partie.abandonnee) continue;

    const tour =
      partie.mode === "solo"
        ? etat.turn === partie.botSide
          ? "L’ordinateur réfléchit"
          : "À toi de jouer"
        : etat.turn === "alice"
          ? "Au tour d’Alice"
          : "Au tour de Joseph";

    return { texte: `Partie en cours · ${tour}`, appel: "Reprendre la partie" };
  }
  return null;
}

function repriseQec(who: Who): Reprise | null {
  const manche = litMancheLocale(who);
  if (!manche) return null;

  const essais = manche.etapes.filter((etape) => etape.type === "essai");
  if (essais.some((etape) => etape.juste)) return null;
  if (essais.length >= ERREURS_MAX) return null;

  const posees = manche.etapes.filter((etape) => etape.type === "question").length;
  return {
    texte: `Manche en cours · ${posees} ${plural(posees, "question posée", "questions posées")}`,
    appel: "Reprendre la manche",
  };
}

/**
 * `serveurVif` fait autorité : quand quelque chose attend vraiment de l'autre
 * côté — l'autre qui a joué son coup, un défi posé — cela passe devant une
 * partie qu'on garde pour soi dans ce navigateur.
 */
function useReprise(jeu: JeuDeLaCarte, who: Who, serveurVif: boolean): Reprise | null {
  const [reprise, setReprise] = useState<Reprise | null>(null);

  useEffect(() => {
    setReprise(jeu === "puissance4" ? repriseP4(who) : repriseQec(who));
  }, [jeu, who]);

  return serveurVif ? null : reprise;
}

export function EtatJeu({
  jeu,
  who,
  defaut,
}: {
  jeu: JeuDeLaCarte;
  who: Who;
  defaut: { vif: boolean; texte: string };
}) {
  const reprise = useReprise(jeu, who, defaut.vif);

  return (
    <p className="flex items-center gap-2 text-[0.8125rem] font-semibold text-ink">
      <span
        aria-hidden="true"
        className={cx(
          "size-2 shrink-0 rounded-full",
          reprise || defaut.vif ? "bg-accent" : "bg-line-strong",
        )}
      />
      {reprise?.texte ?? defaut.texte}
    </p>
  );
}

export function AppelJeu({
  jeu,
  who,
  defaut,
  serveurVif = false,
}: {
  jeu: JeuDeLaCarte;
  who: Who;
  defaut: string;
  serveurVif?: boolean;
}) {
  const reprise = useReprise(jeu, who, serveurVif);
  return <>{reprise?.appel ?? defaut}</>;
}
