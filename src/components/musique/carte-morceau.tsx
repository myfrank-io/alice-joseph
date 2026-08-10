"use client";

import { useId, useMemo, useState } from "react";
import { Avatar, cardClass, cx } from "@/components/ui";
import { possessive } from "@/lib/format";
import { estLienSur, lecteurPour } from "@/lib/musique";
import type { Playlist, Track, Who } from "@/lib/types";
import { LecteurEmbarque } from "@/components/musique/lecteur";
import { MenuMorceau } from "@/components/musique/menu-morceau";
import {
  BoutonEcouter,
  Coeurs,
  LienDuService,
  Pochette,
} from "@/components/musique/parties";

export interface Avatars {
  alice?: string;
  joseph?: string;
}

/**
 * La carte d'un morceau. Elle porte la pochette, le titre, l'artiste, qui l'a
 * ajouté, les deux cœurs — et surtout la note, qui est la seule chose qu'une
 * plateforme de streaming ne saura jamais garder à notre place.
 */
export function CarteMorceau({
  track,
  who,
  playlists,
  playlistId,
  index,
  avatars,
}: {
  track: Track;
  who: Who;
  playlists: Playlist[];
  /** Sur la page d'une playlist : permet le retrait depuis le menu. */
  playlistId?: string;
  /** Numéro d'ordre, affiché dans une liste ordonnée. */
  index?: number;
  avatars?: Avatars;
}) {
  const [joue, setJoue] = useState(false);
  const idLecteur = useId();
  const lecteur = useMemo(() => lecteurPour(track), [track]);
  const avatar = track.by === "alice" ? avatars?.alice : avatars?.joseph;

  return (
    <article className={cx(cardClass, "flex gap-3 p-3.5")}>
      {typeof index === "number" ? (
        <span className="tabular w-5 shrink-0 pt-1 text-right text-xs font-bold text-ink-3">
          {index}
        </span>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {joue && lecteur ? (
          <LecteurEmbarque lecteur={lecteur} id={idLecteur} />
        ) : (
          <div className="flex items-start gap-3">
            <Pochette src={track.artworkUrl} className="size-16" />
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-[1.0625rem] leading-snug text-ink">{track.title}</h3>
              {track.artist ? (
                <p className="mt-0.5 truncate text-sm text-ink-2">{track.artist}</p>
              ) : null}
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-3">
                <Avatar who={track.by} src={avatar} size={18} />
                Ajouté par {possessive(track.by, who)}
              </p>
            </div>
          </div>
        )}

        {track.note ? (
          <p className="border-l-2 border-line-strong pl-3 font-display text-[0.9375rem] italic leading-relaxed text-ink-2">
            {track.note}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1">
          <Coeurs trackId={track.id} loves={track.loves} who={who} />

          <span className="ml-auto flex items-center gap-1">
            {lecteur ? (
              <BoutonEcouter
                joue={joue}
                onToggle={() => setJoue((valeur) => !valeur)}
                controle={idLecteur}
              />
            ) : estLienSur(track.url) ? (
              <LienDuService url={track.url} provider={track.provider} titre={track.title} />
            ) : null}

            <MenuMorceau track={track} playlists={playlists} playlistId={playlistId} />
          </span>
        </div>
      </div>
    </article>
  );
}
