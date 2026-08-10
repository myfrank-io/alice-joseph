import { projeter } from "@/lib/carte/projection";

/**
 * Le fond de carte : un fichier statique fabriqué une fois pour toutes par
 * `scripts/generer-monde.mjs`. Aucune tuile, aucun CDN, aucun service externe —
 * un seul `fetch` d'un JSON de 120 Ko, mis en cache par le navigateur, et partagé
 * ici par tous les montages du composant.
 */

export interface PaysTrace {
  id: string;
  nom: string;
  /** Chemin SVG déjà projeté, dans le repère [0, width] × [0, height]. */
  d: string;
}

export interface Monde {
  width: number;
  height: number;
  pays: PaysTrace[];
}

let promesse: Promise<Monde> | null = null;

export function chargerMonde(): Promise<Monde> {
  promesse ??= fetch("/monde.json")
    .then((reponse) => {
      if (!reponse.ok) throw new Error(`monde.json : ${reponse.status}`);
      return reponse.json() as Promise<Monde>;
    })
    .catch((erreur: unknown) => {
      // On oublie l'échec pour qu'un « Réessayer » reparte de zéro.
      promesse = null;
      throw erreur;
    });
  return promesse;
}

/* ------------------------- Silhouette et graticule ------------------------ */

function ligne(points: [number, number][]): string {
  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join("");
}

function meridien(lng: number, deLat: number, aLat: number, pas: number): [number, number][] {
  const points: [number, number][] = [];
  const sens = aLat >= deLat ? 1 : -1;
  for (let lat = deLat; sens > 0 ? lat < aLat : lat > aLat; lat += sens * pas) {
    points.push(projeter(lng, lat));
  }
  points.push(projeter(lng, aLat));
  return points;
}

function parallele(lat: number, pas: number): [number, number][] {
  const points: [number, number][] = [];
  for (let lng = -180; lng < 180; lng += pas) points.push(projeter(lng, lat));
  points.push(projeter(180, lat));
  return points;
}

let sphere: string | null = null;

/**
 * Le contour du monde : les deux méridiens ±180 (courbés en Equal Earth) reliés par
 * les deux pôles, qui sont des segments horizontaux. C'est lui qui porte la couleur
 * des mers.
 */
export function cheminSphere(): string {
  sphere ??= `${ligne([...meridien(180, -90, 90, 2), ...meridien(-180, 90, -90, 2)])}Z`;
  return sphere;
}

let graticule: string | null = null;

/** Méridiens et parallèles tous les 30° : de quoi lire le monde sans le charger. */
export function cheminGraticule(): string {
  if (graticule) return graticule;
  const traits: string[] = [];
  for (let lng = -150; lng <= 150; lng += 30) traits.push(ligne(meridien(lng, -90, 90, 3)));
  for (let lat = -60; lat <= 60; lat += 30) traits.push(ligne(parallele(lat, 5)));
  graticule = traits.join("");
  return graticule;
}
