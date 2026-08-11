import type { Plateforme } from "@/lib/types";
import { LONGUEUR_MAX_LIEN, PLATEFORMES, estLienSur } from "@/lib/musique";

/**
 * Odesli (song.link) : le même morceau, chez tout le monde.
 *
 * Alice est sur Deezer, Joseph sur Spotify. Sans clé d'API, sans compte
 * développeur et sans OAuth, un seul point d'entrée public suffit à faire le
 * pont : on lui donne l'adresse d'un morceau chez n'importe quel service, il
 * renvoie l'adresse du même morceau chez tous les autres.
 *
 *   https://api.song.link/v1-alpha.1/links?url=<url encodée>&userCountry=FR
 *
 * Ce n'est pas gratuit en appels : une dizaine par minute, pas davantage. D'où
 * la règle de l'app — on résout **une fois**, à l'ajout du morceau, et le
 * résultat est gardé pour toujours. Plus aucun appel ensuite, jamais, sauf
 * demande explicite (« Retrouver les liens »).
 *
 * Tout échoue proprement : réseau coupé, service muet, limite atteinte, morceau
 * inconnu. Un morceau se crée toujours, même si Odesli n'a rien donné.
 */

const POINT = "https://api.song.link/v1-alpha.1/links";

/** Le pays décide du catalogue interrogé, et donc des liens renvoyés. */
const PAYS = "FR";

/** Huit secondes : au-delà, l'ajout d'un morceau paraîtrait bloqué. */
const DELAI_MS = 8000;

export interface ResolutionReussie {
  ok: true;
  /** La page universelle Odesli, où chaque service a son bouton. */
  pageUrl?: string;
  liens: Partial<Record<Plateforme, string>>;
  titre?: string;
  artiste?: string;
  pochette?: string;
}

export interface ResolutionRatee {
  ok: false;
  /** Message déjà écrit en français, affichable tel quel. */
  erreur: string;
  /** Vrai quand c'est la limite d'appels qui a parlé : insister n'aiderait pas. */
  limite?: boolean;
}

export type Resolution = ResolutionReussie | ResolutionRatee;

/* --------------------------------- Lecture -------------------------------- */

function texte(valeur: unknown): string {
  return typeof valeur === "string" ? valeur.trim() : "";
}

function lienPropre(valeur: unknown): string | undefined {
  const brut = texte(valeur);
  return estLienSur(brut) && brut.length <= LONGUEUR_MAX_LIEN ? brut : undefined;
}

function objet(valeur: unknown): Record<string, unknown> | null {
  return valeur && typeof valeur === "object" && !Array.isArray(valeur)
    ? (valeur as Record<string, unknown>)
    : null;
}

/** Les liens par plateforme, réduits à celles qui nous intéressent et vérifiés un par un. */
function lireLiens(brut: unknown): Partial<Record<Plateforme, string>> {
  const source = objet(brut);
  const liens: Partial<Record<Plateforme, string>> = {};
  if (!source) return liens;

  for (const plateforme of PLATEFORMES) {
    const entree = objet(source[plateforme]);
    const url = entree ? lienPropre(entree.url) : undefined;
    if (url) liens[plateforme] = url;
  }
  return liens;
}

/** Titre, artiste et pochette : l'entité désignée, ou la première venue. */
function lireEntite(donnees: Record<string, unknown>): Record<string, unknown> | null {
  const entites = objet(donnees.entitiesByUniqueId);
  if (!entites) return null;

  const cle = texte(donnees.entityUniqueId);
  const choisie = cle ? objet(entites[cle]) : null;
  if (choisie) return choisie;

  for (const valeur of Object.values(entites)) {
    const entite = objet(valeur);
    if (entite) return entite;
  }
  return null;
}

/* -------------------------------- Résolution ------------------------------ */

function messageDeLaPanne(erreur: unknown): string {
  const nom = erreur instanceof Error ? erreur.name : "";
  if (nom === "TimeoutError" || nom === "AbortError") {
    return "song.link n’a pas répondu en huit secondes. Le morceau est gardé, tu pourras réessayer.";
  }
  return "song.link est injoignable pour le moment. Le morceau est gardé, tu pourras réessayer.";
}

/**
 * Le même morceau chez tous les services, à partir d'un seul lien.
 *
 * Ne lève jamais : tout retour est soit une réussite exploitable, soit un
 * message d'erreur en français, prêt à être affiché.
 */
export async function resoudreLiens(url: string): Promise<Resolution> {
  const cible = typeof url === "string" ? url.trim() : "";
  if (!estLienSur(cible) || cible.length > LONGUEUR_MAX_LIEN) {
    return { ok: false, erreur: "Ce lien n’est pas une adresse web exploitable." };
  }

  let reponse: Response;
  try {
    reponse = await fetch(`${POINT}?url=${encodeURIComponent(cible)}&userCountry=${PAYS}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(DELAI_MS),
      headers: { accept: "application/json" },
    });
  } catch (erreur) {
    return { ok: false, erreur: messageDeLaPanne(erreur) };
  }

  if (reponse.status === 429) {
    return {
      ok: false,
      limite: true,
      erreur: "song.link n’accepte qu’une dizaine de recherches par minute. Attends un peu.",
    };
  }
  if (reponse.status === 404) {
    return { ok: false, erreur: "song.link ne connaît pas ce lien." };
  }
  if (!reponse.ok) {
    return { ok: false, erreur: `song.link a répondu ${reponse.status}. À réessayer plus tard.` };
  }

  let donnees: Record<string, unknown> | null;
  try {
    donnees = objet(await reponse.json());
  } catch {
    return { ok: false, erreur: "song.link a renvoyé une réponse illisible." };
  }
  if (!donnees) return { ok: false, erreur: "song.link a renvoyé une réponse vide." };

  const liens = lireLiens(donnees.linksByPlatform);
  const pageUrl = lienPropre(donnees.pageUrl);

  // Rien d'ouvrable : autant le dire, plutôt que d'enregistrer du vide.
  if (!pageUrl && Object.keys(liens).length === 0) {
    return { ok: false, erreur: "song.link n’a trouvé ce morceau sur aucun service." };
  }

  const entite = lireEntite(donnees);
  return {
    ok: true,
    pageUrl,
    liens,
    titre: entite ? texte(entite.title) || undefined : undefined,
    artiste: entite ? texte(entite.artistName) || undefined : undefined,
    pochette: entite ? lienPropre(entite.thumbnailUrl) : undefined,
  };
}
