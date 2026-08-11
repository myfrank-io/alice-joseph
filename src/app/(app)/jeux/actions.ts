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
import { autreQue, etatDepuisCoups, jouer, type Coup } from "@/lib/jeux/puissance4";
import { estPuissance4, estQuiEstCe } from "@/lib/jeux/parties";
import {
  ERREURS_MAX,
  PENALITE_ERREUR,
  aEcarter,
  bilanManche,
  candidats,
  erreursDe,
  question,
  type Etape,
  type QuiEstCeManche,
} from "@/lib/jeux/qui-est-ce";
import type { ChargeManche, ChargePartie, EtatFormulaire, Reponse } from "@/lib/jeux/types";

/**
 * Toutes les mutations des deux jeux.
 *
 * Deux principes, sans exception : l'identité vient de `requireWho()` et jamais
 * du client, et l'état de jeu est recalculé ici à partir de l'historique reçu ou
 * rangé en base. Un navigateur ne peut donc rien affirmer, seulement demander.
 *
 * Depuis que les jeux se jouent hors ligne, ce fichier n'est plus sollicité coup
 * par coup. Il ne reste ici que ce qui a une vraie raison d'être partagé :
 * le mode « chacun de son côté », le défi du « qui est-ce ? », le paquet, et
 * l'enregistrement d'un résultat une fois la partie finie.
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

/** Les identifiants fabriqués par le navigateur : rien d'autre que du sobre. */
function litIdentifiant(valeur: unknown): string | null {
  return typeof valeur === "string" && /^[A-Za-z0-9_-]{6,64}$/.test(valeur) ? valeur : null;
}

function estWho(valeur: unknown): valeur is Who {
  return valeur === "alice" || valeur === "joseph";
}

function objet(valeur: unknown): Record<string, unknown> | null {
  return valeur && typeof valeur === "object" && !Array.isArray(valeur)
    ? (valeur as Record<string, unknown>)
    : null;
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

/**
 * Ouvre une partie « chacun de son côté ».
 *
 * C'est le seul mode qui a besoin d'un endroit commun pour attendre : les deux
 * autres se jouent entièrement dans le navigateur et ne reviennent ici qu'une
 * fois finis, par `enregistrerPartie`.
 */
export async function creerPartie(mode: unknown): Promise<Reponse> {
  const who = await requireWho();

  if (mode !== "distance") return echec("Ce mode se joue sans le serveur.");

  const partie = await insert<Connect4Game>("games", {
    kind: "puissance4",
    startedBy: who,
    status: "en-cours",
    state: etatDepuisCoups([], { premier: who, mode }),
  });

  revaliderP4();
  return { ok: true, id: partie.id };
}

/* --------------------- Une partie jouée hors du serveur ------------------- */

function litChargePartie(brut: unknown, who: Who): ChargePartie | null {
  const charge = objet(brut);
  if (!charge) return null;

  const id = litIdentifiant(charge.id);
  if (!id) return null;
  if (charge.mode !== "local" && charge.mode !== "solo") return null;
  if (!estWho(charge.premier)) return null;

  // En solo, la machine tient forcément le camp d'en face : sans quoi le bilan
  // personnel de `scoreSolo` compterait des victoires qui n'existent pas.
  const botSide = charge.mode === "solo" ? autreQue(who) : undefined;
  if (charge.mode === "solo" && charge.botSide !== botSide) return null;

  if (!Array.isArray(charge.coups)) return null;
  const coups: Coup[] = [];
  for (const entree of charge.coups.slice(0, 42)) {
    const coup = objet(entree);
    if (!coup) return null;
    if (!estWho(coup.by)) return null;
    if (typeof coup.column !== "number" || !Number.isInteger(coup.column)) return null;
    if (coup.column < 0 || coup.column > 6) return null;
    coups.push({ by: coup.by, column: coup.column, at: new Date().toISOString() });
  }

  return { id, mode: charge.mode, premier: charge.premier, ...(botSide ? { botSide } : {}), coups };
}

/**
 * Range le résultat d'une partie jouée dans le navigateur.
 *
 * Appelée une seule fois, à la fin — et jamais pendant. Le serveur rejoue la
 * liste des coups avec `etatDepuisCoups` : une grille bricolée n'a donc aucune
 * prise, seul un historique cohérent produit un résultat.
 *
 * L'identifiant vient du navigateur exprès : un résultat mis en file d'attente
 * parce que le réseau manquait peut être renvoyé sans risque de doublon.
 */
export async function enregistrerPartie(brut: unknown): Promise<Reponse> {
  const who = await requireWho();

  const charge = litChargePartie(brut, who);
  if (!charge) return echec("Partie illisible.");

  const dejaRangee = await get<Doc>("games", charge.id);
  if (dejaRangee) return { ok: true, id: charge.id };

  const state = etatDepuisCoups(charge.coups, {
    premier: charge.premier,
    mode: charge.mode,
    botSide: charge.botSide,
  });
  if (state.moves.length === 0) return echec("Partie sans le moindre coup.");

  try {
    await insert<Connect4Game>("games", {
      id: charge.id,
      kind: "puissance4",
      startedBy: who,
      status: "terminee",
      state,
    });
  } catch {
    // Deux onglets ont pu l'envoyer en même temps : c'est rangé, tout va bien.
    const arrivee = await get<Doc>("games", charge.id);
    if (!arrivee) return echec("L’enregistrement n’a pas abouti.");
  }

  // Pas de revalidation ici, volontairement : l'écran de fin est encore affiché,
  // et voir la partie apparaître au même instant dans « dernières parties » la
  // ferait lire en double. Le plateau rafraîchit la page quand on le quitte.
  return { ok: true, id: charge.id };
}

/**
 * Un coup en mode « chacun de son côté ».
 *
 * Le seul coup qui passe encore par le réseau, et pour cause : il doit atterrir
 * sur l'autre téléphone. Les deux autres modes ne viennent jamais ici.
 */
export async function jouerCoup(id: unknown, colonne: unknown): Promise<Reponse> {
  const who = await requireWho();

  const partie = await chargerPartie(id);
  if (!partie) return echec("Partie introuvable.");
  if (partie.status !== "en-cours") return echec("La partie est terminée.");
  if (typeof colonne !== "number" || !Number.isInteger(colonne)) {
    return echec("Colonne invalide.");
  }

  const etat = rejouer(partie);
  if (etat.mode !== "distance") return echec("Cette partie se joue sans le serveur.");
  if (etat.turn !== who) return echec("Ce n’est pas ton tour.");

  const apres = jouer(etat, colonne, who);
  if (!apres) return echec("Coup impossible.");

  await update<Connect4Game>("games", partie.id, {
    state: apres,
    status: apres.winner || apres.draw ? "terminee" : "en-cours",
  });

  revaliderP4();
  return { ok: true };
}

export async function abandonner(id: unknown): Promise<Reponse> {
  await requireWho();

  const partie = await chargerPartie(id);
  if (!partie) return echec("Partie introuvable.");
  if (partie.status !== "en-cours") return echec("La partie est déjà terminée.");

  // Une partie abandonnée se ferme sans vainqueur : personne ne gagne un point
  // parce que l'autre a fermé l'onglet.
  await update<Connect4Game>("games", partie.id, { state: rejouer(partie), status: "terminee" });

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

/**
 * Le défi : on choisit pour l'autre, et le secret reste ici.
 *
 * C'est la seule manche qui vit encore sur le serveur, et c'est irréductible.
 * Une manche tirée au sort se joue entièrement dans le navigateur — le joueur
 * connaît déjà la réponse, la lui cacher n'aurait aucun sens — mais un défi,
 * lui, doit rester ignoré de celui qui cherche. Descendre le secret, même
 * chiffré, même caché, reviendrait à le mettre à deux clics de l'inspecteur.
 */
export async function lancerDefi(personneId: unknown): Promise<Reponse> {
  const who = await requireWho();

  const paquet = await list<Person>("people");
  if (paquet.length < 4) return echec("Il faut au moins quatre personnes dans le paquet.");

  const joueur = autreQue(who);

  const parties = await list<Doc>("games");
  const enCours = parties.filter(
    (doc): doc is QuiEstCeManche =>
      estQuiEstCe(doc) && doc.status === "en-cours" && doc.player === joueur,
  );
  if (enCours.length > 0) {
    return echec(`${joueur === "alice" ? "Alice" : "Joseph"} a déjà un défi en attente.`);
  }

  if (typeof personneId !== "string") return echec("Choisis quelqu’un.");
  const secret = paquet.find((p) => p.id === personneId);
  if (!secret) return echec("Cette personne n’est plus dans le paquet.");

  const manche = await insert<QuiEstCeManche>("games", {
    kind: "qui-est-ce",
    player: joueur,
    setBy: who,
    secretPersonId: secret.id,
    questionsAsked: 0,
    status: "en-cours",
    eliminated: [],
    etapes: [],
  });

  revaliderQec();
  return { ok: true, id: manche.id };
}

/* -------------------- Une manche jouée hors du serveur -------------------- */

function litChargeManche(brut: unknown): ChargeManche | null {
  const charge = objet(brut);
  if (!charge) return null;

  const id = litIdentifiant(charge.id);
  if (!id) return null;
  if (typeof charge.secretPersonId !== "string" || charge.secretPersonId.length > 64) return null;
  if (!Array.isArray(charge.etapes)) return null;

  const etapes: Etape[] = [];
  for (const entree of charge.etapes.slice(0, 80)) {
    const etape = objet(entree);
    if (!etape) return null;
    if (etape.type === "question") {
      if (typeof etape.questionId !== "string" || !question(etape.questionId)) return null;
      etapes.push({
        type: "question",
        questionId: etape.questionId,
        reponse: etape.reponse === true,
        elimines: 0,
      });
    } else if (etape.type === "essai") {
      if (typeof etape.personneId !== "string" || etape.personneId.length > 64) return null;
      etapes.push({ type: "essai", personneId: etape.personneId, juste: etape.juste === true });
    } else {
      return null;
    }
  }

  return { id, secretPersonId: charge.secretPersonId, etapes };
}

/**
 * Range une manche tirée au sort et jouée dans le navigateur.
 *
 * Rien n'est cru sur parole : `bilanManche` rejoue l'historique contre le paquet
 * du moment et contre les attributs du secret. Le compteur, les éliminations et
 * l'issue sont donc ceux du moteur, pas ceux du navigateur.
 */
export async function enregistrerManche(brut: unknown): Promise<Reponse> {
  const who = await requireWho();

  const charge = litChargeManche(brut);
  if (!charge) return echec("Manche illisible.");

  const dejaRangee = await get<Doc>("games", charge.id);
  if (dejaRangee) return { ok: true, id: charge.id };

  const paquet = await list<Person>("people");
  const secret = paquet.find((p) => p.id === charge.secretPersonId) ?? null;
  const bilan = bilanManche(paquet, secret, charge.etapes);
  if (bilan.status === "en-cours") return echec("Cette manche n’est pas finie.");

  try {
    await insert<QuiEstCeManche>("games", {
      id: charge.id,
      kind: "qui-est-ce",
      player: who,
      setBy: "hasard",
      secretPersonId: charge.secretPersonId,
      questionsAsked: bilan.questionsAsked,
      status: bilan.status,
      eliminated: bilan.eliminated,
      etapes: bilan.etapes,
    });
  } catch {
    const arrivee = await get<Doc>("games", charge.id);
    if (!arrivee) return echec("L’enregistrement n’a pas abouti.");
  }

  revaliderQec();
  return { ok: true, id: charge.id };
}

/**
 * Une question posée pendant un défi.
 *
 * Le seul aller-retour qui reste dans ce jeu, et le seul qui soit justifié : la
 * réponse dépend d'un secret que le navigateur n'a pas le droit de connaître.
 */
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
