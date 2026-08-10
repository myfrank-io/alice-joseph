import Link from "next/link";
import type { Album, Photo } from "@/lib/types";
import { plural } from "@/lib/format";
import { IconPhotos } from "@/components/icons";
import { couvertureAlbum, photosDeLAlbum } from "@/components/photos/shared";

/**
 * Les albums en cartes : la couverture porte tout, le texte se tient dessous.
 * Pas de cadre autour — l'image est déjà un objet.
 */
export function CartesAlbums({ albums, photos }: { albums: Album[]; photos: Photo[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
      {albums.map((album) => {
        const dedans = photosDeLAlbum(photos, album.id);
        const couverture = couvertureAlbum(album, photos);

        return (
          <li key={album.id}>
            <Link
              href={`/photos/albums/${album.id}`}
              className="group block rounded-md"
            >
              <div className="relative overflow-hidden rounded-md bg-surface-2 shadow-[var(--shadow-sm)]">
                {couverture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={couverture.thumbUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="aspect-[4/3] size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="grid aspect-[4/3] place-items-center text-ink-3">
                    <IconPhotos size={28} />
                  </div>
                )}
              </div>

              <h3 className="mt-2.5 truncate font-display text-[1.0625rem] leading-snug text-ink">
                {album.title}
              </h3>
              <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                {dedans.length} {plural(dedans.length, "photo", "photos")}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
