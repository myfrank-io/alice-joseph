"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/components/ui";
import { IconFermer } from "@/components/icons";

/**
 * Panneau modal : il monte du bas sur téléphone, s'affiche centré sur grand
 * écran. Une seule implémentation pour toutes les apps, pour que le geste soit
 * partout le même.
 *
 * Le panneau est rendu dans `document.body` par un portail, et ce n'est pas un
 * détail : la plupart des panneaux s'ouvrent depuis le `action` du `PageHeader`,
 * donc depuis l'intérieur d'un en-tête qui porte `backdrop-filter` (`.veil`).
 * Or un `backdrop-filter` non nul devient bloc conteneur des descendants
 * `position: fixed` — le `inset-0` se serait calé sur la bande d'en-tête au lieu
 * du viewport, et le `z-50` serait resté prisonnier du contexte d'empilement de
 * l'en-tête. Le portail met le panneau hors de portée de tout ancêtre.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [monte, setMonte] = useState(false);

  // `document` n'existe pas au rendu serveur : on n'ouvre le portail qu'ensuite.
  useEffect(() => setMonte(true), []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || !monte) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[color-mix(in_oklab,var(--ink)_38%,transparent)] backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "animate-rise relative flex max-h-[90dvh] w-full flex-col overflow-hidden",
          "rounded-t-2xl border border-line bg-surface shadow-[var(--shadow-lg)]",
          "sm:rounded-2xl",
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <div className="flex items-start gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-heading text-ink">{title}</h2>
            {description ? (
              <p className="mt-1 text-[0.8125rem] leading-snug text-ink-3">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="-mr-1 -mt-1 grid size-9 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <IconFermer size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer ? (
          <div className="safe-b border-t border-line bg-surface-2/60 px-5 py-3.5">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
