"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Ferme un petit panneau flottant sur Échap ou au premier geste à l'extérieur.
 * Le rappel passe par une référence : le composant appelant n'a pas à le
 * mémoriser pour éviter de réabonner les écouteurs à chaque rendu.
 */
export function useDismiss<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
): RefObject<T | null> {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return ref;
}
