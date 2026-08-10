"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { Avatar, Button, EmptyState, Field, Spinner, Textarea, cx } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { ImagePicker } from "@/components/image-picker";
import { IconFil, IconPlus } from "@/components/icons";
import type { Who } from "@/lib/types";
import { MOODS } from "@/components/fil/emojis";
import { creerPost } from "@/app/(app)/fil/actions";

/**
 * La composition vit à trois endroits — la zone de saisie en haut du fil, le
 * bouton flottant sous le pouce, l'état vide — mais n'ouvre qu'un seul panneau.
 * D'où ce contexte minuscule, qui ne transporte rien d'autre que « ouvre ».
 */
const OuvrirContext = createContext<() => void>(() => {});

const FORM_ID = "fil-composer";

export function ComposerProvider({ who, children }: { who: Who; children: ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  const ouvrir = useCallback(() => setOuvert(true), []);
  const fermer = useCallback(() => setOuvert(false), []);

  return (
    <OuvrirContext.Provider value={ouvrir}>
      {children}

      <button
        type="button"
        onClick={ouvrir}
        aria-label="Écrire un message"
        className={cx(
          "fixed bottom-24 right-4 z-30 grid size-14 place-items-center rounded-full lg:hidden",
          "bg-accent text-accent-on shadow-[var(--shadow-lg)]",
          "transition-transform active:scale-95",
        )}
      >
        <IconPlus size={26} />
      </button>

      <ComposerSheet ouvert={ouvert} onFermer={fermer} />
    </OuvrirContext.Provider>
  );
}

/* ------------------------------ Zone de saisie ---------------------------- */

export function ComposerTrigger({ who }: { who: Who }) {
  const ouvrir = useContext(OuvrirContext);

  return (
    <button
      type="button"
      onClick={ouvrir}
      className={cx(
        "mt-5 flex w-full items-center gap-3 rounded-lg border border-line bg-surface px-3.5 py-3 text-left",
        "shadow-[var(--shadow-sm)] transition-colors hover:border-line-strong hover:bg-surface-2/50",
      )}
    >
      <Avatar who={who} size={38} />
      <span className="min-w-0 flex-1 truncate text-sm text-ink-3">
        Raconte-lui ta journée…
      </span>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
        <IconPlus size={18} />
      </span>
    </button>
  );
}

/* -------------------------------- État vide ------------------------------- */

export function FilVide() {
  const ouvrir = useContext(OuvrirContext);

  return (
    <EmptyState
      icon={<IconFil size={24} />}
      title="Rien encore, et c’est très bien"
      action={<Button onClick={ouvrir}>Écrire le premier mot</Button>}
    >
      Le fil se remplira tout seul&nbsp;: une pensée du matin, une photo prise en vitesse, une
      nouvelle du jour. Personne d’autre ne le lira.
    </EmptyState>
  );
}

/* --------------------------------- Panneau -------------------------------- */

function ComposerSheet({ ouvert, onFermer }: { ouvert: boolean; onFermer: () => void }) {
  const [texte, setTexte] = useState("");
  const [humeur, setHumeur] = useState("");
  const [envoi, demarrer] = useTransition();

  const pret = texte.trim().length > 0;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pret || envoi) return;

    const data = new FormData(event.currentTarget);
    demarrer(async () => {
      await creerPost(data);
      setTexte("");
      setHumeur("");
      onFermer();
    });
  }

  function fermer() {
    if (envoi) return;
    onFermer();
  }

  return (
    <Sheet
      open={ouvert}
      onClose={fermer}
      title="Écrire un mot"
      description="Ce que tu déposes ici n’ira jamais plus loin que vous deux."
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={fermer} disabled={envoi}>
            Annuler
          </Button>
          <Button type="submit" form={FORM_ID} disabled={!pret || envoi}>
            {envoi ? <Spinner /> : null}
            {envoi ? "Envoi…" : "Publier"}
          </Button>
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field label="Ton message">
          <Textarea
            name="texte"
            rows={5}
            value={texte}
            onChange={(event) => setTexte(event.target.value)}
            data-autofocus
            maxLength={4000}
            placeholder="Ce qui s’est passé aujourd’hui, ou juste une pensée…"
          />
        </Field>

        <div role="group" aria-label="Humeur du jour" className="flex flex-col gap-2">
          <p className="label-caps text-ink-3">Humeur du jour — facultatif</p>
          <input type="hidden" name="humeur" value={humeur} />
          <div className="flex flex-wrap gap-2">
            {MOODS.map((mood) => {
              const actif = humeur === mood.label;
              return (
                <button
                  key={mood.label}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => setHumeur(actif ? "" : mood.label)}
                  className={cx(
                    "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold",
                    "transition-colors",
                    actif
                      ? "border-accent bg-accent-soft text-accent-ink"
                      : "border-line bg-surface-2 text-ink-2 hover:border-line-strong hover:text-ink",
                  )}
                >
                  <span aria-hidden="true" className="text-base leading-none">
                    {mood.emoji}
                  </span>
                  {mood.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="label-caps text-ink-3">Photos — quatre au plus</p>
          <ImagePicker name="photos" max={4} shape="libre" label="Ajouter des photos" />
        </div>
      </form>
    </Sheet>
  );
}
