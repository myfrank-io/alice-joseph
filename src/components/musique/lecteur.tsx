"use client";

import { cx } from "@/components/ui";
import type { Lecteur } from "@/lib/musique";

/**
 * Le lecteur natif du service, en iframe.
 *
 * Ce composant n'est monté que lorsque la personne a demandé à écouter : c'est
 * la règle. Une bibliothèque affiche vingt morceaux, et vingt iframes montées
 * d'un coup, ce sont vingt connexions à Spotify avant même le premier clic.
 */
export function LecteurEmbarque({
  lecteur,
  id,
  className,
}: {
  lecteur: Lecteur;
  id?: string;
  className?: string;
}) {
  return (
    <div
      id={id}
      className={cx(
        "animate-soften overflow-hidden rounded-md border border-line bg-surface-2",
        className,
      )}
    >
      <iframe
        src={lecteur.embedUrl}
        title={lecteur.titre}
        loading="lazy"
        allow="encrypted-media; clipboard-write; picture-in-picture"
        allowFullScreen={lecteur.ratio !== null}
        referrerPolicy="strict-origin-when-cross-origin"
        className="block w-full rounded-md border-0"
        style={
          lecteur.ratio
            ? { aspectRatio: lecteur.ratio, height: "auto" }
            : { height: lecteur.hauteur }
        }
      />
    </div>
  );
}
