"use client";

import { useState, useTransition } from "react";
import { choisirPlateforme } from "@/app/(app)/musique/actions";
import { Button, cx } from "@/components/ui";
import { whoLabel } from "@/lib/format";
import { PLATEFORMES, nomPlateforme } from "@/lib/musique";
import type { Plateforme, Who } from "@/lib/types";

/**
 * « Tu écoutes sur… »
 *
 * Toute l'app Musique tient à ce réglage : c'est lui qui décide si le bouton
 * d'un morceau dit « Écouter sur Deezer » ou « Écouter sur Spotify ». Chacun ne
 * règle que le sien — l'action serveur ne lit que le cookie de session, jamais
 * une identité venue d'ici.
 *
 * Il vit dans l'app Musique, et pas dans Réglages, parce que c'est là qu'on
 * s'en aperçoit : le jour où le bouton propose le mauvais service, le remède
 * est à portée de pouce. Une fois choisi, il se replie en une seule ligne.
 */
export function ChoixPlateforme({
  plateforme,
  autre,
  plateformeAutre,
}: {
  /** Ce que la personne connectée a déjà choisi, s'il y a lieu. */
  plateforme?: Plateforme;
  /** L'autre personne : on dit sur quoi elle écoute, ça évite de demander. */
  autre: Who;
  plateformeAutre?: Plateforme;
}) {
  // Choix optimiste : le serveur revalide juste après, mais le doigt a raison.
  const [choix, setChoix] = useState<Plateforme | undefined>(plateforme);
  const [ouvert, setOuvert] = useState(!plateforme);
  const [enCours, demarrer] = useTransition();

  const surAutre = plateformeAutre
    ? `${whoLabel(autre)} écoute sur ${nomPlateforme(plateformeAutre)}.`
    : `${whoLabel(autre)} ne l’a pas encore dit.`;

  return (
    <section
      aria-label="Le service sur lequel tu écoutes"
      className="rounded-lg border border-line bg-surface p-4 shadow-[var(--shadow-sm)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="label-caps text-ink-3">Tu écoutes sur</h2>
          <p className="mt-1 text-sm text-ink">
            {choix ? (
              <span className="font-display text-[1.0625rem] text-ink">
                {nomPlateforme(choix)}
              </span>
            ) : (
              <span className="text-ink-2">à préciser</span>
            )}
            <span className="ml-2 text-xs text-ink-3">{surAutre}</span>
          </p>
        </div>

        {choix ? (
          <Button
            type="button"
            variant="ghost"
            size="md"
            className="h-11"
            aria-expanded={ouvert}
            onClick={() => setOuvert((valeur) => !valeur)}
          >
            {ouvert ? "Fermer" : "Changer"}
          </Button>
        ) : null}
      </div>

      {ouvert ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {PLATEFORMES.map((option) => {
              const actif = option === choix;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={actif}
                  disabled={enCours}
                  onClick={() => {
                    setChoix(option);
                    setOuvert(false);
                    if (actif) return;
                    demarrer(async () => {
                      await choisirPlateforme(option);
                    });
                  }}
                  className={cx(
                    "flex h-11 items-center whitespace-nowrap rounded-full border px-4 text-sm font-semibold",
                    "transition-colors disabled:opacity-60",
                    actif
                      ? "border-accent bg-accent-soft text-accent-ink"
                      : "border-line bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink",
                  )}
                >
                  {nomPlateforme(option)}
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-xs leading-relaxed text-ink-3">
            Chaque morceau s’ouvrira dans ton application, quel que soit le service depuis lequel
            il a été collé. Ce réglage n’est que le tien.
          </p>
        </>
      ) : null}
    </section>
  );
}
