"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
  type TouchEvent as EvenementTactile,
} from "react";
import type { Album, Photo } from "@/lib/types";
import { formatShortDate, whoLabel } from "@/lib/format";
import { cx } from "@/components/ui";
import { instantPhoto } from "@/components/photos/shared";
import {
  IconChevronDroite,
  IconChevronGauche,
  IconCoeur,
  IconCorbeille,
  IconEtoile,
  IconFermer,
  IconGrille,
  IconValider,
} from "@/components/icons";
import {
  ajouterPhotosAlbum,
  basculerFavori,
  definirCouverture,
  retirerPhotoAlbum,
  supprimerPhoto,
} from "@/app/(app)/photos/actions";

/**
 * La chambre noire.
 *
 * C'est la seule pièce du site qui fixe ses couleurs au lieu de suivre le
 * thème : une photo se regarde sur du sombre, en plein jour comme la nuit. Les
 * valeurs reprennent celles du thème sombre de `globals.css`, en opaque, pour
 * que la lumière de la page ne traverse jamais le fond.
 */
const CHAMBRE = {
  "--v-fond": "#131116",
  "--v-chrome": "#252129",
  "--v-chrome-fort": "#332e39",
  "--v-ligne": "#3a3441",
  "--v-texte": "#f0ebe6",
  "--v-texte-2": "#c3bcc6",
  "--v-texte-3": "#918a97",
  "--v-accent": "#7fc7b9",
  "--v-danger": "#e8877b",
} as CSSProperties;

const SEUIL_GLISSEMENT = 56;

export function Visionneuse({
  photos,
  index,
  albums,
  album,
  onIndex,
  onClose,
}: {
  photos: Photo[];
  index: number;
  albums: Album[];
  /** Renseigné quand on regarde depuis un album : débloque couverture et retrait. */
  album?: Album;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const panneau = useRef<HTMLDivElement>(null);
  const ancreMenu = useRef<HTMLDivElement>(null);
  const depart = useRef<{ x: number; y: number } | null>(null);
  const [glissement, setGlissement] = useState(0);
  const [menuAlbums, setMenuAlbums] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [enCours, demarrer] = useTransition();

  const photo = photos[index];
  const total = photos.length;

  const aller = useCallback(
    (pas: number) => {
      if (total < 2) return;
      setMenuAlbums(false);
      setConfirmation(false);
      onIndex((index + pas + total) % total);
    },
    [index, onIndex, total],
  );

  /* Le corps ne défile plus derrière : la photo occupe tout l'écran. */
  useEffect(() => {
    const precedent = document.body.style.overflow;
    const rendu = document.activeElement;
    document.body.style.overflow = "hidden";
    panneau.current?.focus();
    return () => {
      document.body.style.overflow = precedent;
      if (rendu instanceof HTMLElement) rendu.focus();
    };
  }, []);

  /* Le menu des albums se referme dès qu'on touche ailleurs. */
  useEffect(() => {
    if (!menuAlbums) return;
    function ailleurs(event: PointerEvent) {
      if (event.target instanceof Node && ancreMenu.current?.contains(event.target)) return;
      setMenuAlbums(false);
    }
    document.addEventListener("pointerdown", ailleurs);
    return () => document.removeEventListener("pointerdown", ailleurs);
  }, [menuAlbums]);

  /* Clavier : échappe, flèches, et un piège de focus léger sur la tabulation. */
  useEffect(() => {
    function auClavier(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (menuAlbums) setMenuAlbums(false);
        else if (confirmation) setConfirmation(false);
        else onClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        aller(-1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        aller(1);
        return;
      }
      if (event.key !== "Tab") return;

      const racine = panneau.current;
      if (!racine) return;
      const cibles = Array.from(
        racine.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);
      if (cibles.length === 0) return;

      const premier = cibles[0];
      const dernier = cibles[cibles.length - 1];
      const actif = document.activeElement;

      if (event.shiftKey && (actif === premier || !racine.contains(actif))) {
        event.preventDefault();
        dernier.focus();
      } else if (!event.shiftKey && actif === dernier) {
        event.preventDefault();
        premier.focus();
      }
    }

    document.addEventListener("keydown", auClavier);
    return () => document.removeEventListener("keydown", auClavier);
  }, [aller, confirmation, menuAlbums, onClose]);

  if (!photo) return null;

  const legende = photo.caption?.trim();
  const details = [
    photo.place?.trim(),
    formatShortDate(instantPhoto(photo)),
    `par ${whoLabel(photo.by)}`,
  ].filter(Boolean) as string[];

  function agir(travail: () => Promise<void>) {
    demarrer(async () => {
      await travail();
    });
  }

  function supprimer() {
    const dernier = total <= 1;
    demarrer(async () => {
      await supprimerPhoto(photo.id);
      setConfirmation(false);
      if (dernier) onClose();
    });
  }

  /* Glissement horizontal : on suit le doigt, puis on bascule au relâchement. */
  function toucheDebut(event: EvenementTactile) {
    const point = event.touches[0];
    depart.current = { x: point.clientX, y: point.clientY };
  }

  function toucheBouge(event: EvenementTactile) {
    if (!depart.current) return;
    const point = event.touches[0];
    const dx = point.clientX - depart.current.x;
    const dy = point.clientY - depart.current.y;
    if (Math.abs(dx) > Math.abs(dy)) setGlissement(dx * 0.35);
  }

  function toucheFin(event: EvenementTactile) {
    const origine = depart.current;
    depart.current = null;
    setGlissement(0);
    if (!origine) return;
    const point = event.changedTouches[0];
    const dx = point.clientX - origine.x;
    const dy = point.clientY - origine.y;
    if (Math.abs(dx) < SEUIL_GLISSEMENT || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    aller(dx < 0 ? 1 : -1);
  }

  return (
    <div
      ref={panneau}
      role="dialog"
      aria-modal="true"
      aria-label={legende ? `Photo : ${legende}` : "Photo en plein écran"}
      tabIndex={-1}
      style={CHAMBRE}
      className="animate-soften fixed inset-0 z-[60] flex flex-col bg-[color:var(--v-fond)] text-[color:var(--v-texte)] outline-none"
    >
      {/* -------------------------------- Haut -------------------------------- */}
      <div className="flex items-center justify-between gap-3 px-3 pt-3 sm:px-5 sm:pt-4">
        <p className="tabular pl-2 text-[0.8125rem] font-semibold text-[color:var(--v-texte-3)]">
          {index + 1} / {total}
        </p>
        <Rond label="Fermer" onClick={onClose}>
          <IconFermer size={19} />
        </Rond>
      </div>

      {/* ------------------------------- La photo ------------------------------ */}
      <div
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        onTouchStart={toucheDebut}
        onTouchMove={toucheBouge}
        onTouchEnd={toucheFin}
        style={{ touchAction: "pan-y" }}
        className="relative flex min-h-0 flex-1 items-center justify-center px-3 py-3 sm:px-16 sm:py-5"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photo.id}
          src={photo.url}
          alt={legende ?? ""}
          width={photo.width}
          height={photo.height}
          loading="lazy"
          decoding="async"
          draggable={false}
          style={{
            aspectRatio: `${photo.width} / ${photo.height}`,
            transform: glissement ? `translateX(${glissement}px)` : undefined,
          }}
          className="max-h-full w-auto max-w-full select-none rounded-sm object-contain shadow-[0_24px_60px_-30px_rgb(0_0_0/0.9)]"
        />

        {total > 1 ? (
          <>
            <Fleche cote="gauche" onClick={() => aller(-1)} />
            <Fleche cote="droite" onClick={() => aller(1)} />
          </>
        ) : null}
      </div>

      {/* -------------------------------- Bas --------------------------------- */}
      <div className="safe-b border-t border-[color:var(--v-ligne)] px-4 pb-3 pt-3.5 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          {legende ? (
            <p className="font-display text-[1.0625rem] leading-snug text-[color:var(--v-texte)]">
              {legende}
            </p>
          ) : null}
          <p
            className={cx(
              "text-[0.8125rem] text-[color:var(--v-texte-3)]",
              legende ? "mt-1" : undefined,
            )}
          >
            {details.join(" · ")}
          </p>

          {confirmation ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-[0.8125rem] text-[color:var(--v-texte-2)]">
                Supprimer cette photo&nbsp;? Elle quittera aussi les albums et les
                souvenirs qui la citent.
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <Pilule onClick={() => setConfirmation(false)}>Annuler</Pilule>
                <Pilule ton="danger" onClick={supprimer} disabled={enCours}>
                  Supprimer
                </Pilule>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Rond
                label={photo.favorite ? "Retirer des favorites" : "Mettre en favori"}
                actif={photo.favorite}
                enfonce={photo.favorite}
                disabled={enCours}
                onClick={() => agir(() => basculerFavori(photo.id))}
              >
                <IconCoeur size={19} fill={photo.favorite ? "currentColor" : "none"} />
              </Rond>

              <div ref={ancreMenu} className="relative">
                <Rond
                  label="Ajouter à un album"
                  actif={menuAlbums}
                  disabled={enCours}
                  onClick={() => setMenuAlbums((ouvert) => !ouvert)}
                  deploye={menuAlbums}
                >
                  <IconGrille size={19} />
                </Rond>

                {menuAlbums ? (
                  <div
                    role="group"
                    aria-label="Albums"
                    className="animate-rise absolute bottom-full left-0 z-10 mb-2 max-h-64 w-64 overflow-y-auto rounded-md border border-[color:var(--v-ligne)] bg-[color:var(--v-chrome)] p-1.5 shadow-[0_18px_40px_-20px_rgb(0_0_0/0.9)]"
                  >
                    {albums.length === 0 ? (
                      <p className="px-2.5 py-2 text-[0.8125rem] text-[color:var(--v-texte-3)]">
                        Aucun album pour l&apos;instant.
                      </p>
                    ) : (
                      albums.map((candidat) => {
                        const dedans = photo.albumIds.includes(candidat.id);
                        return (
                          <button
                            key={candidat.id}
                            type="button"
                            disabled={enCours}
                            aria-pressed={dedans}
                            onClick={() =>
                              agir(() =>
                                dedans
                                  ? retirerPhotoAlbum(candidat.id, photo.id)
                                  : ajouterPhotosAlbum(candidat.id, [photo.id]),
                              )
                            }
                            className="flex min-h-11 w-full items-center gap-2.5 rounded-sm px-2.5 text-left text-sm font-semibold transition-colors hover:bg-[color:var(--v-chrome-fort)] disabled:opacity-50"
                          >
                            <span
                              className={cx(
                                "grid size-5 shrink-0 place-items-center rounded-full border",
                                dedans
                                  ? "border-[color:var(--v-accent)] bg-[color:var(--v-accent)] text-[color:var(--v-fond)]"
                                  : "border-[color:var(--v-ligne)]",
                              )}
                            >
                              {dedans ? <IconValider size={13} /> : null}
                            </span>
                            <span className="truncate">{candidat.title}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </div>

              {album ? (
                <>
                  <Pilule
                    disabled={enCours || album.coverPhotoId === photo.id}
                    onClick={() => agir(() => definirCouverture(album.id, photo.id))}
                  >
                    <IconEtoile
                      size={15}
                      fill={album.coverPhotoId === photo.id ? "currentColor" : "none"}
                    />
                    {album.coverPhotoId === photo.id ? "Couverture" : "Mettre en couverture"}
                  </Pilule>
                  <Pilule
                    disabled={enCours}
                    onClick={() => agir(() => retirerPhotoAlbum(album.id, photo.id))}
                  >
                    Retirer de l&apos;album
                  </Pilule>
                </>
              ) : null}

              <span className="ml-auto flex">
                <Rond
                  label="Supprimer la photo"
                  ton="danger"
                  disabled={enCours}
                  onClick={() => setConfirmation(true)}
                >
                  <IconCorbeille size={19} />
                </Rond>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Les commandes ----------------------------- */

function Rond({
  label,
  onClick,
  children,
  actif = false,
  ton = "neutre",
  disabled = false,
  enfonce,
  deploye,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  actif?: boolean;
  ton?: "neutre" | "danger";
  disabled?: boolean;
  enfonce?: boolean;
  deploye?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={enfonce}
      aria-expanded={deploye}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "grid size-11 shrink-0 place-items-center rounded-full transition-colors",
        "bg-[color:var(--v-chrome)] hover:bg-[color:var(--v-chrome-fort)] disabled:opacity-50",
        actif && "text-[color:var(--v-accent)]",
        ton === "danger" && "hover:text-[color:var(--v-danger)]",
      )}
    >
      {children}
    </button>
  );
}

function Pilule({
  children,
  onClick,
  ton = "neutre",
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  ton?: "neutre" | "danger";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[0.8125rem] font-semibold transition-colors",
        "bg-[color:var(--v-chrome)] hover:bg-[color:var(--v-chrome-fort)] disabled:opacity-50",
        ton === "danger" ? "text-[color:var(--v-danger)]" : "text-[color:var(--v-texte)]",
      )}
    >
      {children}
    </button>
  );
}

function Fleche({ cote, onClick }: { cote: "gauche" | "droite"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={cote === "gauche" ? "Photo précédente" : "Photo suivante"}
      onClick={onClick}
      className={cx(
        "absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full",
        "bg-[color:var(--v-chrome)] text-[color:var(--v-texte)] transition-colors hover:bg-[color:var(--v-chrome-fort)]",
        cote === "gauche" ? "left-1 sm:left-3" : "right-1 sm:right-3",
      )}
    >
      {cote === "gauche" ? <IconChevronGauche size={20} /> : <IconChevronDroite size={20} />}
    </button>
  );
}
