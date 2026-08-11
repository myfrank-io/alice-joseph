"use client";

import { useId, useMemo, useState } from "react";
import { Avatar, cx } from "@/components/ui";
import { formatShortDate, possessive } from "@/lib/format";
import { lecteurPour, ouverturePour } from "@/lib/musique";
import type { Plateforme, Playlist, Track, Who } from "@/lib/types";
import type { Avatars } from "@/components/musique/carte-morceau";
import { LecteurEmbarque } from "@/components/musique/lecteur";
import { MenuMorceau } from "@/components/musique/menu-morceau";
import {
  BoutonEcouter,
  BoutonOuvrirSur,
  Coeurs,
  MentionSansLecteur,
  Pochette,
} from "@/components/musique/parties";

/**
 * Un seul morceau, en grand, tout en haut : le dernier que les deux ont aimé.
 * À défaut, le dernier arrivé — la page ne doit jamais s'ouvrir sur du vide.
 */
export function MorceauDuMoment({
  track,
  who,
  playlists,
  avatars,
  partage,
  plateforme,
}: {
  track: Track;
  who: Who;
  playlists: Playlist[];
  avatars?: Avatars;
  /** Vrai quand les deux ont mis leur cœur : ça change ce qu'on raconte. */
  partage: boolean;
  /** Le service de la personne connectée : il décide du bouton principal. */
  plateforme?: Plateforme;
}) {
  const [joue, setJoue] = useState(false);
  const idLecteur = useId();
  const lecteur = useMemo(() => lecteurPour(track), [track]);
  const ouverture = useMemo(() => ouverturePour(track, plateforme), [track, plateforme]);
  const avatar = track.by === "alice" ? avatars?.alice : avatars?.joseph;

  // Le lien d'origine ne vaut d'être montré que faute de lecteur intégré.
  const ouvre = ouverture && !(ouverture.genre === "origine" && lecteur) ? ouverture : null;

  return (
    <section
      aria-label="Le morceau du moment"
      className="relative overflow-hidden rounded-lg border border-line bg-surface p-4 shadow-[var(--shadow-md)] sm:p-6"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-36"
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in oklab, var(--tint-musique) 45%, transparent), transparent)",
        }}
      />

      <div className="relative">
        <p className="label-caps text-ink-3">Le morceau du moment</p>
        <p className="mt-1 text-[0.8125rem] text-ink-2">
          {partage
            ? "Le dernier que vous avez aimé tous les deux."
            : "Le dernier arrivé dans la bibliothèque."}
        </p>

        {joue && lecteur ? (
          <LecteurEmbarque lecteur={lecteur} id={idLecteur} className="mt-4" />
        ) : (
          <div className="mt-4 flex items-start gap-4 sm:gap-5">
            <Pochette
              src={track.artworkUrl}
              className="size-24 shadow-[var(--shadow-md)] sm:size-32"
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-title text-ink">{track.title}</h2>
              {track.artist ? (
                <p className="mt-1 truncate text-sm text-ink-2">{track.artist}</p>
              ) : null}
              <p className="mt-2.5 flex items-center gap-1.5 text-xs text-ink-3">
                <Avatar who={track.by} src={avatar} size={20} />
                <span className="truncate">
                  Ajouté par {possessive(track.by, who)}, le {formatShortDate(track.createdAt)}
                </span>
              </p>
            </div>
          </div>
        )}

        {track.note ? (
          <p
            className={cx(
              "mt-4 border-l-2 pl-3 font-display text-base italic leading-relaxed text-ink-2",
              "border-line-strong",
            )}
          >
            {track.note}
          </p>
        ) : null}

        {lecteur ? null : <MentionSansLecteur className="mt-4" />}

        <div className="mt-5 flex flex-wrap items-center gap-1">
          <Coeurs trackId={track.id} loves={track.loves} who={who} taille={21} />

          <span className="ml-auto flex items-center gap-1">
            {ouvre ? (
              <BoutonOuvrirSur
                ouverture={ouvre}
                variant={ouvre.genre === "plateforme" ? "primary" : "soft"}
              />
            ) : null}

            {lecteur ? (
              <BoutonEcouter
                joue={joue}
                onToggle={() => setJoue((valeur) => !valeur)}
                controle={idLecteur}
                variant={ouvre?.genre === "plateforme" ? "soft" : "primary"}
                compact={ouvre !== null}
              />
            ) : null}

            <MenuMorceau track={track} playlists={playlists} />
          </span>
        </div>
      </div>
    </section>
  );
}
