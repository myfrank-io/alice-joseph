"use client";

import { useId, useState, useTransition } from "react";
import { Button, Field, Input, Spinner, Textarea } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { IconPlus } from "@/components/icons";
import { creerAlbum } from "@/app/(app)/photos/actions";

/** Création d'un album : un titre, et une phrase si le cœur y est. */
export function BoutonNouvelAlbum({
  variant = "soft",
}: {
  variant?: "primary" | "soft" | "outline";
}) {
  const [ouvert, setOuvert] = useState(false);
  const [envoi, demarrer] = useTransition();
  const formulaire = useId();

  function soumettre(formData: FormData) {
    demarrer(async () => {
      await creerAlbum(formData);
      setOuvert(false);
    });
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOuvert(true)}>
        <IconPlus size={18} />
        Nouvel album
      </Button>

      <Sheet
        open={ouvert}
        onClose={() => setOuvert(false)}
        title="Nouvel album"
        description="Un titre suffit. Les photos viendront après."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setOuvert(false)}>
              Annuler
            </Button>
            <Button type="submit" form={formulaire} disabled={envoi}>
              {envoi ? <Spinner /> : null}
              Créer
            </Button>
          </div>
        }
      >
        <form id={formulaire} action={soumettre} className="flex flex-col gap-4">
          <Field label="Titre">
            <Input
              name="titre"
              required
              maxLength={80}
              data-autofocus
              placeholder="Lisbonne, cinq jours"
            />
          </Field>
          <Field label="Description" hint="Facultative.">
            <Textarea
              name="description"
              rows={3}
              maxLength={300}
              placeholder="Trop de marches, trop de pastéis, aucun regret."
            />
          </Field>
        </form>
      </Sheet>
    </>
  );
}
