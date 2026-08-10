"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { ajouterMorceau } from "@/app/(app)/musique/actions";
import { Button, Field, Input, Textarea, cx } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { IconPlus } from "@/components/icons";
import { ETAT_INITIAL } from "@/lib/musique";
import type { Playlist } from "@/lib/types";

/**
 * Le geste principal de l'app : coller un lien. Tout le reste du formulaire est
 * facultatif, et la saisie manuelle ne s'ouvre que si le lien n'a rien donné.
 */
export function AjouterMorceau({
  playlists,
  playlistParDefaut,
  plein = false,
}: {
  playlists: Playlist[];
  /** Playlist cochée d'avance, quand on ajoute depuis la page d'une playlist. */
  playlistParDefaut?: string;
  /** Bouton en toutes lettres, pour les états vides. */
  plein?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [manuel, setManuel] = useState(false);
  const [etat, envoyer, enCours] = useActionState(ajouterMorceau, ETAT_INITIAL);
  const idFormulaire = useId();

  useEffect(() => {
    if (etat.ok) {
      setOuvert(false);
      setManuel(false);
    } else if (etat.manuel) {
      setManuel(true);
    }
  }, [etat]);

  // React vide le formulaire après chaque action : on remet ce qui avait été saisi.
  const valeurs = etat.valeurs;
  const cochee = (id: string) =>
    valeurs ? (valeurs.playlistIds ?? "").split(",").includes(id) : id === playlistParDefaut;

  return (
    <>
      <Button
        type="button"
        size={plein ? "lg" : "md"}
        onClick={() => setOuvert(true)}
        aria-label={plein ? undefined : "Ajouter un morceau"}
        className={plein ? undefined : "h-11 px-3.5"}
      >
        <IconPlus size={18} />
        {plein ? "Ajouter un morceau" : "Ajouter"}
      </Button>

      <Sheet
        open={ouvert}
        onClose={() => setOuvert(false)}
        title="Ajouter un morceau"
        description="Colle un lien Spotify, YouTube, Deezer ou Apple Music : on récupère le titre et la pochette."
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="md" onClick={() => setOuvert(false)}>
              Annuler
            </Button>
            <Button type="submit" form={idFormulaire} size="md" disabled={enCours}>
              {enCours ? "On cherche…" : "Ajouter"}
            </Button>
          </div>
        }
      >
        <form id={idFormulaire} action={envoyer} className="flex flex-col gap-5">
          <Field label="Le lien" hint="On s'occupe du titre, de l'artiste et de la pochette.">
            <Input
              name="url"
              type="url"
              inputMode="url"
              autoComplete="off"
              maxLength={2000}
              defaultValue={valeurs?.url ?? ""}
              placeholder="https://open.spotify.com/track/…"
              data-autofocus
            />
          </Field>

          {etat.erreur ? (
            <p role="alert" className="rounded-sm bg-bad-soft px-3 py-2.5 text-sm leading-snug text-bad">
              {etat.erreur}
            </p>
          ) : null}

          {manuel ? (
            <div className="flex flex-col gap-4 rounded-sm border border-line bg-surface-2/60 p-3.5">
              <Field label="Titre">
                <Input
                  name="title"
                  maxLength={200}
                  defaultValue={valeurs?.title ?? ""}
                  placeholder="La Vie en rose"
                />
              </Field>
              <Field label="Artiste">
                <Input
                  name="artist"
                  maxLength={120}
                  defaultValue={valeurs?.artist ?? ""}
                  placeholder="Édith Piaf"
                />
              </Field>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setManuel(true)}
              className="self-start rounded-xs text-sm font-semibold text-accent-ink underline underline-offset-4 hover:text-accent"
            >
              Écrire le titre à la main
            </button>
          )}

          <Field
            label="Pourquoi ce morceau ?"
            hint="Une phrase suffit. C'est elle qu'on relira dans dix ans."
          >
            <Textarea
              name="note"
              rows={3}
              maxLength={1000}
              defaultValue={valeurs?.note ?? ""}
              placeholder="Notre premier slow, au mariage de Camille."
            />
          </Field>

          {playlists.length > 0 ? (
            <fieldset>
              <legend className="label-caps mb-2 text-ink-3">Ranger dans</legend>
              <div className="flex flex-wrap gap-2">
                {playlists.map((playlist) => (
                  <label key={playlist.id} className="cursor-pointer">
                    <input
                      type="checkbox"
                      name="playlistIds"
                      value={playlist.id}
                      defaultChecked={cochee(playlist.id)}
                      className="peer sr-only"
                    />
                    <span
                      className={cx(
                        "flex h-11 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5",
                        "text-sm font-semibold text-ink-2 transition-colors",
                        "peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent-ink",
                        "peer-focus-visible:shadow-[var(--ring)]",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: `var(--tint-${playlist.tint})` }}
                      />
                      {playlist.title}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </form>
      </Sheet>
    </>
  );
}
