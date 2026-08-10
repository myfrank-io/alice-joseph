import { put } from "@vercel/blob";
import { hasBlobStorage } from "@/lib/data/store";

/**
 * Albums partagés iCloud.
 *
 * Apple ne documente pas ce service : il n'y a ni clé d'API, ni compte
 * développeur, seulement les trois appels que le visualiseur web d'Apple fait
 * lui-même quand on ouvre un album partagé public. Le protocole est stable
 * depuis des années, mais rien ne le garantit — tout ce qui vient d'Apple est
 * donc lu avec méfiance : aucune forme n'est supposée, chaque champ est vérifié,
 * et toute surprise ressort en français plutôt qu'en exception.
 *
 * Trois règles tiennent le reste :
 *
 * 1. Les dérivés (les tailles disponibles d'une photo) sont choisis à la mesure
 *    — largeur, puis poids — jamais au nom de la clé. Apple a déjà changé ses
 *    paliers (« 342 », « 1279 », « 2049 »…) et les changera encore.
 * 2. Les adresses de téléchargement rendues par Apple expirent en une heure.
 *    On télécharge donc les octets et on les range chez nous ; une URL Apple
 *    n'est jamais conservée comme adresse définitive d'une photo.
 * 3. On ne suit qu'une seule redirection de partition, et seulement vers un
 *    hôte `pNN-sharedstreams.icloud.com` : la réponse d'Apple ne doit pas
 *    pouvoir nous envoyer requêter n'importe quoi.
 */

/* --------------------------------- Résultat -------------------------------- */

/** Tout ce qui peut échouer le dit explicitement, avec une phrase lisible. */
export type Resultat<T> = ({ ok: true } & T) | { ok: false; erreur: string };

export function echec(erreur: string): { ok: false; erreur: string } {
  return { ok: false, erreur };
}

/**
 * Ce que rendent les quatre actions serveur.
 *
 * Elles vivent ici plutôt que dans le fichier `"use server"`, qui ne doit
 * exporter que des fonctions asynchrones — et l'écran, lui, a besoin de ces
 * formes pour afficher le résultat.
 */
export type ReponseConnexion = Resultat<{ albumName: string; photos: number }>;

export type ReponseTest = Resultat<{ albumName: string; photos: number; nouvelles: number }>;

export type ReponseSync = Resultat<{
  albumName: string;
  importees: number;
  /** Photos de l'album encore absentes de la bibliothèque après ce passage. */
  restantes: number;
  /** Vidéos et éléments laissés de côté. */
  ignorees: number;
  total: number;
}>;

export type ReponseDeconnexion = Resultat<{ retire: boolean }>;

/* ------------------------------- Les formes -------------------------------- */

export interface DeriveICloud {
  /** Clé du dérivé chez Apple (« 342 », « 1279 »…). Gardée pour le diagnostic seulement. */
  cle: string;
  checksum: string;
  fileSize: number;
  width: number;
  height: number;
}

export interface PhotoICloud {
  photoGuid: string;
  caption?: string;
  dateCreated?: string;
  batchDateCreated?: string;
  width: number;
  height: number;
  /** `mediaAssetType` quand Apple le donne : « video » pour une vidéo. */
  type?: string;
  derivatives: Record<string, DeriveICloud>;
}

export interface AlbumICloud {
  streamName?: string;
  userFirstName?: string;
  userLastName?: string;
  streamCtag?: string;
  photos: PhotoICloud[];
}

/* ------------------------------- Constantes -------------------------------- */

/** Première partition interrogée : elle redirige vers la bonne. */
const HOTE_PAR_DEFAUT = "p01-sharedstreams.icloud.com";

/** Le seul hôte vers lequel on accepte d'être redirigé. */
const HOTE_PARTITION = /^p\d{1,3}-sharedstreams\.icloud\.com$/;

/** Le jeton d'un album : uniquement alphanumérique. */
const JETON = /^[A-Za-z0-9]{8,64}$/;

/** Mots de route qui ne sont jamais un jeton. */
const SEGMENTS_DE_ROUTE = new Set(["sharedalbum", "sharedalbums", "photos", "photo", "share"]);

/** « fr-fr », « en-us »… le segment de langue d'un lien iCloud. */
const LANGUE = /^[a-z]{2}(-[a-z]{2})?$/i;

const DELAI_MS = 15_000;
const TAILLE_PAQUET = 25;
const OCTETS_MAX = 24 * 1024 * 1024;

/** Largeur visée pour la miniature. Le dérivé retenu est le premier à l'atteindre. */
const LARGEUR_MINIATURE = 342;

/** Ce qu'un navigateur sait afficher sans conversion. */
const TYPES_AFFICHABLES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/* ------------------------------ Lecture prudente --------------------------- */

function chaine(valeur: unknown): string | undefined {
  if (typeof valeur !== "string") return undefined;
  const propre = valeur.trim();
  return propre.length > 0 ? propre : undefined;
}

/** Apple renvoie ses nombres tantôt en nombres, tantôt en chaînes. */
function nombre(valeur: unknown): number {
  if (typeof valeur === "number" && Number.isFinite(valeur)) return Math.max(0, Math.trunc(valeur));
  if (typeof valeur === "string") {
    const lu = Number.parseInt(valeur, 10);
    if (Number.isFinite(lu)) return Math.max(0, lu);
  }
  return 0;
}

/** « 2024-06-14T09:12:33Z » → « 2024-06-14 ». Rien si la date est illisible. */
export function jourDePhoto(photo: PhotoICloud): string | undefined {
  for (const brut of [photo.dateCreated, photo.batchDateCreated]) {
    if (!brut) continue;
    const direct = /^(\d{4}-\d{2}-\d{2})/.exec(brut);
    if (direct) return direct[1];
    const date = new Date(brut);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return undefined;
}

/* ------------------------------ 1. Le lien --------------------------------- */

function dernierSegment(chemin: string): string {
  const morceaux = chemin.split("/").filter((morceau) => morceau.length > 0);
  return morceaux[morceaux.length - 1] ?? "";
}

/**
 * Extrait le jeton d'un lien public d'album partagé.
 *
 * Trois formes circulent : `icloud.com/sharedalbum/#JETON`, la même avec un
 * segment de langue, et le lien court `share.icloud.com/photos/JETON`. Le jeton
 * est ce qui suit le `#`, ou à défaut le dernier segment du chemin.
 */
export function analyserLienAlbum(url: string): Resultat<{ jeton: string }> {
  const brut = typeof url === "string" ? url.trim() : "";
  if (brut.length === 0) return echec("Colle le lien public de ton album partagé.");

  let adresse: URL;
  try {
    adresse = new URL(brut);
  } catch {
    return echec(
      "Ce n’est pas une adresse valide. Attendu : https://www.icloud.com/sharedalbum/#… ou https://share.icloud.com/photos/…",
    );
  }

  if (adresse.protocol !== "https:") {
    return echec("Le lien doit commencer par https://.");
  }

  const hote = adresse.hostname.toLowerCase();
  if (hote !== "www.icloud.com" && hote !== "icloud.com" && hote !== "share.icloud.com") {
    return echec(
      "Ce lien ne vient pas d’iCloud. Attendu : https://www.icloud.com/sharedalbum/#… ou https://share.icloud.com/photos/…",
    );
  }

  const candidat = adresse.hash.replace(/^#/, "").trim() || dernierSegment(adresse.pathname);

  if (candidat.length === 0) {
    return echec(
      "Ce lien ne contient pas de jeton d’album. Sur l’iPhone, ouvre l’album partagé, onglet Personnes, active « Site web public » et copie le lien proposé.",
    );
  }
  if (SEGMENTS_DE_ROUTE.has(candidat.toLowerCase()) || LANGUE.test(candidat)) {
    return echec(
      "Ce lien mène à iCloud mais ne désigne aucun album. Il manque la partie après le # — recopie le lien en entier.",
    );
  }
  if (!JETON.test(candidat)) {
    return echec(
      "Le jeton de ce lien a une forme inattendue. Recopie le lien tel qu’iCloud le donne, sans le modifier.",
    );
  }

  return { ok: true, jeton: candidat };
}

/* ------------------------------ Les requêtes ------------------------------- */

type ReponseApple = { ok: true; statut: number; corps: unknown } | { ok: false; erreur: string };

function messageReseau(erreur: unknown): string {
  const nom = erreur instanceof Error ? erreur.name : "";
  if (nom === "TimeoutError" || nom === "AbortError") {
    return "Apple n’a pas répondu en quinze secondes. Réessaie dans un moment.";
  }
  return "Impossible de joindre iCloud depuis le serveur. Réessaie dans un moment.";
}

function messageStatut(statut: number): string {
  if (statut === 400) {
    return "Apple a refusé la requête (400). Le lien de l’album est peut-être incomplet.";
  }
  if (statut === 401 || statut === 403) {
    return "L’album n’est plus public. Sur l’iPhone, ouvre-le, onglet Personnes, et réactive « Site web public ».";
  }
  if (statut === 404) {
    return "Album introuvable. Le lien a été révoqué, ou l’album n’existe plus.";
  }
  if (statut === 429) {
    return "Apple limite les requêtes pour l’instant. Réessaie dans quelques minutes.";
  }
  if (statut >= 500) {
    return `Apple ne répond pas correctement (erreur ${statut}). Réessaie plus tard.`;
  }
  return `Réponse inattendue d’Apple (statut ${statut}).`;
}

async function poster(
  base: string,
  jeton: string,
  methode: "webstream" | "webasseturls",
  corps: unknown,
): Promise<ReponseApple> {
  const adresse = `https://${base}/${encodeURIComponent(jeton)}/sharedstreams/${methode}`;

  let reponse: Response;
  try {
    reponse = await fetch(adresse, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        Origin: "https://www.icloud.com",
        Referer: "https://www.icloud.com/",
      },
      body: JSON.stringify(corps),
      cache: "no-store",
      signal: AbortSignal.timeout(DELAI_MS),
    });
  } catch (erreur) {
    return echec(messageReseau(erreur));
  }

  let texte = "";
  try {
    texte = await reponse.text();
  } catch (erreur) {
    return echec(messageReseau(erreur));
  }

  let analyse: unknown = null;
  try {
    analyse = texte.length > 0 ? (JSON.parse(texte) as unknown) : null;
  } catch {
    analyse = null;
  }

  return { ok: true, statut: reponse.status, corps: analyse };
}

/** L'hôte de partition indiqué par une réponse 330, s'il est crédible. */
function hoteRedirige(corps: unknown): string | null {
  if (!corps || typeof corps !== "object") return null;
  const valeur = (corps as Record<string, unknown>)["X-Apple-MMe-Host"];
  const hote = chaine(valeur)?.toLowerCase();
  return hote && HOTE_PARTITION.test(hote) ? hote : null;
}

/* --------------------------- 2 et 3. L'album ------------------------------- */

function lireDerives(valeur: unknown): Record<string, DeriveICloud> {
  const sortie: Record<string, DeriveICloud> = {};
  if (!valeur || typeof valeur !== "object") return sortie;

  for (const [cle, brut] of Object.entries(valeur as Record<string, unknown>)) {
    if (!brut || typeof brut !== "object") continue;
    const derive = brut as Record<string, unknown>;
    const checksum = chaine(derive.checksum);
    if (!checksum) continue;
    sortie[cle] = {
      cle,
      checksum,
      fileSize: nombre(derive.fileSize),
      width: nombre(derive.width),
      height: nombre(derive.height),
    };
  }
  return sortie;
}

function lirePhoto(valeur: unknown): PhotoICloud | null {
  if (!valeur || typeof valeur !== "object") return null;
  const brut = valeur as Record<string, unknown>;

  const photoGuid = chaine(brut.photoGuid);
  if (!photoGuid) return null;

  return {
    photoGuid,
    caption: chaine(brut.caption)?.slice(0, 240),
    dateCreated: chaine(brut.dateCreated),
    batchDateCreated: chaine(brut.batchDateCreated),
    width: nombre(brut.width),
    height: nombre(brut.height),
    type: chaine(brut.mediaAssetType)?.toLowerCase(),
    derivatives: lireDerives(brut.derivatives),
  };
}

function lireAlbum(corps: unknown): AlbumICloud | null {
  if (!corps || typeof corps !== "object") return null;
  const brut = corps as Record<string, unknown>;
  if (!Array.isArray(brut.photos)) return null;

  const photos: PhotoICloud[] = [];
  for (const element of brut.photos) {
    const photo = lirePhoto(element);
    if (photo) photos.push(photo);
  }

  return {
    streamName: chaine(brut.streamName)?.slice(0, 120),
    userFirstName: chaine(brut.userFirstName),
    userLastName: chaine(brut.userLastName),
    streamCtag: chaine(brut.streamCtag),
    photos,
  };
}

/**
 * Liste le contenu d'un album.
 *
 * On part de `p01`, qui répond 330 en indiquant la partition réelle de l'album ;
 * une seule redirection est suivie. L'hôte finalement retenu est rendu au
 * passage : le conserver évite ce détour aux synchronisations suivantes.
 */
export async function chargerAlbum(
  jeton: string,
  base: string = HOTE_PAR_DEFAUT,
): Promise<Resultat<{ base: string; album: AlbumICloud }>> {
  if (!JETON.test(jeton)) {
    return echec("Le jeton de cet album est invalide. Reconnecte le lien de l’album.");
  }

  let hote = HOTE_PARTITION.test(base) ? base : HOTE_PAR_DEFAUT;

  for (let essai = 0; essai < 2; essai += 1) {
    const reponse = await poster(hote, jeton, "webstream", { streamCtag: null });
    if (!reponse.ok) return reponse;

    if (reponse.statut === 330) {
      const suivant = hoteRedirige(reponse.corps);
      if (essai === 1 || !suivant) {
        return echec(
          "Apple renvoie vers un autre serveur sans jamais s’arrêter. Réessaie dans un moment.",
        );
      }
      hote = suivant;
      continue;
    }

    if (reponse.statut !== 200) return echec(messageStatut(reponse.statut));

    const album = lireAlbum(reponse.corps);
    if (!album) {
      return echec("Réponse inattendue d’Apple : la liste des photos est illisible.");
    }
    return { ok: true, base: hote, album };
  }

  return echec("Apple n’a pas fini par répondre. Réessaie dans un moment.");
}

/* -------------------------- 4. Adresses des actifs ------------------------- */

function lireItems(corps: unknown): Record<string, string> | null {
  if (!corps || typeof corps !== "object") return null;
  const items = (corps as Record<string, unknown>).items;
  if (!items || typeof items !== "object") return null;

  const sortie: Record<string, string> = {};
  for (const [checksum, valeur] of Object.entries(items as Record<string, unknown>)) {
    if (!valeur || typeof valeur !== "object") continue;
    const item = valeur as Record<string, unknown>;
    const hote = chaine(item.url_location);
    const chemin = chaine(item.url_path);
    if (!hote || !chemin) continue;
    if (!/^[A-Za-z0-9.-]+$/.test(hote) || !chemin.startsWith("/")) continue;
    sortie[checksum] = `https://${hote}${chemin}`;
  }
  return sortie;
}

/**
 * Les adresses de téléchargement, indexées par checksum de dérivé.
 *
 * Apple plafonne à vingt-cinq identifiants par appel : la liste est découpée
 * ici, pour que l'appelant n'ait pas à y penser. Ces adresses expirent en une
 * heure environ — elles ne servent qu'à télécharger tout de suite.
 */
export async function urlsDesActifs(
  base: string,
  jeton: string,
  guids: string[],
): Promise<Resultat<{ urls: Record<string, string> }>> {
  const urls: Record<string, string> = {};

  for (let debut = 0; debut < guids.length; debut += TAILLE_PAQUET) {
    const paquet = guids.slice(debut, debut + TAILLE_PAQUET);
    if (paquet.length === 0) continue;

    const reponse = await poster(base, jeton, "webasseturls", { photoGuids: paquet });
    if (!reponse.ok) return reponse;

    if (reponse.statut === 330) {
      return echec(
        "Apple a déplacé l’album vers un autre serveur. Relance la synchronisation : la bonne adresse sera retenue.",
      );
    }
    if (reponse.statut !== 200) return echec(messageStatut(reponse.statut));

    const items = lireItems(reponse.corps);
    if (!items) {
      return echec("Réponse inattendue d’Apple : les adresses de téléchargement sont illisibles.");
    }
    Object.assign(urls, items);
  }

  return { ok: true, urls };
}

/* ------------------------------ Les dérivés -------------------------------- */

export interface ChoixDerives {
  grand: DeriveICloud;
  petit: DeriveICloud;
}

/**
 * Le plus grand dérivé pour la photo, un petit pour la miniature.
 *
 * Le classement se fait à la largeur, le poids ne servant qu'à départager —
 * jamais sur le nom de la clé, qui n'est qu'un palier historique d'Apple. Quand
 * un album ne propose qu'une seule taille, les deux choix se confondent : le
 * téléchargement n'a alors lieu qu'une fois.
 */
export function choisirDerives(photo: PhotoICloud): ChoixDerives | null {
  const liste = Object.values(photo.derivatives);
  if (liste.length === 0) return null;

  const triees = [...liste].sort((a, b) => a.width - b.width || a.fileSize - b.fileSize);
  const grand = triees[triees.length - 1];
  const petit = triees.find((derive) => derive.width >= LARGEUR_MINIATURE) ?? triees[0];

  return { grand, petit };
}

/* ------------------------------ Le rangement ------------------------------- */

function nomDeFichier(brut: string): string {
  return brut.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 80);
}

/**
 * Télécharge une photo chez Apple et la range dans notre stockage.
 *
 * C'est le cœur de l'affaire : les adresses d'Apple expirent, donc seule une
 * copie chez nous fait une photothèque qui tient. `storeImage()` ne convient pas
 * ici — il attend une data URL produite par le navigateur, alors que ces
 * octets-là viennent d'un `fetch`.
 */
export async function rangerImageDistante(
  url: string,
  cheminSansExtension: string,
): Promise<Resultat<{ url: string; octets: number }>> {
  if (!hasBlobStorage()) {
    return echec("Le stockage des photos n’est pas branché.");
  }

  let reponse: Response;
  try {
    reponse = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(DELAI_MS) });
  } catch (erreur) {
    return echec(messageReseau(erreur));
  }

  if (!reponse.ok) {
    return echec(
      `Le téléchargement d’une photo a échoué (statut ${reponse.status}). L’adresse fournie par Apple a peut-être expiré.`,
    );
  }

  const type = (reponse.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const contentType = TYPES_AFFICHABLES.has(type) ? type : "";
  if (!contentType) {
    return echec(
      `Apple a renvoyé un format qu’un navigateur n’affiche pas (${type || "type inconnu"}).`,
    );
  }

  let octets: ArrayBuffer;
  try {
    octets = await reponse.arrayBuffer();
  } catch (erreur) {
    return echec(messageReseau(erreur));
  }

  if (octets.byteLength === 0) return echec("Apple a renvoyé une image vide.");
  if (octets.byteLength > OCTETS_MAX) {
    return echec("Une photo dépasse 24 Mo : elle a été laissée de côté.");
  }

  try {
    const range = await put(`${cheminSansExtension}.${EXTENSIONS[contentType]}`, octets, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return { ok: true, url: range.url, octets: octets.byteLength };
  } catch {
    return echec("Le stockage des photos a refusé l’image. Réessaie dans un moment.");
  }
}

/** Chemin de rangement d'une photo importée : stable, donc rejouable sans doublon. */
export function cheminPhoto(who: string, photoGuid: string, taille: "grand" | "min"): string {
  return `photos/icloud/${nomDeFichier(who)}/${nomDeFichier(photoGuid)}${
    taille === "min" ? "-min" : ""
  }`;
}

/** « Album de Lisbonne » ou, à défaut, le prénom du propriétaire. */
export function nomAlbum(album: AlbumICloud): string {
  const prenom = [album.userFirstName, album.userLastName].filter(Boolean).join(" ").trim();
  return album.streamName ?? (prenom ? `Album de ${prenom}` : "Album partagé");
}
