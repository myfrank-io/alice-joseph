"use client";

import { useState, useTransition } from "react";
import type { Who } from "@/lib/types";
import type { MancheVue, PersonneVue } from "@/lib/jeux/types";
import {
  ERREURS_MAX,
  PENALITE_ERREUR,
  candidats,
  formuleQuestions,
  question,
  questionsUtiles,
  type Etape,
  type ScoreQuiEstCe,
} from "@/lib/jeux/qui-est-ce";
import { lancerManche, poserQuestion, tenterReponse } from "@/app/(app)/jeux/actions";
import { Button, Card, Chip, Spinner, cx } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { StylesJeux } from "@/components/jeux/styles";
import { Portrait } from "@/components/jeux/paquet";
import { IconFermer, IconValider } from "@/components/icons";
import { plural, whoLabel } from "@/lib/format";

/**
 * L'écran du « qui est-ce ? ».
 *
 * Tout ce qui décide appartient au serveur : la réponse à une question, les
 * visages à écarter, la victoire. L'écran ne fait que montrer l'état, proposer
 * les questions qui séparent encore, et n'afficher la personne cherchée qu'une
 * fois la manche finie — `secretPersonId` reste nul jusque-là, jusque dans le
 * HTML envoyé au navigateur.
 */

const QUESTIONS_VISIBLES = 6;

function autreQue(who: Who): Who {
  return who === "alice" ? "joseph" : "alice";
}

export function QuiEstCe({
  who,
  paquet,
  manche,
  historique,
  scores,
  autreEnCours,
}: {
  who: Who;
  paquet: PersonneVue[];
  /** La manche du joueur : celle en cours, ou la dernière finie. */
  manche: MancheVue | null;
  historique: MancheVue[];
  scores: { alice: ScoreQuiEstCe; joseph: ScoreQuiEstCe };
  /** L'autre a une manche en route : impossible de lui en poser une seconde. */
  autreEnCours: boolean;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [annonceDefi, setAnnonceDefi] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const [cible, setCible] = useState<PersonneVue | null>(null);
  const [defiOuvert, setDefiOuvert] = useState(false);
  const [toutesLesQuestions, setToutesLesQuestions] = useState(false);

  const autre = autreQue(who);
  const enJeu = manche && manche.status === "en-cours" ? manche : null;
  const restants = enJeu ? candidats(paquet, enJeu.eliminated) : paquet;
  const utiles = enJeu ? questionsUtiles(restants) : [];
  const assezDeMonde = paquet.length >= 4;

  function agir(action: () => Promise<{ ok: boolean; erreur?: string }>, apres?: () => void) {
    setErreur(null);
    setAnnonceDefi(null);
    demarrer(async () => {
      const reponse = await action();
      if (reponse.ok) apres?.();
      else setErreur(reponse.erreur ?? "Ça n’a pas marché.");
    });
  }

  return (
    <>
      <StylesJeux />

      {enJeu ? (
        <section className="mt-5 flex flex-col gap-4">
          <Tableau manche={enJeu} restants={restants.length} />

          <p
            aria-live="polite"
            aria-atomic="true"
            className="min-h-6 text-sm leading-snug text-ink-2"
          >
            {annonce(enJeu, paquet)}
          </p>

          <Plateau
            paquet={paquet}
            elimines={enJeu.eliminated}
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
                        onClick={() => agir(() => poserQuestion(enJeu.id, q.id))}
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
              ajoute {PENALITE_ERREUR} questions au compteur, la troisième met fin à la manche.
            </p>
          </div>

          <div className="flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={enCours}
              onClick={() => agir(() => lancerManche("hasard"))}
            >
              Abandonner et retirer au sort
            </Button>
          </div>
        </section>
      ) : (
        <section className="mt-5 flex flex-col gap-5">
          {manche ? <Recapitulatif manche={manche} paquet={paquet} /> : null}

          <Lancement
            autre={autre}
            assezDeMonde={assezDeMonde}
            manquants={Math.max(0, 4 - paquet.length)}
            autreEnCours={autreEnCours}
            enCours={enCours}
            message={annonceDefi}
            onHasard={() => agir(() => lancerManche("hasard"))}
            onDefi={() => {
              setErreur(null);
              setDefiOuvert(true);
            }}
          />
        </section>
      )}

      {erreur ? (
        <p role="alert" className="mt-3 text-center text-sm font-semibold text-bad">
          {erreur}
        </p>
      ) : null}

      <Palmares scores={scores} historique={historique} paquet={paquet} />

      {/* Confirmation d'un essai : deux questions de pénalité, ça se demande. */}
      {cible ? (
        <Sheet
          open
          onClose={() => setCible(null)}
          title={`C’est ${cible.name} ?`}
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
                  if (enJeu) agir(() => tenterReponse(enJeu.id, choisi.id));
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
                    () => lancerManche("defi", personne.id),
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
                  <span className="relative min-h-0 flex-1 overflow-hidden opacity-35 grayscale">
                    <Portrait personne={personne} />
                  </span>
                  <span className="absolute inset-x-0 top-1/3 grid place-items-center text-ink-3">
                    <IconFermer size={26} />
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
          detail="La plateforme tire un visage du paquet, à toi de le retrouver. Personne ne connaît la réponse."
          appel="Tirer au sort"
          disabled={!assezDeMonde || enCours}
          enCours={enCours}
          onClick={onHasard}
        />
        <Option
          titre="En défi"
          detail={
            autreEnCours
              ? `${whoLabel(autre)} a déjà une manche en cours : impossible d’en lancer une seconde.`
              : `Tu choisis secrètement qui ${whoLabel(autre)} devra trouver.`
          }
          appel={`Choisir pour ${whoLabel(autre)}`}
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
  disabled,
  enCours,
  onClick,
}: {
  titre: string;
  detail: string;
  appel: string;
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
        "flex min-h-[7.5rem] flex-col items-start gap-1.5 rounded-lg border border-line bg-surface p-4 text-left",
        "shadow-[var(--shadow-sm)] transition-[border-color,background-color,transform] duration-150",
        "hover:border-accent hover:bg-accent-soft/40 active:translate-y-px",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      <span className="font-display text-heading text-ink">{titre}</span>
      <span className="text-[0.8125rem] leading-snug text-ink-3">{detail}</span>
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
