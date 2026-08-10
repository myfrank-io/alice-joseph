import Link from "next/link";
import { requireWho } from "@/lib/auth";
import { listMany } from "@/lib/data/store";
import { PageHeader } from "@/components/page-header";
import { EmptyState, SectionTitle } from "@/components/ui";
import { IconMusique } from "@/components/icons";
import { plural } from "@/lib/format";
import type { Playlist, Settings, Track } from "@/lib/types";
import { AjouterMorceau } from "@/components/musique/ajouter-morceau";
import { CarteMorceau, type Avatars } from "@/components/musique/carte-morceau";
import { MorceauDuMoment } from "@/components/musique/morceau-du-moment";
import { BoutonNouvellePlaylist } from "@/components/musique/playlist-formulaire";
import { RangeePlaylists } from "@/components/musique/rangee-playlists";
import { FiltresBibliotheque, appliquerFiltre, lireFiltre } from "@/components/musique/filtres";

/**
 * Le dernier morceau que les deux ont aimé passe devant. Sinon, le dernier
 * arrivé : la page ne s'ouvre jamais sur une absence.
 */
function morceauDuMoment(tracks: Track[]): { track: Track; partage: boolean } | null {
  const aime = tracks.find(
    (track) => track.loves.includes("alice") && track.loves.includes("joseph"),
  );
  if (aime) return { track: aime, partage: true };
  return tracks[0] ? { track: tracks[0], partage: false } : null;
}

export default async function MusiquePage({
  searchParams,
}: {
  searchParams: Promise<{ [cle: string]: string | string[] | undefined }>;
}) {
  const who = await requireWho();
  const params = await searchParams;
  const filtre = lireFiltre(params.filtre);

  const donnees = await listMany(["tracks", "playlists", "settings"]);
  const tracks = donnees.tracks as Track[];
  const playlists = donnees.playlists as Playlist[];
  const reglages = (donnees.settings as Settings[])[0];
  const avatars: Avatars = { alice: reglages?.aliceAvatar, joseph: reglages?.josephAvatar };

  const moment = morceauDuMoment(tracks);
  const visibles = appliquerFiltre(tracks, filtre);

  const sousTitre =
    tracks.length === 0
      ? "Rien encore : le premier lien collé lance tout"
      : `${tracks.length} ${plural(tracks.length, "morceau", "morceaux")} · ${playlists.length} ${plural(playlists.length, "playlist", "playlists")}`;

  return (
    <>
      <PageHeader
        title="Musique"
        subtitle={sousTitre}
        action={<AjouterMorceau playlists={playlists} />}
      />

      <div className="mt-6 flex flex-col gap-10 lg:mt-8 lg:gap-12">
        {moment ? (
          <MorceauDuMoment
            track={moment.track}
            who={who}
            playlists={playlists}
            avatars={avatars}
            partage={moment.partage}
          />
        ) : null}

        <section>
          <SectionTitle
            eyebrow="À écouter d'affilée"
            title="Playlists"
            action={<BoutonNouvellePlaylist />}
          />
          <div className="mt-4">
            {playlists.length > 0 ? (
              <RangeePlaylists playlists={playlists} tracks={tracks} />
            ) : (
              <p className="rounded-lg border border-dashed border-line-strong bg-surface-2/50 px-4 py-6 text-center text-sm leading-relaxed text-ink-2">
                Aucune playlist. Une pour la voiture, une pour le dimanche matin, et la
                bibliothèque commence à ressembler à quelque chose.
              </p>
            )}
          </div>
        </section>

        <section id="bibliotheque">
          <SectionTitle
            eyebrow="Tout ce qu'on a gardé"
            title="La bibliothèque"
            action={
              <span className="text-sm text-ink-3">
                {visibles.length} {plural(visibles.length, "morceau", "morceaux")}
              </span>
            }
          />

          <div className="mt-4">
            <FiltresBibliotheque actif={filtre} />
          </div>

          <div className="mt-5">
            {tracks.length === 0 ? (
              <EmptyState
                icon={<IconMusique size={24} />}
                title="La bibliothèque est vide"
                action={<AjouterMorceau playlists={playlists} plein />}
              >
                Colle un lien Spotify ou YouTube, on s&apos;occupe du reste : titre, pochette et
                lecteur arrivent tout seuls. À toi d&apos;écrire pourquoi ce morceau compte.
              </EmptyState>
            ) : visibles.length === 0 ? (
              <EmptyState icon={<IconMusique size={24} />} title="Rien de ce côté-là">
                Aucun morceau ne correspond à ce filtre.{" "}
                <Link
                  href="/musique"
                  scroll={false}
                  className="font-semibold text-accent-ink underline underline-offset-2"
                >
                  Revenir à tout
                </Link>
                .
              </EmptyState>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {visibles.map((track) => (
                  <li key={track.id}>
                    <CarteMorceau
                      track={track}
                      who={who}
                      playlists={playlists}
                      avatars={avatars}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
