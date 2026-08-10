"use client";

import { useId, useState, useTransition } from "react";
import type { Album } from "@/lib/types";
import { Button, Field, Input, Select, Spinner } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { ImagePicker } from "@/components/image-picker";
import { IconPlus } from "@/components/icons";
import { importerPhotos } from "@/app/(app)/photos/actions";

const MAX = 12;

/**
 * L'import. Les fichiers sont redimensionnés dans le navigateur par
 * `ImagePicker` ; la légende, le lieu et la date sont communs au lot, parce
 * qu'on importe presque toujours une série prise au même endroit.
 */
export function BoutonAjouter({
  albums,
  lieux = [],
  albumId,
  libelle = "Ajouter",
  variant = "primary",
}: {
  albums: Album[];
  lieux?: string[];
  /** Sur une page d'album : les photos importées y atterrissent directement. */
  albumId?: string;
  libelle?: string;
  variant?: "primary" | "soft";
}) {
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, demarrer] = useTransition();
  const formulaire = useId();
  const listeLieux = useId();

  const albumChoisi = albums.find((album) => album.id === albumId);

  function fermer() {
    setOuvert(false);
    setErreur(null);
  }

  function soumettre(formData: FormData) {
    const brut = formData.get("images");
    if (typeof brut !== "string" || brut.trim() === "[]") {
      setErreur("Choisis au moins une photo.");
      return;
    }
    setErreur(null);
    demarrer(async () => {
      await importerPhotos(formData);
      fermer();
    });
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOuvert(true)}>
        <IconPlus size={18} />
        {libelle}
      </Button>

      <Sheet
        open={ouvert}
        onClose={fermer}
        title="Ajouter des photos"
        description={
          albumChoisi
            ? `Elles rejoindront « ${albumChoisi.title} ».`
            : `Jusqu’à ${MAX} photos à la fois.`
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={fermer}>
              Annuler
            </Button>
            <Button type="submit" form={formulaire} disabled={envoi}>
              {envoi ? <Spinner /> : null}
              {envoi ? "Import…" : "Importer"}
            </Button>
          </div>
        }
      >
        <form id={formulaire} action={soumettre} className="flex flex-col gap-4">
          <ImagePicker name="images" max={MAX} label="Choisir des photos" />

          {erreur ? <p className="text-xs font-semibold text-bad">{erreur}</p> : null}

          <Field label="Légende" hint="Facultative, la même pour toutes les photos du lot.">
            <Input
              name="legende"
              maxLength={240}
              placeholder="Le premier café, avant que la ville se réveille"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lieu">
              <Input name="lieu" maxLength={80} placeholder="Lisbonne" list={listeLieux} />
            </Field>
            <Field label="Date">
              <Input type="date" name="date" />
            </Field>
          </div>

          {lieux.length > 0 ? (
            <datalist id={listeLieux}>
              {lieux.map((lieu) => (
                <option key={lieu} value={lieu} />
              ))}
            </datalist>
          ) : null}

          {albumId ? (
            <input type="hidden" name="album" value={albumId} />
          ) : albums.length > 0 ? (
            <Field label="Album">
              <Select name="album" defaultValue="">
                <option value="">Aucun album</option>
                {albums.map((album) => (
                  <option key={album.id} value={album.id}>
                    {album.title}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </form>
      </Sheet>
    </>
  );
}
