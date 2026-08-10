"use client";

import { useId, useState, useTransition } from "react";
import type { Album, Photo } from "@/lib/types";
import { Button, EmptyState, Field, Input, Spinner, Textarea, cx } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { IconCorbeille, IconCrayon, IconPlus, IconValider } from "@/components/icons";
import {
  ajouterPhotosAlbum,
  modifierAlbum,
  supprimerAlbum,
} from "@/app/(app)/photos/actions";
import { plural } from "@/lib/format";

/* ------------------------- Renommer et supprimer -------------------------- */

/** Les deux commandes de l'en-tête d'un album. */
export function OutilsAlbum({ album }: { album: Album }) {
  const [renommer, setRenommer] = useState(false);
  const [effacer, setEffacer] = useState(false);
  const [envoi, demarrer] = useTransition();
  const formulaire = useId();

  function enregistrer(formData: FormData) {
    demarrer(async () => {
      await modifierAlbum(album.id, formData);
      setRenommer(false);
    });
  }

  /* L'action redirige elle-même vers la liste des albums. */
  function supprimer() {
    demarrer(async () => {
      await supprimerAlbum(album.id);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setRenommer(true)}
        aria-label="Renommer l’album"
        title="Renommer l’album"
        className="grid size-11 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <IconCrayon size={19} />
      </button>
      <button
        type="button"
        onClick={() => setEffacer(true)}
        aria-label="Supprimer l’album"
        title="Supprimer l’album"
        className="grid size-11 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-bad"
      >
        <IconCorbeille size={19} />
      </button>

      <Sheet
        open={renommer}
        onClose={() => setRenommer(false)}
        title="Renommer l’album"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setRenommer(false)}>
              Annuler
            </Button>
            <Button type="submit" form={formulaire} disabled={envoi}>
              {envoi ? <Spinner /> : null}
              Enregistrer
            </Button>
          </div>
        }
      >
        <form id={formulaire} action={enregistrer} className="flex flex-col gap-4">
          <Field label="Titre">
            <Input
              name="titre"
              required
              maxLength={80}
              data-autofocus
              defaultValue={album.title}
            />
          </Field>
          <Field label="Description" hint="Facultative.">
            <Textarea
              name="description"
              rows={3}
              maxLength={300}
              defaultValue={album.description ?? ""}
            />
          </Field>
        </form>
      </Sheet>

      <Sheet
        open={effacer}
        onClose={() => setEffacer(false)}
        title="Supprimer l’album ?"
        description="Les photos, elles, restent dans la galerie."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setEffacer(false)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={supprimer} disabled={envoi}>
              {envoi ? <Spinner /> : null}
              Supprimer
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-ink-2">
          «&nbsp;{album.title}&nbsp;» disparaîtra de la liste des albums. Aucune photo
          n&rsquo;est supprimée&nbsp;: elles perdent seulement cette étiquette.
        </p>
      </Sheet>
    </>
  );
}

/* --------------------- Piocher dans la bibliothèque ----------------------- */

/** Sélecteur multiple : toute la bibliothèque, sauf ce que l'album contient déjà. */
export function AjouterDesPhotos({
  album,
  photos,
  variant = "primary",
}: {
  album: Album;
  photos: Photo[];
  variant?: "primary" | "soft";
}) {
  const [ouvert, setOuvert] = useState(false);
  const [choisies, setChoisies] = useState<string[]>([]);
  const [envoi, demarrer] = useTransition();

  function fermer() {
    setOuvert(false);
    setChoisies([]);
  }

  function basculer(id: string) {
    setChoisies((actuelles) =>
      actuelles.includes(id) ? actuelles.filter((autre) => autre !== id) : [...actuelles, id],
    );
  }

  function valider() {
    if (choisies.length === 0) return;
    demarrer(async () => {
      await ajouterPhotosAlbum(album.id, choisies);
      fermer();
    });
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOuvert(true)}>
        <IconPlus size={18} />
        Ajouter des photos
      </Button>

      <Sheet
        open={ouvert}
        onClose={fermer}
        size="lg"
        title="Choisir dans la bibliothèque"
        description={
          photos.length > 0
            ? `${photos.length} ${plural(photos.length, "photo disponible", "photos disponibles")}.`
            : undefined
        }
        footer={
          <div className="flex items-center justify-between gap-3">
            <p className="text-[0.8125rem] text-ink-3">
              {choisies.length === 0
                ? "Aucune sélection"
                : `${choisies.length} ${plural(choisies.length, "sélectionnée", "sélectionnées")}`}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={fermer}>
                Annuler
              </Button>
              <Button onClick={valider} disabled={envoi || choisies.length === 0}>
                {envoi ? <Spinner /> : null}
                Ajouter
              </Button>
            </div>
          </div>
        }
      >
        {photos.length === 0 ? (
          <EmptyState title="Tout est déjà là">
            Chaque photo de la bibliothèque appartient déjà à cet album.
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {photos.map((photo) => {
              const prise = choisies.includes(photo.id);
              return (
                <li key={photo.id}>
                  <button
                    type="button"
                    onClick={() => basculer(photo.id)}
                    aria-pressed={prise}
                    aria-label={
                      photo.caption?.trim() ? `Choisir : ${photo.caption}` : "Choisir cette photo"
                    }
                    className="relative block w-full overflow-hidden rounded-sm bg-surface-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbUrl}
                      alt={photo.caption ?? ""}
                      loading="lazy"
                      decoding="async"
                      className={cx(
                        "aspect-square size-full object-cover transition-opacity",
                        prise ? "opacity-60" : undefined,
                      )}
                    />
                    <span
                      aria-hidden="true"
                      className={cx(
                        "absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full border transition-colors",
                        prise
                          ? "border-accent bg-accent text-accent-on"
                          : "border-line bg-surface/85 text-transparent",
                      )}
                    >
                      <IconValider size={14} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>
    </>
  );
}
