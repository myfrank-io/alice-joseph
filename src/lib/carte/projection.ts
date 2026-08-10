/**
 * Projection Equal Earth (Šavrič, Patterson & Jenny, 2018).
 *
 * C'est la seule source de vérité de la carte : le script `scripts/generer-monde.mjs`
 * importe ce fichier pour dessiner les contours des pays, et le navigateur l'importe
 * pour placer les épingles. Les deux emploient donc exactement les mêmes maths — un
 * lieu tombe au pixel près sur son pays.
 *
 * Pourquoi Equal Earth : les surfaces sont respectées (contrairement à Mercator qui
 * fait de l'Islande un continent), et le monde garde une silhouette agréable, sans
 * les pôles étirés. C'est une projection pseudo-cylindrique : x ne dépend que de la
 * longitude et de la latitude, y seulement de la latitude.
 */

const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;

const RAD = Math.PI / 180;

/** Projection dans l'espace mathématique de la formule, y vers le haut. */
function projeterBrut(lng: number, lat: number): [number, number] {
  const phi = lat * RAD;
  const lambda = lng * RAD;

  const theta = Math.asin(M * Math.sin(phi));
  const t2 = theta * theta;
  const t6 = t2 * t2 * t2;

  const x = (lambda * Math.cos(theta)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
  const y = theta * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));

  return [x, y];
}

/** Demi-largeur (à l'équateur) et demi-hauteur (au pôle) du monde projeté. */
const X_MAX = projeterBrut(180, 0)[0];
const Y_MAX = projeterBrut(0, 90)[1];

/** Cadrage : le monde entier occupe exactement [0, LARGEUR] × [0, HAUTEUR]. */
export const LARGEUR_CARTE = 1000;
const ECHELLE = LARGEUR_CARTE / (2 * X_MAX);
export const HAUTEUR_CARTE = Math.round(2 * Y_MAX * ECHELLE * 100) / 100;

/** Rapport largeur/hauteur du monde projeté — utile pour cadrer le SVG. */
export const RATIO_CARTE = LARGEUR_CARTE / HAUTEUR_CARTE;

/**
 * Longitude/latitude en degrés → coordonnées de la carte, y vers le bas (SVG).
 * Le nord est en haut, l'antiméridien sur les bords.
 */
export function projeter(lng: number, lat: number): [number, number] {
  const [x, y] = projeterBrut(lng, lat);
  return [(x + X_MAX) * ECHELLE, (Y_MAX - y) * ECHELLE];
}

/**
 * L'inverse : un point de la carte → longitude/latitude. Sert au mode « placer
 * sur la carte ».
 *
 * Equal Earth n'a pas d'inverse analytique : on remonte à θ par Newton-Raphson
 * (une poignée d'itérations suffit, la fonction est monotone et très régulière),
 * puis on redescend sur la latitude et la longitude.
 *
 * Renvoie `null` si le point tombe hors du monde — les quatre coins du cadre sont
 * en dehors de la silhouette de la Terre.
 */
export function deprojeter(x: number, y: number): [number, number] | null {
  const xb = x / ECHELLE - X_MAX;
  const yb = Y_MAX - y / ECHELLE;

  let theta = yb;
  for (let i = 0; i < 24; i += 1) {
    const t2 = theta * theta;
    const t6 = t2 * t2 * t2;
    const f = theta * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)) - yb;
    const df = A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2);
    const pas = f / df;
    theta -= pas;
    if (Math.abs(pas) < 1e-12) break;
  }

  const sinPhi = Math.sin(theta) / M;
  if (Math.abs(sinPhi) > 1) return null;

  const t2 = theta * theta;
  const t6 = t2 * t2 * t2;
  const denominateur = M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2));
  const lambda = (xb * denominateur) / Math.cos(theta);

  const lng = lambda / RAD;
  const lat = Math.asin(sinPhi) / RAD;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (Math.abs(lng) > 180.000001) return null;

  return [Math.min(180, Math.max(-180, lng)), Math.min(90, Math.max(-90, lat))];
}
