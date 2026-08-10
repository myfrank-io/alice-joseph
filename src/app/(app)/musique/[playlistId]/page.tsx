import { notFound } from "next/navigation";
import { requireWho } from "@/lib/auth";
import { get, listMany } from "@/lib/data/store";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui";
import { IconMusique } from "@/components/icons";
import { plural, possessive } from "@/lib/format";
import type { Playlist, Settings, Track } from "@/lib/types";
import { AjouterDesMorceaux } from "@/components/musique/ajouter-a-playlist";
import { AjouterMorceau } from "@/components/musique/ajouter-morceau";
import { CarteMorceau, type Avatars } from "@/components/musique/carte-morceau";
import { MenuPlaylist } from "@/components/musique/playlist-formulaire";
import { PochetteComposite } from "@/components/musique/rangee-playlists";

export default async function PlaylistPage({
  params,
}: {
  params: Promise<{ playlistId: string }>;
}) {
  const who = await requireWho();
  const { playlistId } = await params;

  const playlist = await get<Playlist>("playlists", playlistId);
  if (!playlist) notFound();

  const donnees = await listMany(["tracks", "playlists", "settings"]);
  const tracks = donnees.tracks as Track[];
  const playlists = donnees.playlists as Playlist[];
  const reglages = (donnees.settings as Settings[])[0];
  const avatars: Avatars = { alice: reglages?.aliceAvatar, joseph: reglages?.josephAvatar };

  // Dans l'ordre où on les a rangés ici : c'est le seul ordre qu'on connaisse.
  const dedans = tracks
    .filter((track) => track.playlistIds.includes(playlist.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const dehors = tracks.filter((track) => !track.playlistIds.includes(playlist.id));

  const pochettes = dedans
    .map((track) => track.artworkUrl)
    .filter((url): url is string => Boolean(url))
    .slice(0, 4);
  const aimesDesDeux = dedans.filter(
    (track) => track.loves.includes("alice") && track.loves.includes("joseph"),
  ).length;

  return (
    <>
      <PageHeader
        title={playlist.title}
        subtitle={`${dedans.length} ${plural(dedans.length, "morceau", "morceaux")} · créée par ${possessive(playlist.by, who)}`}
        back={{ href: "/musique", label: "Retour à la musique" }}
        action={<MenuPlaylist playlist={playlist} />}
      />

      <div className="mt-6 flex flex-col gap-8">
        <section
          className="overflow-hidden rounded-lg border border-line p-4 sm:p-6"
          style={{
            background: `color-mix(in oklab, var(--tint-${playlist.tint}) 22%, var(--surface))`,
          }}
        >
          <div className="flex items-start gap-4 sm:gap-5">
            <span className="block w-24 shrink-0 sm:w-32">
              <PochetteComposite pochettes={pochettes} tint={playlist.tint} />
            </span>

            <div className="min-w-0 flex-1">
              {playlist.description ? (
                <p className="font-display text-[0.9375rem] italic leading-relaxed text-ink-2">
                  {playlist.description}
                </p>
              ) : null}

              <p className="mt-2 text-xs text-ink-3">
                {dedans.length} {plural(dedans.length, "morceau", "morceaux")}
                {aimesDesDeux > 0
                  ? ` · ${aimesDesDeux} ${plural(aimesDesDeux, "aimé", "aimés")} tous les deux`
                  : ""}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <AjouterDesMorceaux playlist={playlist} candidats={dehors} />
                <AjouterMorceau playlists={playlists} playlistParDefaut={playlist.id} />
              </div>
            </div>
          </div>
        </section>

        <section>
          {dedans.length === 0 ? (
            <EmptyState icon={<IconMusique size={24} />} title="Playlist vide">
              Pioche des morceaux déjà gardés, ou colle un lien Spotify ou YouTube : on
              s&apos;occupe du reste. Les deux boutons sont juste au-dessus.
            </EmptyState>
          ) : (
            <ol className="flex flex-col gap-3">
              {dedans.map((track, rang) => (
                <li key={track.id}>
                  <CarteMorceau
                    track={track}
                    who={who}
                    playlists={playlists}
                    playlistId={playlist.id}
                    index={rang + 1}
                    avatars={avatars}
                  />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
