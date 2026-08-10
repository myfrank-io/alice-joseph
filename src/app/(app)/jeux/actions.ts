"use server";

import { revalidatePath } from "next/cache";
import { requireWho } from "@/lib/auth";
import { get, insert, list, remove, update } from "@/lib/data/store";
import { isValidIncomingImage, storeImage } from "@/lib/upload";
import type {
  Circle,
  Connect4Game,
  Doc,
  HairColor,
  Person,
  PersonTraits,
  Who,
  WhoOrBoth,
} from "@/lib/types";
import { autreQue, etatDepuisCoups, jouer, meilleurCoup } from "@/lib/jeux/puissance4";
import { estPuissance4, estQuiEstCe } from "@/lib/jeux/parties";
import {
  ERREURS_MAX,
  PENALITE_ERREUR,
  aEcarter,
  candidats,
  erreursDe,
  question,
  type Etape,
  type QuiEstCeManche,
} from "@/lib/jeux/qui-est-ce";
import type { EtatFormulaire, Reponse } from "@/lib/jeux/types";

/**
 * Toutes les mutations des deux jeux.
 *
 * Deux principes, sans exception : l'identité vient de `requireWho()` et jamais
 * du client, et l'état de jeu est recalculé ici à partir de l'historique rangé
 * en base. Un navigateur ne peut donc rien affirmer, seulement demander.
 */

const CHEMIN_HALL = "/jeux";
const CHEMIN_P4 = "/jeux/puissance-4";
const CHEMIN_QEC = "/jeux/qui-est-ce";

function echec(erreur: string): Reponse {
  return { ok: false, erreur };
}

function texte(valeur: FormDataEntryValue | null, max: number): string {
  return typeof valeur === "string" ? valeur.trim().slice(0, max) : "";
}

/* ========================================================================== */
/*                                Puissance 4                                 */
/* ========================================================================== */

function rejouer(partie: Connect4Game) {
  return etatDepuisCoups(partie.state.moves, {
    premier: partie.startedBy,
    mode: partie.state.mode,
    botSide: partie.state.botSide,
  });
}

async function chargerPartie(id: unknown): Promise<Connect4Game | null> {
  if (typeof id !== "string" || !id) return null;
  const doc = await get<Doc>("games", id);
  return doc && estPuissance4(doc) ? doc : null;
}

function revaliderP4() {
  revalidatePath(CHEMIN_P4);
  revalidatePath(CHEMIN_HALL);
}

export async function creerPartie(mode: unknown): Promise<Reponse> {
  const who = await requireWho();

  if (mode !== "local" && mode !== "distance" && mode !== "solo") {
    return echec("Mode de jeu inconnu.");
  }

  const botSide = mode === "solo" ? autreQue(who) : undefined;
  const partie = await insert<Connect4Game>("games", {
    kind: "puissance4",
    startedBy: who,
    status: "en-cours",
    state: etatDepuisCoups([], { premier: who, mode, botSide }),
  });

  revaliderP4();
  return { ok: true, id: partie.id };
}

export async function jouerCoup(id: unknown, colonne: unknown): Promise<Reponse> {
  const who = await requireWho();

  const partie = await chargerPartie(id);
  if (!partie) return echec("Partie introuvable.");
  if (partie.status !== "en-cours") return echec("La partie est terminée.");
  if (typeof colonne !== "number" || !Number.isInteger(colonne)) {
    return echec("Colonne invalide.");
  }

  const etat = rejouer(partie);
  const mode = etat.mode;

  // Qui pose le jeton, et a-t-il le droit ?
  let acteur: Who;
  if (mode === "local") {
    // Un seul appareil : c'est le tour affiché qui joue, pas la session.
    acteur = etat.turn;
  } else if (mode === "distance") {
    if (etat.turn !== who) return echec("Ce n’est pas ton tour.");
    acteur = who;
  } else {
    if (partie.startedBy !== who) return echec("Cette partie n’est pas la tienne.");
    if (etat.turn === etat.botSide) return echec("L’ordinateur n’a pas encore joué.");
    acteur = who;
  }

  let apres = jouer(etat, colonne, acteur);
  if (!apres) return echec("Coup impossible.");

  // L'ordinateur répond dans la foulée : un seul aller-retour pour le joueur.
  if (mode === "solo" && apres.botSide && !apres.winner && !apres.draw) {
    const reponse = meilleurCoup(apres);
    if (reponse !== null) apres = jouer(apres, reponse, apres.botSide) ?? apres;
  }

  await update<Connect4Game>("games", partie.id, {
    state: apres,
    status: apres.winner || apres.draw ? "terminee" : "en-cours",
  });

  revaliderP4();
  return { ok: true };
}

export async function annulerCoup(id: unknown): Promise<Reponse> {
  const who = await requireWho();

  const partie = await chargerPartie(id);
  if (!partie) return echec("Partie introuvable.");
  if (partie.status !== "en-cours") return echec("La partie est terminée.");

  const etat = rejouer(partie);
  if (etat.mode === "distance") {
    return echec("À distance, un coup joué ne se reprend pas.");
  }
  if (etat.mode === "solo" && partie.startedBy !== who) {
    return echec("Cette partie n’est pas la tienne.");
  }

  const coups = [...etat.moves];
  if (coups.length === 0) return echec("Aucun coup à annuler.");

  if (etat.mode === "solo") {
    // On retire la réponse de l'ordinateur avec notre propre coup, sinon
    // annuler reviendrait à lui offrir un tour gratuit.
    if (coups[coups.length - 1].by === etat.botSide) coups.pop();
    if (coups.length > 0 && coups[coups.length - 1].by !== etat.botSide) coups.pop();
  } else {
    coups.pop();
  }

  await update<Connect4Game>("games", partie.id, {
    state: etatDepuisCoups(coups, {
      premier: partie.startedBy,
      mode: etat.mode,
      botSide: etat.botSide,
    }),
    status: "en-cours",
  });

  revaliderP4();
  return { ok: true };
}

export async function abandonner(id: unknown): Promise<Reponse> {
  const who = await requireWho();

  const partie = await chargerPartie(id);
  if (!partie) return echec("Partie introuvable.");
  if (partie.status !== "en-cours") return echec("La partie est déjà terminée.");

  const etat = rejouer(partie);
  if (etat.mode === "solo" && partie.startedBy !== who) {
    return echec("Cette partie n’est pas la tienne.");
  }

  // Une partie abandonnée se ferme sans vainqueur : personne ne gagne un point
  // parce que l'autre a fermé l'onglet.
  await update<Connect4Game>("games", partie.id, { state: etat, status: "terminee" });

  revaliderP4();
  return { ok: true };
}

/* ========================================================================== */
/*                                Qui est-ce ?                                */
/* ========================================================================== */

const COTES: WhoOrBoth[] = ["alice", "joseph", "les-deux"];
const CERCLES: Circle[] = ["famille", "amis", "travail", "etudes", "voisinage"];
const CHEVEUX: HairColor[] = ["brun", "blond", "noir", "roux", "gris", "chauve"];

function revaliderQec() {
  revalidatePath(CHEMIN_QEC);
  revalidatePath(CHEMIN_HALL);
}

function litTraits(formData: FormData): PersonTraits {
  const cote = formData.get("cote");
  const cercle = formData.get("cercle");
  const cheveux = formData.get("cheveux");

  return {
    cote: COTES.includes(cote as WhoOrBoth) ? (cote as WhoOrBoth) : "les-deux",
    cercle: CERCLES.includes(cercle as Circle) ? (cercle as Circle) : "amis",
    cheveux: CHEVEUX.includes(cheveux as HairColor) ? (cheveux as HairColor) : "brun",
    cheveuxLongs: formData.get("cheveuxLongs") === "oui",
    lunettes: formData.get("lunettes") === "oui",
    barbe: formData.get("barbe") === "oui",
    chapeau: formData.get("chapeau") === "oui",
  };
}

/** Récupère l'unique image du `ImagePicker`, ou null s'il n'y en a pas. */
async function litPhoto(formData: FormData): Promise<{ url: string; thumbUrl: string } | null> {
  const brut = formData.get("photo");
  if (typeof brut !== "string" || !brut) return null;

  let valeurs: unknown;
  try {
    valeurs = JSON.parse(brut);
  } catch {
    return null;
  }
  if (!Array.isArray(valeurs) || valeurs.length === 0) return null;

  const premiere = valeurs[0];
  if (!isValidIncomingImage(premiere)) return null;

  const rangee = await storeImage(premiere, "personnes");
  return { url: rangee.url, thumbUrl: rangee.thumbUrl };
}

export async function creerPersonne(
  _precedent: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const who = await requireWho();

  const name = texte(formData.get("name"), 40);
  if (!name) return { erreur: "Il faut au moins un prénom." };

  const photo = await litPhoto(formData);
  const hint = texte(formData.get("hint"), 120);

  await insert<Person>("people", {
    name,
    hint: hint || undefined,
    photoUrl: photo?.url,
    thumbUrl: photo?.thumbUrl,
    traits: litTraits(formData),
    by: who,
  });

  revaliderQec();
  return { ok: true };
}

export async function modifierPersonne(
  _precedent: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  await requireWho();

  const id = texte(formData.get("id"), 64);
  if (!id) return { erreur: "Personne introuvable." };

  const existante = await get<Person>("people", id);
  if (!existante) return { erreur: "Personne introuvable." };

  const name = texte(formData.get("name"), 40);
  if (!name) return { erreur: "Il faut au moins un prénom." };

  const photo = await litPhoto(formData);
  const hint = texte(formData.get("hint"), 120);

  await update<Person>("people", id, {
    name,
    hint: hint || undefined,
    traits: litTraits(formData),
    // Sans nouvelle image, on garde celle d'avant.
    ...(photo ? { photoUrl: photo.url, thumbUrl: photo.thumbUrl } : {}),
  });

  revaliderQec();
  return { ok: true };
}

export async function supprimerPersonne(id: unknown): Promise<Reponse> {
  await requireWho();
  if (typeof id !== "string" || !id) return echec("Personne introuvable.");

  const existante = await get<Person>("people", id);
  if (!existante) return echec("Personne introuvable.");

  await remove("people", id);

  // Une manche dont la réponse vient de disparaître n'est plus jouable.
  const parties = await list<Doc>("games");
  for (const doc of parties) {
    if (estQuiEstCe(doc) && doc.status === "en-cours" && doc.secretPersonId === id) {
      await remove("games", doc.id);
    }
  }

  revaliderQec();
  return { ok: true };
}

async function chargerManche(id: unknown): Promise<QuiEstCeManche | null> {
  if (typeof id !== "string" || !id) return null;
  const doc = await get<Doc>("games", id);
  return doc && estQuiEstCe(doc) ? doc : null;
}

export async function lancerManche(facon: unknown, personneId?: unknown): Promise<Reponse> {
  const who = await requireWho();

  if (facon !== "hasard" && facon !== "defi") return echec("Lancement inconnu.");

  const paquet = await list<Person>("people");
  if (paquet.length < 4) return echec("Il faut au moins quatre personnes dans le paquet.");

  const joueur = facon === "defi" ? autreQue(who) : who;

  const parties = await list<Doc>("games");
  const enCours = parties.filter(
    (doc): doc is QuiEstCeManche =>
      estQuiEstCe(doc) && doc.status === "en-cours" && doc.player === joueur,
  );

  if (facon === "defi" && enCours.length > 0) {
    return echec(`${joueur === "alice" ? "Alice" : "Joseph"} a déjà une manche en cours.`);
  }
  // On ne repart de zéro que sur ses propres manches.
  for (const ancienne of enCours) await remove("games", ancienne.id);

  let secret: Person | undefined;
  if (facon === "defi") {
    if (typeof personneId !== "string") return echec("Choisis quelqu’un.");
    secret = paquet.find((p) => p.id === personneId);
    if (!secret) return echec("Cette personne n’est plus dans le paquet.");
  } else {
    secret = paquet[Math.floor(Math.random() * paquet.length)];
  }

  const manche = await insert<QuiEstCeManche>("games", {
    kind: "qui-est-ce",
    player: joueur,
    setBy: facon === "defi" ? who : "hasard",
    secretPersonId: secret.id,
    questionsAsked: 0,
    status: "en-cours",
    eliminated: [],
    etapes: [],
  });

  revaliderQec();
  return { ok: true, id: manche.id };
}

export async function poserQuestion(mancheId: unknown, questionId: unknown): Promise<Reponse> {
  const who = await requireWho();

  const manche = await chargerManche(mancheId);
  if (!manche) return echec("Manche introuvable.");
  if (manche.status !== "en-cours") return echec("La manche est terminée.");
  if (manche.player !== who) return echec("Cette manche n’est pas la tienne.");

  const q = typeof questionId === "string" ? question(questionId) : null;
  if (!q) return echec("Question inconnue.");

  const paquet = await list<Person>("people");
  const secret = paquet.find((p) => p.id === manche.secretPersonId);
  if (!secret) return echec("La personne cherchée n’est plus dans le paquet.");

  const restants = candidats(paquet, manche.eliminated);
  const reponse = q.test(secret.traits);
  const ecartes = aEcarter(restants, q, reponse);

  if (ecartes.length === 0) {
    return echec("Cette question n’écarte plus personne.");
  }

  const etape: Etape = {
    type: "question",
    questionId: q.id,
    reponse,
    elimines: ecartes.length,
  };

  await update<QuiEstCeManche>("games", manche.id, {
    eliminated: [...manche.eliminated, ...ecartes],
    questionsAsked: manche.questionsAsked + 1,
    etapes: [...(manche.etapes ?? []), etape],
  });

  revaliderQec();
  return { ok: true };
}

export async function tenterReponse(mancheId: unknown, personneId: unknown): Promise<Reponse> {
  const who = await requireWho();

  const manche = await chargerManche(mancheId);
  if (!manche) return echec("Manche introuvable.");
  if (manche.status !== "en-cours") return echec("La manche est terminée.");
  if (manche.player !== who) return echec("Cette manche n’est pas la tienne.");
  if (typeof personneId !== "string") return echec("Choisis un visage.");
  if (manche.eliminated.includes(personneId)) return echec("Ce visage est déjà écarté.");

  const paquet = await list<Person>("people");
  if (!paquet.some((p) => p.id === personneId)) return echec("Cette personne a disparu du paquet.");

  const juste = personneId === manche.secretPersonId;
  const etapes: Etape[] = [...(manche.etapes ?? []), { type: "essai", personneId, juste }];

  if (juste) {
    await update<QuiEstCeManche>("games", manche.id, { status: "gagnee", etapes });
    revaliderQec();
    return { ok: true };
  }

  const erreurs = erreursDe({ ...manche, etapes });
  await update<QuiEstCeManche>("games", manche.id, {
    eliminated: [...manche.eliminated, personneId],
    questionsAsked: manche.questionsAsked + PENALITE_ERREUR,
    status: erreurs >= ERREURS_MAX ? "perdue" : "en-cours",
    etapes,
  });

  revaliderQec();
  return { ok: true };
}
