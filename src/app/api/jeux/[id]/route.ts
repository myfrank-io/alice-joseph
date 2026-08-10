import { NextResponse } from "next/server";
import { currentWho } from "@/lib/auth";
import { get } from "@/lib/data/store";
import type { Doc } from "@/lib/types";
import { estPuissance4, estQuiEstCe } from "@/lib/jeux/parties";
import { erreursDe } from "@/lib/jeux/qui-est-ce";
import type { MancheVue } from "@/lib/jeux/types";
import type { VuePartie } from "@/components/jeux/puissance4";

/**
 * L'état d'une partie, en lecture seule.
 *
 * Sert au mode « chacun de son côté » : le plateau interroge cette route toutes
 * les trois secondes et ne compare qu'`updatedAt`, mais on renvoie la partie
 * entière — exactement la forme que la page sert déjà au composant, pour qu'un
 * jour un rafraîchissement sans aller-retour serveur soit possible.
 *
 * La manche du « qui est-ce ? » sort d'ici comme elle sort d'une page : sans sa
 * réponse tant qu'elle est en cours.
 */

export const dynamic = "force-dynamic";

function json(corps: unknown, status = 200) {
  return NextResponse.json(corps, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET(_requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await currentWho();
  if (!who) return json({ erreur: "Il faut être connecté." }, 401);

  const { id } = await params;
  const doc = id ? await get<Doc>("games", id) : null;
  if (!doc) return json({ erreur: "Partie introuvable." }, 404);

  if (estPuissance4(doc)) {
    const vue: VuePartie = {
      id: doc.id,
      startedBy: doc.startedBy,
      status: doc.status,
      state: doc.state,
      updatedAt: doc.updatedAt,
    };
    return json({ kind: "puissance4", ...vue });
  }

  if (estQuiEstCe(doc)) {
    const vue: MancheVue = {
      id: doc.id,
      player: doc.player,
      setBy: doc.setBy,
      status: doc.status,
      questionsAsked: doc.questionsAsked,
      erreurs: erreursDe(doc),
      eliminated: doc.eliminated,
      etapes: doc.etapes ?? [],
      secretPersonId: doc.status === "en-cours" ? null : doc.secretPersonId,
    };
    return json({ kind: "qui-est-ce", updatedAt: doc.updatedAt, ...vue });
  }

  return json({ erreur: "Partie introuvable." }, 404);
}
