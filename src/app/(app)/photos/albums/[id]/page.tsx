import { notFound } from "next/navigation";
import { requireWho } from "@/lib/auth";
import { listMany } from "@/lib/data/store";
import type { Album, Photo } from "@/lib/types";
import { plural } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui";
import { IconPhotos } from "@/components/icons";
import { Galerie } from "@/components/photos/gallery";
import { BoutonAjouter } from "@/components/photos/import-sheet";
import { AjouterDesPhotos, OutilsAlbum } from "@/components/photos/album-tools";
import {
  lieuxConnus,
  periodeCouverte,
  photosDeLAlbum,
  trierPhotos,
} from "@/components/photos/shared";

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  await requireWho();

  const { id } = await params;
  const donnees = await listMany(["photos", "albums"]);
  const albums = donnees.albums as Album[];
  const album = albums.find((candidat) => candidat.id === id);
  if (!album) notFound();

  const toutes = trierPhotos(donnees.photos as Photo[]);
  const photos = photosDeLAlbum(toutes, album.id);
  const disponibles = toutes.filter((photo) => !photo.albumIds.includes(album.id));

  const periode = periodeCouverte(photos);
  const sousTitre = [
    `${photos.length} ${plural(photos.length, "photo", "photos")}`,
    periode,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader
        title={album.title}
        subtitle={sousTitre}
        back={{ href: "/photos?vue=albums", label: "Retour aux albums" }}
        action={<OutilsAlbum album={album} />}
      />

      {album.description ? (
        <p className="mt-4 max-w-[60ch] text-sm leading-relaxed text-ink-2">
          {album.description}
        </p>
      ) : null}

      {photos.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<IconPhotos size={22} />}
            title="Album vide"
            action={
              <Commandes
                album={album}
                albums={albums}
                photos={toutes}
                restantes={disponibles}
              />
            }
          >
            Choisis des photos déjà dans la bibliothèque, ou importes-en de nouvelles.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-5">
            <Commandes
              album={album}
              albums={albums}
              photos={toutes}
              restantes={disponibles}
              discret
            />
          </div>
          <div className="mt-6">
            <Galerie photos={photos} albums={albums} album={album} />
          </div>
        </>
      )}
    </>
  );
}

/** Les deux façons de remplir un album : piocher, ou importer. */
function Commandes({
  album,
  albums,
  photos,
  restantes,
  discret = false,
}: {
  album: Album;
  albums: Album[];
  photos: Photo[];
  restantes: Photo[];
  discret?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
      <AjouterDesPhotos
        album={album}
        photos={restantes}
        variant={discret ? "soft" : "primary"}
      />
      <BoutonAjouter
        albums={albums}
        albumId={album.id}
        lieux={lieuxConnus(photos)}
        libelle="Importer"
        variant="soft"
      />
    </div>
  );
}
