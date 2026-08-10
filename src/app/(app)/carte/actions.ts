"use server";

import { revalidatePath } from "next/cache";
import { requireWho } from "@/lib/auth";
import { get, insert, remove, update } from "@/lib/data/store";
import { validerEntree } from "@/lib/carte/lieu";
import type { Place } from "@/lib/types";

/**
 * Écritures de la carte.
 *
 * Trois principes, sans exception : l'identité vient de `requireWho()` et jamais
 * du client ; tout ce qui arrive repasse par `validerEntree`, la même fonction
 * que celle qui grise le bouton du formulaire ; et rien ne lève — une action
 * renvoie toujours une réponse lisible, que le panneau sait afficher.
 */

type Reponse = { ok: true; id: string } | { ok: false; erreur: string };

const INTROUVABLE = "Ce lieu n’existe plus.";

/** La carte, et l'accueil qui compte les lieux visités. */
function rafraichir(): void {
  revalidatePath("/carte");
  revalidatePath("/nous");
}

/** Un identifiant venu du navigateur n'est qu'une chaîne, jusqu'à preuve du contraire. */
async function chargerLieu(id: unknown): Promise<Place | null> {
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return null;
  return get<Place>("places", id);
}

export async function ajouterLieu(brut: unknown): Promise<Reponse> {
  const who = await requireWho();

  const validation = validerEntree(brut);
  if (!validation.ok) return { ok: false, erreur: validation.erreur };
  const entree = validation.valeur;

  const lieu = await insert<Place>("places", {
    name: entree.name,
    country: entree.country,
    lat: entree.lat,
    lng: entree.lng,
    kind: entree.kind,
    visitedAt: entree.visitedAt,
    note: entree.note,
    photoIds: entree.photoIds,
    by: who,
    with: entree.with,
  });

  rafraichir();
  return { ok: true, id: lieu.id };
}

/**
 * Un lieu appartient au couple, pas à celui qui l'a saisi : les deux peuvent le
 * corriger. En revanche `by` ne bouge jamais — c'est de la mémoire, pas un droit.
 */
export async function modifierLieu(id: unknown, brut: unknown): Promise<Reponse> {
  await requireWho();

  const lieu = await chargerLieu(id);
  if (!lieu) return { ok: false, erreur: INTROUVABLE };

  const validation = validerEntree(brut);
  if (!validation.ok) return { ok: false, erreur: validation.erreur };
  const entree = validation.valeur;

  // `visitedAt` et `note` passent volontairement à `undefined` quand ils sont
  // vidés : une envie ne garde pas la date de la visite qu'elle n'est plus.
  await update<Place>("places", lieu.id, {
    name: entree.name,
    country: entree.country,
    lat: entree.lat,
    lng: entree.lng,
    kind: entree.kind,
    visitedAt: entree.visitedAt,
    note: entree.note,
    photoIds: entree.photoIds,
    with: entree.with,
  });

  rafraichir();
  return { ok: true, id: lieu.id };
}

/** Les photos rattachées ne sont pas touchées : elles vivent dans l'app Photos. */
export async function supprimerLieu(id: unknown): Promise<Reponse> {
  await requireWho();

  const lieu = await chargerLieu(id);
  if (!lieu) return { ok: false, erreur: INTROUVABLE };

  await remove("places", lieu.id);

  rafraichir();
  return { ok: true, id: lieu.id };
}
