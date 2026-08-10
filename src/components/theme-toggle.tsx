"use client";

import { useEffect, useState } from "react";
import { cx } from "@/components/ui";
import { IconJour, IconNuit, IconGrille } from "@/components/icons";

type Choix = "light" | "dark" | "systeme";

const OPTIONS: { valeur: Choix; label: string; Icon: (p: { size?: number }) => React.ReactElement }[] =
  [
    { valeur: "light", label: "Jour", Icon: IconJour },
    { valeur: "dark", label: "Chambre noire", Icon: IconNuit },
    { valeur: "systeme", label: "Comme le téléphone", Icon: IconGrille },
  ];

/**
 * Le thème vit dans `localStorage` et se pose en attribut sur `<html>`.
 * « Comme le téléphone » retire l'attribut : c'est alors `prefers-color-scheme`
 * qui décide, ce que la feuille de style gère déjà.
 */
export function ThemeToggle() {
  const [choix, setChoix] = useState<Choix>("systeme");

  useEffect(() => {
    const stocke = localStorage.getItem("aj-theme");
    setChoix(stocke === "dark" || stocke === "light" ? stocke : "systeme");
  }, []);

  function appliquer(valeur: Choix) {
    setChoix(valeur);
    if (valeur === "systeme") {
      localStorage.removeItem("aj-theme");
      document.documentElement.removeAttribute("data-theme");
    } else {
      localStorage.setItem("aj-theme", valeur);
      document.documentElement.setAttribute("data-theme", valeur);
    }
  }

  return (
    <div role="radiogroup" aria-label="Apparence" className="grid gap-2 sm:grid-cols-3">
      {OPTIONS.map(({ valeur, label, Icon }) => {
        const actif = choix === valeur;
        return (
          <button
            key={valeur}
            type="button"
            role="radio"
            aria-checked={actif}
            onClick={() => appliquer(valeur)}
            className={cx(
              "flex items-center gap-2.5 rounded-sm border px-3.5 py-3 text-sm font-semibold transition-colors",
              actif
                ? "border-accent bg-accent-soft text-accent-ink"
                : "border-line text-ink-2 hover:border-line-strong hover:bg-surface-2",
            )}
          >
            <Icon size={18} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
