import Link from "next/link";
import { cx } from "@/components/ui";
import type { Track } from "@/lib/types";

/** Les quatre façons de regarder la bibliothèque. Le choix vit dans l'URL. */
export type FiltreBibliotheque = "tout" | "alice" | "joseph" | "deux";

export const FILTRES: { cle: FiltreBibliotheque; label: string }[] = [
  { cle: "tout", label: "Tout" },
  { cle: "alice", label: "Ajoutés par Alice" },
  { cle: "joseph", label: "Ajoutés par Joseph" },
  { cle: "deux", label: "Nos deux préférés" },
];

export function lireFiltre(valeur: string | string[] | undefined): FiltreBibliotheque {
  const cle = Array.isArray(valeur) ? valeur[0] : valeur;
  return FILTRES.find((f) => f.cle === cle)?.cle ?? "tout";
}

export function appliquerFiltre(tracks: Track[], filtre: FiltreBibliotheque): Track[] {
  switch (filtre) {
    case "alice":
      return tracks.filter((track) => track.by === "alice");
    case "joseph":
      return tracks.filter((track) => track.by === "joseph");
    case "deux":
      return tracks.filter(
        (track) => track.loves.includes("alice") && track.loves.includes("joseph"),
      );
    default:
      return tracks;
  }
}

export function FiltresBibliotheque({ actif }: { actif: FiltreBibliotheque }) {
  return (
    <nav aria-label="Filtrer la bibliothèque" className="no-scrollbar -mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex w-max gap-2">
        {FILTRES.map(({ cle, label }) => {
          const choisi = cle === actif;
          return (
            <li key={cle}>
              <Link
                href={cle === "tout" ? "/musique" : `/musique?filtre=${cle}`}
                scroll={false}
                aria-current={choisi ? "true" : undefined}
                className={cx(
                  "flex h-11 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors",
                  choisi
                    ? "bg-accent-soft text-accent-ink"
                    : "bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
