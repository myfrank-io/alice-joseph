"use server";

import { revalidatePath } from "next/cache";
import { requireWho } from "@/lib/auth";
import { hasBlobStorage, insert, list, remove, update } from "@/lib/data/store";
import type { Doc, Photo, SourceICloud, Who } from "@/lib/types";
import {
  analyserLienAlbum,
  chargerAlbum,
  cheminPhoto,
  choisirDerives,
  echec,
  jourDePhoto,
  nomAlbum,
  rangerImageDistante,
  urlsDesActifs,
  type PhotoICloud,
  type ReponseConnexion,
  type ReponseDeconnexion,
  type ReponseSync,
  type ReponseTest,
} from "@/lib/icloud";

/**
 * Les quatre gestes de la connexion iCloud.
 *
 * Aucune action ne prend d'identifiant de source : la personne connectée est
 * lue par `requireWho()` et sa source est retrouvée à partir de là. C'est ce qui
 * garantit, par construction plutôt que par vérification, que personne ne peut
 * toucher à l'album de l'autre — il n'existe aucun paramètre pour le désigner.
 */

/** Photos importées au maximum par synchronisation. Au-delà, on annonce le reste. */
const PLAFOND_PAR_SYNC = 60;

/** Photos traitées de front : assez pour aller vite, assez peu pour ne pas saturer. */
const TAILLE_LOT = 4;

/** Marge de sécurité sous le temps d'exécution d'une fonction serverless. */
const TEMPS_MAX_MS = 45_000;

/* --------------------------------- Outils --------------------------------- */

async function sourceDe(who: Who): Promise<SourceICloud | null> {
  const sources = await list<SourceICloud>("sources");
  return sources.find((source) => source.who === who) ?? null;
}

async function noter(
  source: SourceICloud,
  patch: Partial<Omit<SourceICloud, keyof Doc>>,
): Promise<void> {
  await update<SourceICloud>("sources", source.id, patch);
}

/* ------------------------------- Connecter -------------------------------- */

/**
 * Enregistre le lien collé, après l'avoir vérifié auprès d'Apple.
 *
 * On ne stocke jamais un lien qui n'a pas répondu : une source connectée est
 * une source dont on sait qu'elle marchait il y a une seconde.
 */
export async function connecterSource(formData: FormData): Promise<ReponseConnexion> {
  const who = await requireWho();

  const brut = formData.get("lien");
  const analyse = analyserLienAlbum(typeof brut === "string" ? brut : "");
  if (!analyse.ok) return analyse;

  const chargement = await chargerAlbum(analyse.jeton);
  if (!chargement.ok) return chargement;

  const albumName = nomAlbum(chargement.album);
  const existante = await sourceDe(who);

  if (existante) {
    const memeAlbum = existante.token === analyse.jeton;
    await noter(existante, {
      token: analyse.jeton,
      base: chargement.base,
      albumName,
      lastError: undefined,
      // Un autre album, c'est un autre compteur.
      importedCount: memeAlbum ? existante.importedCount : 0,
    });
  } else {
    await insert<SourceICloud>("sources", {
      who,
      token: analyse.jeton,
      base: chargement.base,
      albumName,
      importedCount: 0,
    });
  }

  revalidatePath("/photos");
  return { ok: true, albumName, photos: chargement.album.photos.length };
}

/* --------------------------------- Tester --------------------------------- */

/**
 * Interroge Apple sans rien importer : c'est le geste qui permettra de valider
 * la connexion en production, là où iCloud est réellement joignable.
 */
export async function testerSource(): Promise<ReponseTest> {
  const who = await requireWho();

  const source = await sourceDe(who);
  if (!source) return echec("Aucun album partagé n’est connecté pour toi.");

  const chargement = await chargerAlbum(source.token, source.base);
  if (!chargement.ok) {
    await noter(source, { lastError: chargement.erreur });
    revalidatePath("/photos");
    return chargement;
  }

  const albumName = nomAlbum(chargement.album);
  const deja = await guidsDejaImportes();
  const nouvelles = chargement.album.photos.filter(
    (photo) => !deja.has(photo.photoGuid),
  ).length;

  await noter(source, { albumName, base: chargement.base, lastError: undefined });
  revalidatePath("/photos");

  return { ok: true, albumName, photos: chargement.album.photos.length, nouvelles };
}

/* ------------------------------ Synchroniser ------------------------------ */

async function guidsDejaImportes(): Promise<Set<string>> {
  const photos = await list<Photo>("photos");
  const guids = new Set<string>();
  for (const photo of photos) {
    if (photo.sourceGuid) guids.add(photo.sourceGuid);
  }
  return guids;
}

/** Une photo : deux téléchargements, deux rangements, une insertion. */
async function importerUne(
  photo: PhotoICloud,
  urls: Record<string, string>,
  who: Who,
): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const choix = choisirDerives(photo);
  if (!choix) return echec("Apple n’a proposé aucune taille pour cette photo.");

  const urlGrand = urls[choix.grand.checksum];
  if (!urlGrand) return echec("Apple n’a pas donné d’adresse de téléchargement pour cette photo.");

  const grand = await rangerImageDistante(urlGrand, cheminPhoto(who, photo.photoGuid, "grand"));
  if (!grand.ok) return grand;

  // Une seule taille disponible : inutile de retélécharger les mêmes octets.
  let thumbUrl = grand.url;
  if (choix.petit.checksum !== choix.grand.checksum) {
    const urlPetit = urls[choix.petit.checksum];
    if (urlPetit) {
      const petit = await rangerImageDistante(urlPetit, cheminPhoto(who, photo.photoGuid, "min"));
      // La miniature est un confort : si elle manque, la grande fait l'affaire.
      if (petit.ok) thumbUrl = petit.url;
    }
  }

  try {
    await insert<Photo>("photos", {
      url: grand.url,
      thumbUrl,
      width: choix.grand.width || photo.width,
      height: choix.grand.height || photo.height,
      caption: photo.caption,
      takenAt: jourDePhoto(photo),
      by: who,
      favorite: false,
      albumIds: [],
      sourceGuid: photo.photoGuid,
    });
  } catch {
    // Une photo perdue ne doit pas emporter la synchronisation entière.
    return echec("La photo n’a pas pu être enregistrée dans la bibliothèque.");
  }

  return { ok: true };
}

/**
 * Importe les photos de l'album qui ne sont pas encore dans la bibliothèque.
 *
 * La déduplication se fait sur `photoGuid` : une photo déjà importée ne l'est
 * jamais deux fois, même si l'album est renommé, reconnecté, ou synchronisé
 * depuis deux appareils. Chaque photo est insérée dès qu'elle est rangée — si
 * la fonction est interrompue, ce qui est passé est acquis.
 */
export async function synchroniserSource(): Promise<ReponseSync> {
  const who = await requireWho();

  const source = await sourceDe(who);
  if (!source) return echec("Aucun album partagé n’est connecté pour toi.");

  if (!hasBlobStorage()) {
    return echec(
      "Le stockage des photos n’est pas branché : les adresses d’Apple expirent en une heure, l’import serait vide dès demain. Ajoute BLOB_READ_WRITE_TOKEN, puis reviens.",
    );
  }

  const chargement = await chargerAlbum(source.token, source.base);
  if (!chargement.ok) {
    await noter(source, { lastError: chargement.erreur });
    revalidatePath("/photos");
    return chargement;
  }

  const { album, base } = chargement;
  const albumName = nomAlbum(album);

  const deja = await guidsDejaImportes();
  const manquantes = album.photos.filter((photo) => !deja.has(photo.photoGuid));

  // Les vidéos d'un album partagé n'ont pas leur place dans une photothèque.
  const importables = manquantes.filter((photo) => photo.type !== "video");
  const ignorees = manquantes.length - importables.length;

  const aTraiter = importables.slice(0, PLAFOND_PAR_SYNC);

  if (aTraiter.length === 0) {
    await noter(source, {
      albumName,
      base,
      lastSyncAt: new Date().toISOString(),
      lastError: undefined,
    });
    revalidatePath("/photos");
    return { ok: true, albumName, importees: 0, restantes: 0, ignorees, total: album.photos.length };
  }

  const adresses = await urlsDesActifs(
    base,
    source.token,
    aTraiter.map((photo) => photo.photoGuid),
  );
  if (!adresses.ok) {
    await noter(source, { base, lastError: adresses.erreur });
    revalidatePath("/photos");
    return adresses;
  }

  const depart = Date.now();
  let importees = 0;
  let derniereErreur: string | undefined;
  let echecs = 0;

  for (let debut = 0; debut < aTraiter.length; debut += TAILLE_LOT) {
    // On préfère s'arrêter nous-mêmes et l'annoncer, plutôt que d'être coupés.
    if (Date.now() - depart > TEMPS_MAX_MS) break;

    const lot = aTraiter.slice(debut, debut + TAILLE_LOT);
    const resultats = await Promise.all(
      lot.map((photo) => importerUne(photo, adresses.urls, who)),
    );

    for (const resultat of resultats) {
      if (resultat.ok) importees += 1;
      else {
        echecs += 1;
        derniereErreur = resultat.erreur;
      }
    }
  }

  const restantes = Math.max(0, importables.length - importees);

  await noter(source, {
    albumName,
    base,
    lastSyncAt: new Date().toISOString(),
    importedCount: source.importedCount + importees,
    lastError:
      echecs > 0
        ? `${echecs} ${echecs > 1 ? "photos n’ont" : "photo n’a"} pas pu être importée${
            echecs > 1 ? "s" : ""
          }. ${derniereErreur ?? ""}`.trim()
        : undefined,
  });

  revalidatePath("/photos");

  if (importees === 0 && echecs > 0) {
    return echec(derniereErreur ?? "Aucune photo n’a pu être importée.");
  }

  return { ok: true, albumName, importees, restantes, ignorees, total: album.photos.length };
}

/* ------------------------------- Déconnecter ------------------------------ */

/**
 * Retire la source. Les photos déjà importées restent : elles appartiennent
 * maintenant à la bibliothèque, pas à l'album d'origine.
 */
export async function deconnecterSource(): Promise<ReponseDeconnexion> {
  const who = await requireWho();

  const source = await sourceDe(who);
  if (!source) return echec("Aucun album partagé n’est connecté pour toi.");

  await remove("sources", source.id);
  revalidatePath("/photos");

  return { ok: true, retire: true };
}
