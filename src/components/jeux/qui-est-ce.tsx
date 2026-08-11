"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Who } from "@/lib/types";
import type { MancheVue, PersonneVue } from "@/lib/jeux/types";
import {
  ERREURS_MAX,
  PENALITE_ERREUR,
  aEcarter,
  bilanManche,
  candidats,
  formuleQuestions,
  question,
  questionsUtiles,
  tirerAuHasard,
  type Etape,
  type Question,
  type ScoreQuiEstCe,
} from "@/lib/jeux/qui-est-ce";
import {
  chargeDeLaManche,
  ecrireMancheLocale,
  effacerMancheLocale,
  empiler,
  litMancheLocale,
  nouvelleMancheLocale,
  viderLaFile,
  type MancheLocale,
} from "@/lib/jeux/local";
import {
  enregistrerManche,
  lancerDefi,
  poserQuestion,
  tenterReponse,
} from "@/app/(app)/jeux/actions";
import { Button, Card, Chip, Spinner, cx } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { Portrait } from "@/components/jeux/paquet";
import { IconFermer, IconValider } from "@/components/icons";
import { plural, whoLabel } from "@/lib/format";

/**
 * L'écran du « qui est-ce ? ».
 *
 * Une manche tirée au sort se joue entièrement ici : le paquet arrive une fois
 * avec la page, le secret est tiré dans le navigateur, `questionsUtiles()` et
 * `aEcarter()` tournent dans le navigateur, et la manche en cours est rangée
 * dans `localStorage`. Aucun aller-retour entre le clic et la carte qui se
 * retourne. Le serveur n'entend parler de la manche qu'une fois finie.
 *
 * Le défi, lui, garde son aller-retour par question, et c'est irréductible :
 * répondre « oui » ou « non » aux dix-huit questions du jeu revient à donner le
 * portrait-robot complet du secret — côté, cercle, cheveux, quatre signes —
 * c'est-à-dire à le désigner. Précalculer les réponses pour les envoyer au
 * navigateur reviendrait donc à écrire la réponse dans la page. Tant que
 * quelqu'un d'autre a choisi pour nous, c'est le serveur qui répond.
 */

const QUESTIONS_VISIBLES = 6;

function autreQue(who: Who): Who {
  return who === "alice" ? "joseph" : "alice";
}

/** D'où vient la manche affichée : cela décide qui répond aux questions. */
type Origine = "locale" | "serveur";

export function QuiEstCe({
  who,
  paquet,
  defi,
  derniere,
  historique,
  scores,
  autreEnCours,
}: {
  who: Who;
  paquet: PersonneVue[];
  /** Le défi que l'autre a posé et qui attend : la seule manche encore arbitrée par le serveur. */
  defi: MancheVue | null;
  /** Ma dernière manche finie côté serveur, pour le récapitulatif. */
  derniere: MancheVue | null;
  historique: MancheVue[];
  scores: { alice: ScoreQuiEstCe; joseph: ScoreQuiEstCe };
  /** L'autre a déjà un défi en attente : impossible de lui en poser un second. */
  autreEnCours: boolean;
}) {
  const router = useRouter();

  const [pret, setPret] = useState(false);
  const [locale, setLocale] = useState<MancheLocale | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [annonceDefi, setAnnonceDefi] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const [cible, setCible] = useState<PersonneVue | null>(null);
  const [defiOuvert, setDefiOuvert] = useState(false);
  const [toutesLesQuestions, setToutesLesQuestions] = useState(false);

  const autre = autreQue(who);
  const assezDeMonde = paquet.length >= 4;

  /** La reprise se fait après le montage : jamais de stockage lu au premier rendu. */
  useEffect(() => {
    setLocale(litMancheLocale(who));
    setPret(true);
    void viderLaFile("qec", who, enregistrerManche);
  }, [who]);

  /* -------------------- La manche locale, relue à chaque fois -------------- */

  const secretLocal = useMemo(
    () => (locale ? (paquet.find((p) => p.id === locale.secretId) ?? null) : null),
    [locale, paquet],
  );

  const bilan = useMemo(
    () => (locale ? bilanManche(paquet, secretLocal, locale.etapes) : null),
    [locale, paquet, secretLocal],
  );

  const vueLocale: MancheVue | null =
    locale && bilan
      ? {
          id: locale.id,
          player: who,
          setBy: "hasard",
          status: bilan.status,
          questionsAsked: bilan.questionsAsked,
          erreurs: bilan.erreurs,
          eliminated: bilan.eliminated,
          etapes: bilan.etapes,
          secretPersonId: bilan.status === "en-cours" ? null : locale.secretId,
        }
      : null;

  /* ------------------------------ Persistance ----------------------------- */

  useEffect(() => {
    if (!pret || !locale) return;
    ecrireMancheLocale(who, locale);
  }, [pret, who, locale]);

  /**
   * Le paquet est une donnée partagée : l'autre a pu retirer, pendant qu'on
   * jouait, la personne même qu'on cherchait. La manche n'a alors plus de
   * réponse possible — on l'arrête au lieu de la laisser tourner à vide.
   */
  const statutLocal = vueLocale?.status;
  useEffect(() => {
    if (!pret || !locale || secretLocal || statutLocal !== "en-cours") return;
    effacerMancheLocale(who);
    setLocale(null);
    setErreur("La personne cherchée a quitté le paquet : la manche s’arrête là.");
  }, [pret, who, locale, secretLocal, statutLocal]);

  /* ------------------ Le résultat part, une fois, à la fin ---------------- */

  useEffect(() => {
    if (!pret || !locale || locale.enregistree) return;
    const issue = bilanManche(paquet, paquet.find((p) => p.id === locale.secretId) ?? null, locale.etapes);
    if (issue.status === "en-cours") return;

    const charge = chargeDeLaManche(locale);
    setLocale((courante) =>
      courante && courante.id === locale.id ? { ...courante, enregistree: true } : courante,
    );

    void (async () => {
      try {
        const reponse = await enregistrerManche(charge);
        if (reponse.ok) router.refresh();
        else empiler("qec", who, charge);
      } catch {
        empiler("qec", who, charge);
      }
    })();
  }, [pret, who, locale, paquet, router]);

  /* ------------------------- Quelle manche on affiche --------------------- */

  const defiEnCours = defi?.status === "en-cours" ? defi : null;

  /**
   * La manche de cet appareil passe devant tout le reste, y compris finie :
   * c'est ce qui laisse le temps de lire son récapitulatif. Elle ne s'efface que
   * sur un geste — tirer au sort, ou relever le défi. Le défi, lui, attend
   * pendant ce temps sans risquer de disparaître, et une bannière le rappelle.
   */
  const courante: { origine: Origine; vue: MancheVue } | null = vueLocale
    ? { origine: "locale", vue: vueLocale }
    : defiEnCours
      ? { origine: "serveur", vue: defiEnCours }
      : derniere
        ? { origine: "serveur", vue: derniere }
        : null;

  const enJeu = courante && courante.vue.status === "en-cours" ? courante : null;
  const restants = enJeu ? candidats(paquet, enJeu.vue.eliminated) : paquet;
  const utiles = enJeu ? questionsUtiles(restants) : [];

  /**
   * Une seule région vivante, toujours montée : un lecteur d'écran n'annonce que
   * ce qui change dans une région déjà présente, jamais une région qui apparaît.
   */
  const statut = enJeu
    ? annonce(enJeu.vue, paquet)
    : courante
      ? courante.vue.status === "gagnee"
        ? `Manche gagnée en ${formuleQuestions(courante.vue.questionsAsked)}.`
        : "Manche perdue."
      : "";

  /* -------------------------------- Actions ------------------------------- */

  function agir(action: () => Promise<{ ok: boolean; erreur?: string }>, apres?: () => void) {
    setErreur(null);
    setAnnonceDefi(null);
    demarrer(async () => {
      const reponse = await action();
      if (reponse.ok) apres?.();
      else setErreur(reponse.erreur ?? "Ça n’a pas marché.");
    });
  }

  /** Le tirage au sort : rien ne quitte le navigateur, tout est immédiat. */
  function lancerAuHasard() {
    setErreur(null);
    setAnnonceDefi(null);
    setToutesLesQuestions(false);
    const secret = tirerAuHasard(paquet);
    if (!secret) {
      setErreur("Le paquet est vide.");
      return;
    }
    setLocale(nouvelleMancheLocale(secret.id));
    // Le palmarès a pu bouger pendant qu'on jouait la manche précédente.
    router.refresh();
  }

  function releverLeDefi() {
    setErreur(null);
    effacerMancheLocale(who);
    setLocale(null);
    setToutesLesQuestions(false);
  }

  function poser(q: Question) {
    if (!enJeu) return;
    if (enJeu.origine === "serveur") {
      agir(() => poserQuestion(enJeu.vue.id, q.id));
      return;
    }
    if (!secretLocal) return;
    const reponse = q.test(secretLocal.traits);
    const etape: Etape = {
      type: "question",
      questionId: q.id,
      reponse,
      elimines: aEcarter(restants, q, reponse).length,
    };
    setErreur(null);
    setLocale((courante) =>
      courante
        ? { ...courante, etapes: [...courante.etapes, etape], majAt: new Date().toISOString() }
        : courante,
    );
  }

  function tenter(personne: PersonneVue) {
    if (!enJeu) return;
    if (enJeu.origine === "serveur") {
      agir(() => tenterReponse(enJeu.vue.id, personne.id));
      return;
    }
    const etape: Etape = {
      type: "essai",
      personneId: personne.id,
      juste: personne.id === locale?.secretId,
    };
    setErreur(null);
    setLocale((courante) =>
      courante
        ? { ...courante, etapes: [...courante.etapes, etape], majAt: new Date().toISOString() }
        : courante,
    );
  }

  /* -------------------------------- Rendu --------------------------------- */

  const listeHistorique = historique.filter((manche) => manche.id !== courante?.vue.id).slice(0, 5);
  const defiEnAttente = defiEnCours !== null && courante?.origine === "locale";

  return (
    <>
      <p
        aria-live="polite"
        aria-atomic="true"
        className={cx("text-sm leading-snug text-ink-2", enJeu ? "mt-5 min-h-6" : "sr-only")}
      >
        {statut}
      </p>

      {!pret ? (
        // Le temps de lire le stockage : une hauteur réservée, pour que
        // l'arrivée de la manche ne fasse pas sauter la page.
        <p
          className="mt-5 flex min-h-32 items-center justify-center text-sm text-ink-3"
          aria-busy="true"
        >
          Un instant…
        </p>
      ) : (
        <>
          {defiEnAttente ? (
            <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <p className="text-sm text-ink-2">
                <span className="font-semibold text-ink">{whoLabel(autre)}</span> t’a lancé un défi.
                Il attend son heure&nbsp;: le relever maintenant laisse tomber cette manche-ci.
              </p>
              <Button variant="soft" size="sm" className="min-h-11" onClick={releverLeDefi}>
                Le relever
              </Button>
            </Card>
          ) : null}

          {enJeu ? (
            <section className="mt-3 flex flex-col gap-4">
              <Tableau manche={enJeu.vue} restants={restants.length} />

              <Plateau
                paquet={paquet}
                elimines={enJeu.vue.eliminated}
                fige={enCours}
                onChoisir={(personne) => {
                  setErreur(null);
                  setCible(personne);
                }}
              />

              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-display text-heading text-ink">
                    {restants.length <= 1 ? "Plus qu’à le dire" : "Les questions qui séparent encore"}
                  </h2>
                  {utiles.length > QUESTIONS_VISIBLES ? (
                    <button
                      type="button"
                      onClick={() => setToutesLesQuestions((v) => !v)}
                      className="min-h-11 text-[0.8125rem] font-bold text-accent-ink"
                    >
                      {toutesLesQuestions ? "Voir moins" : `Les ${utiles.length} questions`}
                    </button>
                  ) : null}
                </div>

                {utiles.length === 0 ? (
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">
                    {restants.length <= 1
                      ? "Un seul visage tient encore debout. Clique dessus."
                      : "Aucune question ne distingue plus ces visages : il faut tenter."}
                  </p>
                ) : (
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(toutesLesQuestions ? utiles : utiles.slice(0, QUESTIONS_VISIBLES)).map(
                      ({ question: q, oui, non }) => (
                        <li key={q.id}>
                          <button
                            type="button"
                            disabled={enCours}
                            onClick={() => poser(q)}
                            className={cx(
                              "flex min-h-11 w-full items-center justify-between gap-3 rounded-sm border border-line bg-surface px-4 py-2.5 text-left",
                              "shadow-[var(--shadow-sm)] transition-[border-color,background-color,transform] duration-150",
                              "hover:border-accent hover:bg-accent-soft/40 active:translate-y-px",
                              "disabled:pointer-events-none disabled:opacity-50",
                            )}
                          >
                            <span className="text-sm font-semibold text-ink">{q.libelle}</span>
                            <span className="tabular shrink-0 text-[0.6875rem] text-ink-3">
                              {oui} / {non}
                            </span>
                          </button>
                        </li>
                      ),
                    )}
                  </ul>
                )}

                <p className="mt-3 text-xs leading-snug text-ink-3">
                  Les deux nombres disent combien de visages répondraient oui, puis non. Une erreur
                  ajoute {PENALITE_ERREUR} questions au compteur&nbsp;; à la {ERREURS_MAX}
                  <sup>e</sup>, la manche est perdue.
                  {enJeu.origine === "serveur" ? (
                    <>
                      {" "}
                      Sur un défi, c’est la plateforme qui répond&nbsp;: ces questions ont besoin d’une
                      connexion, sans quoi le secret serait dans la page.
                    </>
                  ) : null}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  disabled={!assezDeMonde}
                  onClick={lancerAuHasard}
                >
                  {enJeu.origine === "serveur"
                    ? "Laisser le défi et retirer au sort"
                    : "Abandonner et retirer au sort"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  disabled={enCours || autreEnCours || !assezDeMonde}
                  onClick={() => {
                    setErreur(null);
                    setDefiOuvert(true);
                  }}
                >
                  Défier {whoLabel(autre)} de son côté
                </Button>
              </div>

              {annonceDefi ? (
                <p
                  aria-live="polite"
                  className="rounded-sm bg-accent-soft px-3.5 py-3 text-center text-sm font-semibold text-accent-ink"
                >
                  {annonceDefi}
                </p>
              ) : null}
            </section>
          ) : (
            <section className="mt-5 flex flex-col gap-5">
              {courante ? <Recapitulatif manche={courante.vue} paquet={paquet} /> : null}

              <Lancement
                autre={autre}
                assezDeMonde={assezDeMonde}
                manquants={Math.max(0, 4 - paquet.length)}
                autreEnCours={autreEnCours}
                enCours={enCours}
                message={annonceDefi}
                onHasard={lancerAuHasard}
                onDefi={() => {
                  setErreur(null);
                  setDefiOuvert(true);
                }}
              />
            </section>
          )}
        </>
      )}

      {erreur ? (
        <p role="alert" className="mt-3 text-center text-sm font-semibold text-bad">
          {erreur}
        </p>
      ) : null}

      <Palmares scores={scores} historique={listeHistorique} paquet={paquet} />

      {/* Confirmation d'un essai : deux questions de pénalité, ça se demande. */}
      {cible ? (
        <Sheet
          open
          onClose={() => setCible(null)}
          title={`C’est ${cible.name} ?`}
          description={`Une erreur coûte ${PENALITE_ERREUR} questions et rapproche de la fin de manche.`}
          footer={
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setCible(null)}>
                Revenir
              </Button>
              <Button
                type="button"
                disabled={enCours}
                onClick={() => {
                  const choisi = cible;
                  setCible(null);
                  tenter(choisi);
                }}
              >
                {enCours ? <Spinner /> : "Oui, c’est elle ou lui"}
              </Button>
            </div>
          }
        >
          <div className="flex items-center gap-4">
            <span className="block size-20 shrink-0 overflow-hidden rounded-md border border-line bg-surface-2">
              <Portrait personne={cible} />
            </span>
            <div className="min-w-0">
              <p className="font-display text-heading text-ink">{cible.name}</p>
              {cible.hint ? (
                <p className="mt-1 text-sm leading-snug text-ink-2">{cible.hint}</p>
              ) : null}
            </div>
          </div>
        </Sheet>
      ) : null}

      {/* Le défi : on choisit pour l'autre, l'écran ne le redira jamais. */}
      <Sheet
        open={defiOuvert}
        onClose={() => setDefiOuvert(false)}
        title={`Choisis pour ${whoLabel(autre)}`}
        description="Personne d’autre ne verra ce choix, pas même toi une fois la manche lancée."
        size="lg"
      >
        <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {paquet.map((personne) => (
            <li key={personne.id}>
              <button
                type="button"
                disabled={enCours}
                aria-label={`Faire chercher ${personne.name}`}
                onClick={() =>
                  agir(
                    () => lancerDefi(personne.id),
                    () => {
                      setDefiOuvert(false);
                      setAnnonceDefi(`Défi envoyé à ${whoLabel(autre)}. À toi de ne rien dire.`);
                    },
                  )
                }
                className={cx(
                  "block w-full rounded-md text-left transition-transform",
                  "hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-50",
                )}
              >
                <span className="block aspect-square overflow-hidden rounded-md border border-line bg-surface-2">
                  <Portrait personne={personne} />
                </span>
                <span className="mt-1.5 block truncate text-[0.8125rem] font-semibold text-ink">
                  {personne.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}

/* ------------------------------- Le tableau ------------------------------- */

function Tableau({ manche, restants }: { manche: MancheVue; restants: number }) {
  const posees = manche.etapes.filter((etape) => etape.type === "question").length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg border border-line bg-surface px-4 py-3.5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-6">
        <Nombre valeur={manche.questionsAsked} libelle="au compteur" />
        <Nombre valeur={restants} libelle={plural(restants, "visage en lice", "visages en lice")} />
        <Nombre valeur={posees} libelle={plural(posees, "question posée", "questions posées")} />
      </div>

      <div className="flex items-center gap-2.5">
        <span
          className="flex items-center gap-1.5"
          role="img"
          aria-label={`${manche.erreurs} ${plural(manche.erreurs, "erreur", "erreurs")} sur ${ERREURS_MAX}`}
        >
          {Array.from({ length: ERREURS_MAX }, (_, index) => (
            <span
              key={index}
              className={cx(
                "size-2.5 rounded-full",
                index < manche.erreurs ? "bg-bad" : "bg-surface-3",
              )}
            />
          ))}
        </span>
        <span className="text-xs font-semibold text-ink-3">
          {manche.setBy === "hasard" ? "Tirage au sort" : `Défi de ${whoLabel(manche.setBy)}`}
        </span>
      </div>
    </div>
  );
}

function Nombre({ valeur, libelle }: { valeur: number; libelle: string }) {
  return (
    <span className="block">
      <span className="tabular block font-display text-title leading-none text-ink">{valeur}</span>
      <span className="mt-1 block text-[0.6875rem] text-ink-3">{libelle}</span>
    </span>
  );
}

/** Ce que la plateforme vient de répondre, pour l'œil comme pour le lecteur d'écran. */
function annonce(manche: MancheVue, paquet: PersonneVue[]): string {
  const derniere = manche.etapes[manche.etapes.length - 1];
  if (!derniere) return "Pose une première question : la plateforme répond, les visages tombent.";

  if (derniere.type === "question") {
    const libelle = question(derniere.questionId)?.libelle ?? "Question";
    return `« ${libelle} » ${derniere.reponse ? "Oui" : "Non"}. ${derniere.elimines} ${plural(
      derniere.elimines,
      "visage écarté",
      "visages écartés",
    )}.`;
  }

  const nom = paquet.find((personne) => personne.id === derniere.personneId)?.name ?? "Ce visage";
  return `Raté : ce n’était pas ${nom}. Compteur alourdi de ${PENALITE_ERREUR} questions.`;
}

/* ------------------------------- Le plateau ------------------------------- */

function Plateau({
  paquet,
  elimines,
  fige,
  onChoisir,
}: {
  paquet: PersonneVue[];
  elimines: string[];
  fige: boolean;
  onChoisir: (personne: PersonneVue) => void;
}) {
  return (
    <ul
      className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6"
      aria-label="Les visages du paquet"
    >
      {paquet.map((personne) => {
        const ecarte = elimines.includes(personne.id);
        return (
          <li key={personne.id}>
            <button
              type="button"
              disabled={ecarte || fige}
              aria-label={ecarte ? `${personne.name}, écarté` : `Répondre : c’est ${personne.name}`}
              onClick={() => onChoisir(personne)}
              className={cx(
                "jeu-carte block aspect-[3/4] w-full rounded-md transition-transform",
                ecarte ? "jeu-carte-retournee cursor-default" : "hover:-translate-y-0.5",
                !ecarte && fige && "opacity-60",
              )}
            >
              <span className="jeu-carte-face">
                <span className="jeu-carte-recto flex flex-col rounded-md border border-line bg-surface shadow-[var(--shadow-sm)]">
                  <span className="relative min-h-0 flex-1 overflow-hidden">
                    <Portrait personne={personne} />
                  </span>
                  <span className="truncate px-1.5 py-1.5 text-center text-[0.75rem] font-semibold text-ink">
                    {personne.name}
                  </span>
                </span>

                <span className="jeu-carte-verso flex flex-col rounded-md border border-line bg-surface-2">
                  <span className="relative min-h-0 flex-1 overflow-hidden">
                    <span className="absolute inset-0 opacity-30 grayscale">
                      <Portrait personne={personne} />
                    </span>
                    <span className="absolute inset-0 grid place-items-center text-ink-3">
                      <IconFermer size={26} />
                    </span>
                  </span>
                  <span className="truncate px-1.5 py-1.5 text-center text-[0.75rem] font-semibold text-ink-3 line-through">
                    {personne.name}
                  </span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------ Le lancement ------------------------------ */

function Lancement({
  autre,
  assezDeMonde,
  manquants,
  autreEnCours,
  enCours,
  message,
  onHasard,
  onDefi,
}: {
  autre: Who;
  assezDeMonde: boolean;
  manquants: number;
  autreEnCours: boolean;
  enCours: boolean;
  message: string | null;
  onHasard: () => void;
  onDefi: () => void;
}) {
  return (
    <div>
      <h2 className="font-display text-heading text-ink">Lancer une manche</h2>

      {assezDeMonde ? null : (
        <p className="mt-2 rounded-sm bg-surface-2 px-3.5 py-3 text-sm leading-relaxed text-ink-2">
          Il manque {manquants} {plural(manquants, "personne", "personnes")} pour que le jeu ait
          du sens.{" "}
          <a href="#paquet" className="font-semibold text-accent-ink underline underline-offset-2">
            Compléter le paquet
          </a>
          .
        </p>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Option
          titre="Au hasard"
          detail="Le navigateur tire un visage du paquet, à toi de le retrouver. Personne ne connaît la réponse."
          appel="Tirer au sort"
          reseau={false}
          disabled={!assezDeMonde}
          enCours={false}
          onClick={onHasard}
        />
        <Option
          titre="En défi"
          detail={
            autreEnCours
              ? `${whoLabel(autre)} a déjà un défi en attente : impossible d’en lancer un second.`
              : `Tu choisis secrètement qui ${whoLabel(autre)} devra trouver.`
          }
          appel={`Choisir pour ${whoLabel(autre)}`}
          reseau
          disabled={!assezDeMonde || autreEnCours || enCours}
          enCours={false}
          onClick={onDefi}
        />
      </div>

      {message ? (
        <p
          aria-live="polite"
          className="mt-3 rounded-sm bg-accent-soft px-3.5 py-3 text-sm font-semibold text-accent-ink"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

function Option({
  titre,
  detail,
  appel,
  reseau,
  disabled,
  enCours,
  onClick,
}: {
  titre: string;
  detail: string;
  appel: string;
  reseau: boolean;
  disabled: boolean;
  enCours: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "flex min-h-[8.5rem] flex-col items-start gap-1.5 rounded-lg border border-line bg-surface p-4 text-left",
        "shadow-[var(--shadow-sm)] transition-[border-color,background-color,transform] duration-150",
        "hover:border-accent hover:bg-accent-soft/40 active:translate-y-px",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      <span className="font-display text-heading text-ink">{titre}</span>
      <span className="text-[0.8125rem] leading-snug text-ink-3">{detail}</span>
      <span
        className={cx(
          "mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold",
          reseau ? "bg-surface-2 text-ink-2" : "bg-accent-soft text-accent-ink",
        )}
      >
        <span
          aria-hidden="true"
          className={cx("size-1.5 rounded-full", reseau ? "bg-line-strong" : "bg-accent")}
        />
        {reseau ? "Demande une connexion" : "Marche sans connexion"}
      </span>
      <span className="mt-auto flex items-center gap-2 pt-2 text-xs font-bold text-accent-ink">
        {enCours ? <Spinner /> : `${appel} →`}
      </span>
    </button>
  );
}

/* ---------------------------- Fin de manche ------------------------------- */

function Recapitulatif({ manche, paquet }: { manche: MancheVue; paquet: PersonneVue[] }) {
  const gagnee = manche.status === "gagnee";
  const secret = paquet.find((personne) => personne.id === manche.secretPersonId) ?? null;

  return (
    <Card className="animate-rise flex flex-col gap-4 p-5">
      <div className="flex items-start gap-4">
        {secret ? (
          <span className="block size-24 shrink-0 overflow-hidden rounded-md border border-line bg-surface-2">
            <Portrait personne={secret} />
          </span>
        ) : null}

        <div className="min-w-0">
          <h2 className="font-display text-title text-ink">
            {gagnee ? "Trouvé" : "Manche perdue"}
          </h2>
          <p className="mt-1 text-sm leading-snug text-ink-2">
            {secret ? (
              <>
                C’était <span className="font-semibold text-ink">{secret.name}</span>
                {secret.hint ? ` — ${secret.hint}` : ""}.
              </>
            ) : (
              "La personne cherchée a depuis quitté le paquet."
            )}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-2">
            <Chip tone={gagnee ? "accent" : "neutre"}>
              {formuleQuestions(manche.questionsAsked)} au compteur
            </Chip>
            {manche.erreurs > 0 ? (
              <Chip>
                {manche.erreurs} {plural(manche.erreurs, "erreur", "erreurs")}
              </Chip>
            ) : null}
            <Chip>
              {manche.setBy === "hasard" ? "Tirage au sort" : `Défi de ${whoLabel(manche.setBy)}`}
            </Chip>
          </p>
        </div>
      </div>

      {manche.etapes.length > 0 ? (
        <ol className="flex flex-col gap-1.5 border-t border-line pt-4">
          {manche.etapes.map((etape, index) => (
            <li
              key={index}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm"
            >
              <LigneEtape etape={etape} paquet={paquet} />
            </li>
          ))}
        </ol>
      ) : null}
    </Card>
  );
}

function LigneEtape({ etape, paquet }: { etape: Etape; paquet: PersonneVue[] }) {
  if (etape.type === "question") {
    return (
      <>
        <span className="text-ink-2">{question(etape.questionId)?.libelle ?? "Question"}</span>
        <span className="flex items-center gap-2">
          <span
            className={cx(
              "text-[0.8125rem] font-bold",
              etape.reponse ? "text-accent-ink" : "text-ink-3",
            )}
          >
            {etape.reponse ? "Oui" : "Non"}
          </span>
          <span className="tabular text-xs text-ink-3">−{etape.elimines}</span>
        </span>
      </>
    );
  }

  const nom = paquet.find((personne) => personne.id === etape.personneId)?.name ?? "Un visage";
  return (
    <>
      <span className="text-ink-2">Essai&nbsp;: {nom}</span>
      <span
        className={cx("flex items-center gap-1.5 text-[0.8125rem] font-bold", etape.juste ? "text-accent-ink" : "text-bad")}
      >
        {etape.juste ? <IconValider size={15} /> : <IconFermer size={15} />}
        {etape.juste ? "Trouvé" : "Raté"}
      </span>
    </>
  );
}

/* -------------------------------- Palmarès -------------------------------- */

function Palmares({
  scores,
  historique,
  paquet,
}: {
  scores: { alice: ScoreQuiEstCe; joseph: ScoreQuiEstCe };
  historique: MancheVue[];
  paquet: PersonneVue[];
}) {
  if (scores.alice.jouees + scores.joseph.jouees === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="font-display text-heading text-ink">Le palmarès</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(["alice", "joseph"] as const).map((qui) => {
          const score = scores[qui];
          return (
            <div
              key={qui}
              className="rounded-md border border-line px-4 py-3.5"
              style={{ background: `color-mix(in oklab, var(--${qui}) 16%, var(--surface))` }}
            >
              <p className="text-sm font-semibold text-ink">{whoLabel(qui)}</p>
              <p className="tabular mt-1 font-display text-title leading-none text-ink">
                {score.gagnees}
                <span className="px-1 text-ink-3">/</span>
                {score.jouees}
              </p>
              <p className="mt-1.5 text-[0.8125rem] text-ink-2">
                {score.meilleur === null
                  ? "Aucune manche gagnée"
                  : `Record : ${formuleQuestions(score.meilleur)}`}
              </p>
            </div>
          );
        })}
      </div>

      {historique.length > 0 ? (
        <ul className="mt-3 flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {historique.map((manche) => {
            const secret = paquet.find((personne) => personne.id === manche.secretPersonId);
            return (
              <li
                key={manche.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className={cx(
                      "size-2.5 shrink-0 rounded-full",
                      manche.player === "alice" ? "bg-alice" : "bg-joseph",
                    )}
                  />
                  <span className="truncate text-sm font-semibold text-ink">
                    {manche.status === "gagnee"
                      ? `${whoLabel(manche.player)} a trouvé ${secret ? secret.name : "le bon visage"}`
                      : `${whoLabel(manche.player)} a séché${secret ? ` sur ${secret.name}` : ""}`}
                  </span>
                </span>
                <span className="text-xs text-ink-3">
                  {formuleQuestions(manche.questionsAsked)}
                  {manche.erreurs > 0
                    ? ` · ${manche.erreurs} ${plural(manche.erreurs, "erreur", "erreurs")}`
                    : ""}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
