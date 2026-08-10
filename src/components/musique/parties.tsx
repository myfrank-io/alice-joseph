"use client";

import { useTransition, type SVGProps } from "react";
import { basculerCoeur } from "@/app/(app)/musique/actions";
import { Button, buttonClass, cx } from "@/components/ui";
import { IconCoeur, IconFermer, IconFleche, IconLecture, IconMusique } from "@/components/icons";
import { whoLabel } from "@/lib/format";
import { nomFournisseur } from "@/lib/musique";
import type { MusicProvider, Who } from "@/lib/types";

/**
 * Les petites pièces partagées entre la carte d'un morceau et le bandeau du
 * morceau du moment : pochette, cœurs, boutons d'écoute.
 */

/* -------------------------------- Pochette -------------------------------- */

export function Pochette({ src, className }: { src?: string; className?: string }) {
  return (
    <span
      className={cx(
        "grid shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-surface-2 text-ink-3",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      ) : (
        <IconMusique size={22} />
      )}
    </span>
  );
}

/* --------------------------------- Cœurs ---------------------------------- */

/**
 * Deux cœurs, un par personne. Chacun ne bascule que le sien : le cœur de
 * l'autre est un témoin, pas un bouton — et l'action serveur le vérifie de
 * toute façon, elle ne lit que le cookie de session.
 */
export function Coeurs({
  trackId,
  loves,
  who,
  taille = 19,
}: {
  trackId: string;
  loves: Who[];
  who: Who;
  taille?: number;
}) {
  const [enCours, demarrer] = useTransition();

  return (
    <span className="flex items-center">
      {(["alice", "joseph"] as const).map((personne) => {
        const aime = loves.includes(personne);
        const teinte = personne === "alice" ? "text-alice" : "text-joseph";

        if (personne !== who) {
          return (
            <span
              key={personne}
              role="img"
              aria-label={
                aime
                  ? `${whoLabel(personne)} a mis son cœur`
                  : `${whoLabel(personne)} n'a pas mis son cœur`
              }
              className={cx(
                "grid size-9 place-items-center",
                aime ? teinte : "text-ink-3 opacity-40",
              )}
            >
              <IconCoeur size={taille - 2} fill={aime ? "currentColor" : "none"} />
            </span>
          );
        }

        return (
          <button
            key={personne}
            type="button"
            aria-pressed={aime}
            aria-label={aime ? "Retirer mon cœur" : "Mettre mon cœur"}
            disabled={enCours}
            onClick={() => {
              demarrer(async () => {
                await basculerCoeur(trackId);
              });
            }}
            className={cx(
              "grid size-11 place-items-center rounded-full transition-colors",
              "hover:bg-surface-2 disabled:opacity-50",
              aime ? teinte : "text-ink-3 hover:text-ink-2",
            )}
          >
            <IconCoeur size={taille} fill={aime ? "currentColor" : "none"} />
          </button>
        );
      })}
    </span>
  );
}

/* -------------------------------- Écouter --------------------------------- */

export function BoutonEcouter({
  joue,
  onToggle,
  controle,
  variant = "soft",
  className,
}: {
  joue: boolean;
  onToggle: () => void;
  controle: string;
  variant?: "soft" | "primary";
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant={joue ? "soft" : variant}
      size="md"
      onClick={onToggle}
      aria-expanded={joue}
      aria-controls={controle}
      className={cx("h-11", className)}
    >
      {joue ? <IconFermer size={15} /> : <IconLecture size={15} />}
      {joue ? "Masquer" : "Écouter"}
    </Button>
  );
}

/** Sortie de secours quand aucun lecteur n'est intégrable : le lien d'origine. */
export function LienDuService({
  url,
  provider,
  titre,
  variant = "ghost",
  className,
}: {
  url: string;
  provider: MusicProvider;
  titre: string;
  variant?: "ghost" | "soft";
  className?: string;
}) {
  const service = provider === "autre" ? "le service d'origine" : nomFournisseur(provider);
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Ouvrir « ${titre} » sur ${service}, dans un nouvel onglet`}
      className={buttonClass(variant, "md", cx("h-11", className))}
    >
      Ouvrir
      <IconFleche size={15} />
    </a>
  );
}

/** Mention discrète : sans lien reconnu, pas de lecteur intégré. */
export function MentionSansLecteur({ className }: { className?: string }) {
  return (
    <p className={cx("text-xs leading-snug text-ink-3", className)}>
      Lien non reconnu : une adresse Spotify, YouTube ou Deezer activerait le lecteur ici même.
    </p>
  );
}

/* --------------------------------- Icône ---------------------------------- */

/**
 * Les trois points du menu. Sa place serait `src/components/icons.tsx` avec
 * les autres — elle attend ici tant qu'on ne touche pas au fichier partagé.
 */
export function IconPoints({ size = 22, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <circle cx="5.6" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="18.4" cy="12" r="1.7" />
    </svg>
  );
}
