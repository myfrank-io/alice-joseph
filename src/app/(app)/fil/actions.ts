"use server";

import { revalidatePath } from "next/cache";
import { requireWho } from "@/lib/auth";
import { get, insert, newId, remove, update } from "@/lib/data/store";
import type { Comment, Doc, Photo, Post, Reaction } from "@/lib/types";
import { isValidIncomingImage, storeImage, type IncomingImage } from "@/lib/upload";
import { findMood, REACTIONS } from "@/components/fil/emojis";

/**
 * Écritures du fil. Aucune n'accepte l'identité du client : elle est toujours
 * relue du cookie signé, et l'appartenance d'un message est vérifiée avant
 * toute modification.
 */

const MAX_PHOTOS = 4;
const MAX_TEXTE = 4000;

/* ------------------------------- Publication ------------------------------ */

function lireImages(raw: FormDataEntryValue | null): IncomingImage[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isValidIncomingImage).slice(0, MAX_PHOTOS);
}

/**
 * Les photos du fil sont de vraies photos : elles rejoignent la collection
 * `photos` et apparaissent donc aussi dans l'app Photos. Le message n'en garde
 * que les identifiants.
 */
export async function creerPost(formData: FormData): Promise<void> {
  const who = await requireWho();

  const body = String(formData.get("texte") ?? "")
    .trim()
    .slice(0, MAX_TEXTE);
  if (!body) return;

  const mood = findMood(String(formData.get("humeur") ?? ""));

  const photoIds: string[] = [];
  for (const image of lireImages(formData.get("photos"))) {
    const stored = await storeImage(image, "fil");
    const photo = await insert<Photo>("photos", {
      url: stored.url,
      thumbUrl: stored.thumbUrl,
      width: stored.width,
      height: stored.height,
      by: who,
      favorite: false,
      albumIds: [],
    });
    photoIds.push(photo.id);
  }

  await insert<Post>("posts", {
    by: who,
    body,
    photoIds,
    mood: mood ? { emoji: mood.emoji, label: mood.label } : undefined,
    reactions: [],
    comments: [],
    pinned: false,
  });

  revalidatePath("/fil");
  if (photoIds.length > 0) revalidatePath("/photos");
}

/* -------------------------------- Le message ------------------------------ */

/** Les photos publiées avec le message restent dans l'app Photos, exprès. */
export async function supprimerPost(postId: string): Promise<void> {
  const who = await requireWho();
  const post = await get<Post>("posts", postId);
  if (!post || post.by !== who) return;

  await remove("posts", postId);
  revalidatePath("/fil");
}

export async function basculerEpingle(postId: string): Promise<void> {
  const who = await requireWho();
  const post = await get<Post>("posts", postId);
  if (!post || post.by !== who) return;

  await update<Post>("posts", postId, { pinned: !post.pinned });
  revalidatePath("/fil");
}

/* ------------------------------- Réactions -------------------------------- */

export async function basculerReaction(postId: string, emoji: string): Promise<void> {
  const who = await requireWho();
  const post = await get<Post>("posts", postId);
  if (!post) return;

  const actuelles = post.reactions ?? [];
  // Le jeu est fermé, mais on laisse retirer une réaction plus ancienne déjà posée.
  const connue =
    REACTIONS.some((reaction) => reaction.emoji === emoji) ||
    actuelles.some((reaction) => reaction.emoji === emoji);
  if (!connue) return;

  const mienne = actuelles.some((reaction) => reaction.by === who && reaction.emoji === emoji);
  const suivantes: Reaction[] = mienne
    ? actuelles.filter((reaction) => !(reaction.by === who && reaction.emoji === emoji))
    : [...actuelles, { by: who, emoji, at: new Date().toISOString() }];

  await update<Post>("posts", postId, { reactions: suivantes });
  revalidatePath("/fil");
}

/* ------------------------------ Commentaires ------------------------------ */

export async function ajouterCommentaire(postId: string, texte: string): Promise<void> {
  const who = await requireWho();

  const body = String(texte ?? "")
    .trim()
    .slice(0, MAX_TEXTE);
  if (!body) return;

  const post = await get<Post>("posts", postId);
  if (!post) return;

  const comment: Comment = {
    id: newId("co-"),
    by: who,
    body,
    at: new Date().toISOString(),
  };

  await update<Post>("posts", postId, { comments: [...(post.comments ?? []), comment] });
  revalidatePath("/fil");
}

export async function supprimerCommentaire(postId: string, commentId: string): Promise<void> {
  const who = await requireWho();
  const post = await get<Post>("posts", postId);
  if (!post) return;

  const comments = post.comments ?? [];
  const cible = comments.find((comment) => comment.id === commentId);
  if (!cible || cible.by !== who) return;

  await update<Post>("posts", postId, {
    comments: comments.filter((comment) => comment.id !== commentId),
  });
  revalidatePath("/fil");
}

/* ------------------------------- Dernière visite -------------------------- */

/**
 * Faute de collection dédiée, la dernière visite du fil est un document rangé
 * dans `settings`, un par personne : `vu-fil-alice` / `vu-fil-joseph`.
 *
 * Deux horodatages plutôt qu'un : `at` est le dernier affichage de la page,
 * `from` la référence qui décide de ce qui porte encore la pastille. Tant qu'on
 * reste sur le fil, `from` ne bouge pas — sinon les nouveautés s'effaceraient
 * dès la première réaction, qui recharge la page.
 */
interface VuFil extends Doc {
  from?: string;
  at: string;
}

const DUREE_VISITE = 15 * 60 * 1000;

/**
 * `list("settings")` trie du plus récent au plus ancien : daté d'aujourd'hui, ce
 * document passerait devant les vrais réglages et piégerait un appelant qui lit
 * la première entrée. On l'antidate donc pour qu'il reste toujours en dernier.
 */
const AVANT_TOUT = "1970-01-01T00:00:00.000Z";

export async function lireEtMarquerVu(): Promise<string | null> {
  const who = await requireWho();
  const id = `vu-fil-${who}`;
  const maintenant = new Date();
  const iso = maintenant.toISOString();

  const vu = await get<VuFil>("settings", id);
  if (!vu) {
    // Première visite : rien n'est « nouveau », tout est à découvrir.
    await insert<VuFil>("settings", { id, from: iso, at: iso, createdAt: AVANT_TOUT });
    return null;
  }

  const ecart = maintenant.getTime() - new Date(vu.at).getTime();
  const from = ecart > DUREE_VISITE ? vu.at : (vu.from ?? vu.at);
  await update<VuFil>("settings", id, { from, at: iso });
  return from;
}
