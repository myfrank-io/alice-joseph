import Link from "next/link";
import { cx } from "@/components/ui";
import { FILTRES, VUES, lienPhotos, type Filtre, type Vue } from "@/components/photos/shared";

/**
 * Les deux commandes de l'en-tête. Ce sont de vrais liens : l'état vit dans
 * l'URL, donc une vue se partage, se met en favori et survit au rechargement.
 */

export function Segments({ vue, filtre }: { vue: Vue; filtre: Filtre }) {
  return (
    <div
      role="group"
      aria-label="Affichage des photos"
      className="flex rounded-full bg-surface-2 p-1"
    >
      {VUES.map(({ valeur, libelle }) => {
        const actif = valeur === vue;
        return (
          <Link
            key={valeur}
            href={lienPhotos(valeur, filtre)}
            aria-current={actif ? "page" : undefined}
            className={cx(
              "inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-4",
              "text-sm font-semibold transition-colors sm:flex-none",
              actif
                ? "bg-surface text-ink shadow-[var(--shadow-sm)]"
                : "text-ink-2 hover:text-ink",
            )}
          >
            {libelle}
          </Link>
        );
      })}
    </div>
  );
}

export function Filtres({ vue, filtre }: { vue: Vue; filtre: Filtre }) {
  return (
    <nav
      aria-label="Filtrer les photos"
      className="no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto px-1"
    >
      {FILTRES.map(({ valeur, libelle }) => {
        const actif = valeur === filtre;
        return (
          <Link
            key={valeur}
            href={lienPhotos(vue, valeur)}
            aria-current={actif ? "true" : undefined}
            className={cx(
              "inline-flex min-h-11 shrink-0 items-center rounded-full px-3",
              "text-[0.8125rem] font-semibold whitespace-nowrap transition-colors",
              actif ? "bg-accent-soft text-accent-ink" : "text-ink-3 hover:text-ink",
            )}
          >
            {libelle}
          </Link>
        );
      })}
    </nav>
  );
}
