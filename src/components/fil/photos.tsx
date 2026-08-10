"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";
import { IconChevronDroite, IconChevronGauche, IconFermer } from "@/components/icons";

export interface PostPhoto {
  id: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  caption?: string;
}

/**
 * Une photo occupe tout le cadre avec son ratio d'origine ; au-delà, on passe à
 * une grille carrée — deux côte à côte, trois en bande, quatre en damier. Le
 * recadrage n'existe que dans la grille : la photo seule n'est jamais coupée,
 * sauf si elle est démesurément haute.
 */
export function PostPhotos({ photos }: { photos: PostPhoto[] }) {
  const [agrandie, setAgrandie] = useState<number | null>(null);
  const fermer = useCallback(() => setAgrandie(null), []);

  if (photos.length === 0) return null;

  const seule = photos.length === 1;
  const colonnes =
    photos.length === 2 ? "grid-cols-2" : photos.length === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <>
      <div className="px-4 pt-3">
        {seule ? (
          <Vignette
            photo={photos[0]}
            index={0}
            total={1}
            onOuvrir={setAgrandie}
            className="block w-full overflow-hidden rounded-sm border border-line"
            imageClassName="max-h-[32rem] w-full object-cover"
            naturel
            source="url"
          />
        ) : (
          <div className={cx("grid gap-1 overflow-hidden rounded-sm", colonnes)}>
            {photos.map((photo, index) => (
              <Vignette
                key={photo.id}
                photo={photo}
                index={index}
                total={photos.length}
                onOuvrir={setAgrandie}
                className="block overflow-hidden bg-surface-2"
                imageClassName="size-full object-cover"
                square
                source="thumbUrl"
              />
            ))}
          </div>
        )}
      </div>

      {agrandie !== null ? (
        <Lightbox photos={photos} index={agrandie} onIndex={setAgrandie} onFermer={fermer} />
      ) : null}
    </>
  );
}

function Vignette({
  photo,
  index,
  total,
  onOuvrir,
  className,
  imageClassName,
  naturel = false,
  square = false,
  source,
}: {
  photo: PostPhoto;
  index: number;
  total: number;
  onOuvrir: (index: number) => void;
  className?: string;
  imageClassName?: string;
  /** Garde le ratio d'origine au lieu de recadrer en carré. */
  naturel?: boolean;
  square?: boolean;
  source: "url" | "thumbUrl";
}) {
  const ratio =
    naturel && photo.width > 0 && photo.height > 0
      ? `${photo.width} / ${photo.height}`
      : undefined;

  return (
    <button
      type="button"
      onClick={() => onOuvrir(index)}
      aria-label={total > 1 ? `Agrandir la photo ${index + 1} sur ${total}` : "Agrandir la photo"}
      className={cx("transition-opacity hover:opacity-95", square && "aspect-square", className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo[source]}
        alt={photo.caption ?? ""}
        loading="lazy"
        decoding="async"
        width={photo.width}
        height={photo.height}
        style={ratio ? { aspectRatio: ratio } : undefined}
        className={imageClassName}
      />
    </button>
  );
}

/* ------------------------------ Plein écran ------------------------------- */

function Lightbox({
  photos,
  index,
  onIndex,
  onFermer,
}: {
  photos: PostPhoto[];
  index: number;
  onIndex: (index: number) => void;
  onFermer: () => void;
}) {
  const fermerRef = useRef<HTMLButtonElement>(null);
  const photo = photos[index];
  const multiple = photos.length > 1;

  // Une seule fois à l'ouverture : on gèle la page derrière et on prend le focus.
  useEffect(() => {
    const precedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    fermerRef.current?.focus();
    return () => {
      document.body.style.overflow = precedent;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onFermer();
      if (event.key === "ArrowLeft") onIndex((index - 1 + photos.length) % photos.length);
      if (event.key === "ArrowRight") onIndex((index + 1) % photos.length);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [index, photos.length, onIndex, onFermer]);

  if (!photo) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo en grand"
      className="fixed inset-0 z-50 bg-ground/95 backdrop-blur-sm"
    >
      <button
        type="button"
        aria-label="Fermer"
        onClick={onFermer}
        className="absolute inset-0 cursor-default"
      />

      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <span className="tabular text-xs font-semibold text-ink-3">
            {multiple ? `${index + 1} / ${photos.length}` : ""}
          </span>
          <button
            ref={fermerRef}
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="-mr-2 grid size-11 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <IconFermer size={20} />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center px-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={photo.caption ?? ""}
            loading="lazy"
            decoding="async"
            width={photo.width}
            height={photo.height}
            className="animate-rise max-h-full w-auto max-w-full rounded-md object-contain shadow-[var(--shadow-lg)]"
          />

          {multiple ? (
            <>
              <FlecheLightbox
                cote="gauche"
                onClick={() => onIndex((index - 1 + photos.length) % photos.length)}
              />
              <FlecheLightbox cote="droite" onClick={() => onIndex((index + 1) % photos.length)} />
            </>
          ) : null}
        </div>

        <div className="safe-b px-5 pb-4 pt-3 text-center">
          {photo.caption ? (
            <p className="text-sm leading-relaxed text-ink-2">{photo.caption}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FlecheLightbox({ cote, onClick }: { cote: "gauche" | "droite"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={cote === "gauche" ? "Photo précédente" : "Photo suivante"}
      className={cx(
        "absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full",
        "border border-line bg-surface/85 text-ink-2 shadow-[var(--shadow-sm)] backdrop-blur",
        "transition-colors hover:text-ink",
        cote === "gauche" ? "left-2" : "right-2",
      )}
    >
      {cote === "gauche" ? <IconChevronGauche size={20} /> : <IconChevronDroite size={20} />}
    </button>
  );
}
