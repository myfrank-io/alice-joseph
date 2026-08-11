"use client";

import {
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import type { Connect4Cell, Connect4Game, Connect4State, Who } from "@/lib/types";
import {
  COLONNES,
  LIGNES,
  autreQue,
  etatDepuisCoups,
  hauteurColonne,
  jouer,
  meilleurCoup,
} from "@/lib/jeux/puissance4";
import { MODES, libelleMode, resultat, type ModeP4 } from "@/lib/jeux/parties";
import {
  chargeDeLaPartie,
  ecrirePartieLocale,
  effacerPartieLocale,
  empiler,
  litPartiesLocales,
  nouvellePartieLocale,
  viderLaFile,
  type ModeLocal,
  type PartieLocale,
} from "@/lib/jeux/local";
import { abandonner, creerPartie, enregistrerPartie, jouerCoup } from "@/app/(app)/jeux/actions";
import { Button, Card, Spinner, cx } from "@/components/ui";
import { whoLabel } from "@/lib/format";

/**
 * Le plateau et tout ce qui l'entoure.
 *
 * Deux modes sur trois ne touchent plus jamais au réseau. « Sur le même
 * téléphone » et « contre l'ordinateur » vivent entièrement ici : le coup est
 * appliqué par `jouer()` dans le navigateur, la machine cherche sa réponse avec
 * `meilleurCoup()` dans le navigateur, et la partie en cours est rangée dans
 * `localStorage` — fermer l'onglet ne la perd plus. Le serveur n'entend parler
 * de la partie qu'une fois finie, pour le compte des duels, et s'il n'entend
 * rien parce qu'on est hors ligne, le résultat attend son tour dans une file.
 *
 * Reste « chacun de son côté », qui garde le serveur : c'est sa raison d'être,
 * la partie doit bien attendre quelque part entre deux téléphones.
 */

const DELAI_CONFIRMATION = 3500;

/**
 * Le temps laissé au jeton du joueur pour finir sa chute avant que la machine
 * ne se mette à chercher. `meilleurCoup()` bloque le fil principal quelques
 * centaines de millisecondes : on attend une image d'abord, pour que le coup
 * qu'on vient de jouer soit peint, puis ce délai, pour que « il réfléchit… »
 * ait le temps d'être lu.
 */
const DELAI_REFLEXION = 280;

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

/** L'état d'une partie locale se relit toujours depuis ses coups. */
function etatDe(partie: PartieLocale): Connect4State {
  return etatDepuisCoups(partie.coups, {
    premier: partie.premier,
    mode: partie.mode,
    botSide: partie.botSide,
  });
}

function estFinie(partie: PartieLocale, etat = etatDe(partie)): boolean {
  return Boolean(etat.winner) || etat.draw || partie.abandonnee === true;
}

/* ========================================================================== */

export function Puissance4({ who, distante }: { who: Who; distante: VuePartie | null }) {
  const router = useRouter();

  const [pret, setPret] = useState(false);
  const [locale, setLocale] = useState<PartieLocale | null>(null);
  const [reprises, setReprises] = useState<PartieLocale[]>([]);
  const [choix, setChoix] = useState(false);
  const [distanteOuverte, setDistanteOuverte] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  /**
   * La reprise, après le montage et jamais avant : lire `localStorage` pendant
   * le premier rendu ferait diverger le HTML du serveur et celui du navigateur.
   * Le plateau vide affiché en attendant a exactement la taille du vrai, si bien
   * que rien ne saute quand la partie arrive.
   */
  useEffect(() => {
    const rangees = litPartiesLocales(who);
    // Une partie en cours passe devant une partie finie, si récente soit-elle.
    const ordre = [...rangees].sort(
      (a, b) =>
        Number(estFinie(a)) - Number(estFinie(b)) || b.majAt.localeCompare(a.majAt),
    );
    const reprise = ordre[0] ?? null;
    setLocale(reprise);
    setReprises(ordre.filter((partie) => partie.id !== reprise?.id && !estFinie(partie)));
    setPret(true);
    void viderLaFile("p4", who, enregistrerPartie);
  }, [who]);

  const etat = useMemo(() => (locale ? etatDe(locale) : null), [locale]);
  const localeFinie = locale && etat ? estFinie(locale, etat) : false;

  /* --------------------------- L'ordinateur joue -------------------------- */

  useEffect(() => {
    if (!pret || !locale || locale.mode !== "solo" || !locale.botSide) return;
    const avant = etatDe(locale);
    if (estFinie(locale, avant) || avant.turn !== locale.botSide) return;

    let vivant = true;
    let minuteur = 0;
    const image = requestAnimationFrame(() => {
      minuteur = window.setTimeout(() => {
        if (!vivant) return;
        const colonne = meilleurCoup(avant);
        if (colonne === null) return;
        setLocale((courante) => {
          if (!courante || courante.id !== locale.id) return courante;
          const etatCourant = etatDe(courante);
          if (etatCourant.turn !== courante.botSide) return courante;
          const apres = jouer(etatCourant, colonne, etatCourant.turn);
          if (!apres) return courante;
          return { ...courante, coups: apres.moves, majAt: new Date().toISOString() };
        });
      }, DELAI_REFLEXION);
    });

    return () => {
      vivant = false;
      cancelAnimationFrame(image);
      window.clearTimeout(minuteur);
    };
  }, [pret, locale]);

  /* ------------------------------ Persistance ----------------------------- */

  useEffect(() => {
    if (!pret || !locale) return;
    ecrirePartieLocale(who, locale);
  }, [pret, who, locale]);

  /* ------------------- Le résultat part, une fois, à la fin --------------- */

  useEffect(() => {
    if (!pret || !locale || locale.enregistree) return;
    const bilan = etatDe(locale);
    if (!estFinie(locale, bilan) || bilan.moves.length === 0) return;

    const charge = chargeDeLaPartie(locale);
    // Marqué tout de suite : l'envoi ne se relance pas à chaque rendu, et s'il
    // échoue c'est la file d'attente qui prend le relais.
    setLocale((courante) =>
      courante && courante.id === locale.id ? { ...courante, enregistree: true } : courante,
    );

    void (async () => {
      try {
        const reponse = await enregistrerPartie(charge);
        if (!reponse.ok) empiler("p4", who, charge);
      } catch {
        empiler("p4", who, charge);
      }
    })();
  }, [pret, who, locale]);

  /* -------------------------------- Actions ------------------------------- */

  function commencer(mode: ModeP4) {
    setErreur(null);
    if (mode === "distance") {
      demarrer(async () => {
        const reponse = await creerPartie("distance");
        if (!reponse.ok) {
          setErreur(reponse.erreur);
          return;
        }
        setDistanteOuverte(true);
        setChoix(false);
      });
      return;
    }

    setLocale(nouvellePartieLocale(who, mode, who));
    setReprises((liste) => liste.filter((partie) => partie.mode !== mode));
    setDistanteOuverte(false);
    setChoix(false);
  }

  function reprendre(partie: PartieLocale) {
    setErreur(null);
    setLocale(partie);
    setReprises((liste) => liste.filter((autre) => autre.id !== partie.id));
    setDistanteOuverte(false);
    setChoix(false);
  }

  function ouvrirLeChoix() {
    setErreur(null);
    setReprises(
      litPartiesLocales(who).filter((partie) => partie.id !== locale?.id && !estFinie(partie)),
    );
    setChoix(true);
    // Le compte cumulé a pu changer pendant qu'on jouait : c'est le bon moment.
    router.refresh();
  }

  function jouerLocal(colonne: number) {
    setLocale((courante) => {
      if (!courante) return courante;
      const avant = etatDe(courante);
      if (estFinie(courante, avant)) return courante;
      if (courante.mode === "solo" && avant.turn === courante.botSide) return courante;
      const apres = jouer(avant, colonne, avant.turn);
      if (!apres) return courante;
      return { ...courante, coups: apres.moves, majAt: new Date().toISOString() };
    });
  }

  function annulerLocal() {
    setLocale((courante) => {
      if (!courante || courante.coups.length === 0) return courante;
      const coups = [...courante.coups];
      if (courante.mode === "solo") {
        // On retire la réponse de l'ordinateur avec notre propre coup, sinon
        // annuler reviendrait à lui offrir un tour gratuit.
        if (coups[coups.length - 1].by === courante.botSide) coups.pop();
        if (coups.length > 0 && coups[coups.length - 1].by !== courante.botSide) coups.pop();
      } else {
        coups.pop();
      }
      return { ...courante, coups, majAt: new Date().toISOString() };
    });
  }

  function abandonnerLocal() {
    if (!locale) return;
    // Une grille encore vide n'a rien à raconter : on la jette sans la ranger.
    if (locale.coups.length === 0) {
      effacerPartieLocale(who, locale.mode);
      setLocale(null);
      ouvrirLeChoix();
      return;
    }
    setLocale({ ...locale, abandonnee: true, majAt: new Date().toISOString() });
  }

  function rejouerLocal() {
    if (!locale) return;
    // Sur le même téléphone, celui qui commence change à chaque partie.
    const premier = locale.mode === "solo" ? who : autreQue(locale.premier);
    setLocale(nouvellePartieLocale(who, locale.mode, premier));
    router.refresh();
  }

  /* -------------------------------- Rendu --------------------------------- */

  const distanteEnCours = distante?.status === "en-cours";
  const affichage = !pret
    ? "attente"
    : choix
      ? "choix"
      : distanteOuverte && distante
        ? "distance"
        : locale && !localeFinie
          ? "locale"
          : distanteEnCours
            ? "distance"
            : locale
              ? "locale"
              : distante
                ? "distance"
                : "choix";

  return (
    <>
      {affichage === "attente" ? (
        <Attente who={who} />
      ) : affichage === "locale" && locale && etat ? (
        <div className="mt-4 flex flex-col gap-3">
          {distanteEnCours && distante ? (
            <Card className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <p className="text-sm text-ink-2">
                Une partie <span className="font-semibold text-ink">chacun de son côté</span>{" "}
                attend aussi
                {distante.state.turn === who ? " — et c’est à toi de jouer" : ""}.
              </p>
              <Button
                variant="soft"
                size="sm"
                className="min-h-11"
                onClick={() => {
                  setDistanteOuverte(true);
                  setChoix(false);
                }}
              >
                L’ouvrir
              </Button>
            </Card>
          ) : null}

          <Etat
            who={who}
            etat={etat}
            abandonnee={locale.abandonnee === true}
            enCours={locale.mode === "solo" && etat.turn === locale.botSide && !localeFinie}
          />

          <Plateau
            etat={etat}
            peutJouer={
              !localeFinie && !(locale.mode === "solo" && etat.turn === locale.botSide)
            }
            onJouer={jouerLocal}
          />

          {localeFinie ? (
            <Fin
              etat={etat}
              abandonnee={locale.abandonnee === true}
              onRejouer={rejouerLocal}
              onChangerDeMode={ouvrirLeChoix}
              enCours={false}
            />
          ) : (
            <Commandes
              coups={etat.moves.length}
              annulable
              enCours={false}
              onAnnuler={annulerLocal}
              onAbandonner={abandonnerLocal}
              onChangerDeMode={ouvrirLeChoix}
            />
          )}
        </div>
      ) : affichage === "distance" && distante ? (
        <PartieDistante who={who} partie={distante} onChangerDeMode={ouvrirLeChoix} />
      ) : (
        <ChoixMode
          enCours={enCours}
          reprises={reprises}
          distante={distanteEnCours ? distante : null}
          onChoisir={commencer}
          onReprendre={reprendre}
          onReprendreDistante={() => {
            setDistanteOuverte(true);
            setChoix(false);
          }}
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

/* --------------------------- Le temps de la reprise ----------------------- */

/**
 * Ce qu'on montre le temps d'un battement de cil, entre le premier rendu et la
 * lecture de `localStorage` : la grille vide, à sa taille définitive.
 */
function Attente({ who }: { who: Who }) {
  const vide = useMemo(() => etatDepuisCoups([], { premier: who, mode: "local" }), [who]);

  return (
    <div className="mt-4 flex flex-col gap-3" aria-busy="true">
      <div className="flex min-h-11 items-center">
        <p className="font-display text-heading text-ink-3">Un instant…</p>
      </div>
      <Plateau etat={vide} peutJouer={false} onJouer={() => {}} />
    </div>
  );
}

/* ------------------------------ Choix du mode ----------------------------- */

function ChoixMode({
  enCours,
  reprises,
  distante,
  onChoisir,
  onReprendre,
  onReprendreDistante,
}: {
  enCours: boolean;
  reprises: PartieLocale[];
  distante: VuePartie | null;
  onChoisir: (mode: ModeP4) => void;
  onReprendre: (partie: PartieLocale) => void;
  onReprendreDistante: () => void;
}) {
  return (
    <div className="mt-5 flex flex-col gap-4">
      {reprises.map((partie) => (
        <Reprise
          key={partie.id}
          mode={partie.mode}
          coups={partie.coups.length}
          onReprendre={() => onReprendre(partie)}
        />
      ))}

      {distante ? (
        <Reprise
          mode="distance"
          coups={distante.state.moves.length}
          onReprendre={onReprendreDistante}
        />
      ) : null}

      <h2 className="font-display text-heading text-ink">Comment on joue&nbsp;?</h2>

      <div className="grid gap-3 sm:grid-cols-3">
        {MODES.map(({ valeur, titre, detail, reseau }) => (
          <button
            key={valeur}
            type="button"
            disabled={enCours}
            onClick={() => onChoisir(valeur)}
            className={cx(
              "group flex min-h-[8.5rem] flex-col items-start gap-1.5 rounded-lg border border-line bg-surface p-4 text-left",
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
                className={cx(
                  "size-1.5 rounded-full",
                  reseau ? "bg-line-strong" : "bg-accent",
                )}
              />
              {reseau ? "Demande une connexion" : "Marche sans connexion"}
            </span>
            <span className="mt-auto flex items-center gap-2 pt-2 text-xs font-bold text-accent-ink">
              {enCours && reseau ? <Spinner /> : "Commencer →"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Reprise({
  mode,
  coups,
  onReprendre,
}: {
  mode: ModeP4;
  coups: number;
  onReprendre: () => void;
}) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
      <p className="text-sm text-ink-2">
        Une partie <span className="font-semibold text-ink">{libelleMode(mode).toLowerCase()}</span>{" "}
        attend,{" "}
        {coups === 0
          ? "pas encore commencée"
          : `${coups} coup${coups > 1 ? "s" : ""} joué${coups > 1 ? "s" : ""}`}
        .
      </p>
      <Button variant="soft" size="sm" className="min-h-11" onClick={onReprendre}>
        Reprendre
      </Button>
    </Card>
  );
}

/* --------------------------- Chacun de son côté --------------------------- */

/**
 * Le seul plateau qui parle encore au serveur.
 *
 * Le coup part en optimiste — le jeton tombe avant l'aller-retour — mais c'est
 * bien le serveur qui tranche : dès qu'il répond, l'état affiché redevient le
 * sien. En cas de refus, on montre la raison et on resynchronise.
 */
function PartieDistante({
  who,
  partie,
  onChangerDeMode,
}: {
  who: Who;
  partie: VuePartie;
  onChangerDeMode: () => void;
}) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const [etat, jouerOptimiste] = useOptimistic(
    partie.state,
    (courant: Connect4State, colonne: number) => jouer(courant, colonne, courant.turn) ?? courant,
  );

  const finie = partie.status === "terminee" || Boolean(etat.winner) || etat.draw;

  useSondage({
    id: partie.id,
    actif: !finie && etat.turn !== who,
    updatedAt: partie.updatedAt,
  });

  function agir(action: () => Promise<{ ok: boolean; erreur?: string }>) {
    setErreur(null);
    demarrer(async () => {
      const reponse = await action();
      if (!reponse.ok) {
        setErreur(reponse.erreur ?? "Ça n’a pas marché.");
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <Etat who={who} etat={etat} abandonnee={finie && !etat.winner && !etat.draw} enCours={enCours} />

      <Plateau
        etat={etat}
        peutJouer={!finie && etat.turn === who && !enCours}
        onJouer={(colonne) => {
          setErreur(null);
          demarrer(async () => {
            jouerOptimiste(colonne);
            const reponse = await jouerCoup(partie.id, colonne);
            if (!reponse.ok) {
              setErreur(reponse.erreur);
              router.refresh();
            }
          });
        }}
      />

      {finie ? (
        <Fin
          etat={etat}
          abandonnee={!etat.winner && !etat.draw}
          onRejouer={() => agir(() => creerPartie("distance"))}
          onChangerDeMode={onChangerDeMode}
          enCours={enCours}
        />
      ) : (
        <Commandes
          coups={etat.moves.length}
          annulable={false}
          enCours={enCours}
          onAnnuler={() => {}}
          onAbandonner={() => agir(() => abandonner(partie.id))}
          onChangerDeMode={onChangerDeMode}
        />
      )}

      {erreur ? (
        <p role="alert" className="text-center text-sm font-semibold text-bad">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------ Ligne d'état ------------------------------ */

function messageEtat(etat: Connect4State, who: Who, abandonnee: boolean): string {
  if (etat.winner) {
    if (etat.mode === "solo") {
      return etat.winner === etat.botSide ? "L’ordinateur gagne" : "Tu gagnes";
    }
    return resultat(etat);
  }
  if (etat.draw) return "Match nul";
  if (abandonnee) return "Partie abandonnée";
  if (etat.mode === "local") return auTour(etat.turn);
  if (etat.mode === "solo") {
    return etat.turn === etat.botSide ? "L’ordinateur réfléchit…" : "À toi de jouer";
  }
  return etat.turn === who ? "À toi de jouer" : `On attend ${whoLabel(etat.turn)}`;
}

function Etat({
  who,
  etat,
  abandonnee,
  enCours,
}: {
  who: Who;
  etat: Connect4State;
  abandonnee: boolean;
  enCours: boolean;
}) {
  const enJeu = !abandonnee && !etat.winner && !etat.draw;

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
        {messageEtat(etat, who, abandonnee)}
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
  coups,
  annulable,
  enCours,
  onAnnuler,
  onAbandonner,
  onChangerDeMode,
}: {
  coups: number;
  annulable: boolean;
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
      {annulable ? (
        <Button
          variant="soft"
          size="sm"
          className="min-h-11"
          onClick={onAnnuler}
          disabled={enCours || coups === 0}
        >
          Annuler le dernier coup
        </Button>
      ) : null}

      <Button
        variant="ghost"
        size="sm"
        className="min-h-11"
        onClick={onChangerDeMode}
        disabled={enCours}
      >
        Changer de mode
      </Button>

      <Button
        variant={confirme ? "danger" : "ghost"}
        size="sm"
        className="min-h-11"
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
  abandonnee,
  onRejouer,
  onChangerDeMode,
  enCours,
}: {
  etat: Connect4State;
  /** Rendue avant la fin : ni vainqueur ni nulle, mais une partie tout de même. */
  abandonnee: boolean;
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
      : abandonnee
        ? `Arrêtée au ${etat.moves.length}ᵉ coup. Personne ne marque.`
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
