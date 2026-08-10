"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { Connect4Cell, Connect4Game, Connect4State, Who } from "@/lib/types";
import { COLONNES, LIGNES, hauteurColonne, jouer } from "@/lib/jeux/puissance4";
import { MODES, libelleMode, resultat, type ModeP4 } from "@/lib/jeux/parties";
import { abandonner, annulerCoup, creerPartie, jouerCoup } from "@/app/(app)/jeux/actions";
import { Button, Card, Spinner, cx } from "@/components/ui";
import { whoLabel } from "@/lib/format";

/**
 * Le plateau et tout ce qui l'entoure.
 *
 * Le coup part en optimiste — le jeton tombe avant l'aller-retour — mais c'est
 * bien le serveur qui tranche : dès qu'il répond, l'état affiché redevient le
 * sien. En cas de refus, on montre la raison et on resynchronise.
 */

const DELAI_CONFIRMATION = 3500;

export interface VuePartie {
  id: string;
  startedBy: Who;
  status: Connect4Game["status"];
  state: Connect4State;
  updatedAt: string;
}

function auTour(who: Who): string {
  return who === "alice" ? "Au tour d’Alice" : "Au tour de Joseph";
}

export function Puissance4({ who, partie }: { who: Who; partie: VuePartie | null }) {
  const router = useRouter();
  const [changement, setChangement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const [etat, jouerOptimiste] = useOptimistic(
    partie?.state ?? null,
    (courant: Connect4State | null, colonne: number) =>
      courant ? (jouer(courant, colonne, courant.turn) ?? courant) : courant,
  );

  const enJeu = partie && etat && !changement ? { partie, etat } : null;

  function lancer(mode: ModeP4) {
    setErreur(null);
    demarrer(async () => {
      const reponse = await creerPartie(mode);
      if (reponse.ok) setChangement(false);
      else setErreur(reponse.erreur);
    });
  }

  function agir(action: () => Promise<{ ok: boolean; erreur?: string }>, resync = false) {
    setErreur(null);
    demarrer(async () => {
      const reponse = await action();
      if (!reponse.ok) {
        setErreur(reponse.erreur ?? "Ça n’a pas marché.");
        if (resync) router.refresh();
      }
    });
  }

  return (
    <>

      {enJeu ? (
        <Partie
          who={who}
          partie={enJeu.partie}
          etat={enJeu.etat}
          enCours={enCours}
          onJouer={(colonne) => {
            setErreur(null);
            demarrer(async () => {
              jouerOptimiste(colonne);
              const reponse = await jouerCoup(enJeu.partie.id, colonne);
              if (!reponse.ok) {
                setErreur(reponse.erreur);
                router.refresh();
              }
            });
          }}
          onAnnuler={() => agir(() => annulerCoup(enJeu.partie.id), true)}
          onAbandonner={() => agir(() => abandonner(enJeu.partie.id), true)}
          onRejouer={() => lancer(enJeu.partie.state.mode)}
          onChangerDeMode={() => setChangement(true)}
        />
      ) : (
        <ChoixMode
          enCours={enCours}
          reprise={partie && partie.status === "en-cours" ? partie : null}
          onChoisir={lancer}
          onReprendre={() => setChangement(false)}
        />
      )}

      {erreur ? (
        <p role="alert" className="mt-3 text-center text-sm font-semibold text-bad">
          {erreur}
        </p>
      ) : null}
    </>
  );
}

/* ------------------------------ Choix du mode ----------------------------- */

function ChoixMode({
  enCours,
  reprise,
  onChoisir,
  onReprendre,
}: {
  enCours: boolean;
  reprise: VuePartie | null;
  onChoisir: (mode: ModeP4) => void;
  onReprendre: () => void;
}) {
  const coups = reprise?.state.moves.length ?? 0;

  return (
    <div className="mt-5 flex flex-col gap-4">
      {reprise ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <p className="text-sm text-ink-2">
            Une partie{" "}
            <span className="font-semibold text-ink">
              {libelleMode(reprise.state.mode).toLowerCase()}
            </span>{" "}
            attend, {coups === 0 ? "pas encore commencée" : `${coups} coup${coups > 1 ? "s" : ""} joué${coups > 1 ? "s" : ""}`}.
          </p>
          <Button variant="soft" size="sm" onClick={onReprendre}>
            Reprendre
          </Button>
        </Card>
      ) : null}

      <h2 className="font-display text-heading text-ink">Comment on joue&nbsp;?</h2>

      <div className="grid gap-3 sm:grid-cols-3">
        {MODES.map(({ valeur, titre, detail }) => (
          <button
            key={valeur}
            type="button"
            disabled={enCours}
            onClick={() => onChoisir(valeur)}
            className={cx(
              "group flex min-h-[7.5rem] flex-col items-start gap-1.5 rounded-lg border border-line bg-surface p-4 text-left",
              "shadow-[var(--shadow-sm)] transition-[border-color,background-color,transform] duration-150",
              "hover:border-accent hover:bg-accent-soft/40 active:translate-y-px",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <span className="font-display text-heading text-ink">{titre}</span>
            <span className="text-[0.8125rem] leading-snug text-ink-3">{detail}</span>
            <span className="mt-auto flex items-center gap-2 pt-2 text-xs font-bold text-accent-ink">
              {enCours ? <Spinner /> : "Commencer →"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- Partie --------------------------------- */

function Partie({
  who,
  partie,
  etat,
  enCours,
  onJouer,
  onAnnuler,
  onAbandonner,
  onRejouer,
  onChangerDeMode,
}: {
  who: Who;
  partie: VuePartie;
  etat: Connect4State;
  enCours: boolean;
  onJouer: (colonne: number) => void;
  onAnnuler: () => void;
  onAbandonner: () => void;
  onRejouer: () => void;
  onChangerDeMode: () => void;
}) {
  const mode = etat.mode;
  const finie = partie.status === "terminee" || Boolean(etat.winner) || etat.draw;
  const botJoue = mode === "solo" && etat.turn === etat.botSide;

  const monTour =
    mode === "local" ||
    (mode === "distance" && etat.turn === who) ||
    (mode === "solo" && partie.startedBy === who && !botJoue);

  useSondage({
    id: partie.id,
    actif: mode === "distance" && partie.status === "en-cours" && etat.turn !== who,
    updatedAt: partie.updatedAt,
  });

  return (
    <div className="mt-4 flex flex-col gap-3">
      <Etat who={who} etat={etat} finie={partie.status === "terminee"} enCours={enCours} />

      <Plateau etat={etat} peutJouer={!finie && monTour && !enCours} onJouer={onJouer} />

      {finie ? (
        <Fin
          etat={etat}
          onRejouer={onRejouer}
          onChangerDeMode={onChangerDeMode}
          enCours={enCours}
        />
      ) : (
        <Commandes
          mode={mode}
          coups={etat.moves.length}
          enCours={enCours}
          onAnnuler={onAnnuler}
          onAbandonner={onAbandonner}
          onChangerDeMode={onChangerDeMode}
        />
      )}
    </div>
  );
}

/* ------------------------------ Ligne d'état ------------------------------ */

function messageEtat(etat: Connect4State, who: Who, finie: boolean): string {
  if (etat.winner) {
    if (etat.mode === "solo") {
      return etat.winner === etat.botSide ? "L’ordinateur gagne" : "Tu gagnes";
    }
    return resultat(etat);
  }
  if (etat.draw) return "Match nul";
  if (finie) return "Partie abandonnée";
  if (etat.mode === "local") return auTour(etat.turn);
  if (etat.mode === "solo") {
    return etat.turn === etat.botSide ? "L’ordinateur réfléchit…" : "À toi de jouer";
  }
  return etat.turn === who ? "À toi de jouer" : `On attend ${whoLabel(etat.turn)}`;
}

function Etat({
  who,
  etat,
  finie,
  enCours,
}: {
  who: Who;
  etat: Connect4State;
  finie: boolean;
  enCours: boolean;
}) {
  const enJeu = !finie && !etat.winner && !etat.draw;

  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <p
        aria-live="polite"
        aria-atomic="true"
        className="flex items-center gap-2.5 font-display text-heading text-ink"
      >
        {enJeu ? (
          <span
            className={cx(
              "size-2.5 shrink-0 rounded-full",
              etat.turn === "alice" ? "bg-alice" : "bg-joseph",
            )}
            aria-hidden="true"
          />
        ) : null}
        {messageEtat(etat, who, finie)}
      </p>
      <span className="flex shrink-0 items-center gap-2 text-ink-3">
        {enCours ? <Spinner /> : null}
        <span className="label-caps hidden sm:inline">{libelleMode(etat.mode)}</span>
      </span>
    </div>
  );
}

/* -------------------------------- Plateau --------------------------------- */

function Plateau({
  etat,
  peutJouer,
  onJouer,
}: {
  etat: Connect4State;
  peutJouer: boolean;
  onJouer: (colonne: number) => void;
}) {
  const [survol, setSurvol] = useState<number | null>(null);
  const grille = useRef<HTMLDivElement>(null);

  const dernier = etat.moves[etat.moves.length - 1];
  const ligneDernier = dernier ? hauteurColonne(etat.board, dernier.column) - 1 : -1;
  const gagnantes = new Set((etat.winningLine ?? []).map(([c, l]) => `${c}-${l}`));

  function auClavier(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const boutons = Array.from(
      grille.current?.querySelectorAll<HTMLButtonElement>("button[data-colonne]") ?? [],
    );
    const actuel = boutons.indexOf(document.activeElement as HTMLButtonElement);
    if (actuel < 0) return;
    event.preventDefault();
    const pas = event.key === "ArrowLeft" ? -1 : 1;
    boutons[(actuel + pas + boutons.length) % boutons.length]?.focus();
  }

  return (
    <div
      className="mx-auto w-full"
      style={{
        // Le plateau ne doit jamais repousser les commandes hors de l'écran :
        // sa largeur est bornée par la hauteur qui reste réellement disponible.
        maxWidth: "min(100%, 28rem, max(15rem, calc((100dvh - 18rem) * 7 / 6)))",
      }}
    >
      <div
        ref={grille}
        role="group"
        aria-label="Grille du puissance 4, sept colonnes sur six lignes"
        onKeyDown={auClavier}
        className="grid grid-cols-7 gap-1 rounded-lg border border-line p-1.5 shadow-[var(--shadow-sm)] sm:gap-1.5 sm:p-2"
        style={{ background: "color-mix(in oklab, var(--tint-jeux) 34%, var(--surface))" }}
      >
        {Array.from({ length: COLONNES }, (_, colonne) => {
          const hauteur = hauteurColonne(etat.board, colonne);
          const pleine = hauteur >= LIGNES;
          const vise = survol === colonne && peutJouer && !pleine;

          return (
            <button
              key={colonne}
              type="button"
              data-colonne={colonne}
              disabled={!peutJouer || pleine}
              aria-label={
                pleine
                  ? `Colonne ${colonne + 1}, pleine`
                  : `Colonne ${colonne + 1}, ${hauteur === 0 ? "aucun jeton" : `${hauteur} jeton${hauteur > 1 ? "s" : ""}`}`
              }
              onClick={() => onJouer(colonne)}
              onPointerEnter={() => setSurvol(colonne)}
              onPointerLeave={() => setSurvol((c) => (c === colonne ? null : c))}
              onFocus={() => setSurvol(colonne)}
              onBlur={() => setSurvol((c) => (c === colonne ? null : c))}
              className={cx(
                "flex flex-col-reverse gap-1 rounded-sm p-0.5 transition-colors duration-150 sm:gap-1.5",
                peutJouer && !pleine ? "cursor-pointer" : "cursor-default",
                vise && "bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]",
              )}
            >
              {Array.from({ length: LIGNES }, (_, ligne) => (
                <Case
                  key={`${colonne}-${ligne}`}
                  valeur={etat.board[colonne][ligne]}
                  ligne={ligne}
                  tombe={dernier !== undefined && dernier.column === colonne && ligne === ligneDernier}
                  fantome={vise && ligne === LIGNES - 1 && etat.board[colonne][ligne] === null ? etat.turn : null}
                  gagnante={gagnantes.has(`${colonne}-${ligne}`)}
                  attenuee={etat.winningLine !== null && !gagnantes.has(`${colonne}-${ligne}`)}
                />
              ))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Case({
  valeur,
  ligne,
  tombe,
  fantome,
  gagnante,
  attenuee,
}: {
  valeur: Connect4Cell;
  ligne: number;
  tombe: boolean;
  fantome: Who | null;
  gagnante: boolean;
  attenuee: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className="grid aspect-square w-full place-items-center rounded-full bg-ground shadow-[inset_0_0_0_1px_var(--line)]"
    >
      {valeur ? (
        <span
          style={{ "--chute": String(LIGNES - ligne) } as CSSProperties}
          className={cx(
            "grid size-full place-items-center rounded-full transition-opacity duration-300",
            valeur === "alice" ? "bg-alice" : "bg-joseph",
            tombe && "jeu-chute",
            gagnante && "jeu-eclat ring-[3px] ring-accent",
            attenuee && "opacity-35",
          )}
        >
          <span
            className={cx(
              "grid size-[62%] place-items-center rounded-full font-display text-[0.7rem] font-bold leading-none sm:text-[0.85rem]",
              valeur === "alice" ? "bg-alice-soft text-alice-ink" : "bg-joseph-soft text-joseph-ink",
            )}
          >
            {valeur === "alice" ? "A" : "J"}
          </span>
        </span>
      ) : fantome ? (
        <span
          className={cx(
            "size-[80%] rounded-full border-2 border-dashed opacity-75",
            fantome === "alice"
              ? "border-alice bg-alice-soft/60"
              : "border-joseph bg-joseph-soft/60",
          )}
        />
      ) : null}
    </span>
  );
}

/* -------------------------------- Commandes ------------------------------- */

function Commandes({
  mode,
  coups,
  enCours,
  onAnnuler,
  onAbandonner,
  onChangerDeMode,
}: {
  mode: ModeP4;
  coups: number;
  enCours: boolean;
  onAnnuler: () => void;
  onAbandonner: () => void;
  onChangerDeMode: () => void;
}) {
  const [confirme, setConfirme] = useState(false);

  useEffect(() => {
    if (!confirme) return;
    const minuteur = setTimeout(() => setConfirme(false), DELAI_CONFIRMATION);
    return () => clearTimeout(minuteur);
  }, [confirme]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {mode !== "distance" ? (
        <Button variant="soft" size="sm" onClick={onAnnuler} disabled={enCours || coups === 0}>
          Annuler le dernier coup
        </Button>
      ) : null}

      <Button variant="ghost" size="sm" onClick={onChangerDeMode} disabled={enCours}>
        Changer de mode
      </Button>

      <Button
        variant={confirme ? "danger" : "ghost"}
        size="sm"
        disabled={enCours}
        onClick={() => (confirme ? onAbandonner() : setConfirme(true))}
      >
        {confirme ? "Confirmer l’abandon" : "Abandonner"}
      </Button>
    </div>
  );
}

/* ------------------------------ Fin de partie ----------------------------- */

function Fin({
  etat,
  onRejouer,
  onChangerDeMode,
  enCours,
}: {
  etat: Connect4State;
  onRejouer: () => void;
  onChangerDeMode: () => void;
  enCours: boolean;
}) {
  const titre =
    etat.winner && etat.mode === "solo"
      ? etat.winner === etat.botSide
        ? "L’ordinateur gagne"
        : "Tu gagnes"
      : etat.winner
        ? resultat(etat)
        : etat.draw
          ? "Match nul"
          : "Partie abandonnée";

  const detail = etat.draw
    ? "Quarante-deux jetons, pas un alignement."
    : etat.winner
      ? `En ${etat.moves.length} coups, ${libelleMode(etat.mode).toLowerCase()}.`
      : "Personne ne marque.";

  return (
    <Card className="animate-rise flex flex-col items-center gap-3 px-4 py-4 text-center">
      <div>
        <h2 className="font-display text-title text-ink">{titre}</h2>
        <p className="mt-1 text-[0.8125rem] text-ink-3">{detail}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onRejouer} disabled={enCours}>
          Rejouer
        </Button>
        <Button variant="outline" onClick={onChangerDeMode} disabled={enCours}>
          Changer de mode
        </Button>
      </div>
    </Card>
  );
}

/* ------------------------------- Mode distance ---------------------------- */

/**
 * En mode « chacun de son côté », la page interroge l'API toutes les trois
 * secondes — et seulement quand il y a une raison de le faire : ce n'est pas
 * notre tour, l'onglet est visible, la partie n'est pas finie.
 */
function useSondage({ id, actif, updatedAt }: { id: string; actif: boolean; updatedAt: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!actif) return;
    let vivant = true;

    async function regarder() {
      if (!vivant || document.visibilityState !== "visible") return;
      try {
        const reponse = await fetch(`/api/jeux/${id}`, { cache: "no-store" });
        if (!reponse.ok || !vivant) return;
        const donnees = (await reponse.json()) as { updatedAt?: string };
        if (vivant && donnees.updatedAt && donnees.updatedAt !== updatedAt) router.refresh();
      } catch {
        // Réseau capricieux : on retentera dans trois secondes.
      }
    }

    const minuteur = window.setInterval(regarder, 3000);
    document.addEventListener("visibilitychange", regarder);

    return () => {
      vivant = false;
      window.clearInterval(minuteur);
      document.removeEventListener("visibilitychange", regarder);
    };
  }, [id, actif, updatedAt, router]);
}
