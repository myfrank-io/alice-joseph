"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWho } from "@/lib/auth";
import { detachReference, get, insert, list, remove, update } from "@/lib/data/store";
import type { Playlist, Tint, Track } from "@/lib/types";
import {
  analyserLien,
  estLienSur,
  recupererMetadonnees,
  type EtatFormulaire,
} from "@/lib/musique";

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

  const metadonnees = lien ? await recupererMetadonnees(lien.url) : null;

  const title = titreSaisi || metadonnees?.title || "";
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
    url: lien?.url ?? lienBrut,
    title,
    artist: artisteSaisi || metadonnees?.artist || undefined,
    artworkUrl: metadonnees?.artworkUrl,
    by: who,
    note: note || undefined,
    playlistIds: await playlistsChoisies(formData),
    loves: [],
  });

  rafraichir();
  return { ok: true };
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

  // On ne retente les métadonnées que si le lien a bougé et qu'il manque une pochette.
  const metadonnees =
    lien && url !== actuel.url && !actuel.artworkUrl
      ? await recupererMetadonnees(lien.url)
      : null;

  await update<Track>("tracks", id, {
    provider: lien?.provider ?? "autre",
    providerId: lien?.providerId ?? "",
    url,
    title,
    artist: artist || undefined,
    artworkUrl: actuel.artworkUrl ?? metadonnees?.artworkUrl,
    note: note || undefined,
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
