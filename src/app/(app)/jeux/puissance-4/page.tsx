import { requireWho } from "@/lib/auth";
import { list } from "@/lib/data/store";
import type { Connect4Game, Doc, Who } from "@/lib/types";
import { estPuissance4, libelleMode, resultat, scoreDuels, scoreSolo } from "@/lib/jeux/parties";
import { PageHeader } from "@/components/page-header";
import { Puissance4, type VuePartie } from "@/components/jeux/puissance4";
import { cx } from "@/components/ui";
import { formatAgo, plural, whoLabel } from "@/lib/format";

/**
 * Le puissance 4.
 *
 * La page ne fait que trois choses : trouver la partie courante de la personne
 * connectée, la donner au plateau dans la forme qu'il attend, et poser autour ce
 * qui ne bouge pas pendant qu'on joue — le compte des duels et les dernières
 * parties. Le choix du mode, l'annulation et l'abandon appartiennent au plateau.
 */

/** Un solo commencé par l'autre ne nous regarde pas ; le reste, si. */
function concerne(partie: Connect4Game, who: Who): boolean {
  return partie.state.mode !== "solo" || partie.startedBy === who;
}

function resultatLisible(partie: Connect4Game): string {
  const { state } = partie;
  if (state.mode !== "solo") return resultat(state);
  if (state.draw) return "Match nul contre l’ordinateur";
  if (!state.winner) return "Partie abandonnée";
  return state.winner === state.botSide
    ? `L’ordinateur bat ${whoLabel(partie.startedBy)}`
    : `${whoLabel(partie.startedBy)} bat l’ordinateur`;
}

export default async function Puissance4Page() {
  const who = await requireWho();

  const parties = (await list<Doc>("games")).filter(estPuissance4);
  const miennes = parties.filter((partie) => concerne(partie, who));

  /**
   * La partie en cours si elle existe, sinon la dernière jouée : c'est elle qui
   * porte l'écran de fin, le temps de savourer avant de relancer.
   */
  const courante = miennes.find((partie) => partie.status === "en-cours") ?? miennes[0] ?? null;

  const vue: VuePartie | null = courante
    ? {
        id: courante.id,
        startedBy: courante.startedBy,
        status: courante.status,
        state: courante.state,
        updatedAt: courante.updatedAt,
      }
    : null;

  const duels = scoreDuels(parties);
  const solo = scoreSolo(parties, who);
  const passees = parties
    .filter((partie) => partie.status === "terminee" && partie.id !== courante?.id)
    .slice(0, 6);

  return (
    <>
      <PageHeader
        title="Puissance 4"
        subtitle={
          duels.alice + duels.joseph + duels.nulles === 0
            ? "Quatre jetons alignés, dans n’importe quel sens"
            : `Alice ${duels.alice} – ${duels.joseph} Joseph`
        }
        back={{ href: "/jeux", label: "Retour aux jeux" }}
      />

      <Puissance4 who={who} partie={vue} />

      <section className="mt-10">
        <h2 className="font-display text-heading text-ink">Le compte</h2>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Compteur qui="alice" valeur={duels.alice} libelle="victoires d’Alice" />
          <Compteur qui="joseph" valeur={duels.joseph} libelle="victoires de Joseph" />
          <Compteur
            valeur={duels.nulles}
            libelle={plural(duels.nulles, "match nul", "matchs nuls")}
          />
        </div>

        <p className="mt-3 text-[0.8125rem] text-ink-3">
          Seuls les duels comptent&nbsp;: une partie contre l’ordinateur n’oppose personne.
          {solo.jouees > 0 ? (
            <>
              {" "}
              De ton côté&nbsp;: {solo.gagnees} {plural(solo.gagnees, "victoire", "victoires")} sur{" "}
              {solo.jouees} {plural(solo.jouees, "partie", "parties")} contre la machine.
            </>
          ) : null}
        </p>
      </section>

      {passees.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-display text-heading text-ink">Dernières parties</h2>
          <ul className="mt-3 flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {passees.map((partie) => (
              <li
                key={partie.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className={cx(
                      "size-2.5 shrink-0 rounded-full",
                      partie.state.winner === "alice"
                        ? "bg-alice"
                        : partie.state.winner === "joseph"
                          ? "bg-joseph"
                          : "bg-line-strong",
                    )}
                  />
                  <span className="truncate text-sm font-semibold text-ink">
                    {resultatLisible(partie)}
                  </span>
                </span>
                <span className="text-xs text-ink-3">
                  {libelleMode(partie.state.mode).toLowerCase()} ·{" "}
                  {partie.state.moves.length} {plural(partie.state.moves.length, "coup", "coups")} ·{" "}
                  {formatAgo(partie.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

/* --------------------------------------------------------------------------- */

function Compteur({
  qui,
  valeur,
  libelle,
}: {
  qui?: Who;
  valeur: number;
  libelle: string;
}) {
  return (
    <div
      className="rounded-md border border-line px-4 py-3.5"
      style={{
        background:
          qui === undefined
            ? "var(--surface)"
            : `color-mix(in oklab, var(--${qui}) 16%, var(--surface))`,
      }}
    >
      <p className="tabular font-display text-title leading-none text-ink">{valeur}</p>
      <p className="mt-1.5 text-[0.8125rem] text-ink-2">{libelle}</p>
    </div>
  );
}
