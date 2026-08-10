"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWho } from "@/lib/auth";
import { detachReference, get, insert, list, remove, update } from "@/lib/data/store";
import { isValidIncomingImage, storeImage, type IncomingImage } from "@/lib/upload";
import type { Album, Photo, Place, Post } from "@/lib/types";

/**
 * Écritures de l'app Photos.
 *
 * Une photo n'appartient pas qu'à sa grille : le fil la cite (`post.photoIds`),
 * la carte l'accroche à un lieu (`place.photoIds`), un album la garde en
 * couverture. Toute suppression doit donc balayer ces trois endroits, sinon on
 * laisse derrière soi des vignettes vides.
 */

const MAX_IMPORT = 12;

/* --------------------------------- Lecture -------------------------------- */

function texte(valeur: FormDataEntryValue | null, max = 240): string | undefined {
  if (typeof valeur !== "string") return undefined;
  const propre = valeur.trim().slice(0, max);
  return propre.length > 0 ? propre : undefined;
}

/** N'accepte qu'une date au format AAAA-MM-JJ, comme le champ natif la produit. */
function jour(valeur: FormDataEntryValue | null): string | undefined {
  const brut = texte(valeur, 10);
  return brut && /^\d{4}-\d{2}-\d{2}$/.test(brut) ? brut : undefined;
}

function imagesEnvoyees(valeur: FormDataEntryValue | null): IncomingImage[] {
  if (typeof valeur !== "string") return [];
  try {
    const brut: unknown = JSON.parse(valeur);
    if (!Array.isArray(brut)) return [];
    return brut.filter(isValidIncomingImage).slice(0, MAX_IMPORT);
  } catch {
    return [];
  }
}

/** Rafraîchit la galerie, plus les pages d'album touchées. */
function rafraichir(albumIds: readonly string[] = []): void {
  revalidatePath("/photos");
  for (const id of new Set(albumIds)) revalidatePath(`/photos/albums/${id}`);
}

/* --------------------------------- Photos --------------------------------- */

export async function importerPhotos(formData: FormData): Promise<void> {
  const who = await requireWho();

  const images = imagesEnvoyees(formData.get("images"));
  if (images.length === 0) return;

  const caption = texte(formData.get("legende"));
  const place = texte(formData.get("lieu"), 80);
  const takenAt = jour(formData.get("date"));

  const albumId = texte(formData.get("album"), 64);
  const album = albumId ? await get<Album>("albums", albumId) : null;

  for (const image of images) {
    const rangee = await storeImage(image, "photos");
    await insert<Photo>("photos", {
      url: rangee.url,
      thumbUrl: rangee.thumbUrl,
      width: rangee.width,
      height: rangee.height,
      caption,
      place,
      takenAt,
      by: who,
      favorite: false,
      albumIds: album ? [album.id] : [],
    });
  }

  // Un album sans couverture prend la première photo qu'on lui donne.
  if (album && !album.coverPhotoId) {
    const dedans = (await list<Photo>("photos")).find((p) => p.albumIds.includes(album.id));
    if (dedans) await update<Album>("albums", album.id, { coverPhotoId: dedans.id });
  }

  rafraichir(album ? [album.id] : []);
}

export async function supprimerPhoto(id: string): Promise<void> {
  await requireWho();

  const photo = await get<Photo>("photos", id);
  if (!photo) return;

  await remove("photos", id);

  // Aucune référence morte : ni dans le fil, ni sur la carte, ni en couverture.
  await detachReference<Post>("posts", "photoIds", id);
  await detachReference<Place>("places", "photoIds", id);

  const albums = await list<Album>("albums");
  const orphelins = albums.filter((album) => album.coverPhotoId === id);
  if (orphelins.length > 0) {
    const restantes = await list<Photo>("photos");
    for (const album of orphelins) {
      const reprise = restantes.find((p) => p.albumIds.includes(album.id));
      await update<Album>("albums", album.id, { coverPhotoId: reprise?.id });
    }
  }

  rafraichir(photo.albumIds);
  revalidatePath("/fil");
  revalidatePath("/carte");
}

export async function basculerFavori(id: string): Promise<void> {
  await requireWho();

  const photo = await get<Photo>("photos", id);
  if (!photo) return;

  await update<Photo>("photos", id, { favorite: !photo.favorite });
  rafraichir(photo.albumIds);
}

/* --------------------------------- Albums --------------------------------- */

export async function creerAlbum(formData: FormData): Promise<void> {
  const who = await requireWho();

  const title = texte(formData.get("titre"), 80);
  if (!title) return;

  const album = await insert<Album>("albums", {
    title,
    description: texte(formData.get("description"), 300),
    by: who,
  });

  rafraichir([album.id]);
}

export async function modifierAlbum(id: string, formData: FormData): Promise<void> {
  await requireWho();

  const title = texte(formData.get("titre"), 80);
  if (!title) return;

  await update<Album>("albums", id, {
    title,
    description: texte(formData.get("description"), 300),
  });

  rafraichir([id]);
}

/**
 * L'album disparaît, les photos restent : elles perdent seulement leur étiquette.
 * La redirection évite de rendre une page d'album qui n'existe plus.
 */
export async function supprimerAlbum(id: string): Promise<void> {
  await requireWho();

  await remove("albums", id);
  await detachReference<Photo>("photos", "albumIds", id);

  rafraichir([id]);
  redirect("/photos?vue=albums");
}

export async function ajouterPhotosAlbum(albumId: string, photoIds: string[]): Promise<void> {
  await requireWho();

  const album = await get<Album>("albums", albumId);
  if (!album) return;

  let premiere: string | undefined;
  for (const photoId of photoIds.slice(0, 200)) {
    const photo = await get<Photo>("photos", photoId);
    if (!photo || photo.albumIds.includes(albumId)) continue;
    await update<Photo>("photos", photoId, { albumIds: [...photo.albumIds, albumId] });
    premiere ??= photo.id;
  }

  if (!album.coverPhotoId && premiere) {
    await update<Album>("albums", albumId, { coverPhotoId: premiere });
  }

  rafraichir([albumId]);
}

export async function retirerPhotoAlbum(albumId: string, photoId: string): Promise<void> {
  await requireWho();

  const photo = await get<Photo>("photos", photoId);
  if (photo) {
    await update<Photo>("photos", photoId, {
      albumIds: photo.albumIds.filter((id) => id !== albumId),
    });
  }

  const album = await get<Album>("albums", albumId);
  if (album?.coverPhotoId === photoId) {
    const reprise = (await list<Photo>("photos")).find(
      (p) => p.id !== photoId && p.albumIds.includes(albumId),
    );
    await update<Album>("albums", albumId, { coverPhotoId: reprise?.id });
  }

  rafraichir([albumId]);
}

export async function definirCouverture(albumId: string, photoId: string): Promise<void> {
  await requireWho();

  const photo = await get<Photo>("photos", photoId);
  if (!photo) return;

  await update<Album>("albums", albumId, { coverPhotoId: photoId });
  rafraichir([albumId]);
}
