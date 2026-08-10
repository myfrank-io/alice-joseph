import Link from "next/link";
import { cx } from "@/components/ui";
import { plural } from "@/lib/format";
import { IconMusique } from "@/components/icons";
import type { Playlist, Tint, Track } from "@/lib/types";

/** Pochette d'une playlist : les quatre premières jaquettes, sur sa teinte. */
export function PochetteComposite({
  pochettes,
  tint,
  className,
}: {
  pochettes: string[];
  tint: Tint;
  className?: string;
}) {
  const fond = (part: number) => `color-mix(in oklab, var(--tint-${tint}) ${part}%, var(--surface))`;

  if (pochettes.length === 0) {
    return (
      <span
        className={cx(
          "grid aspect-square w-full place-items-center overflow-hidden rounded-md border border-line text-ink-2",
          className,
        )}
        style={{ background: fond(45) }}
      >
        <IconMusique size={26} />
      </span>
    );
  }

  return (
    <span
      className={cx(
        "grid aspect-square w-full grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-md border border-line",
        className,
      )}
      style={{ background: fond(40) }}
    >
      {[0, 1, 2, 3].map((rang) =>
        pochettes[rang] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={rang}
            src={pochettes[rang]}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          <span key={rang} className="size-full" style={{ background: fond(50 - rang * 9) }} />
        ),
      )}
    </span>
  );
}

/** Les playlists en rangée défilante : on les feuillette du pouce. */
export function RangeePlaylists({
  playlists,
  tracks,
}: {
  playlists: Playlist[];
  tracks: Track[];
}) {
  return (
    <ul className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
      {playlists.map((playlist) => {
        const dedans = tracks.filter((track) => track.playlistIds.includes(playlist.id));
        const pochettes = dedans
          .map((track) => track.artworkUrl)
          .filter((url): url is string => Boolean(url))
          .slice(0, 4);

        return (
          <li key={playlist.id} className="w-36 shrink-0 snap-start sm:w-44">
            <Link
              href={`/musique/${playlist.id}`}
              className="block rounded-md transition-transform hover:-translate-y-0.5"
            >
              <PochetteComposite pochettes={pochettes} tint={playlist.tint} />
              <p className="mt-2 truncate font-display text-[0.9375rem] font-semibold text-ink">
                {playlist.title}
              </p>
              <p className="mt-0.5 text-xs text-ink-3">
                {dedans.length} {plural(dedans.length, "morceau", "morceaux")}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
