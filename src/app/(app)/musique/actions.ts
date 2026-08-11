"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWho } from "@/lib/auth";
import { detachReference, get, insert, list, remove, update } from "@/lib/data/store";
import type { Playlist, Plateforme, Settings, Tint, Track } from "@/lib/types";
import {
  analyserLien,
  estLienSur,
  estPlateforme,
  peutEtreResolu,
  recupererMetadonnees,
  type EtatFormulaire,
} from "@/lib/musique";
import { resoudreLiens } from "@/lib/odesli";

/**
 * Écritures de l'app Musique. Chaque action vérifie l'identité avec
 * `requireWho()` — jamais une valeur venue du client — écrit dans le magasin,
 * puis rafraîchit la page principale et les pages de playlist.
 */

const TEINTES: Tint[] = ["fil", "photos", "musique", "carte", "jeux"];

function rafraichir(): void {
  revalidatePath("/musique");
  revalidatePath("/musique/[playlistId]", "page");
}

function champ(formData: FormData, nom: string, maximum: number): string {
  const valeur = formData.get(nom);
  return (typeof valeur === "string" ? valeur : "").trim().slice(0, maximum);
}

function teinte(formData: FormData): Tint {
  const valeur = formData.get("tint");
  return TEINTES.find((t) => t === valeur) ?? "musique";
}

/** Un tableau de liens vide ne vaut pas la peine d'être stocké. */
function liensOuRien(
  liens: Partial<Record<Plateforme, string>>,
): Partial<Record<Plateforme, string>> | undefined {
  return Object.keys(liens).length > 0 ? liens : undefined;
}

/** Les playlists cochées, réduites à celles qui existent vraiment. */
async function playlistsChoisies(formData: FormData): Promise<string[]> {
  const demandees = formData
    .getAll("playlistIds")
    .filter((valeur): valeur is string => typeof valeur === "string");
  if (demandees.length === 0) return [];
  const existantes = await list<Playlist>("playlists");
  return existantes.filter((p) => demandees.includes(p.id)).map((p) => p.id);
}

/* -------------------------------- Morceaux -------------------------------- */

export async function ajouterMorceau(
  _prec: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const who = await requireWho();

  const lienBrut = champ(formData, "url", 2000);
  const titreSaisi = champ(formData, "title", 200);
  const artisteSaisi = champ(formData, "artist", 120);
  const note = champ(formData, "note", 1000);

  const valeurs = {
    url: lienBrut,
    title: titreSaisi,
    artist: artisteSaisi,
    note,
    playlistIds: formData
      .getAll("playlistIds")
      .filter((valeur): valeur is string => typeof valeur === "string")
      .join(","),
  };

  if (!lienBrut && !titreSaisi) {
    return { erreur: "Colle un lien, ou donne au moins un titre.", valeurs };
  }

  // Un lien reconnu est reconstruit de toutes pièces : « open.spotify.com/… »
  // sans « https:// » passe très bien. Un lien inconnu, lui, doit être une
  // vraie adresse web pour qu'on accepte de le garder tel quel.
  const lien = lienBrut ? analyserLien(lienBrut) : null;
  if (lienBrut && !lien && !estLienSur(lienBrut)) {
    return { erreur: "Ce lien ne ressemble pas à une adresse web.", manuel: true, valeurs };
  }

  // Les deux appels réseau partent ensemble : l'oEmbed du service pour le titre
  // et la pochette, Odesli pour le même morceau chez les autres services. Ni
  // l'un ni l'autre ne peut empêcher l'enregistrement — au pire, ils se taisent.
  const cible = lien?.url ?? lienBrut;
  const [metadonnees, resolution] = await Promise.all([
    lien ? recupererMetadonnees(lien.url) : null,
    peutEtreResolu(cible) ? resoudreLiens(cible) : null,
  ]);
  const partout = resolution?.ok ? resolution : null;

  const title = titreSaisi || metadonnees?.title || partout?.titre || "";
  if (!title) {
    return {
      erreur: lien
        ? "Le service n'a rien renvoyé pour ce lien. Écris le titre à la main, on garde le lecteur."
        : "On n'a pas reconnu ce lien. Écris le titre à la main : le morceau sera gardé quand même.",
      manuel: true,
      valeurs,
    };
  }

  await insert<Track>("tracks", {
    provider: lien?.provider ?? "autre",
    providerId: lien?.providerId ?? "",
    url: cible,
    title,
    artist: artisteSaisi || metadonnees?.artist || partout?.artiste || undefined,
    artworkUrl: metadonnees?.artworkUrl ?? partout?.pochette,
    by: who,
    note: note || undefined,
    playlistIds: await playlistsChoisies(formData),
    loves: [],
    liens: partout ? liensOuRien(partout.liens) : undefined,
    pageUrl: partout?.pageUrl,
  });

  rafraichir();
  return { ok: true };
}

/**
 * Retrouve chez tous les services le morceau désigné par son lien.
 *
 * Un seul appel à song.link, jamais automatique : soit à l'ajout du morceau,
 * soit ici, quand quelqu'un le demande. Le mode silencieux sert au rattrapage
 * par lots, qui rafraîchit la page une seule fois, à la fin.
 */
export async function retrouverLiens(
  trackId: string,
  silencieux = false,
): Promise<{ ok: boolean; erreur?: string; trouves?: number; limite?: boolean }> {
  await requireWho();

  const morceau = trackId ? await get<Track>("tracks", trackId) : null;
  if (!morceau) return { ok: false, erreur: "Ce morceau n’existe plus." };

  if (!peutEtreResolu(morceau.url)) {
    return {
      ok: false,
      erreur:
        "Ce morceau n’a pas de lien à chercher. Ouvre-le chez toi, copie son adresse, puis colle-la dans « Modifier ».",
    };
  }

  const resolution = await resoudreLiens(morceau.url);
  if (!resolution.ok) {
    return { ok: false, erreur: resolution.erreur, limite: resolution.limite };
  }

  await update<Track>("tracks", trackId, {
    liens: liensOuRien(resolution.liens),
    pageUrl: resolution.pageUrl,
    artworkUrl: morceau.artworkUrl ?? resolution.pochette,
    artist: morceau.artist ?? resolution.artiste,
  });

  if (!silencieux) rafraichir();
  return { ok: true, trouves: Object.keys(resolution.liens).length };
}

/* ------------------------------ Ma plateforme ----------------------------- */

/**
 * Le service sur lequel on écoute. Chacun ne règle que le sien : l'identité
 * vient du cookie de session, la valeur du client n'est qu'un choix de service.
 */
export async function choisirPlateforme(valeur: string): Promise<void> {
  const who = await requireWho();
  const plateforme = estPlateforme(valeur) ? valeur : undefined;

  const patch: Partial<Settings> =
    who === "alice" ? { alicePlateforme: plateforme } : { josephPlateforme: plateforme };

  const existants = await list<Settings>("settings");
  const reglages = existants[0];

  if (reglages) {
    await update<Settings>("settings", reglages.id, patch);
  } else {
    await insert<Settings>("settings", {
      id: "settings",
      aliceLabel: "Alice",
      josephLabel: "Joseph",
      ...patch,
    });
  }

  rafraichir();
}

export async function modifierMorceau(
  _prec: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  await requireWho();

  const id = champ(formData, "trackId", 64);
  const actuel = id ? await get<Track>("tracks", id) : null;
  if (!actuel) return { erreur: "Ce morceau n'existe plus." };

  const title = champ(formData, "title", 200);
  const artist = champ(formData, "artist", 120);
  const note = champ(formData, "note", 1000);
  const lienBrut = champ(formData, "url", 2000);
  const valeurs = { title, artist, note, url: lienBrut };

  if (!title) return { erreur: "Un morceau a besoin d'un titre.", valeurs };
  if (lienBrut && !estLienSur(lienBrut)) {
    return { erreur: "Ce lien ne ressemble pas à une adresse web.", valeurs };
  }

  const lien = lienBrut ? analyserLien(lienBrut) : null;
  const url = lien?.url ?? lienBrut;
  const aChangeDeLien = url !== actuel.url;

  // On ne retente les métadonnées que si le lien a bougé et qu'il manque une
  // pochette. Un nouveau lien, en revanche, désigne peut-être un autre morceau :
  // les liens gardés pour l'autre plateforme ne valent plus rien, on refait le tour.
  const [metadonnees, resolution] = await Promise.all([
    lien && aChangeDeLien && !actuel.artworkUrl ? recupererMetadonnees(lien.url) : null,
    aChangeDeLien && peutEtreResolu(url) ? resoudreLiens(url) : null,
  ]);
  const partout = resolution?.ok ? resolution : null;

  await update<Track>("tracks", id, {
    provider: lien?.provider ?? "autre",
    providerId: lien?.providerId ?? "",
    url,
    title,
    artist: artist || undefined,
    artworkUrl: actuel.artworkUrl ?? metadonnees?.artworkUrl ?? partout?.pochette,
    note: note || undefined,
    ...(aChangeDeLien
      ? { liens: partout ? liensOuRien(partout.liens) : undefined, pageUrl: partout?.pageUrl }
      : null),
  });

  rafraichir();
  return { ok: true };
}

export async function supprimerMorceau(trackId: string): Promise<void> {
  await requireWho();
  if (!trackId) return;
  await remove("tracks", trackId);
  rafraichir();
}

/**
 * Bascule le cœur de la personne connectée, et d'elle seule : l'identité vient
 * du cookie de session, jamais du formulaire.
 */
export async function basculerCoeur(trackId: string): Promise<void> {
  const who = await requireWho();
  const morceau = trackId ? await get<Track>("tracks", trackId) : null;
  if (!morceau) return;

  const loves = morceau.loves.includes(who)
    ? morceau.loves.filter((personne) => personne !== who)
    : [...morceau.loves, who];

  await update<Track>("tracks", trackId, { loves });
  rafraichir();
}

/* -------------------------------- Playlists ------------------------------- */

export async function creerPlaylist(
  _prec: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const who = await requireWho();

  const title = champ(formData, "title", 120);
  const description = champ(formData, "description", 400);
  if (!title) {
    return { erreur: "Une playlist a besoin d'un titre.", valeurs: { title, description } };
  }

  await insert<Playlist>("playlists", {
    title,
    description: description || undefined,
    tint: teinte(formData),
    by: who,
  });

  rafraichir();
  return { ok: true };
}

export async function modifierPlaylist(
  _prec: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  await requireWho();

  const id = champ(formData, "playlistId", 64);
  const actuelle = id ? await get<Playlist>("playlists", id) : null;
  if (!actuelle) return { erreur: "Cette playlist n'existe plus." };

  const title = champ(formData, "title", 120);
  const description = champ(formData, "description", 400);
  if (!title) {
    return { erreur: "Une playlist a besoin d'un titre.", valeurs: { title, description } };
  }

  await update<Playlist>("playlists", id, {
    title,
    description: description || undefined,
    tint: teinte(formData),
  });

  rafraichir();
  return { ok: true };
}

/** Supprime la playlist et la retire de tous les morceaux qui la citaient. */
export async function supprimerPlaylist(playlistId: string): Promise<void> {
  await requireWho();
  if (!playlistId) return;

  await detachReference<Track>("tracks", "playlistIds", playlistId);
  await remove("playlists", playlistId);

  rafraichir();
  redirect("/musique");
}

export async function ajouterAPlaylist(trackId: string, playlistId: string): Promise<void> {
  await requireWho();

  const morceau = trackId ? await get<Track>("tracks", trackId) : null;
  const playlist = playlistId ? await get<Playlist>("playlists", playlistId) : null;
  if (!morceau || !playlist || morceau.playlistIds.includes(playlistId)) return;

  await update<Track>("tracks", trackId, {
    playlistIds: [...morceau.playlistIds, playlistId],
  });
  rafraichir();
}

export async function retirerDePlaylist(trackId: string, playlistId: string): Promise<void> {
  await requireWho();

  const morceau = trackId ? await get<Track>("tracks", trackId) : null;
  if (!morceau || !morceau.playlistIds.includes(playlistId)) return;

  await update<Track>("tracks", trackId, {
    playlistIds: morceau.playlistIds.filter((id) => id !== playlistId),
  });
  rafraichir();
}
