import type { MusicProvider, Track } from "@/lib/types";

/**
 * Reconnaissance des liens de musique.
 *
 * Le principe de l'app tient en une phrase : on colle un lien, la plateforme
 * reconnaît le morceau et intègre le lecteur du service. Aucun compte
 * développeur, aucune clé d'API, aucun fichier hébergé — uniquement des URL
 * publiques et les oEmbed ouverts que chaque service expose déjà.
 *
 * Tout ce qui sort d'ici est reconstruit à partir d'identifiants validés par
 * expression régulière : rien de ce qu'un utilisateur colle ne se retrouve tel
 * quel dans le `src` d'une iframe.
 */

/** Ce que désigne un lien : un morceau, un album, une playlist, une vidéo. */
export type LinkType = "track" | "album" | "playlist" | "video";

export interface LienMusique {
  provider: MusicProvider;
  /** Identifiant chez le fournisseur. */
  providerId: string;
  type: LinkType;
  /** Lien normalisé : sans paramètre de suivi, prêt à être stocké. */
  url: string;
  /** Adresse du lecteur intégrable. */
  embedUrl: string;
}

/** Ce qu'on arrive à deviner d'un morceau à partir de son lien. */
export interface MetadonneesMorceau {
  title?: string;
  artist?: string;
  artworkUrl?: string;
}

/** Retour des formulaires de l'app, lu côté client par `useActionState`. */
export interface EtatFormulaire {
  ok?: boolean;
  erreur?: string;
  /** Vrai quand le lien n'a pas été reconnu : le formulaire ouvre la saisie manuelle. */
  manuel?: boolean;
  /**
   * Ce qui venait d'être saisi. React vide le formulaire dès que l'action est
   * revenue : sans ce renvoi, une erreur ferait tout retaper.
   */
  valeurs?: Record<string, string>;
}

export const ETAT_INITIAL: EtatFormulaire = {};

/* ------------------------------ Identifiants ------------------------------ */

/** Spotify : base 62, 22 caractères en pratique. */
const ID_SPOTIFY = /^[A-Za-z0-9]{8,40}$/;
/** YouTube : identifiants de vidéo et de playlist, même alphabet. */
const ID_YOUTUBE = /^[A-Za-z0-9_-]{5,64}$/;
/** Deezer : purement numérique. */
const ID_DEEZER = /^\d{1,20}$/;
/** Apple Music : numérique pour les albums et morceaux, `pl.xxx` pour les playlists. */
const ID_APPLE = /^(?:pl\.[A-Za-z0-9._-]{2,64}|\d{1,20})$/;
/** Le morceau lisible dans une URL Apple (« le-slug-du-titre »), déjà encodé. */
const SLUG_APPLE = /^[A-Za-z0-9%._~-]{1,120}$/;
const CODE_PAYS = /^[a-z]{2}$/i;
const CODE_LANGUE = /^[a-z]{2}(?:-[a-z]{2})?$/i;

/* ------------------------------ Analyse du lien --------------------------- */

function versUrl(valeur: string): URL | null {
  try {
    const url = new URL(/^https?:\/\//i.test(valeur) ? valeur : `https://${valeur}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/**
 * Reconnaît un lien Spotify, YouTube, Deezer ou Apple Music et le normalise.
 * Renvoie `null` dès que le lien n'est pas exploitable : c'est le cas normal,
 * l'appelant propose alors la saisie manuelle.
 */
export function analyserLien(url: string): LienMusique | null {
  const brut = typeof url === "string" ? url.trim() : "";
  if (!brut) return null;

  // Les URI natives de l'application Spotify de bureau (« Copier le lien Spotify »).
  const uri = /^spotify:(track|album|playlist):([A-Za-z0-9]+)$/i.exec(brut);
  if (uri) return spotify(uri[1].toLowerCase(), uri[2]);

  const adresse = versUrl(brut);
  if (!adresse) return null;

  const hote = adresse.hostname.toLowerCase().replace(/^(?:www|m)\./, "");
  const chemin = adresse.pathname.split("/").filter(Boolean);

  if (hote === "open.spotify.com" || hote === "play.spotify.com" || hote === "embed.spotify.com") {
    return spotifyDepuisChemin(chemin);
  }
  if (
    hote === "youtu.be" ||
    hote === "youtube.com" ||
    hote === "music.youtube.com" ||
    hote === "youtube-nocookie.com"
  ) {
    return youtube(hote, chemin, adresse.searchParams);
  }
  if (hote === "deezer.com" || hote === "widget.deezer.com" || hote === "link.deezer.com") {
    return deezer(chemin);
  }
  if (
    hote === "music.apple.com" ||
    hote === "embed.music.apple.com" ||
    hote === "itunes.apple.com"
  ) {
    return apple(chemin, adresse.searchParams);
  }
  return null;
}

/* --------------------------------- Spotify -------------------------------- */

function spotify(genre: string, identifiant: string): LienMusique | null {
  if (genre !== "track" && genre !== "album" && genre !== "playlist") return null;
  if (!ID_SPOTIFY.test(identifiant)) return null;
  return {
    provider: "spotify",
    providerId: identifiant,
    type: genre,
    url: `https://open.spotify.com/${genre}/${identifiant}`,
    embedUrl: `https://open.spotify.com/embed/${genre}/${identifiant}`,
  };
}

function spotifyDepuisChemin(chemin: string[]): LienMusique | null {
  const segments = [...chemin];
  // « /intl-fr/track/… » et « /embed/track/… » mènent au même morceau.
  while (segments[0] && (/^intl-[a-z]{2,3}$/i.test(segments[0]) || segments[0] === "embed")) {
    segments.shift();
  }
  const [genre, identifiant] = segments;
  if (!genre || !identifiant) return null;
  // Le paramètre « ?si= » disparaît de lui-même : l'URL est reconstruite.
  return spotify(genre.toLowerCase(), identifiant);
}

/* --------------------------------- YouTube -------------------------------- */

function youtube(hote: string, chemin: string[], params: URLSearchParams): LienMusique | null {
  const [premier, second] = chemin;
  let video = "";

  if (hote === "youtu.be") {
    video = premier ?? "";
  } else if (premier === "watch") {
    video = params.get("v") ?? "";
  } else if (premier === "shorts" || premier === "live" || premier === "v" || premier === "embed") {
    // « /embed/videoseries?list=… » n'est pas une vidéo mais une playlist.
    video = second === "videoseries" ? "" : (second ?? "");
  }

  if (video && ID_YOUTUBE.test(video)) {
    return {
      provider: "youtube",
      providerId: video,
      type: "video",
      url: `https://www.youtube.com/watch?v=${video}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${video}`,
    };
  }

  const liste = params.get("list") ?? "";
  if (liste && ID_YOUTUBE.test(liste)) {
    return {
      provider: "youtube",
      providerId: liste,
      type: "playlist",
      url: `https://www.youtube.com/playlist?list=${liste}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/videoseries?list=${liste}`,
    };
  }
  return null;
}

/* ---------------------------------- Deezer -------------------------------- */

function deezer(chemin: string[]): LienMusique | null {
  const segments = [...chemin];
  // « /widget/auto/track/… » quand on colle l'adresse d'un widget déjà intégré.
  const tete = segments[0];
  if (tete === "widget") {
    segments.shift();
    if (segments[0] === "auto") segments.shift();
  }
  // La langue est facultative : « /fr/track/… » comme « /track/… ».
  if (segments.length > 2 && segments[0] && CODE_LANGUE.test(segments[0])) segments.shift();

  const [genre, identifiant] = segments;
  if (!genre || !identifiant) return null;
  const type = genre.toLowerCase();
  if (type !== "track" && type !== "album" && type !== "playlist") return null;
  if (!ID_DEEZER.test(identifiant)) return null;

  return {
    provider: "deezer",
    providerId: identifiant,
    type,
    url: `https://www.deezer.com/fr/${type}/${identifiant}`,
    embedUrl: `https://widget.deezer.com/widget/auto/${type}/${identifiant}`,
  };
}

/* ------------------------------- Apple Music ------------------------------ */

function apple(chemin: string[], params: URLSearchParams): LienMusique | null {
  const segments = [...chemin];
  const pays = segments[0] && CODE_PAYS.test(segments[0]) ? segments.shift()!.toLowerCase() : "fr";
  const genre = (segments.shift() ?? "").toLowerCase();
  if (genre !== "album" && genre !== "playlist" && genre !== "song") return null;

  const identifiant = segments.pop() ?? "";
  const slug = segments.pop() ?? "";
  if (!ID_APPLE.test(identifiant)) return null;

  // « ?i=… » désigne une piste précise à l'intérieur d'un album.
  const piste = params.get("i") ?? "";
  const morceau = piste && ID_DEEZER.test(piste) ? piste : "";
  const chemins = slug && SLUG_APPLE.test(slug) ? `${slug}/` : "";
  const suite = morceau ? `?i=${morceau}` : "";
  const type: LinkType = genre === "playlist" ? "playlist" : genre === "song" || morceau ? "track" : "album";

  return {
    provider: "apple",
    providerId: morceau || identifiant,
    type,
    url: `https://music.apple.com/${pays}/${genre}/${chemins}${identifiant}${suite}`,
    embedUrl: `https://embed.music.apple.com/${pays}/${genre}/${chemins}${identifiant}${suite}`,
  };
}

/* --------------------------------- Lecteur -------------------------------- */

export function nomFournisseur(provider: MusicProvider): string {
  switch (provider) {
    case "spotify":
      return "Spotify";
    case "youtube":
      return "YouTube";
    case "deezer":
      return "Deezer";
    case "apple":
      return "Apple Music";
    default:
      return "un autre service";
  }
}

/**
 * Hauteur d'iframe conseillée, en pixels, telle que la documente chaque service.
 * Zéro veut dire « pas de hauteur fixe » : le lecteur suit alors un ratio,
 * donné par `ratioEmbed`.
 */
export function hauteurEmbed(provider: MusicProvider, type: LinkType): number {
  switch (provider) {
    case "spotify":
      return type === "track" ? 152 : 380;
    case "deezer":
      return type === "track" ? 300 : 380;
    case "apple":
      return type === "track" ? 175 : 450;
    case "youtube":
      return 0;
    default:
      return 0;
  }
}

/** Le lecteur YouTube est une vidéo : il se cale sur un ratio, pas sur une hauteur. */
export function ratioEmbed(provider: MusicProvider): string | null {
  return provider === "youtube" ? "16 / 9" : null;
}

export interface Lecteur {
  provider: MusicProvider;
  type: LinkType;
  embedUrl: string;
  hauteur: number;
  ratio: string | null;
  /** Titre de l'iframe, seul repère pour qui navigue au clavier ou à l'oreille. */
  titre: string;
}

/** Reconstruit un lecteur depuis les seuls fournisseur et identifiant stockés. */
function depuisIdentifiant(provider: MusicProvider, providerId: string): LienMusique | null {
  if (!providerId) return null;
  switch (provider) {
    case "spotify":
      return spotify("track", providerId);
    case "youtube":
      return ID_YOUTUBE.test(providerId)
        ? {
            provider,
            providerId,
            type: "video",
            url: `https://www.youtube.com/watch?v=${providerId}`,
            embedUrl: `https://www.youtube-nocookie.com/embed/${providerId}`,
          }
        : null;
    case "deezer":
      return ID_DEEZER.test(providerId)
        ? {
            provider,
            providerId,
            type: "track",
            url: `https://www.deezer.com/fr/track/${providerId}`,
            embedUrl: `https://widget.deezer.com/widget/auto/track/${providerId}`,
          }
        : null;
    default:
      // Apple Music a besoin du pays et du chemin complet : le lien fait foi.
      return null;
  }
}

/**
 * Le lecteur d'un morceau enregistré, ou `null` s'il n'y en a pas — c'est le
 * cas du contenu d'exemple, dont les liens ne pointent vers aucun morceau
 * précis. On repart du lien, plus riche que l'identifiant seul.
 */
export function lecteurPour(
  morceau: Pick<Track, "provider" | "providerId" | "url" | "title"> & { artist?: string },
): Lecteur | null {
  const lien =
    analyserLien(morceau.url) ?? depuisIdentifiant(morceau.provider, morceau.providerId);
  if (!lien) return null;

  const auteur = morceau.artist ? ` — ${morceau.artist}` : "";
  return {
    provider: lien.provider,
    type: lien.type,
    embedUrl: lien.embedUrl,
    hauteur: hauteurEmbed(lien.provider, lien.type),
    ratio: ratioEmbed(lien.provider),
    titre: `${morceau.title}${auteur} · lecteur ${nomFournisseur(lien.provider)}`,
  };
}

/** Un lien affichable en toute sécurité dans un `href` ou un `src`. */
export function estLienSur(url: string | undefined | null): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url.trim());
}

/* -------------------------------- Métadonnées ----------------------------- */

function pointOembed(lien: LienMusique): string | null {
  const cible = encodeURIComponent(lien.url);
  switch (lien.provider) {
    case "spotify":
      return `https://open.spotify.com/oembed?url=${cible}`;
    case "youtube":
      return `https://www.youtube.com/oembed?url=${cible}&format=json`;
    case "deezer":
      return `https://api.deezer.com/oembed?url=${cible}&format=json`;
    default:
      // Apple Music n'expose pas d'oEmbed public : on saisira à la main.
      return null;
  }
}

/** Les mentions dont les plateformes vidéo décorent les titres. */
const BRUIT =
  /\s*[([]\s*(?:official\s*(?:music\s*)?(?:video|audio|lyrics?\s*video)?|clip\s*officiel|audio\s*officiel|lyrics?(?:\s*video)?|visuali[sz]er|paroles|hd|hq|4k|remaster(?:ed)?(?:\s*\d{4})?)\s*[)\]]\s*$/i;

function nettoyerTitre(valeur: string): string {
  let propre = valeur.replace(/\s+/g, " ").trim();
  for (let i = 0; i < 3 && BRUIT.test(propre); i += 1) propre = propre.replace(BRUIT, "").trim();
  return propre;
}

/** « Artist - Topic », « ArtisteVEVO » : le nom de chaîne, débarrassé de sa livrée. */
function nettoyerAuteur(valeur: string): string {
  return valeur
    .replace(/\s*-\s*topic$/i, "")
    .replace(/vevo$/i, "")
    .replace(/\s*-\s*officiel(?:le)?$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Un titre d'oEmbed vaut soit « Titre », soit « Artiste - Titre ». On sépare
 * quand la forme est claire, sinon tout reste dans le titre : mieux vaut un
 * titre trop long qu'un artiste inventé.
 */
export function separerTitre(brut: string, auteur?: string): { title: string; artist?: string } {
  const propre = nettoyerTitre(brut);
  const coupe = /^(.{1,60}?)\s+[-–—]\s+(.+)$/.exec(propre);
  if (coupe) {
    const artiste = coupe[1].trim();
    const titre = coupe[2].trim();
    if (artiste && titre) return { title: titre, artist: artiste };
  }
  const auteurPropre = auteur ? nettoyerAuteur(auteur) : "";
  return auteurPropre ? { title: propre, artist: auteurPropre } : { title: propre };
}

function texte(valeur: unknown): string {
  return typeof valeur === "string" ? valeur.trim() : "";
}

/**
 * Interroge l'oEmbed public du service pour en tirer titre et pochette.
 *
 * Échoue en silence, toujours : réseau coupé, service muet, lien mort, format
 * inattendu — on renvoie `null` et l'utilisateur complète à la main. Une
 * récupération ratée ne doit jamais empêcher d'enregistrer un morceau.
 */
export async function recupererMetadonnees(url: string): Promise<MetadonneesMorceau | null> {
  const lien = analyserLien(url);
  if (!lien) return null;

  const point = pointOembed(lien);
  if (!point) return null;

  try {
    const reponse = await fetch(point, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/json" },
    });
    if (!reponse.ok) return null;

    const donnees: unknown = await reponse.json();
    if (!donnees || typeof donnees !== "object") return null;
    const brut = donnees as Record<string, unknown>;

    const titreBrut = texte(brut.title);
    const pochette = texte(brut.thumbnail_url);
    const auteur = texte(brut.author_name);
    if (!titreBrut && !pochette) return null;

    const { title, artist } = titreBrut ? separerTitre(titreBrut, auteur) : { title: "", artist: undefined };

    return {
      title: title || undefined,
      artist: artist || undefined,
      artworkUrl: estLienSur(pochette) ? pochette : undefined,
    };
  } catch {
    return null;
  }
}
