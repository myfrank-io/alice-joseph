import Link from "next/link";
import { requireWho } from "@/lib/auth";
import { listMany } from "@/lib/data/store";
import { souvenirDuJour } from "@/lib/souvenir";
import type {
  Album,
  Connect4Game,
  Photo,
  Place,
  Playlist,
  Post,
  Settings,
  Track,
  Who,
} from "@/lib/types";
import { Avatar, AvatarPair, Card, cx, LinkButton } from "@/components/ui";
import {
  IconCarte,
  IconFleche,
  IconJeux,
  IconMusique,
  IconPhotos,
  IconReglages,
} from "@/components/icons";
import {
  daysSince,
  formatAgo,
  formatDay,
  formatNumber,
  formatShortDate,
  whoLabel,
} from "@/lib/format";

export default async function NousPage() {
  const who = await requireWho();

  const data = await listMany([
    "photos",
    "posts",
    "albums",
    "tracks",
    "playlists",
    "places",
    "games",
    "settings",
  ]);

  const photos = data.photos as Photo[];
  const posts = data.posts as Post[];
  const albums = data.albums as Album[];
  const tracks = data.tracks as Track[];
  const playlists = data.playlists as Playlist[];
  const places = data.places as Place[];
  const games = data.games as Connect4Game[];
  const reglages = (data.settings as Settings[]).find((doc) => doc.id === "settings");

  const souvenir = souvenirDuJour(photos);
  const dernierPost = posts.find((post) => post.body.trim().length > 0);
  const jours = reglages?.since ? daysSince(reglages.since) : null;

  const paysVisites = new Set(
    places.filter((place) => place.kind === "visite").map((place) => place.country),
  ).size;

  const partiesTerminees = games.filter(
    (game) => game.kind === "puissance4" && game.status === "terminee",
  );
  const victoires = {
    alice: partiesTerminees.filter((game) => game.state?.winner === "alice").length,
    joseph: partiesTerminees.filter((game) => game.state?.winner === "joseph").length,
  };

  return (
    <>
      <header className="flex items-start justify-between gap-4 pb-8 pt-7 lg:pt-12">
        <div className="min-w-0">
          <p className="label-caps text-ink-3">{formatDay(new Date().toISOString())}</p>
          <h1 className="mt-2 font-display text-display leading-[1.04] tracking-tight text-ink">
            {salutation()} {whoLabel(who)}
          </h1>
          {jours !== null ? (
            <p className="mt-3 flex flex-wrap items-center gap-2.5 text-sm text-ink-2">
              <AvatarPair size={26} />
              <span>
                <span className="tabular font-semibold text-ink">{formatNumber(jours)}</span> jours
                ensemble
              </span>
            </p>
          ) : null}
        </div>

        <Link
          href="/reglages"
          aria-label="Réglages"
          className="grid size-10 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
        >
          <IconReglages size={20} />
        </Link>
      </header>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="lg:col-span-3">
          {souvenir ? (
            <Link
              href="/photos"
              className="group block overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={souvenir.photo.url}
                  alt={souvenir.photo.caption ?? ""}
                  className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                  loading="eager"
                  decoding="async"
                />
                <div className="absolute inset-x-0 top-0 p-4">
                  <span className="label-caps rounded-full bg-[color-mix(in_oklab,var(--ink)_55%,transparent)] px-3 py-1.5 text-[color:var(--ground)] backdrop-blur-sm">
                    {souvenir.accroche}
                  </span>
                </div>
              </div>
              <div className="flex items-end justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-display text-heading leading-snug text-ink">
                    {souvenir.photo.caption ?? "Sans légende"}
                  </p>
                  <p className="mt-1 text-[0.8125rem] text-ink-3">
                    {[
                      souvenir.photo.place,
                      souvenir.photo.takenAt ? formatShortDate(souvenir.photo.takenAt) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2 transition-transform group-hover:translate-x-0.5">
                  <IconFleche size={17} />
                </span>
              </div>
            </Link>
          ) : (
            <Card className="p-6">
              <p className="font-display text-heading text-ink">Pas encore de souvenir</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                Ajoute quelques photos et cette place accueillera, chaque jour, une image prise
                le même jour une autre année.
              </p>
              <LinkButton href="/photos" size="sm" className="mt-4">
                Ajouter des photos
              </LinkButton>
            </Card>
          )}
        </section>

        <div className="flex flex-col gap-4 lg:col-span-2">
          {dernierPost ? <DernierMot post={dernierPost} viewer={who} /> : null}

          <div className="grid grid-cols-2 gap-3">
            <Tuile
              href="/photos"
              tint="--tint-photos"
              icon={<IconPhotos size={19} />}
              valeur={formatNumber(photos.length)}
              libelle={photos.length > 1 ? "photos" : "photo"}
              detail={albums.length > 0 ? `${albums.length} albums` : undefined}
            />
            <Tuile
              href="/musique"
              tint="--tint-musique"
              icon={<IconMusique size={19} />}
              valeur={formatNumber(tracks.length)}
              libelle={tracks.length > 1 ? "morceaux" : "morceau"}
              detail={playlists.length > 0 ? `${playlists.length} playlists` : undefined}
            />
            <Tuile
              href="/carte"
              tint="--tint-carte"
              icon={<IconCarte size={19} />}
              valeur={formatNumber(paysVisites)}
              libelle={paysVisites > 1 ? "pays" : "pays"}
              detail={`${places.filter((p) => p.kind === "visite").length} lieux`}
            />
            <Tuile
              href="/jeux"
              tint="--tint-jeux"
              icon={<IconJeux size={19} />}
              valeur={
                partiesTerminees.length > 0 ? `${victoires.alice}–${victoires.joseph}` : "Jouer"
              }
              libelle={partiesTerminees.length > 0 ? "Alice / Joseph" : "puissance 4, qui est-ce"}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/* --------------------------------------------------------------------------- */

function DernierMot({ post, viewer }: { post: Post; viewer: Who }) {
  const deLautre = post.by !== viewer;

  return (
    <Link
      href="/fil"
      className="group block rounded-lg border border-line bg-surface p-4 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]"
    >
      <p className="label-caps mb-3 text-ink-3">
        {deLautre ? `Le dernier mot de ${whoLabel(post.by)}` : "Ton dernier mot"}
      </p>
      <div className="flex gap-3">
        <Avatar who={post.by} size={34} ring={deLautre} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-3 text-sm leading-relaxed text-ink">{post.body}</p>
          <p className="mt-2 flex items-center gap-2 text-xs text-ink-3">
            <span>{formatAgo(post.createdAt)}</span>
            {post.comments.length > 0 ? (
              <span>
                · {post.comments.length}{" "}
                {post.comments.length > 1 ? "réponses" : "réponse"}
              </span>
            ) : null}
          </p>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-accent-ink transition-transform group-hover:translate-x-0.5">
        Ouvrir le fil <IconFleche size={13} />
      </p>
    </Link>
  );
}

function Tuile({
  href,
  tint,
  icon,
  valeur,
  libelle,
  detail,
}: {
  href: string;
  tint: string;
  icon: React.ReactNode;
  valeur: string;
  libelle: string;
  detail?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "group flex flex-col justify-between rounded-md border border-line p-3.5",
        "transition-transform hover:-translate-y-0.5",
      )}
      style={{ background: `color-mix(in oklab, var(${tint}) 22%, var(--surface))` }}
    >
      <span className="text-ink-2">{icon}</span>
      <span className="mt-5 block">
        <span className="tabular block font-display text-[1.5rem] leading-none text-ink">
          {valeur}
        </span>
        <span className="mt-1 block text-xs font-semibold text-ink-2">{libelle}</span>
        {detail ? <span className="mt-0.5 block text-[0.6875rem] text-ink-3">{detail}</span> : null}
      </span>
    </Link>
  );
}

/** Le fuseau est fixé côté serveur, pour que la salutation colle à l'heure de Paris. */
function salutation(): string {
  const heure = Number(
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
  if (heure < 6) return "Bonne nuit";
  if (heure < 12) return "Bonjour";
  if (heure < 18) return "Bel après-midi";
  return "Bonsoir";
}
