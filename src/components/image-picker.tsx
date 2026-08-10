"use client";

import { useId, useRef, useState } from "react";
import { resizeImage, type ResizedImage } from "@/lib/resize-image";
import { cx, Spinner } from "@/components/ui";
import { IconFermer, IconImport } from "@/components/icons";

/**
 * Sélecteur d'images partagé par les photos, les portraits du jeu et les avatars.
 *
 * Les fichiers sont redimensionnés dans le navigateur puis sérialisés en JSON
 * dans un champ caché : le composant s'intègre donc à n'importe quel formulaire
 * relié à une action serveur, sans état partagé ni contexte.
 */
export function ImagePicker({
  name,
  max = 8,
  label = "Ajouter des photos",
  shape = "carre",
}: {
  name: string;
  max?: number;
  label?: string;
  shape?: "carre" | "libre";
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ResizedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setError(null);
    setBusy(true);
    try {
      const room = Math.max(0, max - images.length);
      const chosen = Array.from(fileList).slice(0, room);
      const resized = await Promise.all(chosen.map(resizeImage));
      setImages((current) => [...current, ...resized]);
    } catch {
      setError("Une des images n'a pas pu être lue. Réessaie avec un autre fichier.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const full = images.length >= max;

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={JSON.stringify(images)} />

      {images.length > 0 ? (
        <ul className="grid grid-cols-4 gap-2">
          {images.map((image, index) => (
            <li key={`${image.thumbDataUrl.slice(-24)}-${index}`} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.thumbDataUrl}
                alt=""
                className={cx(
                  "w-full rounded-sm border border-line object-cover",
                  shape === "carre" ? "aspect-square" : "aspect-[3/4]",
                )}
              />
              <button
                type="button"
                aria-label="Retirer cette image"
                onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-ink text-ground shadow-[var(--shadow-sm)] transition-transform hover:scale-105"
              >
                <IconFermer size={13} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <label
        htmlFor={inputId}
        className={cx(
          "flex cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed px-4 py-3 text-sm font-semibold transition-colors",
          full
            ? "cursor-not-allowed border-line text-ink-3"
            : "border-line-strong text-ink-2 hover:border-accent hover:bg-accent-soft hover:text-accent-ink",
        )}
      >
        {busy ? <Spinner /> : <IconImport size={18} />}
        {busy ? "Préparation…" : full ? `Maximum ${max} images` : label}
      </label>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        multiple={max > 1}
        disabled={full || busy}
        onChange={(event) => onFiles(event.target.files)}
        className="sr-only"
      />

      {error ? <p className="text-xs font-semibold text-bad">{error}</p> : null}
    </div>
  );
}
