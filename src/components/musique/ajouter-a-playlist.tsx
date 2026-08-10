"use client";

import { useMemo, useState, useTransition } from "react";
import { ajouterAPlaylist } from "@/app/(app)/musique/actions";
import { Button, Input, cx } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { IconPlus, IconRecherche, IconValider } from "@/components/icons";
import { Pochette } from "@/components/musique/parties";
import type { Playlist, Track } from "@/lib/types";

function sansAccent(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Piocher dans la bibliothèque pour garnir une playlist. */
export function AjouterDesMorceaux({
  playlist,
  candidats,
}: {
  playlist: Playlist;
  candidats: Track[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [ajoutes, setAjoutes] = useState<string[]>([]);
  const [enCours, demarrer] = useTransition();

  const listes = useMemo(() => {
    const terme = sansAccent(recherche.trim());
    if (!terme) return candidats;
    return candidats.filter((track) =>
      sansAccent(`${track.title} ${track.artist ?? ""}`).includes(terme),
    );
  }, [candidats, recherche]);

  return (
    <>
      <Button type="button" variant="soft" size="md" onClick={() => setOuvert(true)} className="h-11">
        <IconPlus size={17} />
        Piocher dans la bibliothèque
      </Button>

      <Sheet
        open={ouvert}
        onClose={() => setOuvert(false)}
        title="Ajouter des morceaux"
        description={`Ils resteront aussi dans la bibliothèque. Playlist : ${playlist.title}.`}
        size="lg"
        footer={
          <div className="flex justify-end">
            <Button type="button" variant="soft" size="md" onClick={() => setOuvert(false)}>
              Terminé
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3">
              <IconRecherche size={17} />
            </span>
            <Input
              type="search"
              value={recherche}
              onChange={(event) => setRecherche(event.target.value)}
              placeholder="Chercher un titre ou un artiste"
              aria-label="Chercher un morceau"
              className="pl-9"
              data-autofocus
            />
          </div>

          {candidats.length === 0 ? (
            <p className="py-6 text-center text-sm leading-relaxed text-ink-2">
              Toute la bibliothèque est déjà dans cette playlist.
            </p>
          ) : listes.length === 0 ? (
            <p className="py-6 text-center text-sm leading-relaxed text-ink-2">
              Aucun morceau ne correspond à « {recherche} ».
            </p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {listes.map((track) => {
                const dedans = ajoutes.includes(track.id);
                return (
                  <li key={track.id}>
                    <button
                      type="button"
                      disabled={dedans || enCours}
                      aria-label={`Ajouter « ${track.title} » à ${playlist.title}`}
                      onClick={() => {
                        setAjoutes((liste) => [...liste, track.id]);
                        demarrer(async () => {
                          await ajouterAPlaylist(track.id, playlist.id);
                        });
                      }}
                      className={cx(
                        "flex w-full items-center gap-3 rounded-sm px-2 py-2.5 text-left transition-colors",
                        "hover:bg-surface-2 disabled:opacity-60 disabled:hover:bg-transparent",
                      )}
                    >
                      <Pochette src={track.artworkUrl} className="size-11" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">
                          {track.title}
                        </span>
                        {track.artist ? (
                          <span className="block truncate text-xs text-ink-3">{track.artist}</span>
                        ) : null}
                      </span>
                      <span
                        className={cx(
                          "grid size-8 shrink-0 place-items-center rounded-full",
                          dedans ? "bg-accent text-accent-on" : "bg-surface-2 text-ink-2",
                        )}
                      >
                        {dedans ? <IconValider size={16} /> : <IconPlus size={16} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Sheet>
    </>
  );
}
