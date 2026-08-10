"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Place } from "@/lib/types";
import {
  HAUTEUR_CARTE,
  LARGEUR_CARTE,
  deprojeter,
  projeter,
} from "@/lib/carte/projection";
import { chargerMonde, cheminGraticule, cheminSphere, type Monde } from "@/lib/carte/monde";
import { clePays } from "@/lib/carte/pays";
import { Button, cx, Spinner } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import {
  IconMoins,
  IconPleinEcran,
  IconRecentrer,
  IconReduire,
} from "@/components/carte/icones-carte";

/**
 * La mapmonde. Un SVG que l'on dessine nous-mêmes : le fond vient d'un JSON statique,
 * les épingles sont projetées dans le navigateur avec exactement les mêmes maths.
 * Rien à charger d'un service externe, rien à installer.
 *
 * Le zoom et le déplacement se font en bougeant le `viewBox` — d'où l'état minuscule
 * (un facteur d'échelle et un centre) et l'absence totale de bibliothèque.
 */

const ZOOM_MIN = 1;
const ZOOM_MAX = 8;
/** Un peu d'air autour du monde, pour que l'Islande ne colle pas au bord. */
const MARGE = 1.04;

type Camera = { k: number; cx: number; cy: number };
type Vue = { x: number; y: number; w: number; h: number };
type Boite = { w: number; h: number };

const CAMERA_INITIALE: Camera = { k: 1, cx: LARGEUR_CARTE / 2, cy: HAUTEUR_CARTE / 2 };

function borner(valeur: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, valeur));
}

/** La capture de pointeur lève si le pointeur a déjà disparu : ce n'est jamais grave. */
function capturer(element: Element, pointerId: number, prendre: boolean) {
  try {
    if (prendre) element.setPointerCapture(pointerId);
    else element.releasePointerCapture(pointerId);
  } catch {
    /* rien à faire */
  }
}

/** Le cadre au zoom 1 : le monde entier, complété sur son côté court pour épouser la boîte. */
function calculerBase(boite: Boite, monde: Monde): Vue {
  let w = monde.width * MARGE;
  let h = monde.height * MARGE;
  const aspect = boite.w / boite.h;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  return { x: monde.width / 2 - w / 2, y: monde.height / 2 - h / 2, w, h };
}

/** La caméra est bornée ici, et nulle part ailleurs : on ne peut pas sortir du cadre. */
function calculerVue(base: Vue, camera: Camera): Vue {
  const k = borner(camera.k, ZOOM_MIN, ZOOM_MAX);
  const w = base.w / k;
  const h = base.h / k;
  return {
    x: borner(camera.cx - w / 2, base.x, base.x + base.w - w),
    y: borner(camera.cy - h / 2, base.y, base.y + base.h - h),
    w,
    h,
  };
}

export function CarteMonde({
  lieux,
  paysVisites,
  actif,
  onSurvol,
  onOuvrir,
  modeDepot,
  onDepot,
  onAnnulerDepot,
  provisoire,
}: {
  lieux: Place[];
  paysVisites: Set<string>;
  actif: string | null;
  onSurvol: (id: string | null) => void;
  onOuvrir: (id: string) => void;
  modeDepot: boolean;
  onDepot: (position: { lat: number; lng: number }) => void;
  onAnnulerDepot: () => void;
  provisoire: { lat: number; lng: number } | null;
}) {
  const [monde, setMonde] = useState<Monde | null>(null);
  const [echec, setEchec] = useState(false);
  const [essai, setEssai] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [camera, setCamera] = useState<Camera>(CAMERA_INITIALE);
  const [pleinEcran, setPleinEcran] = useState(false);
  const [horsMonde, setHorsMonde] = useState(false);

  const cadreRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  /* --------------------------- Chargement du fond -------------------------- */

  useEffect(() => {
    let vivant = true;
    setEchec(false);
    chargerMonde()
      .then((charge) => {
        if (vivant) setMonde(charge);
      })
      .catch(() => {
        if (vivant) setEchec(true);
      });
    return () => {
      vivant = false;
    };
  }, [essai]);

  /* ------------------------------ Mesures ---------------------------------- */

  useEffect(() => {
    const cadre = cadreRef.current;
    if (!cadre) return;
    const observateur = new ResizeObserver((entrees) => {
      const rect = entrees[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        setBoite({ w: rect.width, h: rect.height });
      }
    });
    observateur.observe(cadre);
    return () => observateur.disconnect();
  }, []);

  const base = useMemo(() => (monde && boite ? calculerBase(boite, monde) : null), [monde, boite]);
  const vue = useMemo(() => (base ? calculerVue(base, camera) : null), [base, camera]);

  /** Combien d'unités de carte pour un pixel d'écran — la clé des épingles à taille fixe. */
  const parPixel = vue && boite ? vue.w / boite.w : 1;

  const baseRef = useRef<Vue | null>(null);
  const vueRef = useRef<Vue | null>(null);
  const boiteRef = useRef<Boite | null>(null);
  useEffect(() => {
    baseRef.current = base;
    vueRef.current = vue;
    boiteRef.current = boite;
  }, [base, vue, boite]);

  /* ------------------------------ Navigation ------------------------------- */

  const zoomer = useCallback((facteur: number, versX?: number, versY?: number) => {
    setCamera((courante) => {
      const cadre = baseRef.current;
      if (!cadre) return courante;
      const k = borner(courante.k * facteur, ZOOM_MIN, ZOOM_MAX);
      if (k === courante.k) return courante;

      const avant = calculerVue(cadre, courante);
      const ancreX = versX ?? avant.x + avant.w / 2;
      const ancreY = versY ?? avant.y + avant.h / 2;
      const fx = (ancreX - avant.x) / avant.w;
      const fy = (ancreY - avant.y) / avant.h;
      const w = cadre.w / k;
      const h = cadre.h / k;
      return { k, cx: ancreX - fx * w + w / 2, cy: ancreY - fy * h + h / 2 };
    });
  }, []);

  const deplacer = useCallback((dxPixels: number, dyPixels: number) => {
    setCamera((courante) => {
      const cadre = baseRef.current;
      const mesure = boiteRef.current;
      if (!cadre || !mesure) return courante;
      const avant = calculerVue(cadre, courante);
      const unite = avant.w / mesure.w;
      return {
        k: courante.k,
        cx: avant.x + avant.w / 2 - dxPixels * unite,
        cy: avant.y + avant.h / 2 - dyPixels * unite,
      };
    });
  }, []);

  const recentrer = useCallback(() => setCamera(CAMERA_INITIALE), []);

  /** Pixels de l'écran → unités de la carte. Exact : la vue épouse toujours la boîte. */
  const versCarte = useCallback((clientX: number, clientY: number): [number, number] | null => {
    const svg = svgRef.current;
    const courante = vueRef.current;
    if (!svg || !courante) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return [
      courante.x + ((clientX - rect.left) / rect.width) * courante.w,
      courante.y + ((clientY - rect.top) / rect.height) * courante.h,
    ];
  }, []);

  /* La molette doit être écoutée à la main : React pose un écouteur passif, qui ne
     peut pas empêcher la page de défiler sous la carte. */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const surMolette = (evenement: WheelEvent) => {
      evenement.preventDefault();
      const point = versCarte(evenement.clientX, evenement.clientY);
      const lignes = evenement.deltaMode === 1 ? 16 : 1;
      const facteur = Math.exp((-evenement.deltaY * lignes) / (evenement.ctrlKey ? 110 : 420));
      zoomer(facteur, point?.[0], point?.[1]);
    };
    svg.addEventListener("wheel", surMolette, { passive: false });
    return () => svg.removeEventListener("wheel", surMolette);
  }, [monde, versCarte, zoomer]);

  /* ------------------------------- Gestes ---------------------------------- */

  const pointeurs = useRef(new Map<number, { x: number; y: number }>());
  const geste = useRef({
    mode: "attente" as "attente" | "pan" | "ignore" | "pince",
    departX: 0,
    departY: 0,
    distance: 0,
    milieuX: 0,
    milieuY: 0,
  });
  const aBouge = useRef(false);

  function surPointeurBas(evenement: ReactPointerEvent<SVGSVGElement>) {
    if (evenement.pointerType === "mouse" && evenement.button !== 0) return;
    pointeurs.current.set(evenement.pointerId, { x: evenement.clientX, y: evenement.clientY });
    aBouge.current = false;

    if (pointeurs.current.size === 1) {
      geste.current.mode = evenement.pointerType === "touch" ? "attente" : "pan";
      geste.current.departX = evenement.clientX;
      geste.current.departY = evenement.clientY;
      capturer(evenement.currentTarget, evenement.pointerId, true);
      return;
    }

    if (pointeurs.current.size === 2) {
      const [a, b] = [...pointeurs.current.values()];
      geste.current.mode = "pince";
      geste.current.distance = Math.hypot(a.x - b.x, a.y - b.y);
      geste.current.milieuX = (a.x + b.x) / 2;
      geste.current.milieuY = (a.y + b.y) / 2;
    }
  }

  function surPointeurBouge(evenement: ReactPointerEvent<SVGSVGElement>) {
    const precedent = pointeurs.current.get(evenement.pointerId);
    if (!precedent) return;
    pointeurs.current.set(evenement.pointerId, { x: evenement.clientX, y: evenement.clientY });
    const courant = geste.current;

    if (courant.mode === "pince" && pointeurs.current.size >= 2) {
      const [a, b] = [...pointeurs.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const milieuX = (a.x + b.x) / 2;
      const milieuY = (a.y + b.y) / 2;
      if (courant.distance > 0 && distance > 0) {
        deplacer(milieuX - courant.milieuX, milieuY - courant.milieuY);
        const point = versCarte(milieuX, milieuY);
        zoomer(distance / courant.distance, point?.[0], point?.[1]);
      }
      courant.distance = distance;
      courant.milieuX = milieuX;
      courant.milieuY = milieuY;
      aBouge.current = true;
      return;
    }

    /* Au doigt, on ne prend la main que sur un vrai geste horizontal : un geste
       vertical appartient au défilement de la page, et le lui voler est odieux. */
    if (courant.mode === "attente") {
      const dx = evenement.clientX - courant.departX;
      const dy = evenement.clientY - courant.departY;
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      courant.mode = Math.abs(dx) > Math.abs(dy) ? "pan" : "ignore";
    }
    if (courant.mode !== "pan") return;

    const dx = evenement.clientX - precedent.x;
    const dy = evenement.clientY - precedent.y;
    if (dx === 0 && dy === 0) return;
    if (Math.hypot(evenement.clientX - courant.departX, evenement.clientY - courant.departY) > 4) {
      aBouge.current = true;
    }
    deplacer(dx, dy);
  }

  function surPointeurFin(evenement: ReactPointerEvent<SVGSVGElement>) {
    pointeurs.current.delete(evenement.pointerId);
    capturer(evenement.currentTarget, evenement.pointerId, false);

    if (pointeurs.current.size === 1) {
      const reste = [...pointeurs.current.values()][0];
      geste.current.mode = "pan";
      geste.current.departX = reste.x;
      geste.current.departY = reste.y;
    } else if (pointeurs.current.size === 0) {
      geste.current.mode = "attente";
    }
  }

  function surClic(evenement: ReactMouseEvent<SVGSVGElement>) {
    if (!modeDepot || aBouge.current) return;
    const point = versCarte(evenement.clientX, evenement.clientY);
    if (!point) return;
    const coordonnees = deprojeter(point[0], point[1]);
    if (!coordonnees) {
      setHorsMonde(true);
      return;
    }
    setHorsMonde(false);
    onDepot({ lat: coordonnees[1], lng: coordonnees[0] });
  }

  function surDoubleClic(evenement: ReactMouseEvent<SVGSVGElement>) {
    if (modeDepot) return;
    const point = versCarte(evenement.clientX, evenement.clientY);
    zoomer(1.9, point?.[0], point?.[1]);
  }

  useEffect(() => {
    if (!modeDepot) setHorsMonde(false);
  }, [modeDepot]);

  /* ----------------------------- Plein écran ------------------------------- */

  useEffect(() => {
    if (!pleinEcran) return;
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape") setPleinEcran(false);
    };
    document.addEventListener("keydown", surTouche);
    const precedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.body.style.overflow = precedent;
    };
  }, [pleinEcran]);

  /* ------------------------------ Épingles --------------------------------- */

  const epingles = useMemo(
    () =>
      lieux.map((lieu) => {
        const [x, y] = projeter(lieu.lng, lieu.lat);
        return { lieu, x, y };
      }),
    [lieux],
  );

  /** Le lieu survolé ou ouvert passe en dernier : en SVG, c'est ça, le premier plan. */
  const ordonnees = useMemo(() => {
    const index = epingles.findIndex((epingle) => epingle.lieu.id === actif);
    if (index < 0) return epingles;
    const copie = [...epingles];
    const [devant] = copie.splice(index, 1);
    copie.push(devant);
    return copie;
  }, [epingles, actif]);

  const pointProvisoire = useMemo(
    () => (provisoire ? projeter(provisoire.lng, provisoire.lat) : null),
    [provisoire],
  );

  const resume = useMemo(() => {
    const visites = lieux.filter((lieu) => lieu.kind === "visite");
    const pays = new Set(visites.map((lieu) => clePays(lieu.country)));
    const envies = lieux.length - visites.length;
    return (
      `Mapmonde des endroits où nous sommes allés : ${visites.length} lieu${visites.length > 1 ? "x" : ""} ` +
      `dans ${pays.size} pays, et ${envies} envie${envies > 1 ? "s" : ""}. ` +
      "La liste sous la carte reprend tout, lieu par lieu."
    );
  }, [lieux]);

  /* ------------------------------- Rendu ----------------------------------- */

  const couleurs = {
    "--mer": "var(--surface-2)",
    "--terre": "var(--surface-3)",
    "--terre-visitee": "color-mix(in oklab, var(--accent) 34%, var(--surface-3))",
    "--trait": "var(--line-strong)",
  } as CSSProperties;

  return (
    <div
      className={cx(
        "relative overflow-hidden border-line bg-surface",
        pleinEcran
          ? "fixed inset-0 z-[45] border-0"
          : "rounded-lg border shadow-[var(--shadow-sm)]",
      )}
    >
      <div
        ref={cadreRef}
        className={cx(
          "relative w-full select-none bg-surface",
          pleinEcran ? "h-dvh" : "h-[58dvh] min-h-[18rem] sm:h-[26rem] lg:h-[32rem]",
        )}
      >
        {monde && vue ? (
          <svg
            ref={svgRef}
            role="img"
            aria-label={resume}
            viewBox={`${vue.x} ${vue.y} ${vue.w} ${vue.h}`}
            preserveAspectRatio="xMidYMid meet"
            className={cx("block size-full", modeDepot ? "cursor-crosshair" : "cursor-grab")}
            style={{ ...couleurs, touchAction: pleinEcran ? "none" : "pan-y" }}
            onPointerDown={surPointeurBas}
            onPointerMove={surPointeurBouge}
            onPointerUp={surPointeurFin}
            onPointerCancel={surPointeurFin}
            onClick={surClic}
            onDoubleClick={surDoubleClic}
          >
            <path
              d={cheminSphere()}
              fill="var(--mer)"
              stroke="var(--trait)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={cheminGraticule()}
              fill="none"
              stroke="var(--trait)"
              strokeWidth={0.75}
              strokeOpacity={0.5}
              vectorEffect="non-scaling-stroke"
            />

            <g strokeLinejoin="round">
              {monde.pays.map((pays) => (
                <path
                  key={pays.id + pays.nom}
                  d={pays.d}
                  fillRule="evenodd"
                  fill={paysVisites.has(clePays(pays.nom)) ? "var(--terre-visitee)" : "var(--terre)"}
                  stroke="var(--trait)"
                  strokeWidth={0.7}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>

            {pointProvisoire ? (
              <g>
                <circle
                  cx={pointProvisoire[0]}
                  cy={pointProvisoire[1]}
                  r={14 * parPixel}
                  fill="color-mix(in oklab, var(--accent) 26%, transparent)"
                />
                <circle
                  cx={pointProvisoire[0]}
                  cy={pointProvisoire[1]}
                  r={5.5 * parPixel}
                  fill="var(--accent)"
                  stroke="var(--surface)"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ) : null}

            <g style={{ pointerEvents: modeDepot ? "none" : undefined }}>
              {ordonnees.map(({ lieu, x, y }) => {
                const enAvant = lieu.id === actif;
                const rayon =
                  lieu.kind === "visite"
                    ? 4.4 + Math.min(lieu.photoIds.length, 6) * 0.5
                    : 5;
                const r = rayon * parPixel;
                return (
                  <g key={lieu.id}>
                    {enAvant ? (
                      <circle
                        cx={x}
                        cy={y}
                        r={r + 7 * parPixel}
                        fill="color-mix(in oklab, var(--accent) 30%, transparent)"
                      />
                    ) : null}
                    {lieu.kind === "visite" ? (
                      <circle
                        cx={x}
                        cy={y}
                        r={r}
                        fill="var(--accent)"
                        stroke="var(--surface)"
                        strokeWidth={1.5}
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : (
                      <circle
                        cx={x}
                        cy={y}
                        r={r}
                        fill="var(--surface)"
                        fillOpacity={0.7}
                        stroke="var(--warn)"
                        strokeWidth={1.8}
                        strokeDasharray="3 2.4"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                    {/* Cible tactile invisible : 44 px de côté, comme partout ailleurs. */}
                    <circle
                      cx={x}
                      cy={y}
                      r={Math.max(22 * parPixel, r * 1.7)}
                      fill="transparent"
                      className="cursor-pointer"
                      onPointerEnter={() => onSurvol(lieu.id)}
                      onPointerLeave={() => onSurvol(null)}
                      onClick={(evenement) => {
                        evenement.stopPropagation();
                        if (aBouge.current) return;
                        onOuvrir(lieu.id);
                      }}
                    />
                  </g>
                );
              })}
            </g>
          </svg>
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            {echec ? (
              <div className="flex flex-col items-center gap-3 px-6 text-center">
                <p className="text-sm text-ink-2">Le fond de carte n&apos;a pas pu être chargé.</p>
                <Button variant="outline" size="sm" onClick={() => setEssai((n) => n + 1)}>
                  Réessayer
                </Button>
              </div>
            ) : (
              <p className="flex items-center gap-2.5 text-sm text-ink-3">
                <Spinner />
                Chargement de la carte…
              </p>
            )}
          </div>
        )}

        {/* ------------------------------ Commandes ---------------------------- */}

        <div
          className="absolute right-3 flex flex-col gap-2"
          style={{
            top: pleinEcran ? "calc(env(safe-area-inset-top, 0px) + 0.75rem)" : "0.75rem",
          }}
        >
          <div className="flex flex-col overflow-hidden rounded-full border border-line bg-surface/85 shadow-[var(--shadow-sm)] backdrop-blur">
            <BoutonCarte label="Zoomer" onClick={() => zoomer(1.6)}>
              <IconPlus size={19} />
            </BoutonCarte>
            <span className="mx-2 border-t border-line" />
            <BoutonCarte label="Dézoomer" onClick={() => zoomer(1 / 1.6)}>
              <IconMoins size={19} />
            </BoutonCarte>
          </div>
        </div>

        <div
          className="absolute right-3 flex flex-col gap-2"
          style={{
            bottom: pleinEcran ? "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" : "0.75rem",
          }}
        >
          <div className="flex flex-col overflow-hidden rounded-full border border-line bg-surface/85 shadow-[var(--shadow-sm)] backdrop-blur">
            <BoutonCarte label="Recentrer la carte" onClick={recentrer}>
              <IconRecentrer size={19} />
            </BoutonCarte>
            <span className="mx-2 border-t border-line" />
            <BoutonCarte
              label={pleinEcran ? "Quitter le plein écran" : "Afficher la carte en plein écran"}
              onClick={() => setPleinEcran((ouvert) => !ouvert)}
            >
              {pleinEcran ? <IconReduire size={19} /> : <IconPleinEcran size={19} />}
            </BoutonCarte>
          </div>
        </div>

        <p className="absolute bottom-3 left-3 flex items-center gap-3 rounded-full border border-line bg-surface/85 px-3 py-1.5 text-[0.6875rem] font-semibold text-ink-2 shadow-[var(--shadow-sm)] backdrop-blur">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-accent" aria-hidden="true" />
            Visités
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full border-2 border-dotted border-warn"
              aria-hidden="true"
            />
            Envies
          </span>
        </p>

        {modeDepot ? (
          <div
            className="absolute inset-x-3 flex items-center gap-3 rounded-sm border border-accent bg-surface/95 px-3 py-2.5 shadow-[var(--shadow-md)] backdrop-blur"
            style={{
              top: pleinEcran ? "calc(env(safe-area-inset-top, 0px) + 0.75rem)" : "0.75rem",
              marginRight: "3.75rem",
            }}
          >
            <p className="min-w-0 flex-1 text-[0.8125rem] leading-snug text-ink">
              {horsMonde ? (
                <span className="font-semibold text-bad">
                  Ce point est en dehors du monde — vise l&apos;intérieur de la carte.
                </span>
              ) : (
                <>
                  <span className="font-semibold">Choisis le point.</span> Un clic sur la carte fixe
                  les coordonnées.
                </>
              )}
            </p>
            <Button variant="ghost" size="sm" onClick={onAnnulerDepot}>
              Annuler
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BoutonCarte({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-11 place-items-center text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {children}
    </button>
  );
}
