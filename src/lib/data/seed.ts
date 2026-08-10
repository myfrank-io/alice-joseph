import type {
  Album,
  Doc,
  Person,
  Photo,
  Place,
  Playlist,
  Post,
  Settings,
  Track,
} from "@/lib/types";
import { demoArtwork, demoPhoto, demoPortrait } from "@/lib/demo-art";
import type { CollectionName } from "@/lib/data/store";

/**
 * Contenu d'exemple. Il n'existe que pour que la plateforme soit belle et
 * compréhensible dès la première visite, avant qu'Alice et Joseph n'aient rien
 * écrit. Il est installé une seule fois, au tout premier démarrage de la base.
 */

const now = () => new Date();

function daysAgo(days: number, hour = 19, minute = 12): string {
  const d = now();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function stamp<T extends Doc>(doc: Omit<T, "createdAt" | "updatedAt"> & { createdAt: string }): T {
  return { ...doc, updatedAt: doc.createdAt } as T;
}

/* --------------------------------- Photos --------------------------------- */

const photoSpecs: {
  id: string;
  caption: string;
  place: string;
  days: number;
  by: "alice" | "joseph";
  favorite?: boolean;
  albums: string[];
}[] = [
  { id: "ph-01", caption: "Le premier café, avant que la ville se réveille", place: "Lisbonne", days: 34, by: "alice", favorite: true, albums: ["al-lisbonne"] },
  { id: "ph-02", caption: "Tu as insisté pour monter les 200 marches", place: "Lisbonne", days: 34, by: "joseph", albums: ["al-lisbonne"] },
  { id: "ph-03", caption: "Le tram 28, bondé, on riait", place: "Lisbonne", days: 33, by: "alice", albums: ["al-lisbonne"] },
  { id: "ph-04", caption: "Pastéis de nata, deuxième tournée", place: "Belém", days: 33, by: "joseph", favorite: true, albums: ["al-lisbonne"] },
  { id: "ph-05", caption: "Coucher de soleil depuis le mirador", place: "Lisbonne", days: 32, by: "alice", albums: ["al-lisbonne"] },
  { id: "ph-06", caption: "Dimanche, personne n'avait envie de se lever", place: "À la maison", days: 12, by: "joseph", albums: ["al-quotidien"] },
  { id: "ph-07", caption: "Ton gratin, la recette de ta grand-mère", place: "À la maison", days: 19, by: "alice", favorite: true, albums: ["al-quotidien"] },
  { id: "ph-08", caption: "Le chat a encore gagné le fauteuil", place: "À la maison", days: 25, by: "joseph", albums: ["al-quotidien"] },
  { id: "ph-09", caption: "Marché du samedi, on a acheté trop de tomates", place: "Marché", days: 8, by: "alice", albums: ["al-quotidien"] },
  { id: "ph-10", caption: "Il pleuvait, on est restés sous l'auvent une heure", place: "Annecy", days: 61, by: "joseph", albums: ["al-annecy"] },
  { id: "ph-11", caption: "L'eau était glacée et tu y es allé quand même", place: "Lac d'Annecy", days: 61, by: "alice", favorite: true, albums: ["al-annecy"] },
  { id: "ph-12", caption: "Le col, enfin", place: "Semnoz", days: 60, by: "joseph", albums: ["al-annecy"] },
  { id: "ph-13", caption: "Petit déjeuner sur le balcon", place: "Annecy", days: 59, by: "alice", albums: ["al-annecy"] },
  { id: "ph-14", caption: "Anniversaire surprise — tu n'avais rien vu venir", place: "Chez Camille", days: 96, by: "joseph", favorite: true, albums: [] },
  { id: "ph-15", caption: "Première neige de l'année", place: "Devant l'immeuble", days: 140, by: "alice", albums: [] },
  { id: "ph-16", caption: "On a repeint la cuisine en trois jours", place: "À la maison", days: 175, by: "joseph", albums: ["al-quotidien"] },
  { id: "ph-17", caption: "Le concert où on ne voyait rien", place: "Paris", days: 210, by: "alice", albums: [] },
  { id: "ph-18", caption: "Dernier soir, on ne voulait pas rentrer", place: "Séville", days: 300, by: "joseph", favorite: true, albums: [] },
];

const photos: Photo[] = photoSpecs.map((spec, index) =>
  stamp<Photo>({
    id: spec.id,
    url: demoPhoto(index + 1, 1400, index % 3 === 0 ? 1750 : 1050),
    thumbUrl: demoPhoto(index + 1, 560, index % 3 === 0 ? 700 : 420),
    width: 1400,
    height: index % 3 === 0 ? 1750 : 1050,
    caption: spec.caption,
    place: spec.place,
    takenAt: daysAgo(spec.days).slice(0, 10),
    by: spec.by,
    favorite: spec.favorite ?? false,
    albumIds: spec.albums,
    createdAt: daysAgo(spec.days, 20, index),
  }),
);

const albums: Album[] = [
  stamp<Album>({
    id: "al-lisbonne",
    title: "Lisbonne, cinq jours",
    description: "Trop de marches, trop de pastéis, aucun regret.",
    coverPhotoId: "ph-01",
    by: "alice",
    createdAt: daysAgo(32, 21, 5),
  }),
  stamp<Album>({
    id: "al-annecy",
    title: "Annecy au printemps",
    description: "Le lac, le col, et la pluie du premier jour.",
    coverPhotoId: "ph-11",
    by: "joseph",
    createdAt: daysAgo(59, 21, 8),
  }),
  stamp<Album>({
    id: "al-quotidien",
    title: "Le quotidien",
    description: "Les jours sans rien de spécial, qui sont les meilleurs.",
    coverPhotoId: "ph-06",
    by: "alice",
    createdAt: daysAgo(175, 21, 2),
  }),
];

/* --------------------------------- Le fil --------------------------------- */

const posts: Post[] = [
  stamp<Post>({
    id: "po-01",
    by: "alice",
    body: "J'ai retrouvé le ticket de cinéma du premier film qu'on a vu ensemble, dans la poche d'un manteau. Je le garde.",
    photoIds: [],
    mood: { emoji: "🌤️", label: "attendrie" },
    reactions: [{ by: "joseph", emoji: "❤️", at: daysAgo(1, 21, 30) }],
    comments: [
      { id: "co-01", by: "joseph", body: "Lequel déjà ? J'ai un doute et ça m'agace.", at: daysAgo(1, 21, 34) },
      { id: "co-02", by: "alice", body: "Celui où tu t'es endormi. Ça réduit peu.", at: daysAgo(1, 21, 41) },
    ],
    pinned: false,
    createdAt: daysAgo(1, 20, 15),
  }),
  stamp<Post>({
    id: "po-02",
    by: "joseph",
    body: "Réservé la table de samedi. 20 h. Ne mange pas à 18 h comme la dernière fois.",
    photoIds: [],
    reactions: [{ by: "alice", emoji: "😂", at: daysAgo(3, 12, 10) }],
    comments: [{ id: "co-03", by: "alice", body: "C'était une seule fois.", at: daysAgo(3, 12, 12) }],
    pinned: false,
    createdAt: daysAgo(3, 11, 40),
  }),
  stamp<Post>({
    id: "po-03",
    by: "alice",
    body: "Les tomates du marché étaient tellement bonnes qu'on en a racheté le lendemain. On devient ces gens-là.",
    photoIds: ["ph-09"],
    mood: { emoji: "🍅", label: "repue" },
    reactions: [
      { by: "joseph", emoji: "🙌", at: daysAgo(8, 14, 0) },
      { by: "joseph", emoji: "❤️", at: daysAgo(8, 14, 1) },
    ],
    comments: [],
    pinned: false,
    createdAt: daysAgo(8, 13, 20),
  }),
  stamp<Post>({
    id: "po-04",
    by: "joseph",
    body: "Dimanche sans réveil, sans plan, sans rien. On devrait en programmer un par mois.",
    photoIds: ["ph-06"],
    mood: { emoji: "🛏️", label: "tranquille" },
    reactions: [{ by: "alice", emoji: "🥰", at: daysAgo(12, 11, 5) }],
    comments: [{ id: "co-04", by: "alice", body: "Programmer un dimanche sans plan. Tu t'entends ?", at: daysAgo(12, 11, 22) }],
    pinned: true,
    createdAt: daysAgo(12, 10, 30),
  }),
  stamp<Post>({
    id: "po-05",
    by: "alice",
    body: "Un an aujourd'hui qu'on a signé pour l'appartement. Je me rappelle qu'on avait peur.",
    photoIds: ["ph-16"],
    reactions: [{ by: "joseph", emoji: "🏡", at: daysAgo(19, 20, 5) }],
    comments: [],
    pinned: false,
    createdAt: daysAgo(19, 19, 45),
  }),
  stamp<Post>({
    id: "po-06",
    by: "joseph",
    body: "Lisbonne, jour 3. On a marché 19 km sans s'en rendre compte. Mes mollets, eux, s'en sont rendu compte.",
    photoIds: ["ph-03", "ph-04"],
    mood: { emoji: "🚋", label: "épuisé mais bien" },
    reactions: [{ by: "alice", emoji: "😂", at: daysAgo(33, 22, 10) }],
    comments: [],
    pinned: false,
    createdAt: daysAgo(33, 21, 50),
  }),
  stamp<Post>({
    id: "po-07",
    by: "alice",
    body: "Note pour plus tard : ne jamais laisser Joseph choisir le restaurant quand il a faim.",
    photoIds: [],
    reactions: [{ by: "joseph", emoji: "😤", at: daysAgo(46, 20, 30) }],
    comments: [{ id: "co-05", by: "joseph", body: "Le kebab était très bien.", at: daysAgo(46, 20, 33) }],
    pinned: false,
    createdAt: daysAgo(46, 20, 12),
  }),
];

/* -------------------------------- Musique --------------------------------- */

const playlists: Playlist[] = [
  stamp<Playlist>({
    id: "pl-roadtrip",
    title: "Nos road-trips",
    description: "Ce qui passe dans la voiture, fenêtres ouvertes.",
    tint: "carte",
    by: "joseph",
    createdAt: daysAgo(200, 18, 0),
  }),
  stamp<Playlist>({
    id: "pl-dimanche",
    title: "Dimanche matin",
    description: "Volume bas, café, personne ne parle avant 10 h.",
    tint: "musique",
    by: "alice",
    createdAt: daysAgo(150, 9, 30),
  }),
  stamp<Playlist>({
    id: "pl-nous",
    title: "Les nôtres",
    description: "Les morceaux qui ont une histoire. Chacun a sa note.",
    tint: "fil",
    by: "alice",
    createdAt: daysAgo(320, 22, 0),
  }),
];

const trackSpecs: {
  id: string;
  title: string;
  artist: string;
  note?: string;
  by: "alice" | "joseph";
  playlists: string[];
  loves: ("alice" | "joseph")[];
  days: number;
}[] = [
  { id: "tr-01", title: "La Vie en rose", artist: "Édith Piaf", note: "Notre premier slow, au mariage de Camille.", by: "alice", playlists: ["pl-nous"], loves: ["alice", "joseph"], days: 318 },
  { id: "tr-02", title: "Dreams", artist: "Fleetwood Mac", note: "La route vers Annecy, à fond.", by: "joseph", playlists: ["pl-roadtrip", "pl-nous"], loves: ["alice", "joseph"], days: 200 },
  { id: "tr-03", title: "Harvest Moon", artist: "Neil Young", note: "Tu la mets toujours quand tu cuisines.", by: "alice", playlists: ["pl-dimanche", "pl-nous"], loves: ["alice"], days: 148 },
  { id: "tr-04", title: "Ribs", artist: "Lorde", by: "alice", playlists: ["pl-roadtrip"], loves: ["alice"], days: 120 },
  { id: "tr-05", title: "Redbone", artist: "Childish Gambino", note: "L'appartement, premier soir, cartons partout.", by: "joseph", playlists: ["pl-nous"], loves: ["joseph"], days: 175 },
  { id: "tr-06", title: "Fly Me to the Moon", artist: "Frank Sinatra", by: "joseph", playlists: ["pl-dimanche"], loves: ["alice", "joseph"], days: 110 },
  { id: "tr-07", title: "Sunday Morning", artist: "The Velvet Underground", by: "alice", playlists: ["pl-dimanche"], loves: ["alice"], days: 100 },
  { id: "tr-08", title: "Road to Nowhere", artist: "Talking Heads", by: "joseph", playlists: ["pl-roadtrip"], loves: ["joseph"], days: 90 },
  { id: "tr-09", title: "Je te laisserai des mots", artist: "Patrick Watson", note: "Lisbonne, le soir sur le mirador.", by: "alice", playlists: ["pl-nous", "pl-dimanche"], loves: ["alice", "joseph"], days: 32 },
  { id: "tr-10", title: "Tous les mêmes", artist: "Stromae", by: "joseph", playlists: ["pl-roadtrip"], loves: [], days: 80 },
  { id: "tr-11", title: "Nightcall", artist: "Kavinsky", note: "Le retour de nuit, personne ne parlait.", by: "joseph", playlists: ["pl-roadtrip", "pl-nous"], loves: ["joseph"], days: 60 },
  { id: "tr-12", title: "Pink + White", artist: "Frank Ocean", by: "alice", playlists: ["pl-dimanche"], loves: ["alice", "joseph"], days: 45 },
];

const tracks: Track[] = trackSpecs.map((spec, index) =>
  stamp<Track>({
    id: spec.id,
    provider: "autre",
    providerId: "",
    url: `https://open.spotify.com/search/${encodeURIComponent(`${spec.title} ${spec.artist}`)}`,
    title: spec.title,
    artist: spec.artist,
    artworkUrl: demoArtwork(index),
    by: spec.by,
    note: spec.note,
    playlistIds: spec.playlists,
    loves: spec.loves,
    createdAt: daysAgo(spec.days, 17, index),
  }),
);

/* ---------------------------------- Carte --------------------------------- */

const placeSpecs: {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  days: number;
  note?: string;
  photos?: string[];
  kind?: "visite" | "envie";
}[] = [
  { id: "li-01", name: "Lisbonne", country: "Portugal", lat: 38.7223, lng: -9.1393, days: 34, note: "Cinq jours, 19 km par jour, zéro regret.", photos: ["ph-01", "ph-03", "ph-05"] },
  { id: "li-02", name: "Annecy", country: "France", lat: 45.8992, lng: 6.1294, days: 61, note: "Le lac à 14 °C et toi dedans.", photos: ["ph-11"] },
  { id: "li-03", name: "Séville", country: "Espagne", lat: 37.3891, lng: -5.9845, days: 300, note: "La chaleur, l'orange amère, la dernière nuit.", photos: ["ph-18"] },
  { id: "li-04", name: "Rome", country: "Italie", lat: 41.9028, lng: 12.4964, days: 420, note: "On s'est perdus tous les jours exprès." },
  { id: "li-05", name: "Amsterdam", country: "Pays-Bas", lat: 52.3676, lng: 4.9041, days: 520, note: "Premier voyage à deux. Il pleuvait sans arrêt." },
  { id: "li-06", name: "Palerme", country: "Italie", lat: 38.1157, lng: 13.3615, days: 610, note: "Le marché de Ballarò à 8 h du matin." },
  { id: "li-07", name: "Marrakech", country: "Maroc", lat: 31.6295, lng: -7.9811, days: 700, note: "Le thé sur le toit, tous les soirs." },
  { id: "li-08", name: "Édimbourg", country: "Écosse", lat: 55.9533, lng: -3.1883, days: 820, note: "Le vent. Vraiment, le vent." },
  { id: "li-09", name: "Reykjavik", country: "Islande", lat: 64.1466, lng: -21.9426, days: 940, note: "Aurores boréales à 2 h du matin, gelés." },
  { id: "li-10", name: "Kyoto", country: "Japon", lat: 35.0116, lng: 135.7681, days: 1100, note: "Le voyage dont on parle encore." },
  { id: "li-11", name: "New York", country: "États-Unis", lat: 40.7128, lng: -74.006, days: 1320, note: "Trop court, trop cher, à refaire." },
  { id: "li-12", name: "Paris", country: "France", lat: 48.8566, lng: 2.3522, days: 210, note: "Le concert où on ne voyait rien.", photos: ["ph-17"] },
  { id: "li-13", name: "El Chaltén", country: "Argentine", lat: -49.3315, lng: -72.8863, days: 0, kind: "envie", note: "Le trek du Fitz Roy. Un jour." },
  { id: "li-14", name: "Hanoï", country: "Viêt Nam", lat: 21.0278, lng: 105.8342, days: 0, kind: "envie", note: "Pour la nourriture, surtout." },
  { id: "li-15", name: "Reine, Lofoten", country: "Norvège", lat: 67.9333, lng: 13.0833, days: 0, kind: "envie", note: "Les cabanes rouges, le soleil de minuit." },
];

const places: Place[] = placeSpecs.map((spec, index) =>
  stamp<Place>({
    id: spec.id,
    name: spec.name,
    country: spec.country,
    lat: spec.lat,
    lng: spec.lng,
    kind: spec.kind ?? "visite",
    visitedAt: spec.kind === "envie" ? undefined : daysAgo(spec.days).slice(0, 10),
    note: spec.note,
    photoIds: spec.photos ?? [],
    by: index % 2 === 0 ? "alice" : "joseph",
    with: "les-deux",
    createdAt: daysAgo(spec.days || 5, 16, index),
  }),
);

/* ------------------------------- Qui est-ce ------------------------------- */

const peopleSpecs: {
  name: string;
  hint: string;
  cote: "alice" | "joseph" | "les-deux";
  cercle: "famille" | "amis" | "travail" | "etudes" | "voisinage";
  cheveux: "brun" | "blond" | "roux" | "noir" | "gris" | "chauve";
  cheveuxLongs: boolean;
  lunettes: boolean;
  barbe: boolean;
  chapeau: boolean;
}[] = [
  { name: "Camille", hint: "Le mariage où on a dansé La Vie en rose", cote: "alice", cercle: "amis", cheveux: "brun", cheveuxLongs: true, lunettes: false, barbe: false, chapeau: false },
  { name: "Théo", hint: "Celui qui répare tout", cote: "joseph", cercle: "amis", cheveux: "brun", cheveuxLongs: false, lunettes: false, barbe: true, chapeau: false },
  { name: "Mamie Suzanne", hint: "La recette du gratin", cote: "alice", cercle: "famille", cheveux: "gris", cheveuxLongs: false, lunettes: true, barbe: false, chapeau: false },
  { name: "Rémi", hint: "Le voisin du dessus, le bruit du dimanche", cote: "les-deux", cercle: "voisinage", cheveux: "blond", cheveuxLongs: false, lunettes: true, barbe: false, chapeau: true },
  { name: "Inès", hint: "Bureau d'en face, café de 15 h", cote: "joseph", cercle: "travail", cheveux: "noir", cheveuxLongs: true, lunettes: true, barbe: false, chapeau: false },
  { name: "Paul", hint: "La coloc de la fac", cote: "joseph", cercle: "etudes", cheveux: "chauve", cheveuxLongs: false, lunettes: false, barbe: true, chapeau: false },
  { name: "Léa", hint: "Le voyage à Rome, c'était son idée", cote: "les-deux", cercle: "amis", cheveux: "roux", cheveuxLongs: true, lunettes: false, barbe: false, chapeau: false },
  { name: "Oncle Marc", hint: "Les blagues du réveillon", cote: "joseph", cercle: "famille", cheveux: "gris", cheveuxLongs: false, lunettes: true, barbe: true, chapeau: true },
  { name: "Sofia", hint: "Elle nous a présentés, techniquement", cote: "les-deux", cercle: "amis", cheveux: "brun", cheveuxLongs: true, lunettes: false, barbe: false, chapeau: false },
  { name: "Julien", hint: "Le collègue qui court des marathons", cote: "alice", cercle: "travail", cheveux: "blond", cheveuxLongs: false, lunettes: false, barbe: false, chapeau: false },
  { name: "Nadia", hint: "Master ensemble, deux ans de bibliothèque", cote: "alice", cercle: "etudes", cheveux: "noir", cheveuxLongs: false, lunettes: true, barbe: false, chapeau: false },
  { name: "Grand-père Henri", hint: "Les histoires de la mer", cote: "joseph", cercle: "famille", cheveux: "chauve", cheveuxLongs: false, lunettes: true, barbe: false, chapeau: true },
];

const people: Person[] = peopleSpecs.map((spec, index) =>
  stamp<Person>({
    id: `pe-${String(index + 1).padStart(2, "0")}`,
    name: spec.name,
    photoUrl: demoPortrait(spec.name, index),
    thumbUrl: demoPortrait(spec.name, index),
    hint: spec.hint,
    traits: {
      cote: spec.cote,
      cercle: spec.cercle,
      cheveux: spec.cheveux,
      cheveuxLongs: spec.cheveuxLongs,
      lunettes: spec.lunettes,
      barbe: spec.barbe,
      chapeau: spec.chapeau,
    },
    by: index % 2 === 0 ? "alice" : "joseph",
    createdAt: daysAgo(260 - index * 4, 15, index),
  }),
);

/* -------------------------------- Réglages -------------------------------- */

const settings: Settings[] = [
  stamp<Settings>({
    id: "settings",
    since: (() => {
      const d = now();
      d.setFullYear(d.getFullYear() - 6);
      d.setMonth(5, 14);
      return d.toISOString().slice(0, 10);
    })(),
    aliceLabel: "Alice",
    josephLabel: "Joseph",
    createdAt: daysAgo(999, 12, 0),
  }),
];

/* --------------------------------------------------------------------------- */

export function seedCollections(): Record<CollectionName, Doc[]> {
  return {
    posts,
    photos,
    albums,
    tracks,
    playlists,
    places,
    people,
    games: [],
    settings,
    // Aucune source d'exemple : un album partagé iCloud se connecte à la main.
    sources: [],
  };
}
