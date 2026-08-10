import type { Place, WhoOrBoth } from "@/lib/types";
import { formatMonth, formatShortDate } from "@/lib/format";

/**
 * Tout ce qui entoure un lieu : le formulaire, sa validation (les mêmes règles côté
 * navigateur et côté serveur), les distances et les regroupements de la liste.
 */

/** Ce que la page envoie au navigateur pour les photos : le strict nécessaire. */
export interface PhotoLegere {
  id: string;
  url: string;
  thumbUrl: string;
  caption?: string;
}

/* -------------------------------- Formulaire ------------------------------- */

export interface EntreeLieu {
  name: string;
  country: string;
  lat: number;
  lng: number;
  kind: "visite" | "envie";
  visitedAt?: string;
  note?: string;
  photoIds: string[];
  with: WhoOrBoth;
}

export const ENTREE_VIDE: EntreeLieu = {
  name: "",
  country: "",
  lat: Number.NaN,
  lng: Number.NaN,
  kind: "visite",
  visitedAt: "",
  note: "",
  photoIds: [],
  with: "les-deux",
};

export function lieuVersEntree(lieu: Place): EntreeLieu {
  return {
    name: lieu.name,
    country: lieu.country,
    lat: lieu.lat,
    lng: lieu.lng,
    kind: lieu.kind,
    visitedAt: lieu.visitedAt ?? "",
    note: lieu.note ?? "",
    photoIds: [...lieu.photoIds],
    with: lieu.with,
  };
}

export type Validation =
  | { ok: true; valeur: EntreeLieu }
  | { ok: false; erreur: string };

const AVEC: WhoOrBoth[] = ["alice", "joseph", "les-deux"];

function texte(valeur: unknown, maximum: number): string {
  return typeof valeur === "string" ? valeur.trim().slice(0, maximum) : "";
}

function nombre(valeur: unknown): number {
  if (typeof valeur === "number") return valeur;
  if (typeof valeur === "string" && valeur.trim() !== "") return Number(valeur.replace(",", "."));
  return Number.NaN;
}

/**
 * Une seule fonction de validation, appelée par le formulaire pour désactiver le
 * bouton et par l'action serveur pour refuser ce qui ne va pas. Le client ne décide
 * jamais seul : le serveur revalide tout.
 */
export function validerEntree(brut: unknown): Validation {
  const source = (brut ?? {}) as Record<string, unknown>;

  const name = texte(source.name, 80);
  if (!name) return { ok: false, erreur: "Il manque le nom du lieu." };

  const country = texte(source.country, 60);
  if (!country) return { ok: false, erreur: "Il manque le pays." };

  const lat = nombre(source.lat);
  const lng = nombre(source.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, erreur: "Il manque la position : place le lieu sur la carte." };
  }
  if (lat < -90 || lat > 90) {
    return { ok: false, erreur: "La latitude doit être comprise entre −90 et 90." };
  }
  if (lng < -180 || lng > 180) {
    return { ok: false, erreur: "La longitude doit être comprise entre −180 et 180." };
  }

  const kind = source.kind === "envie" ? "envie" : "visite";

  let visitedAt: string | undefined;
  if (kind === "visite") {
    const brute = texte(source.visitedAt, 10);
    if (brute) {
      if (!/^\d{4}-\d{2}(-\d{2})?$/.test(brute) || Number.isNaN(Date.parse(brute))) {
        return { ok: false, erreur: "La date doit s'écrire AAAA-MM-JJ." };
      }
      visitedAt = brute;
    }
  }

  const note = texte(source.note, 600);

  const photoIds = Array.isArray(source.photoIds)
    ? source.photoIds
        .filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 64)
        .slice(0, 24)
    : [];

  const avec = AVEC.includes(source.with as WhoOrBoth) ? (source.with as WhoOrBoth) : "les-deux";

  return {
    ok: true,
    valeur: {
      name,
      country,
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      kind,
      visitedAt,
      note: note || undefined,
      photoIds,
      with: avec,
    },
  };
}

/* --------------------------------- Distances ------------------------------- */

/**
 * Paris, d'où partent tous leurs voyages : c'est là qu'ils habitent (le premier
 * lieu ajouté, lui, changerait de sens à chaque ajout, et « le plus lointain »
 * n'aurait plus de repère stable).
 */
export const DEPART = { nom: "Paris", lat: 48.8566, lng: 2.3522 };

const RAYON_TERRE_KM = 6371;

/** Distance orthodromique (formule de haversine), en kilomètres. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * RAYON_TERRE_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface Statistiques {
  pays: number;
  villes: number;
  envies: number;
  plusLoin: { lieu: Place; km: number } | null;
}

export function calculerStatistiques(lieux: Place[]): Statistiques {
  const visites = lieux.filter((lieu) => lieu.kind === "visite");
  const pays = new Set(visites.map((lieu) => lieu.country.trim().toLowerCase()).filter(Boolean));

  let plusLoin: { lieu: Place; km: number } | null = null;
  for (const lieu of visites) {
    const km = distanceKm(DEPART, lieu);
    if (!plusLoin || km > plusLoin.km) plusLoin = { lieu, km };
  }

  return {
    pays: pays.size,
    villes: visites.length,
    envies: lieux.length - visites.length,
    plusLoin,
  };
}

/* --------------------------------- Affichage ------------------------------- */

/** « 14 mars 2025 », « mars 2025 », ou rien. */
export function formatDateLieu(visitedAt?: string): string | null {
  if (!visitedAt) return null;
  if (/^\d{4}-\d{2}$/.test(visitedAt)) return formatMonth(`${visitedAt}-01`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(visitedAt)) return formatShortDate(visitedAt);
  return null;
}

/** « 48,8566 N · 2,3522 E » */
export function formatCoordonnees(lat: number, lng: number): string {
  const nombre = (valeur: number) => Math.abs(valeur).toFixed(4).replace(".", ",");
  return `${nombre(lat)} ${lat >= 0 ? "N" : "S"} · ${nombre(lng)} ${lng >= 0 ? "E" : "O"}`;
}

export function anneeDuLieu(lieu: Place): number | null {
  const annee = Number(lieu.visitedAt?.slice(0, 4));
  return Number.isFinite(annee) && annee > 0 ? annee : null;
}

export interface GroupeAnnee {
  annee: number | null;
  lieux: Place[];
}

/**
 * Les visites par année décroissante, les envies à part — elles n'ont pas de date
 * par nature, et les ranger dans « Un jour » est plus juste que de les dater.
 */
export function grouperParAnnee(lieux: Place[]): {
  annees: GroupeAnnee[];
  envies: Place[];
} {
  const parAnnee = new Map<number | null, Place[]>();
  const envies: Place[] = [];

  for (const lieu of lieux) {
    if (lieu.kind === "envie") {
      envies.push(lieu);
      continue;
    }
    const annee = anneeDuLieu(lieu);
    const groupe = parAnnee.get(annee);
    if (groupe) groupe.push(lieu);
    else parAnnee.set(annee, [lieu]);
  }

  const annees = [...parAnnee.entries()]
    .map(([annee, liste]) => ({
      annee,
      lieux: liste.sort((a, b) => (b.visitedAt ?? "").localeCompare(a.visitedAt ?? "")),
    }))
    .sort((a, b) => {
      if (a.annee === null) return 1;
      if (b.annee === null) return -1;
      return b.annee - a.annee;
    });

  envies.sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return { annees, envies };
}
