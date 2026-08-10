import { requireWho } from "@/lib/auth";
import { listMany } from "@/lib/data/store";
import type { Photo, Place } from "@/lib/types";
import { formatNumber, plural } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState, SectionTitle, cx } from "@/components/ui";
import { IconCarte, IconChevronDroite } from "@/components/icons";
import {
  DEPART,
  calculerStatistiques,
  formatDateLieu,
  grouperParAnnee,
  type PhotoLegere,
  type Statistiques,
} from "@/lib/carte/lieu";
import { AtelierCarte, BoutonAjouterLieu, Carte, OuvrirLieu } from "@/app/(app)/carte/vue-carte";

/**
 * Carte : une mapmonde et son carnet.
 *
 * La carte occupe le haut de l'écran, la liste reprend tout en dessous — même
 * panneau, mêmes gestes, au clavier comme au doigt. Ce qui est faisable sur une
 * épingle est faisable sur sa ligne, et réciproquement.
 */

export default async function CartePage() {
  await requireWho();

  const donnees = await listMany(["places", "photos"]);
  const lieux = donnees.places as Place[];
  const bibliotheque = donnees.photos as Photo[];

  /* Les photos partent allégées : le formulaire y pioche, le panneau y relit celles
     qui sont rattachées. Rien de plus qu'une vignette, une image et sa légende. */
  const photos: PhotoLegere[] = bibliotheque.map((photo) => ({
    id: photo.id,
    url: photo.url,
    thumbUrl: photo.thumbUrl,
    caption: photo.caption,
  }));
  const existantes = new Set(photos.map((photo) => photo.id));
  const compterPhotos = (lieu: Place) =>
    lieu.photoIds.filter((id) => existantes.has(id)).length;

  const stats = calculerStatistiques(lieux);
  const { annees, envies } = grouperParAnnee(lieux);

  const sousTitre =
    lieux.length === 0
      ? "Rien encore : le monde entier reste à épingler"
      : [
          `${formatNumber(stats.pays)} pays`,
          `${formatNumber(stats.villes)} ${plural(stats.villes, "lieu", "lieux")}`,
          stats.envies > 0
            ? `${formatNumber(stats.envies)} ${plural(stats.envies, "envie", "envies")}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <AtelierCarte lieux={lieux} photos={photos}>
      <PageHeader title="Carte" subtitle={sousTitre} action={<BoutonAjouterLieu />} />

      <div className="mt-4 lg:mt-6">
        <Carte />
      </div>

      {lieux.length === 0 ? (
        <div className="mt-8 lg:mt-10">
          <EmptyState
            icon={<IconCarte size={22} />}
            title="La carte est encore vierge"
            action={<BoutonAjouterLieu plein />}
          >
            Le premier point est souvent le plus simple&nbsp;: là où vous vivez. Ensuite chaque
            voyage ajoute une épingle, chaque pays se teinte, et il y a de la place pour les
            endroits dont vous rêvez encore.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-5 lg:mt-6">
            <Compteurs stats={stats} />
          </div>

          <div className="mt-10 lg:mt-14">
            <SectionTitle eyebrow="Tout ce qui est sur la carte" title="Lieu par lieu" />

            <div className="mt-5 flex flex-col gap-8">
              {annees.map((groupe) => (
                <Groupe
                  key={groupe.annee ?? "sans-date"}
                  titre={groupe.annee !== null ? String(groupe.annee) : "Sans date"}
                  compte={`${groupe.lieux.length} ${plural(groupe.lieux.length, "lieu", "lieux")}`}
                  lieux={groupe.lieux}
                  compterPhotos={compterPhotos}
                />
              ))}

              {envies.length > 0 ? (
                <Groupe
                  titre="Un jour"
                  compte={`${envies.length} ${plural(envies.length, "envie", "envies")}`}
                  lieux={envies}
                  compterPhotos={compterPhotos}
                />
              ) : null}
            </div>
          </div>
        </>
      )}
    </AtelierCarte>
  );
}

/* ------------------------------- Compteurs -------------------------------- */

function Compteurs({ stats }: { stats: Statistiques }) {
  const cellules: { libelle: string; valeur: string; detail: string }[] = [
    {
      libelle: "Pays",
      valeur: formatNumber(stats.pays),
      detail: "où l’on est allés",
    },
    {
      libelle: plural(stats.villes, "Lieu", "Lieux"),
      valeur: formatNumber(stats.villes),
      detail: plural(stats.villes, "épingle posée", "épingles posées"),
    },
    {
      libelle: plural(stats.envies, "Envie", "Envies"),
      valeur: formatNumber(stats.envies),
      detail: "en attente d’une date",
    },
    stats.plusLoin
      ? {
          libelle: "Le plus loin",
          valeur: `${formatNumber(Math.round(stats.plusLoin.km))} km`,
          detail: `${stats.plusLoin.lieu.name}, depuis ${DEPART.nom}`,
        }
      : {
          libelle: "Le plus loin",
          valeur: "—",
          detail: `à mesurer depuis ${DEPART.nom}`,
        },
  ];

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
      {cellules.map((cellule) => (
        <div key={cellule.libelle} className="bg-surface px-4 py-3.5">
          <dt className="label-caps text-ink-3">{cellule.libelle}</dt>
          <dd className="mt-1.5">
            <span className="tabular block font-display text-title text-ink">{cellule.valeur}</span>
            <span className="mt-0.5 block truncate text-xs text-ink-3">{cellule.detail}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* --------------------------------- Le carnet ------------------------------ */

function Groupe({
  titre,
  compte,
  lieux,
  compterPhotos,
}: {
  titre: string;
  compte: string;
  lieux: Place[];
  compterPhotos: (lieu: Place) => number;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
        <h3 className="font-display text-heading text-ink">{titre}</h3>
        <span className="shrink-0 text-xs font-semibold text-ink-3">{compte}</span>
      </div>

      <ul className="mt-1.5">
        {lieux.map((lieu) => (
          <li key={lieu.id}>
            <LigneLieu lieu={lieu} photos={compterPhotos(lieu)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LigneLieu({ lieu, photos }: { lieu: Place; photos: number }) {
  const date = formatDateLieu(lieu.visitedAt);
  const second = [lieu.country, date].filter(Boolean).join(" · ");

  return (
    <OuvrirLieu
      id={lieu.id}
      className={cx(
        "flex min-h-[3.5rem] w-full items-center gap-3.5 rounded-sm px-3 py-2.5 text-left",
        "transition-colors hover:bg-surface-2 data-[actif]:bg-surface-2",
      )}
    >
      {/* La même grammaire que la légende de la carte : plein = visité, pointillé = envie. */}
      <span
        aria-hidden="true"
        className={cx(
          "size-2.5 shrink-0 rounded-full",
          lieu.kind === "visite" ? "bg-accent" : "border-2 border-dotted border-warn",
        )}
      />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-semibold text-ink">{lieu.name}</span>
        <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-3">{second}</span>
      </span>

      {photos > 0 ? (
        <span className="shrink-0 text-xs font-semibold text-ink-3">
          {photos} {plural(photos, "photo", "photos")}
        </span>
      ) : null}

      <IconChevronDroite size={18} className="shrink-0 text-ink-3" />
    </OuvrirLieu>
  );
}
