"use client";

import { useActionState, useEffect, useId, useState, useTransition } from "react";
import {
  creerPlaylist,
  modifierPlaylist,
  supprimerPlaylist,
} from "@/app/(app)/musique/actions";
import { Button, Field, Input, Textarea, cx } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { IconCorbeille, IconCrayon, IconPlus } from "@/components/icons";
import { IconPoints } from "@/components/musique/parties";
import { ETAT_INITIAL } from "@/lib/musique";
import type { Playlist, Tint } from "@/lib/types";

/** Les cinq teintes de la maison, nommées par leur couleur : c'est ce qu'on voit. */
const TEINTES: { cle: Tint; label: string }[] = [
  { cle: "fil", label: "Rose" },
  { cle: "photos", label: "Bleu" },
  { cle: "musique", label: "Vert d'eau" },
  { cle: "carte", label: "Ambre" },
  { cle: "jeux", label: "Lilas" },
];

function ChampsPlaylist({
  playlist,
  valeurs,
}: {
  playlist?: Playlist;
  /** Renvoyées par l'action après une erreur : React a vidé le formulaire. */
  valeurs?: Record<string, string>;
}) {
  return (
    <>
      <Field label="Titre">
        <Input
          name="title"
          defaultValue={valeurs?.title ?? playlist?.title ?? ""}
          required
          maxLength={120}
          placeholder="Dimanche matin"
          data-autofocus
        />
      </Field>

      <Field label="Description" hint="Facultatif : à quel moment on l'écoute.">
        <Textarea
          name="description"
          defaultValue={valeurs?.description ?? playlist?.description ?? ""}
          rows={2}
          maxLength={400}
          placeholder="Volume bas, café, personne ne parle avant 10 h."
        />
      </Field>

      <fieldset>
        <legend className="label-caps mb-2 text-ink-3">Teinte</legend>
        <div className="flex flex-wrap gap-2">
          {TEINTES.map(({ cle, label }) => (
            <label key={cle} className="cursor-pointer">
              <input
                type="radio"
                name="tint"
                value={cle}
                defaultChecked={(playlist?.tint ?? "musique") === cle}
                className="peer sr-only"
              />
              <span
                className={cx(
                  "flex h-11 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5",
                  "text-sm font-semibold text-ink-2 transition-colors",
                  "peer-checked:border-line-strong peer-checked:bg-surface-3 peer-checked:text-ink",
                  "peer-focus-visible:shadow-[var(--ring)]",
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-3.5 shrink-0 rounded-full"
                  style={{ background: `var(--tint-${cle})` }}
                />
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

function Erreur({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-sm bg-bad-soft px-3 py-2.5 text-sm leading-snug text-bad">
      {message}
    </p>
  );
}

/* ------------------------------ Nouvelle liste ---------------------------- */

export function BoutonNouvellePlaylist({ plein = false }: { plein?: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, envoyer, enCours] = useActionState(creerPlaylist, ETAT_INITIAL);
  const idFormulaire = useId();

  useEffect(() => {
    if (etat.ok) setOuvert(false);
  }, [etat]);

  return (
    <>
      <Button
        type="button"
        variant={plein ? "primary" : "soft"}
        size={plein ? "lg" : "md"}
        onClick={() => setOuvert(true)}
        className={plein ? undefined : "h-11"}
      >
        <IconPlus size={17} />
        {plein ? "Créer une playlist" : "Nouvelle"}
      </Button>

      <Sheet
        open={ouvert}
        onClose={() => setOuvert(false)}
        title="Nouvelle playlist"
        description="Un titre, une couleur, et on y range les morceaux ensuite."
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="md" onClick={() => setOuvert(false)}>
              Annuler
            </Button>
            <Button type="submit" form={idFormulaire} size="md" disabled={enCours}>
              {enCours ? "Création…" : "Créer"}
            </Button>
          </div>
        }
      >
        <form id={idFormulaire} action={envoyer} className="flex flex-col gap-5">
          <ChampsPlaylist valeurs={etat.valeurs} />
          <Erreur message={etat.erreur} />
        </form>
      </Sheet>
    </>
  );
}

/* -------------------------- Menu d'une playlist --------------------------- */

type Vue = "menu" | "modifier" | "supprimer" | null;

export function MenuPlaylist({ playlist }: { playlist: Playlist }) {
  const [vue, setVue] = useState<Vue>(null);
  const [etat, envoyer, enCours] = useActionState(modifierPlaylist, ETAT_INITIAL);
  const [enTransit, demarrer] = useTransition();

  useEffect(() => {
    if (etat.ok) setVue(null);
  }, [etat]);

  const titre =
    vue === "modifier"
      ? "Modifier la playlist"
      : vue === "supprimer"
        ? "Supprimer cette playlist ?"
        : playlist.title;

  return (
    <>
      <button
        type="button"
        onClick={() => setVue("menu")}
        aria-label={`Options pour la playlist « ${playlist.title} »`}
        className="grid size-11 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <IconPoints size={20} />
      </button>

      <Sheet open={vue !== null} onClose={() => setVue(null)} title={titre}>
        {vue === "menu" ? (
          <ul className="-mx-2 flex flex-col">
            <li>
              <button
                type="button"
                onClick={() => setVue("modifier")}
                className="flex w-full items-center gap-3 rounded-sm px-3 py-3 text-left text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
              >
                <IconCrayon size={19} className="text-ink-3" />
                Modifier le titre, la description ou la teinte
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setVue("supprimer")}
                className="flex w-full items-center gap-3 rounded-sm px-3 py-3 text-left text-sm font-semibold text-bad transition-colors hover:bg-surface-2"
              >
                <IconCorbeille size={19} />
                Supprimer la playlist
              </button>
            </li>
          </ul>
        ) : null}

        {vue === "modifier" ? (
          <form action={envoyer} className="flex flex-col gap-5">
            <input type="hidden" name="playlistId" value={playlist.id} />
            <ChampsPlaylist playlist={playlist} valeurs={etat.valeurs} />
            <Erreur message={etat.erreur} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="md" onClick={() => setVue("menu")}>
                Annuler
              </Button>
              <Button type="submit" size="md" disabled={enCours}>
                {enCours ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </form>
        ) : null}

        {vue === "supprimer" ? (
          <div className="flex flex-col gap-5">
            <p className="text-sm leading-relaxed text-ink-2">
              La playlist disparaît, les morceaux restent dans la bibliothèque. Rien ne se perd,
              sauf l&rsquo;ordre qu&rsquo;on leur avait donné.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="md" onClick={() => setVue("menu")}>
                Annuler
              </Button>
              <Button
                type="button"
                variant="danger"
                size="md"
                disabled={enTransit}
                onClick={() => {
                  demarrer(async () => {
                    await supprimerPlaylist(playlist.id);
                  });
                }}
              >
                Supprimer
              </Button>
            </div>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
