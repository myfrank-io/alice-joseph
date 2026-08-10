import Link from "next/link";
import type { ReactNode } from "react";
import { requireWho } from "@/lib/auth";
import { listMany } from "@/lib/data/store";
import type { Connect4Game, Doc, Person, Who } from "@/lib/types";
import { estPuissance4, estQuiEstCe, resultat, scoreDuels } from "@/lib/jeux/parties";
import {
  candidats,
  formuleQuestions,
  scoreQuiEstCe,
  type QuiEstCeManche,
} from "@/lib/jeux/qui-est-ce";
import { PageHeader } from "@/components/page-header";
import { cx } from "@/components/ui";
import { IconFleche } from "@/components/icons";
import {
  IllustrationBientot,
  IllustrationPuissance4,
  IllustrationQuiEstCe,
} from "@/components/jeux/illustrations";
import { formatAgo, plural, whoLabel } from "@/lib/format";

/**
 * Le hall.
 *
 * Deux cartes, deux jeux, et pour chacune l'état vivant : ce qui attend d'être
 * repris, ce qui vient de finir, et le compte des deux. Rien n'y est décoratif —
 * la carte doit répondre à « on en était où ? » sans qu'on ait à l'ouvrir.
 */

/** Une partie de puissance 4 concerne les deux, sauf un solo commencé par l'autre. */
function concerne(partie: Connect4Game, who: Who): boolean {
  return partie.state.mode !== "solo" || partie.startedBy === who;
}

function auTour(who: Who): string {
  return who === "alice" ? "Au tour d’Alice" : "Au tour de Joseph";
}

function tourP4(partie: Connect4Game, who: Who): string {
  const { state } = partie;
  if (state.mode === "solo") {
    return state.turn === state.botSide ? "L’ordinateur réfléchit" : "À toi de jouer";
  }
  if (state.mode === "distance") {
    return state.turn === who ? "À toi de jouer" : `On attend ${whoLabel(state.turn)}`;
  }
  return auTour(state.turn);
}

function resultatP4(partie: Connect4Game): string {
  const { state } = partie;
  if (state.mode !== "solo") return resultat(state);
  if (state.draw) return "Match nul contre l’ordinateur";
  if (!state.winner) return "Partie abandonnée";
  return state.winner === state.botSide
    ? `L’ordinateur bat ${whoLabel(partie.startedBy)}`
    : `${whoLabel(partie.startedBy)} bat l’ordinateur`;
}

export default async function JeuxPage() {
  const who = await requireWho();

  const donnees = await listMany(["games", "people"]);
  const parties = (donnees.games as Doc[]).filter(estPuissance4);
  const manches = (donnees.games as Doc[]).filter(estQuiEstCe);
  const paquet = donnees.people as Person[];

  /* ------------------------------ Puissance 4 ----------------------------- */

  const miennes = parties.filter((partie) => concerne(partie, who));
  const p4EnCours = miennes.find((partie) => partie.status === "en-cours") ?? null;
  const p4Derniere = parties.find((partie) => partie.status === "terminee") ?? null;
  const duels = scoreDuels(parties);

  /* ------------------------------ Qui est-ce ------------------------------ */

  const mesManches = manches.filter((manche) => manche.player === who);
  const qecEnCours = mesManches.find((manche) => manche.status === "en-cours") ?? null;
  const qecAutre = manches.find(
    (manche) => manche.player !== who && manche.status === "en-cours",
  );
  const qecDerniere = manches.find((manche) => manche.status !== "en-cours") ?? null;
  const scoreAlice = scoreQuiEstCe(manches.filter((m) => m.player === "alice"));
  const scoreJoseph = scoreQuiEstCe(manches.filter((m) => m.player === "joseph"));

  return (
    <>
      <PageHeader
        title="Jeux"
        subtitle="Deux jeux, un tableau d’honneur qui ne s’efface jamais"
      />

      <div className="mt-6 grid gap-4 lg:mt-8 lg:grid-cols-2">
        <CarteJeu
          href="/jeux/puissance-4"
          titre="Puissance 4"
          pitch="Sept colonnes, six lignes, quatre jetons alignés. Sur le même téléphone, chacun de son côté, ou contre l’ordinateur."
          illustration={<IllustrationPuissance4 className="h-full w-full" />}
          etat={
            p4EnCours
              ? { vif: true, texte: `Partie en cours · ${tourP4(p4EnCours, who)}` }
              : p4Derniere
                ? { vif: false, texte: `${resultatP4(p4Derniere)} · ${formatAgo(p4Derniere.updatedAt)}` }
                : { vif: false, texte: "Aucune partie pour l’instant" }
          }
          appel={p4EnCours ? "Reprendre la partie" : "Commencer une partie"}
        >
          <ScoreDuo
            alice={duels.alice}
            joseph={duels.joseph}
            legende={
              duels.alice + duels.joseph + duels.nulles === 0
                ? "Le compte est à zéro"
                : duels.nulles > 0
                  ? `${duels.nulles} ${plural(duels.nulles, "match nul", "matchs nuls")}`
                  : "En duel"
            }
          />
        </CarteJeu>

        <CarteJeu
          href="/jeux/qui-est-ce"
          titre={<>Qui est-ce&nbsp;?</>}
          pitch="Un visage à trouver parmi ceux qu’on connaît. On pose des questions, la plateforme répond, les autres s’écartent."
          illustration={<IllustrationQuiEstCe className="h-full w-full" />}
          etat={
            qecEnCours
              ? {
                  vif: true,
                  texte: `Manche en cours · ${candidats(paquet, qecEnCours.eliminated).length} ${plural(
                    candidats(paquet, qecEnCours.eliminated).length,
                    "visage",
                    "visages",
                  )} encore en lice`,
                }
              : qecAutre
                ? { vif: true, texte: `${whoLabel(qecAutre.player)} cherche encore` }
                : qecDerniere
                  ? {
                      vif: false,
                      texte: `${
                        qecDerniere.status === "gagnee"
                          ? `${whoLabel(qecDerniere.player)} a trouvé en ${formuleQuestions(qecDerniere.questionsAsked)}`
                          : `Manche perdue par ${whoLabel(qecDerniere.player)}`
                      } · ${formatAgo(qecDerniere.updatedAt)}`,
                    }
                  : {
                      vif: false,
                      texte: `${paquet.length} ${plural(paquet.length, "visage", "visages")} dans le paquet`,
                    }
          }
          appel={qecEnCours ? "Reprendre la manche" : "Lancer une manche"}
        >
          <ScoreDuo
            alice={scoreAlice.gagnees}
            joseph={scoreJoseph.gagnees}
            legende={meilleureManche(scoreAlice.meilleur, scoreJoseph.meilleur)}
          />
        </CarteJeu>
      </div>

      <section className="mt-4 flex items-center gap-4 rounded-lg border border-dashed border-line-strong bg-surface-2/40 px-5 py-5">
        <IllustrationBientot className="hidden h-10 w-24 shrink-0 sm:block" />
        <div className="min-w-0">
          <h2 className="font-display text-heading text-ink-2">Bientôt</h2>
          <p className="mt-1 text-[0.8125rem] leading-snug text-ink-3">
            De la place pour un troisième jeu, le jour où l’envie viendra. Un memory de nos
            photos, peut-être.
          </p>
        </div>
      </section>
    </>
  );
}

/* --------------------------------------------------------------------------- */

function meilleureManche(alice: number | null, joseph: number | null): string {
  const meilleurs = [alice, joseph].filter((n): n is number => n !== null);
  if (meilleurs.length === 0) return "Manches gagnées";
  return `Record : ${formuleQuestions(Math.min(...meilleurs))}`;
}

function CarteJeu({
  href,
  titre,
  pitch,
  illustration,
  etat,
  appel,
  children,
}: {
  href: string;
  titre: ReactNode;
  pitch: string;
  illustration: ReactNode;
  etat: { vif: boolean; texte: string };
  appel: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "group flex flex-col overflow-hidden rounded-lg border border-line bg-surface",
        "shadow-[var(--shadow-sm)] transition-shadow duration-200 hover:shadow-[var(--shadow-md)]",
      )}
    >
      <div
        className="h-32 px-6 py-4 sm:h-40"
        style={{ background: "color-mix(in oklab, var(--tint-jeux) 26%, var(--surface))" }}
      >
        {illustration}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h2 className="font-display text-title text-ink">{titre}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{pitch}</p>
        </div>

        <p className="flex items-center gap-2 text-[0.8125rem] font-semibold text-ink">
          <span
            aria-hidden="true"
            className={cx(
              "size-2 shrink-0 rounded-full",
              etat.vif ? "bg-accent" : "bg-line-strong",
            )}
          />
          {etat.texte}
        </p>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-line pt-3.5">
          {children}
          <span className="flex items-center gap-1.5 text-[0.8125rem] font-bold text-accent-ink transition-transform group-hover:translate-x-0.5">
            {appel}
            <IconFleche size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}

function ScoreDuo({
  alice,
  joseph,
  legende,
}: {
  alice: number;
  joseph: number;
  legende: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-2">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-alice" />
          <span className="text-xs font-semibold text-ink-2">Alice</span>
        </span>
        <span className="tabular font-display text-[1.125rem] leading-none text-ink">
          {alice}
          <span className="px-1 text-ink-3">–</span>
          {joseph}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-ink-2">Joseph</span>
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-joseph" />
        </span>
      </p>
      <p className="mt-1 text-[0.6875rem] text-ink-3">{legende}</p>
    </div>
  );
}
