import type { Photo } from "@/lib/types";

export interface Souvenir {
  photo: Photo;
  /** Ce qu'on affiche au-dessus : « Il y a 2 ans, jour pour jour ». */
  accroche: string;
}

function monthDay(iso: string): string {
  return iso.slice(5, 10);
}

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86_400_000);
}

/**
 * Une photo à remettre sous les yeux aujourd'hui.
 *
 * On cherche d'abord une photo prise le même jour une autre année — c'est le
 * rappel qui touche. À défaut, on en tire une parmi les favorites, mais de façon
 * stable dans la journée : on ne veut pas qu'elle change à chaque rafraîchissement.
 */
export function souvenirDuJour(photos: Photo[], today = new Date()): Souvenir | null {
  const datees = photos.filter((photo) => photo.takenAt);
  if (datees.length === 0) return null;

  const aujourdhui = today.toISOString().slice(0, 10);
  const cible = monthDay(aujourdhui);
  const anneeCourante = Number(aujourdhui.slice(0, 4));

  const memeJour = datees
    .filter((photo) => monthDay(photo.takenAt!) === cible)
    .filter((photo) => Number(photo.takenAt!.slice(0, 4)) < anneeCourante)
    .sort((a, b) => a.takenAt!.localeCompare(b.takenAt!));

  if (memeJour.length > 0) {
    const photo = memeJour[0];
    const ecart = anneeCourante - Number(photo.takenAt!.slice(0, 4));
    return {
      photo,
      accroche: ecart === 1 ? "Il y a un an, jour pour jour" : `Il y a ${ecart} ans, jour pour jour`,
    };
  }

  const pool = datees.filter((photo) => photo.favorite);
  const choix = pool.length > 0 ? pool : datees;
  const photo = choix[dayOfYear(today) % choix.length];

  return { photo, accroche: "Un souvenir, au hasard" };
}
