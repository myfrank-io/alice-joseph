import type { Album, Photo } from "@/lib/types";
import { formatMonth, plural } from "@/lib/format";

/**
 * Le vocabulaire commun de l'app Photos : tri, regroupement, filtres, liens.
 *
 * Ce module ne porte aucune directive : il est lu par les pages serveur comme
 * par la visionneuse, et ne dépend donc de rien d'autre que des types et des
 * formats de date.
 */

/* --------------------------------- L'URL ---------------------------------- */

export type Vue = "grille" | "moments" | "albums";
export type Filtre = "toutes" | "favorites" | "alice" | "joseph";

export const VUES: { valeur: Vue; libelle: string }[] = [
  { valeur: "grille", libelle: "Grille" },
  { valeur: "moments", libelle: "Moments" },
  { valeur: "albums", libelle: "Albums" },
];

export const FILTRES: { valeur: Filtre; libelle: string }[] = [
  { valeur: "toutes", libelle: "Toutes" },
  { valeur: "favorites", libelle: "Favorites" },
  { valeur: "alice", libelle: "Par Alice" },
  { valeur: "joseph", libelle: "Par Joseph" },
];

type Param = string | string[] | undefined;

function premier(valeur: Param): string {
  return (Array.isArray(valeur) ? valeur[0] : valeur) ?? "";
}

export function lireVue(valeur: Param): Vue {
  const brut = premier(valeur);
  return VUES.some((v) => v.valeur === brut) ? (brut as Vue) : "grille";
}

export function lireFiltre(valeur: Param): Filtre {
  const brut = premier(valeur);
  return FILTRES.some((f) => f.valeur === brut) ? (brut as Filtre) : "toutes";
}

/** L'état de la page tient entièrement dans son adresse : elle reste partageable. */
export function lienPhotos(vue: Vue, filtre: Filtre): string {
  const params = new URLSearchParams();
  if (vue !== "grille") params.set("vue", vue);
  if (filtre !== "toutes") params.set("par", filtre);
  const requete = params.toString();
  return requete ? `/photos?${requete}` : "/photos";
}

/* ------------------------------- Les photos ------------------------------- */

/**
 * Instant de référence d'une photo : la prise de vue si on la connaît, sinon
 * l'import. Midi UTC pour que le jour reste le même une fois affiché à Paris.
 */
export function instantPhoto(photo: Photo): string {
  return photo.takenAt ? `${photo.takenAt}T12:00:00.000Z` : photo.createdAt;
}

export function trierPhotos(photos: Photo[]): Photo[] {
  return [...photos].sort((a, b) => instantPhoto(b).localeCompare(instantPhoto(a)));
}

export function filtrerPhotos(photos: Photo[], filtre: Filtre): Photo[] {
  if (filtre === "favorites") return photos.filter((photo) => photo.favorite);
  if (filtre === "alice" || filtre === "joseph") {
    return photos.filter((photo) => photo.by === filtre);
  }
  return photos;
}

export function photosDeLAlbum(photos: Photo[], albumId: string): Photo[] {
  return photos.filter((photo) => photo.albumIds.includes(albumId));
}

/** La couverture choisie, ou à défaut la photo la plus récente de l'album. */
export function couvertureAlbum(album: Album, photos: Photo[]): Photo | undefined {
  const dedans = photosDeLAlbum(photos, album.id);
  return dedans.find((photo) => photo.id === album.coverPhotoId) ?? dedans[0];
}

/** Les lieux déjà écrits, pour proposer l'auto-complétion à l'import. */
export function lieuxConnus(photos: Photo[]): string[] {
  const vus: string[] = [];
  for (const photo of photos) {
    const lieu = photo.place?.trim();
    if (lieu && !vus.includes(lieu)) vus.push(lieu);
  }
  return vus.sort((a, b) => a.localeCompare(b, "fr"));
}

/* -------------------------------- Les mois -------------------------------- */

export interface Moment {
  cle: string;
  titre: string;
  photos: Photo[];
  lieux: string[];
}

/**
 * Découpe une liste déjà triée en mois successifs. Le libellé du mois sert de
 * clé : « juin 2026 » ne revient jamais deux fois.
 */
export function grouperParMois(photos: Photo[]): Moment[] {
  const moments: Moment[] = [];
  let courant: Moment | undefined;

  for (const photo of photos) {
    const titre = formatMonth(instantPhoto(photo));
    if (!courant || courant.titre !== titre) {
      courant = { cle: titre, titre, photos: [], lieux: [] };
      moments.push(courant);
    }
    courant.photos.push(photo);
    const lieu = photo.place?.trim();
    if (lieu && !courant.lieux.includes(lieu)) courant.lieux.push(lieu);
  }

  return moments;
}

/** « 12 photos · Lisbonne, Belém » — la ligne sous un titre de mois. */
export function resumeMoment(moment: Moment): string {
  const compte = `${moment.photos.length} ${plural(moment.photos.length, "photo", "photos")}`;
  if (moment.lieux.length === 0) return compte;
  const lieux = moment.lieux.slice(0, 3).join(", ");
  return `${compte} · ${lieux}${moment.lieux.length > 3 ? "…" : ""}`;
}

/** « juin 2026 » si tout tient dans un mois, « juin 2026 – août 2026 » sinon. */
export function periodeCouverte(photos: Photo[]): string | null {
  if (photos.length === 0) return null;
  const instants = photos.map(instantPhoto).sort();
  const debut = formatMonth(instants[0]);
  const fin = formatMonth(instants[instants.length - 1]);
  return debut === fin ? debut : `${debut} – ${fin}`;
}
