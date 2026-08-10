"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
  type RefObject,
} from "react";
import type { Place } from "@/lib/types";
import { Button } from "@/components/ui";
import { IconFermer, IconPlus } from "@/components/icons";
import { CarteMonde } from "@/components/carte/carte-monde";
import { SheetLieu } from "@/components/carte/sheet-lieu";
import { SheetFormulaire } from "@/components/carte/sheet-formulaire";
import { clesDesPaysVisites } from "@/lib/carte/pays";
import { ENTREE_VIDE, lieuVersEntree, type EntreeLieu, type PhotoLegere } from "@/lib/carte/lieu";
import { ajouterLieu, modifierLieu, supprimerLieu } from "@/app/(app)/carte/actions";

/**
 * L'atelier : le seul état de la page, et le seul endroit qui parle aux actions.
 *
 * La page reste un composant serveur — elle garde tout le texte et toute la mise
 * en page. Ce fichier ne contient aucune décoration : il fournit la frontière
 * client dont la mapmonde et les panneaux ont besoin (des gestionnaires
 * d'événements ne traversent pas un composant serveur), et il l'expose en
 * morceaux — la carte, le bouton d'ajout, l'enveloppe d'une ligne de liste — que
 * la page dispose comme elle l'entend.
 *
 * Conséquence heureuse : une ligne de la liste et son épingle déclenchent
 * exactement le même code. La liste est vraiment l'équivalent de la carte.
 */

type Coordonnees = { lat: number; lng: number };
type Formulaire = { mode: "ajout" } | { mode: "edition"; id: string };

interface Atelier {
  lieux: Place[];
  /** Le lieu ouvert, ou à défaut celui que l'on survole : la carte le met devant. */
  actif: string | null;
  survoler: (id: string | null) => void;
  ouvrir: (id: string) => void;
  ajouter: () => void;
  modeDepot: boolean;
  deposer: (position: Coordonnees) => void;
  annulerDepot: () => void;
  provisoire: Coordonnees | null;
  cadre: RefObject<HTMLDivElement | null>;
}

const ContexteAtelier = createContext<Atelier | null>(null);

function useAtelier(): Atelier {
  const atelier = useContext(ContexteAtelier);
  if (!atelier) throw new Error("Ce composant doit vivre dans <AtelierCarte>.");
  return atelier;
}

export function AtelierCarte({
  lieux,
  photos,
  children,
}: {
  lieux: Place[];
  /** Toutes les photos de la bibliothèque : le formulaire y pioche, le panneau y relit. */
  photos: PhotoLegere[];
  children: ReactNode;
}) {
  const [survole, setSurvole] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [formulaire, setFormulaire] = useState<Formulaire | null>(null);
  const [brouillon, setBrouillon] = useState<EntreeLieu>(ENTREE_VIDE);
  const [modeDepot, setModeDepot] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const cadre = useRef<HTMLDivElement>(null);

  /* Le lieu se relit dans la liste fraîche à chaque rendu : après une
     modification le panneau se met à jour tout seul, et après une suppression il
     se ferme de lui-même puisque le lieu a disparu. */
  const lieuOuvert = useMemo(
    () => lieux.find((lieu) => lieu.id === ouvert) ?? null,
    [lieux, ouvert],
  );

  /* --------------------------------- Gestes -------------------------------- */

  const ouvrir = useCallback((id: string) => {
    setOuvert(id);
    setErreur(null);
  }, []);

  const ajouter = useCallback(() => {
    setOuvert(null);
    setErreur(null);
    setModeDepot(false);
    setBrouillon(ENTREE_VIDE);
    setFormulaire({ mode: "ajout" });
  }, []);

  const modifier = useCallback(() => {
    if (!lieuOuvert) return;
    setOuvert(null);
    setErreur(null);
    setModeDepot(false);
    setBrouillon(lieuVersEntree(lieuOuvert));
    setFormulaire({ mode: "edition", id: lieuOuvert.id });
  }, [lieuOuvert]);

  const fermerFormulaire = useCallback(() => {
    setFormulaire(null);
    setModeDepot(false);
    setBrouillon(ENTREE_VIDE);
    setErreur(null);
  }, []);

  /* Le panneau s'efface pendant qu'on vise ; le brouillon, lui, reste ici. */
  const placer = useCallback(() => setModeDepot(true), []);

  const deposer = useCallback((position: Coordonnees) => {
    setBrouillon((courant) => ({ ...courant, lat: position.lat, lng: position.lng }));
    setModeDepot(false);
  }, []);

  const annulerDepot = useCallback(() => setModeDepot(false), []);

  /* La carte est souvent déjà passée en haut de l'écran quand on demande à
     pointer : on la ramène sous les yeux. Le défilement suit `scroll-behavior`,
     donc « mouvement réduit » est respecté sans rien faire de plus. */
  useEffect(() => {
    if (modeDepot) cadre.current?.scrollIntoView({ block: "center" });
  }, [modeDepot]);

  /* -------------------------------- Écritures ------------------------------ */

  const enregistrer = useCallback(() => {
    if (!formulaire) return;
    const courant = formulaire;
    setErreur(null);
    demarrer(async () => {
      const reponse =
        courant.mode === "ajout"
          ? await ajouterLieu(brouillon)
          : await modifierLieu(courant.id, brouillon);
      if (reponse.ok) {
        setFormulaire(null);
        setBrouillon(ENTREE_VIDE);
      } else {
        setErreur(reponse.erreur);
      }
    });
  }, [brouillon, formulaire, demarrer]);

  const supprimer = useCallback(() => {
    const cible = ouvert;
    if (!cible) return;
    setErreur(null);
    demarrer(async () => {
      const reponse = await supprimerLieu(cible);
      /* Un refus ne peut vouloir dire qu'une chose : le lieu avait déjà disparu.
         On referme donc dans les deux cas, et on explique si ce n'est pas ce
         qu'on avait demandé — le panneau, lui, n'a pas de place pour le dire. */
      setOuvert(null);
      if (!reponse.ok) setErreur(reponse.erreur);
    });
  }, [ouvert, demarrer]);

  /* --------------------------------- Rendu --------------------------------- */

  const provisoire = useMemo<Coordonnees | null>(() => {
    if (!formulaire) return null;
    if (!Number.isFinite(brouillon.lat) || !Number.isFinite(brouillon.lng)) return null;
    return { lat: brouillon.lat, lng: brouillon.lng };
  }, [formulaire, brouillon.lat, brouillon.lng]);

  const valeur = useMemo<Atelier>(
    () => ({
      lieux,
      actif: ouvert ?? survole,
      survoler: setSurvole,
      ouvrir,
      ajouter,
      modeDepot,
      deposer,
      annulerDepot,
      provisoire,
      cadre,
    }),
    [lieux, ouvert, survole, ouvrir, ajouter, modeDepot, deposer, annulerDepot, provisoire],
  );

  return (
    <ContexteAtelier.Provider value={valeur}>
      {children}

      <SheetLieu
        lieu={lieuOuvert}
        photos={photos}
        enCours={enCours}
        onFermer={() => setOuvert(null)}
        onModifier={modifier}
        onSupprimer={supprimer}
      />

      <SheetFormulaire
        ouvert={formulaire !== null && !modeDepot}
        mode={formulaire?.mode ?? "ajout"}
        valeur={brouillon}
        photos={photos}
        enCours={enCours}
        erreur={erreur}
        onChange={setBrouillon}
        onPlacerSurLaCarte={placer}
        onFermer={fermerFormulaire}
        onEnregistrer={enregistrer}
      />

      {/* Une écriture ratée hors formulaire — une suppression, presque toujours —
          n'a nulle part où s'afficher : on la dit ici plutôt que de la taire. */}
      {erreur && !formulaire ? (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-24 z-[55] mx-auto flex max-w-md items-center gap-2 rounded-sm border border-line bg-bad-soft py-1.5 pl-4 pr-1.5 shadow-[var(--shadow-md)] lg:bottom-6 lg:left-auto lg:right-6 lg:mx-0"
        >
          <p className="min-w-0 flex-1 py-1 text-[0.8125rem] font-semibold leading-snug text-bad">
            {erreur}
          </p>
          <button
            type="button"
            onClick={() => setErreur(null)}
            aria-label="Masquer le message"
            className="grid size-11 shrink-0 place-items-center rounded-full text-bad transition-opacity hover:opacity-70"
          >
            <IconFermer size={17} />
          </button>
        </div>
      ) : null}
    </ContexteAtelier.Provider>
  );
}

/* ============================ Les morceaux posés ========================== */

/** La mapmonde. Sa hauteur est réservée par le composant : aucun saut au chargement. */
export function Carte() {
  const { lieux, actif, survoler, ouvrir, modeDepot, deposer, annulerDepot, provisoire, cadre } =
    useAtelier();

  const paysVisites = useMemo(() => clesDesPaysVisites(lieux), [lieux]);

  return (
    <div ref={cadre}>
      <CarteMonde
        lieux={lieux}
        paysVisites={paysVisites}
        actif={actif}
        onSurvol={survoler}
        onOuvrir={ouvrir}
        modeDepot={modeDepot}
        onDepot={deposer}
        onAnnulerDepot={annulerDepot}
        provisoire={provisoire}
      />
    </div>
  );
}

export function BoutonAjouterLieu({ plein = false }: { plein?: boolean }) {
  const { ajouter } = useAtelier();
  return (
    <Button
      type="button"
      size={plein ? "lg" : "md"}
      onClick={ajouter}
      aria-label={plein ? undefined : "Ajouter un lieu"}
      className={plein ? undefined : "h-11 px-3.5"}
    >
      <IconPlus size={18} />
      {plein ? "Ajouter un lieu" : "Ajouter"}
    </Button>
  );
}

/**
 * L'enveloppe d'une ligne de liste : elle ouvre le panneau du lieu, et fait
 * grossir l'épingle correspondante pendant qu'on la survole ou qu'on la tabule.
 * `data-actif` est posé quand la carte et la liste parlent du même lieu — la page
 * décide de ce que ça veut dire visuellement.
 */
export function OuvrirLieu({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const { actif, ouvrir, survoler } = useAtelier();
  return (
    <button
      type="button"
      onClick={() => ouvrir(id)}
      onPointerEnter={() => survoler(id)}
      onPointerLeave={() => survoler(null)}
      onFocus={() => survoler(id)}
      onBlur={() => survoler(null)}
      data-actif={actif === id ? "" : undefined}
      className={className}
    >
      {children}
    </button>
  );
}
