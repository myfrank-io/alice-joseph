"use client";

import { useEffect, useMemo, useState } from "react";
import type { Album, Photo } from "@/lib/types";
import { cx } from "@/components/ui";
import { IconCoeur } from "@/components/icons";
import { Visionneuse } from "@/components/photos/viewer";
import { grouperParMois, resumeMoment } from "@/components/photos/shared";

/**
 * La galerie : une grille dense, et une visionneuse qui parcourt exactement la
 * liste affichée. En vue « moments », chaque mois garde son décalage dans la
 * liste complète — les flèches traversent donc les mois sans à-coup.
 */
export function Galerie({
  photos,
  albums,
  album,
  groupee = false,
}: {
  photos: Photo[];
  albums: Album[];
  /** Renseigné sur une page d'album : ouvre les actions propres à l'album. */
  album?: Album;
  groupee?: boolean;
}) {
  const [ouverte, setOuverte] = useState<number | null>(null);

  /* Une suppression raccourcit la liste : on ne reste jamais sur un trou. */
  useEffect(() => {
    setOuverte((actuelle) => {
      if (actuelle === null) return null;
      if (photos.length === 0) return null;
      return Math.min(actuelle, photos.length - 1);
    });
  }, [photos.length]);

  const moments = useMemo(() => {
    if (!groupee) return [];
    let depart = 0;
    return grouperParMois(photos).map((moment) => {
      const place = { ...moment, depart };
      depart += moment.photos.length;
      return place;
    });
  }, [groupee, photos]);

  return (
    <>
      {groupee ? (
        <div className="flex flex-col gap-9">
          {moments.map((moment) => (
            <section key={moment.cle}>
              <h2 className="font-display text-heading text-ink">{moment.titre}</h2>
              <p className="mt-0.5 text-[0.8125rem] text-ink-3">{resumeMoment(moment)}</p>
              <Grille
                photos={moment.photos}
                depart={moment.depart}
                onOuvrir={setOuverte}
                className="mt-3"
              />
            </section>
          ))}
        </div>
      ) : (
        <Grille photos={photos} depart={0} onOuvrir={setOuverte} />
      )}

      {ouverte !== null ? (
        <Visionneuse
          photos={photos}
          index={ouverte}
          albums={albums}
          album={album}
          onIndex={setOuverte}
          onClose={() => setOuverte(null)}
        />
      ) : null}
    </>
  );
}

/**
 * Trois colonnes sur téléphone, cinq sur grand écran, 3 px d'écart : la densité
 * d'une pellicule. La vignette déborde la marge du téléphone, pour que la photo
 * touche le bord de l'écran.
 */
function Grille({
  photos,
  depart,
  onOuvrir,
  className,
}: {
  photos: Photo[];
  depart: number;
  onOuvrir: (index: number) => void;
  className?: string;
}) {
  return (
    <ul className={cx("-mx-4 grid grid-cols-3 gap-[3px] lg:mx-0 lg:grid-cols-5", className)}>
      {photos.map((photo, rang) => {
        const legende = photo.caption?.trim();
        return (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => onOuvrir(depart + rang)}
              aria-label={legende ? `Ouvrir : ${legende}` : "Ouvrir la photo"}
              className="group relative block w-full overflow-hidden bg-surface-2 focus-visible:z-10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumbUrl}
                alt={legende ?? ""}
                loading="lazy"
                decoding="async"
                className="aspect-square size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
              />
              {photo.favorite ? (
                <span
                  aria-hidden="true"
                  className="absolute bottom-1 right-1 grid size-5 place-items-center rounded-full bg-surface/85 text-accent"
                >
                  <IconCoeur size={12} fill="currentColor" />
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
