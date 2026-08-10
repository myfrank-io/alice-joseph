"use client";

import { useEffect, useState } from "react";
import type { Place } from "@/lib/types";
import { Sheet } from "@/components/sheet";
import { Avatar, Button, Chip, cx } from "@/components/ui";
import { IconCorbeille, IconCrayon, IconFermer } from "@/components/icons";
import { formatNumber, whoLabel } from "@/lib/format";
import {
  DEPART,
  distanceKm,
  formatCoordonnees,
  formatDateLieu,
  type PhotoLegere,
} from "@/lib/carte/lieu";

/** Le panneau qui s'ouvre au clic sur une épingle — ou sur une ligne de la liste. */
export function SheetLieu({
  lieu,
  photos,
  enCours,
  onFermer,
  onModifier,
  onSupprimer,
}: {
  lieu: Place | null;
  photos: PhotoLegere[];
  enCours: boolean;
  onFermer: () => void;
  onModifier: () => void;
  onSupprimer: () => void;
}) {
  const [confirmation, setConfirmation] = useState(false);
  const [agrandie, setAgrandie] = useState<PhotoLegere | null>(null);

  useEffect(() => {
    setConfirmation(false);
    setAgrandie(null);
  }, [lieu?.id]);

  if (!lieu) return null;

  const date = formatDateLieu(lieu.visitedAt);
  const attachees = lieu.photoIds
    .map((id) => photos.find((photo) => photo.id === id))
    .filter((photo): photo is PhotoLegere => Boolean(photo));
  const km = Math.round(distanceKm(DEPART, lieu));

  return (
    <>
      <Sheet
        open
        onClose={onFermer}
        title={lieu.name}
        description={[lieu.country, date].filter(Boolean).join(" · ")}
        footer={
          <div className="flex items-center justify-between gap-3">
            <Button
              variant={confirmation ? "danger" : "ghost"}
              size="sm"
              disabled={enCours}
              onClick={() => (confirmation ? onSupprimer() : setConfirmation(true))}
            >
              <IconCorbeille size={16} />
              {confirmation ? "Confirmer la suppression" : "Supprimer"}
            </Button>
            <Button variant="outline" size="sm" disabled={enCours} onClick={onModifier}>
              <IconCrayon size={16} />
              Modifier
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={lieu.kind === "visite" ? "accent" : "neutre"}>
              {lieu.kind === "visite" ? "Visité" : "Envie"}
            </Chip>
            <Chip>{formatCoordonnees(lieu.lat, lieu.lng)}</Chip>
            {lieu.kind === "visite" && km > 0 ? (
              <Chip>
                {formatNumber(km)} km de {DEPART.nom}
              </Chip>
            ) : null}
          </div>

          {lieu.note ? (
            <p className="text-sm leading-relaxed whitespace-pre-line text-ink-2">{lieu.note}</p>
          ) : null}

          {attachees.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="label-caps text-ink-3">
                {attachees.length > 1 ? `${attachees.length} photos` : "1 photo"}
              </p>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {attachees.map((photo) => (
                  <li key={photo.id}>
                    <button
                      type="button"
                      onClick={() => setAgrandie(photo)}
                      className="block w-full overflow-hidden rounded-sm border border-line transition-transform hover:scale-[1.02]"
                      aria-label={photo.caption ?? "Agrandir la photo"}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.thumbUrl}
                        alt={photo.caption ?? ""}
                        loading="lazy"
                        decoding="async"
                        className="aspect-square w-full object-cover"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex items-center gap-3 border-t border-line pt-4">
            <Avatar who={lieu.by} size={32} />
            <p className="text-[0.8125rem] leading-snug text-ink-2">
              Ajouté par <span className="font-semibold text-ink">{whoLabel(lieu.by)}</span>
              {lieu.with === "les-deux" ? (
                <>
                  {" "}
                  · <span className="text-ink-3">tous les deux</span>
                </>
              ) : (
                <>
                  {" "}
                  · <span className="text-ink-3">avec {whoLabel(lieu.with)}</span>
                </>
              )}
            </p>
          </div>
        </div>
      </Sheet>

      {agrandie ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Fermer la photo"
            onClick={() => setAgrandie(null)}
            className="absolute inset-0 cursor-default bg-[color-mix(in_oklab,var(--ink)_72%,transparent)] backdrop-blur-[2px]"
          />
          <figure className="animate-rise relative flex max-h-full flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={agrandie.url}
              alt={agrandie.caption ?? ""}
              decoding="async"
              className="max-h-[76dvh] w-auto max-w-full rounded-md shadow-[var(--shadow-lg)]"
            />
            {agrandie.caption ? (
              <figcaption className="max-w-[46ch] text-center text-[0.8125rem] text-ground">
                {agrandie.caption}
              </figcaption>
            ) : null}
          </figure>
          <button
            type="button"
            onClick={() => setAgrandie(null)}
            aria-label="Fermer la photo"
            className={cx(
              "absolute right-4 top-4 grid size-11 place-items-center rounded-full",
              "border border-line bg-surface/85 text-ink-2 backdrop-blur transition-colors hover:text-ink",
            )}
          >
            <IconFermer size={18} />
          </button>
        </div>
      ) : null}
    </>
  );
}
