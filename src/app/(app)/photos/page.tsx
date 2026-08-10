import { requireWho } from "@/lib/auth";
import { listMany } from "@/lib/data/store";
import type { Album, Photo } from "@/lib/types";
import { formatNumber, plural } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState, LinkButton } from "@/components/ui";
import { IconCoeur, IconPhotos } from "@/components/icons";
import { Filtres, Segments } from "@/components/photos/segments";
import { Galerie } from "@/components/photos/gallery";
import { CartesAlbums } from "@/components/photos/albums-view";
import { BoutonAjouter } from "@/components/photos/import-sheet";
import { BoutonNouvelAlbum } from "@/components/photos/album-create";
import {
  FILTRES,
  filtrerPhotos,
  lienPhotos,
  lieuxConnus,
  lireFiltre,
  lireVue,
  trierPhotos,
  type Filtre,
} from "@/components/photos/shared";

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireWho();

  const params = await searchParams;
  const vue = lireVue(params.vue);
  const filtre = lireFiltre(params.par);

  const donnees = await listMany(["photos", "albums"]);
  const toutes = trierPhotos(donnees.photos as Photo[]);
  const albums = donnees.albums as Album[];
  const photos = filtrerPhotos(toutes, filtre);
  const lieux = lieuxConnus(toutes);

  const sousTitre =
    toutes.length === 0
      ? "La mémoire visuelle de vous deux"
      : `${formatNumber(toutes.length)} ${plural(toutes.length, "photo", "photos")} · ` +
        `${albums.length} ${plural(albums.length, "album", "albums")}`;

  return (
    <>
      <PageHeader
        title="Photos"
        subtitle={sousTitre}
        action={<BoutonAjouter albums={albums} lieux={lieux} />}
      />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:mt-6">
        <Segments vue={vue} filtre={filtre} />
        {vue === "albums" ? <BoutonNouvelAlbum /> : <Filtres vue={vue} filtre={filtre} />}
      </div>

      <div className="mt-6">
        {vue === "albums" ? (
          albums.length === 0 ? (
            <EmptyState
              icon={<IconPhotos size={22} />}
              title="Pas encore d’album"
              action={<BoutonNouvelAlbum variant="primary" />}
            >
              Un album, c&apos;est une parenthèse&nbsp;: un voyage, une saison, une soirée.
              Rassemble les photos qui vont ensemble.
            </EmptyState>
          ) : (
            <CartesAlbums albums={albums} photos={toutes} />
          )
        ) : photos.length === 0 ? (
          <VidePhotos filtre={filtre} vide={toutes.length === 0} albums={albums} lieux={lieux} />
        ) : (
          <Galerie photos={photos} albums={albums} groupee={vue === "moments"} />
        )}
      </div>
    </>
  );
}

/* ------------------------------- États vides ------------------------------ */

function VidePhotos({
  filtre,
  vide,
  albums,
  lieux,
}: {
  filtre: Filtre;
  vide: boolean;
  albums: Album[];
  lieux: string[];
}) {
  if (vide) {
    return (
      <EmptyState
        icon={<IconPhotos size={22} />}
        title="Rien à regarder pour l’instant"
        action={<BoutonAjouter albums={albums} lieux={lieux} />}
      >
        La première photo est toujours la plus difficile. Ensuite, ça défile tout seul.
      </EmptyState>
    );
  }

  const libelle = FILTRES.find((item) => item.valeur === filtre)?.libelle ?? "";

  return (
    <EmptyState
      icon={filtre === "favorites" ? <IconCoeur size={22} /> : <IconPhotos size={22} />}
      title={filtre === "favorites" ? "Aucune favorite" : "Rien avec ce filtre"}
      action={
        <LinkButton variant="soft" href={lienPhotos("grille", "toutes")}>
          Voir toutes les photos
        </LinkButton>
      }
    >
      {filtre === "favorites"
        ? "Ouvre une photo et touche le cœur : elle se retrouvera ici."
        : `Aucune photo ne correspond à « ${libelle} » pour le moment.`}
    </EmptyState>
  );
}
