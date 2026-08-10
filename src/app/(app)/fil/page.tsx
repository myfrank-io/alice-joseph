import { requireWho } from "@/lib/auth";
import { listMany } from "@/lib/data/store";
import type { Photo, Post } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { IconEpingle } from "@/components/icons";
import { formatDay, plural } from "@/lib/format";
import { lireEtMarquerVu } from "./actions";
import { ComposerProvider, ComposerTrigger, FilVide } from "@/components/fil/composer";
import { PostCard } from "@/components/fil/post-card";
import type { PostPhoto } from "@/components/fil/photos";

/* ------------------------------- Les journées ----------------------------- */

/** Clé de jour à Paris, pour regrouper sans se faire piéger par le fuseau. */
const cleFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function cleJour(iso: string): string {
  return cleFormatter.format(new Date(iso));
}

function libelleJour(iso: string, aujourdHui: string, hier: string): string {
  const cle = cleJour(iso);
  if (cle === aujourdHui) return "Aujourd’hui";
  if (cle === hier) return "Hier";
  return formatDay(iso);
}

interface Journee {
  cle: string;
  libelle: string;
  posts: Post[];
}

/* ---------------------------------- Page ---------------------------------- */

export default async function FilPage() {
  const who = await requireWho();
  const depuis = await lireEtMarquerVu();

  const donnees = await listMany(["posts", "photos"]);
  const posts = (donnees.posts ?? []) as Post[];
  const photos = (donnees.photos ?? []) as Photo[];

  const parId = new Map(photos.map((photo) => [photo.id, photo]));
  const photosDe = (post: Post): PostPhoto[] =>
    (post.photoIds ?? [])
      .map((id) => parId.get(id))
      .filter((photo): photo is Photo => Boolean(photo))
      .map(({ id, url, thumbUrl, width, height, caption }) => ({
        id,
        url,
        thumbUrl,
        width,
        height,
        caption,
      }));

  const estNouveau = (post: Post) =>
    depuis !== null && post.by !== who && post.createdAt > depuis;

  const epingles = posts.filter((post) => post.pinned);
  const fil = posts.filter((post) => !post.pinned);

  // On repart de midi UTC pour que le changement d'heure ne décale pas « Hier ».
  const aujourdHui = cleFormatter.format(new Date());
  const midi = new Date(`${aujourdHui}T12:00:00.000Z`).getTime();
  const hier = cleFormatter.format(new Date(midi - 86_400_000));

  const journees: Journee[] = [];
  for (const post of fil) {
    const cle = cleJour(post.createdAt);
    const derniere = journees.at(-1);
    if (derniere && derniere.cle === cle) derniere.posts.push(post);
    else
      journees.push({
        cle,
        libelle: libelleJour(post.createdAt, aujourdHui, hier),
        posts: [post],
      });
  }

  const nouveaux = posts.filter(estNouveau).length;
  const sousTitre =
    nouveaux > 0
      ? `${nouveaux} ${plural(nouveaux, "nouveau message", "nouveaux messages")} depuis ta dernière visite`
      : "Nos petites nouvelles, jour après jour";

  return (
    <div className="mx-auto w-full max-w-[38rem]">
      <PageHeader title="Fil" subtitle={sousTitre} />

      <ComposerProvider who={who}>
        <ComposerTrigger who={who} />

        {posts.length === 0 ? (
          <div className="mt-6">
            <FilVide />
          </div>
        ) : (
          <div className="mt-7 flex flex-col gap-8">
            {epingles.length > 0 ? (
              <section aria-label="Messages épinglés" className="flex flex-col gap-3">
                <h2 className="label-caps flex items-center gap-1.5 text-ink-3">
                  <IconEpingle size={13} />
                  Épinglé
                </h2>
                {epingles.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    photos={photosDe(post)}
                    who={who}
                    nouveau={estNouveau(post)}
                    horodatage="date"
                  />
                ))}
              </section>
            ) : null}

            {journees.map((journee) => (
              <section
                key={journee.cle}
                aria-label={journee.libelle}
                className="flex flex-col gap-3"
              >
                <Separateur libelle={journee.libelle} />
                {journee.posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    photos={photosDe(post)}
                    who={who}
                    nouveau={estNouveau(post)}
                  />
                ))}
              </section>
            ))}
          </div>
        )}
      </ComposerProvider>
    </div>
  );
}

function Separateur({ libelle }: { libelle: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-xs font-semibold text-ink-3">{libelle}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
    </div>
  );
}
