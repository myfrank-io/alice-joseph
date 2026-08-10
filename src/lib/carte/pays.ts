/**
 * Rattacher un lieu à un pays du fond de carte.
 *
 * Les lieux sont saisis en français (« Espagne », « Viêt Nam »), le fond de carte
 * vient de Natural Earth et parle anglais (« Spain », « Vietnam »). On compare donc
 * des clés normalisées — sans accents, sans espaces, sans ponctuation — et une petite
 * table couvre les cas où le nom français n'est pas une simple variante orthographique
 * du nom anglais.
 */

/** « États-Unis » → « etatsunis ». Tolère la casse, les accents et les tirets. */
export function clePays(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Nom français (ou approchant) → nom exact du fond de carte. Tout ce qui n'est pas
 * dans la table est comparé tel quel : « Portugal », « France », « Uruguay » et la
 * plupart des noms anglais tombent juste tout seuls.
 */
const TABLE: Record<string, string> = {
  // Les pays déjà présents dans les lieux d'exemple.
  Espagne: "Spain",
  Écosse: "United Kingdom",
  "États-Unis": "United States of America",
  "Viêt Nam": "Vietnam",
  "Pays-Bas": "Netherlands",
  Italie: "Italy",
  Japon: "Japan",
  Maroc: "Morocco",
  Islande: "Iceland",
  Norvège: "Norway",
  Argentine: "Argentina",

  // Le reste de l'Europe.
  Allemagne: "Germany",
  Angleterre: "United Kingdom",
  Autriche: "Austria",
  Belgique: "Belgium",
  Biélorussie: "Belarus",
  "Bosnie-Herzégovine": "Bosnia and Herz.",
  Bulgarie: "Bulgaria",
  Croatie: "Croatia",
  Danemark: "Denmark",
  Estonie: "Estonia",
  Finlande: "Finland",
  Grèce: "Greece",
  Groenland: "Greenland",
  Hongrie: "Hungary",
  Irlande: "Ireland",
  "Irlande du Nord": "United Kingdom",
  Lettonie: "Latvia",
  Lituanie: "Lithuania",
  "Macédoine du Nord": "Macedonia",
  Moldavie: "Moldova",
  Monténégro: "Montenegro",
  "Pays de Galles": "United Kingdom",
  Pologne: "Poland",
  "République tchèque": "Czechia",
  Roumanie: "Romania",
  "Royaume-Uni": "United Kingdom",
  Russie: "Russia",
  Serbie: "Serbia",
  Slovaquie: "Slovakia",
  Slovénie: "Slovenia",
  Suède: "Sweden",
  Suisse: "Switzerland",
  Tchéquie: "Czechia",
  Turquie: "Turkey",

  // Afrique et Proche-Orient.
  "Afrique du Sud": "South Africa",
  Algérie: "Algeria",
  "Arabie saoudite": "Saudi Arabia",
  Cameroun: "Cameroon",
  Égypte: "Egypt",
  "Émirats arabes unis": "United Arab Emirates",
  Éthiopie: "Ethiopia",
  Irak: "Iraq",
  Israël: "Israel",
  Jordanie: "Jordan",
  Kenya: "Kenya",
  Libye: "Libya",
  Mozambique: "Mozambique",
  Namibie: "Namibia",
  Nigéria: "Nigeria",
  Ouganda: "Uganda",
  "République démocratique du Congo": "Dem. Rep. Congo",
  Sénégal: "Senegal",
  Soudan: "Sudan",
  Tanzanie: "Tanzania",
  Tunisie: "Tunisia",
  Zambie: "Zambia",

  // Amériques.
  Brésil: "Brazil",
  Chili: "Chile",
  Colombie: "Colombia",
  "Costa Rica": "Costa Rica",
  Équateur: "Ecuador",
  "Guyane française": "France",
  Jamaïque: "Jamaica",
  Mexique: "Mexico",
  Pérou: "Peru",
  "République dominicaine": "Dominican Rep.",

  // Asie et Océanie.
  Australie: "Australia",
  Birmanie: "Myanmar",
  Cambodge: "Cambodia",
  Chine: "China",
  "Corée du Nord": "North Korea",
  "Corée du Sud": "South Korea",
  Inde: "India",
  Indonésie: "Indonesia",
  Malaisie: "Malaysia",
  Mongolie: "Mongolia",
  Népal: "Nepal",
  "Nouvelle-Calédonie": "New Caledonia",
  "Nouvelle-Zélande": "New Zealand",
  Ouzbékistan: "Uzbekistan",
  "Papouasie-Nouvelle-Guinée": "Papua New Guinea",
  Philippines: "Philippines",
  Taïwan: "Taiwan",
  Thaïlande: "Thailand",
};

const TABLE_NORMALISEE = new Map<string, string>(
  Object.entries(TABLE).map(([français, monde]) => [clePays(français), monde]),
);

/** Les pays dont le nom français est déjà celui du fond de carte. */
const IDENTIQUES = [
  "Canada",
  "Cuba",
  "France",
  "Guatemala",
  "Honduras",
  "Luxembourg",
  "Madagascar",
  "Nicaragua",
  "Panama",
  "Paraguay",
  "Portugal",
  "Uruguay",
  "Venezuela",
];

/** Proposées dans le champ « Pays » du formulaire. Une aide, jamais une contrainte. */
export const SUGGESTIONS_PAYS: string[] = [...new Set([...Object.keys(TABLE), ...IDENTIQUES])].sort(
  (a, b) => a.localeCompare(b, "fr"),
);

/** Nom tel qu'il est écrit dans un lieu → nom tel qu'il est écrit dans monde.json. */
export function nomMondial(pays: string): string {
  return TABLE_NORMALISEE.get(clePays(pays)) ?? pays;
}

/** L'ensemble des clés de pays où l'on a posé le pied — sert à teinter le fond. */
export function clesDesPaysVisites(
  lieux: { country: string; kind: "visite" | "envie" }[],
): Set<string> {
  const cles = new Set<string>();
  for (const lieu of lieux) {
    if (lieu.kind !== "visite") continue;
    const nom = lieu.country?.trim();
    if (nom) cles.add(clePays(nomMondial(nom)));
  }
  return cles;
}
