"use client";

import { useState, useTransition } from "react";
import { Button, cx } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { IconCorbeille, IconEpingle } from "@/components/icons";
import { basculerEpingle, supprimerPost } from "@/app/(app)/fil/actions";
import { useDismiss } from "@/components/fil/popover";

/** Trois points — la seule icône qui manquait au jeu commun. */
function IconPoints({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </svg>
  );
}

/** N'apparaît que pour l'auteur du message : chacun ne range que ses affaires. */
export function PostMenu({
  postId,
  epingle,
  avecPhotos,
}: {
  postId: string;
  epingle: boolean;
  avecPhotos: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [enCours, demarrer] = useTransition();
  const enveloppe = useDismiss<HTMLDivElement>(ouvert, () => setOuvert(false));

  function epingler() {
    setOuvert(false);
    demarrer(async () => {
      await basculerEpingle(postId);
    });
  }

  function supprimer() {
    demarrer(async () => {
      await supprimerPost(postId);
      setConfirmation(false);
    });
  }

  return (
    <div ref={enveloppe} className="relative -mr-2 -mt-1 shrink-0">
      <button
        type="button"
        onClick={() => setOuvert((valeur) => !valeur)}
        disabled={enCours}
        aria-expanded={ouvert}
        aria-label="Actions du message"
        className={cx(
          "grid size-11 place-items-center rounded-full transition-colors",
          ouvert ? "bg-surface-2 text-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink",
        )}
      >
        <IconPoints size={20} />
      </button>

      {ouvert ? (
        <div
          role="menu"
          aria-label="Actions du message"
          className="animate-rise absolute right-0 top-11 z-20 w-52 overflow-hidden rounded-md border border-line bg-surface p-1 shadow-[var(--shadow-md)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={epingler}
            className="flex h-11 w-full items-center gap-2.5 rounded-sm px-3 text-left text-sm font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <IconEpingle size={17} />
            {epingle ? "Désépingler" : "Épingler en haut"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOuvert(false);
              setConfirmation(true);
            }}
            className="flex h-11 w-full items-center gap-2.5 rounded-sm px-3 text-left text-sm font-semibold text-ink-2 transition-colors hover:bg-bad-soft hover:text-bad"
          >
            <IconCorbeille size={17} />
            Supprimer
          </button>
        </div>
      ) : null}

      <Sheet
        open={confirmation}
        onClose={() => {
          if (!enCours) setConfirmation(false);
        }}
        title="Supprimer ce message ?"
        description="Il quittera le fil, avec ses réactions et ses commentaires."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmation(false)}
              disabled={enCours}
            >
              Annuler
            </Button>
            <Button type="button" variant="danger" onClick={supprimer} disabled={enCours}>
              {enCours ? "Suppression…" : "Supprimer"}
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-ink-2">
          {avecPhotos
            ? "Les photos publiées avec ce message restent dans l’app Photos : seul le message disparaît."
            : "C’est définitif, et personne ne pourra le retrouver."}
        </p>
      </Sheet>
    </div>
  );
}
