/**
 * Fabrique `public/monde.json` : les contours des pays, déjà projetés, prêts à être
 * posés tels quels dans un SVG.
 *
 *   node scripts/generer-monde.mjs
 *
 * On le lance une seule fois et on commet le résultat. Le navigateur ne fait donc
 * qu'un seul `fetch` d'un fichier statique : aucune tuile, aucun CDN, aucun service
 * externe à l'exécution.
 *
 * La projection vient de `src/lib/carte/projection.ts` — le même fichier que celui
 * qu'importe le composant de carte. C'est la garantie que les épingles tombent
 * exactement sur les contours dessinés ici. (Node sait exécuter le TypeScript
 * directement depuis la 22.18 ; aucune duplication n'est nécessaire.)
 */

import { readFileSync, writeFileSync, statSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { feature } from "topojson-client";

import { projeter, LARGEUR_CARTE, HAUTEUR_CARTE } from "../src/lib/carte/projection.ts";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENTREE = resolve(RACINE, "node_modules/world-atlas/countries-110m.json");
const SORTIE = resolve(RACINE, "public/monde.json");

/** Une décimale suffit : 0,1 unité de carte ≈ 0,04 px à l'écran le plus large. */
const DECIMALES = 1;

function arrondir(valeur) {
  const facteur = 10 ** DECIMALES;
  return Math.round(valeur * facteur) / facteur;
}

/* ------------------------------ Antiméridien ------------------------------ */

/**
 * Trois pays enjambent la ligne de changement de date (la Russie par la Tchoukotka,
 * les Fidji, et l'Antarctique qui fait le tour du pôle). Projetés tels quels, leurs
 * anneaux zèbrent la carte d'un bord à l'autre. On les coupe donc à ±180°, puis on
 * referme chaque morceau le long du bord de la carte — le méridien 180 est courbe en
 * Equal Earth, on l'échantillonne ; le pôle, lui, est un segment horizontal.
 */
const PAS_BORD = 2;

function pointsDeMeridien(lng, latDepart, latArrivee) {
  const points = [];
  const sens = latArrivee > latDepart ? 1 : -1;
  const premier = Math.round(latDepart / PAS_BORD) * PAS_BORD;
  for (let lat = premier; sens > 0 ? lat < latArrivee : lat > latArrivee; lat += sens * PAS_BORD) {
    if (sens > 0 ? lat > latDepart : lat < latDepart) points.push([lng, lat]);
  }
  points.push([lng, latArrivee]);
  return points;
}

/** Referme un morceau dont les deux extrémités reposent sur l'antiméridien. */
function refermerSurLeBord(points) {
  const depart = points[0];
  const fin = points[points.length - 1];
  const signeDepart = depart[0] > 0 ? 1 : -1;
  const signeFin = fin[0] > 0 ? 1 : -1;

  if (signeDepart === signeFin) {
    // Même bord : on longe simplement le méridien pour revenir au point de départ.
    return points.concat(pointsDeMeridien(signeFin * 180, fin[1], depart[1]).slice(0, -1));
  }

  // Bords opposés : le morceau fait le tour d'un pôle (l'Antarctique). On descend
  // jusqu'au pôle, on le traverse — une droite horizontale ici — et on remonte de
  // l'autre côté.
  const latMoyenne = points.reduce((somme, p) => somme + p[1], 0) / points.length;
  const pole = latMoyenne < 0 ? -90 : 90;
  return points
    .concat(pointsDeMeridien(signeFin * 180, fin[1], pole))
    .concat([[signeDepart * 180, pole]])
    .concat(pointsDeMeridien(signeDepart * 180, pole, depart[1]).slice(0, -1));
}

/**
 * Vrai si l'anneau enjambe ±180°. Le trait qui longe un pôle saute lui aussi de
 * +180 à −180 : il est parfaitement légitime (c'est le bord haut ou bas de la
 * carte, horizontal en Equal Earth) et ne compte pas.
 */
function traverseLAntimeridien(anneau) {
  for (let i = 1; i < anneau.length; i += 1) {
    const a = anneau[i - 1];
    const b = anneau[i];
    if (Math.abs(b[0] - a[0]) <= 180) continue;
    if (Math.abs(a[1]) > 89.999 && Math.abs(b[1]) > 89.999) continue;
    return true;
  }
  return false;
}

/** Un anneau fermé (lng/lat) → un ou plusieurs anneaux qui ne traversent plus ±180°. */
function couperAntimeridien(anneau) {
  const morceaux = [];
  let courant = [anneau[0]];

  for (let i = 1; i < anneau.length; i += 1) {
    const precedent = anneau[i - 1];
    const point = anneau[i];

    if (Math.abs(point[0] - precedent[0]) > 180) {
      const signe = precedent[0] > 0 ? 1 : -1;
      const lngDeroule = point[0] + 360 * signe;
      const ecart = lngDeroule - precedent[0];
      const t = ecart === 0 ? 0 : (signe * 180 - precedent[0]) / ecart;
      const lat = precedent[1] + t * (point[1] - precedent[1]);
      courant.push([signe * 180, lat]);
      morceaux.push(courant);
      courant = [[-signe * 180, lat], point];
    } else {
      courant.push(point);
    }
  }
  morceaux.push(courant);

  if (morceaux.length === 1) return [anneau];

  // Le dernier morceau se termine là où l'anneau a commencé : il prolonge le premier.
  const dernier = morceaux.pop();
  dernier.pop();
  morceaux[0] = dernier.concat(morceaux[0]);

  return morceaux.map(refermerSurLeBord);
}

/* ----------------------------- Contours en SVG ---------------------------- */

/**
 * Un anneau (liste de [lng, lat]) → suite de points projetés et arrondis, sans
 * doublons consécutifs. Les doublons apparaissent tout seuls à cause de l'arrondi
 * et représentent une bonne part du poids du fichier.
 */
function anneauProjete(anneau) {
  const points = [];
  for (const [lng, lat] of anneau) {
    const [x, y] = projeter(lng, lat);
    const px = arrondir(x);
    const py = arrondir(y);
    const dernier = points[points.length - 1];
    if (dernier && dernier[0] === px && dernier[1] === py) continue;
    points.push([px, py]);
  }
  // Le dernier point d'un anneau GeoJSON répète le premier : `Z` s'en charge.
  while (
    points.length > 1 &&
    points[0][0] === points[points.length - 1][0] &&
    points[0][1] === points[points.length - 1][1]
  ) {
    points.pop();
  }
  return points;
}

function anneauxDeLaGeometrie(geometrie) {
  if (!geometrie) return [];
  if (geometrie.type === "Polygon") return geometrie.coordinates;
  if (geometrie.type === "MultiPolygon") return geometrie.coordinates.flat();
  return [];
}

function anneauxDecoupes(geometrie) {
  return anneauxDeLaGeometrie(geometrie).flatMap(couperAntimeridien);
}

function cheminSvg(anneaux) {
  const morceaux = [];
  for (const points of anneaux) {
    if (points.length < 3) continue;
    const [tete, ...reste] = points;
    let d = `M${tete[0]} ${tete[1]}`;
    if (reste.length) d += `L${reste.map(([x, y]) => `${x} ${y}`).join(" ")}`;
    morceaux.push(`${d}Z`);
  }
  return morceaux.join("");
}

/* --------------------------- Contrôle des villes -------------------------- */

/** Lancer de rayon, règle pair-impair : gère aussi les trous et les archipels. */
function pointDansAnneaux(anneaux, x, y) {
  let dedans = false;
  for (const points of anneaux) {
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      const traverse = yi > y !== yj > y;
      if (traverse && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
    }
  }
  return dedans;
}

const VILLES_TEMOINS = [
  { nom: "Paris", lat: 48.8566, lng: 2.3522, pays: "France" },
  { nom: "Kyoto", lat: 35.0116, lng: 135.7681, pays: "Japan" },
  { nom: "Buenos Aires", lat: -34.6037, lng: -58.3816, pays: "Argentina" },
];

/* ---------------------------------- Main ---------------------------------- */

const topologie = JSON.parse(readFileSync(ENTREE, "utf8"));
const collection = feature(topologie, topologie.objects.countries);

const anneauxParPays = new Map();
const pays = [];

let coupes = 0;

for (const element of collection.features) {
  const nom = element.properties?.name;
  if (!nom) continue;

  const bruts = anneauxDeLaGeometrie(element.geometry);
  const decoupes = anneauxDecoupes(element.geometry);
  if (bruts.some(traverseLAntimeridien)) coupes += 1;

  const anneaux = decoupes.map(anneauProjete);
  const d = cheminSvg(anneaux);
  if (!d) continue;

  anneauxParPays.set(nom, anneaux);
  pays.push({ id: String(element.id ?? nom), nom, d });
}

pays.sort((a, b) => a.nom.localeCompare(b.nom, "en"));

/* Après découpe, plus aucun anneau ne doit enjamber ±180° : une régression ici
   zébrerait la carte de traits d'un bord à l'autre. */
let traversees = 0;
for (const element of collection.features) {
  for (const anneau of anneauxDecoupes(element.geometry)) {
    if (traverseLAntimeridien(anneau)) traversees += 1;
  }
}

mkdirSync(dirname(SORTIE), { recursive: true });
writeFileSync(
  SORTIE,
  JSON.stringify({ width: LARGEUR_CARTE, height: HAUTEUR_CARTE, pays }),
  "utf8",
);

const octets = statSync(SORTIE).size;
const points = [...anneauxParPays.values()].flat().reduce((n, a) => n + a.length, 0);

console.log(`monde.json  ${pays.length} pays, ${points} points`);
console.log(`            ${LARGEUR_CARTE} × ${HAUTEUR_CARTE} unités de carte`);
console.log(`            ${(octets / 1024).toFixed(1)} Ko`);
console.log(`            ${coupes} pays recousu(s) à l'antiméridien`);
console.log(`            ${traversees} segment(s) traversant encore l'antiméridien (attendu : 0)`);

console.log("\nContrôle de la projection");
let erreurs = traversees > 0 ? 1 : 0;
for (const ville of VILLES_TEMOINS) {
  const [x, y] = projeter(ville.lng, ville.lat);
  const anneaux = anneauxParPays.get(ville.pays);
  const dedans = anneaux ? pointDansAnneaux(anneaux, x, y) : false;
  if (!dedans) erreurs += 1;
  console.log(
    `  ${ville.nom.padEnd(13)} → x ${x.toFixed(1).padStart(6)}  y ${y.toFixed(1).padStart(6)}` +
      `   ${dedans ? "tombe bien dans" : "NE TOMBE PAS DANS"} ${ville.pays}`,
  );
}

if (erreurs > 0) {
  console.error("\nLa carte est fausse : voir les lignes ci-dessus.");
  process.exit(1);
}
console.log("\nTout est en place.");
