"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  ajouterAPlaylist,
  modifierMorceau,
  retirerDePlaylist,
  supprimerMorceau,
} from "@/app/(app)/musique/actions";
import { Button, Field, Input, Textarea, cx } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import {
  IconCorbeille,
  IconCrayon,
  IconFermer,
  IconMusique,
  IconValider,
} from "@/components/icons";
import { IconPoints } from "@/components/musique/parties";
import { ETAT_INITIAL } from "@/lib/musique";
import type { Playlist, Track } from "@/lib/types";

type Vue = "menu" | "modifier" | "playlists" | "supprimer" | null;

const TITRES: Record<Exclude<Vue, null | "menu">, string> = {
  modifier: "Modifier le morceau",
  playlists: "Ranger dans une playlist",
  supprimer: "Supprimer ce morceau ?",
};

const LIGNE =
  "flex w-full items-center gap-3 rounded-sm px-3 py-3 text-left text-sm font-semibold " +
  "transition-colors hover:bg-surface-2";

/**
 * Le menu d'un morceau. Sur téléphone, un menu déroulant est un piège à
 * doigts : on ouvre le panneau du bas, déjà utilisé partout ailleurs, et
 * chaque vue remplace la précédente dans le même panneau.
 */
export function MenuMorceau({
  track,
  playlists,
  playlistId,
}: {
  track: Track;
  playlists: Playlist[];
  /** Renseigné sur la page d'une playlist : ajoute « Retirer d'ici ». */
  playlistId?: string;
}) {
  const [vue, setVue] = useState<Vue>(null);
  const [etat, envoyer, enCours] = useActionState(modifierMorceau, ETAT_INITIAL);
  const [enTransit, demarrer] = useTransition();

  useEffect(() => {
    if (etat.ok) setVue(null);
  }, [etat]);

  const titre = vue === "menu" ? track.title : vue ? TITRES[vue] : "";

  return (
    <>
      <button
        type="button"
        onClick={() => setVue("menu")}
        aria-label={`Options pour « ${track.title} »`}
        className="grid size-11 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <IconPoints size={20} />
      </button>

      <Sheet
        open={vue !== null}
        onClose={() => setVue(null)}
        title={titre}
        description={vue === "menu" && track.artist ? track.artist : undefined}
      >
        {vue === "menu" ? (
          <ul className="-mx-2 flex flex-col">
            <li>
              <button type="button" className={cx(LIGNE, "text-ink")} onClick={() => setVue("modifier")}>
                <IconCrayon size={19} className="text-ink-3" />
                Modifier le titre, l&apos;artiste ou la note
              </button>
            </li>
            <li>
              <button type="button" className={cx(LIGNE, "text-ink")} onClick={() => setVue("playlists")}>
                <IconMusique size={19} className="text-ink-3" />
                Ranger dans une playlist
              </button>
            </li>
            {playlistId ? (
              <li>
                <button
                  type="button"
                  className={cx(LIGNE, "text-ink")}
                  disabled={enTransit}
                  onClick={() => {
                    demarrer(async () => {
                      await retirerDePlaylist(track.id, playlistId);
                    });
                    setVue(null);
                  }}
                >
                  <IconFermer size={19} className="text-ink-3" />
                  Retirer de cette playlist
                </button>
              </li>
            ) : null}
            <li>
              <button type="button" className={cx(LIGNE, "text-bad")} onClick={() => setVue("supprimer")}>
                <IconCorbeille size={19} />
                Supprimer
              </button>
            </li>
          </ul>
        ) : null}

        {vue === "modifier" ? (
          <form action={envoyer} className="flex flex-col gap-4">
            <input type="hidden" name="trackId" value={track.id} />
            <Field label="Titre">
              <Input
                name="title"
                defaultValue={etat.valeurs?.title ?? track.title}
                required
                maxLength={200}
                data-autofocus
              />
            </Field>
            <Field label="Artiste">
              <Input
                name="artist"
                defaultValue={etat.valeurs?.artist ?? track.artist ?? ""}
                maxLength={120}
              />
            </Field>
            <Field label="Lien" hint="Un lien Spotify, YouTube, Deezer ou Apple Music active le lecteur.">
              <Input
                name="url"
                type="url"
                inputMode="url"
                defaultValue={etat.valeurs?.url ?? track.url}
                maxLength={2000}
                placeholder="https://"
              />
            </Field>
            <Field label="Pourquoi ce morceau ?" hint="C'est la note qu'on relira dans dix ans.">
              <Textarea
                name="note"
                defaultValue={etat.valeurs?.note ?? track.note ?? ""}
                rows={3}
                maxLength={1000}
              />
            </Field>

            {etat.erreur ? (
              <p role="alert" className="rounded-sm bg-bad-soft px-3 py-2 text-sm text-bad">
                {etat.erreur}
              </p>
            ) : null}

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

        {vue === "playlists" ? (
          <ChoixPlaylists track={track} playlists={playlists} />
        ) : null}

        {vue === "supprimer" ? (
          <div className="flex flex-col gap-5">
            <p className="text-sm leading-relaxed text-ink-2">
              « {track.title} » sera retiré de la bibliothèque et de toutes les playlists. La note
              qui l&apos;accompagne partira avec.
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
                    await supprimerMorceau(track.id);
                  });
                  setVue(null);
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

/* ---------------------------- Choix des playlists ------------------------- */

function ChoixPlaylists({ track, playlists }: { track: Track; playlists: Playlist[] }) {
  const [enCours, demarrer] = useTransition();

  if (playlists.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-ink-2">
        Aucune playlist pour l&apos;instant. Crée-en une depuis la page Musique, puis reviens
        ranger ce morceau.
      </p>
    );
  }

  return (
    <ul className="-mx-2 flex flex-col">
      {playlists.map((playlist) => {
        const dedans = track.playlistIds.includes(playlist.id);
        return (
          <li key={playlist.id}>
            <button
              type="button"
              aria-pressed={dedans}
              disabled={enCours}
              onClick={() => {
                demarrer(async () => {
                  if (dedans) await retirerDePlaylist(track.id, playlist.id);
                  else await ajouterAPlaylist(track.id, playlist.id);
                });
              }}
              className={cx(LIGNE, "justify-between text-ink disabled:opacity-60")}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className="size-3.5 shrink-0 rounded-full"
                  style={{ background: `var(--tint-${playlist.tint})` }}
                />
                <span className="truncate">{playlist.title}</span>
              </span>
              <span
                className={cx(
                  "grid size-6 shrink-0 place-items-center rounded-full transition-colors",
                  dedans ? "bg-accent text-accent-on" : "border border-line-strong text-transparent",
                )}
              >
                <IconValider size={14} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
