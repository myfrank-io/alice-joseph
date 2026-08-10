"use client";

import { useState, useTransition } from "react";
import { cx } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import { whoInitial, whoLabel } from "@/lib/format";
import type { Reaction, Who } from "@/lib/types";
import { REACTIONS, reactionName } from "@/components/fil/emojis";
import { useDismiss } from "@/components/fil/popover";
import { basculerReaction } from "@/app/(app)/fil/actions";

/**
 * À deux, une réaction n'a pas besoin d'être comptée : elle a besoin d'être
 * attribuée. Chaque pastille dit donc qui l'a posée, et un clic sur la sienne
 * la retire.
 */
export function Reactions({
  postId,
  reactions,
  who,
}: {
  postId: string;
  reactions: Reaction[];
  who: Who;
}) {
  const [choix, setChoix] = useState(false);
  const [enCours, demarrer] = useTransition();
  const barre = useDismiss<HTMLDivElement>(choix, () => setChoix(false));

  const groupes = grouper(reactions);
  const miennes = new Set(
    reactions.filter((reaction) => reaction.by === who).map((reaction) => reaction.emoji),
  );

  function basculer(emoji: string) {
    setChoix(false);
    demarrer(async () => {
      await basculerReaction(postId, emoji);
    });
  }

  return (
    <div ref={barre} className="relative flex flex-wrap items-center gap-1.5 px-4 py-2">
      {groupes.map(({ emoji, par }) => {
        const mienne = par.includes(who);
        const noms = par.map((personne) => whoLabel(personne)).join(" et ");

        return (
          <button
            key={emoji}
            type="button"
            onClick={() => basculer(emoji)}
            disabled={enCours}
            aria-pressed={mienne}
            aria-label={`${reactionName(emoji)}, ${noms}`}
            title={noms}
            className={cx(
              "inline-flex h-11 items-center gap-1.5 rounded-full border px-3",
              "shadow-[var(--shadow-sm)] transition-colors disabled:opacity-60",
              mienne
                ? "border-accent bg-accent-soft text-accent-ink"
                : "border-line bg-surface-2 text-ink-2 hover:border-line-strong hover:bg-surface-3",
            )}
          >
            <span aria-hidden="true" className="text-base leading-none">
              {emoji}
            </span>
            <span aria-hidden="true" className="text-[0.6875rem] font-bold tracking-wide">
              {par.map((personne) => whoInitial(personne)).join("")}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => setChoix((ouvert) => !ouvert)}
        disabled={enCours}
        aria-expanded={choix}
        aria-label="Ajouter une réaction"
        className={cx(
          "grid size-11 place-items-center rounded-full border border-dashed transition-colors",
          choix
            ? "border-accent bg-accent-soft text-accent-ink"
            : "border-line-strong text-ink-3 hover:border-accent hover:text-accent-ink",
        )}
      >
        <IconPlus size={17} />
      </button>

      {choix ? (
        <div
          role="menu"
          aria-label="Choisir une réaction"
          className="animate-rise absolute bottom-full left-2 z-20 mb-1 flex rounded-full border border-line bg-surface p-1 shadow-[var(--shadow-md)]"
        >
          {REACTIONS.map((reaction) => {
            const posee = miennes.has(reaction.emoji);
            return (
              <button
                key={reaction.emoji}
                type="button"
                role="menuitem"
                onClick={() => basculer(reaction.emoji)}
                aria-pressed={posee}
                aria-label={posee ? `Retirer ${reaction.name}` : `Réagir avec ${reaction.name}`}
                className={cx(
                  "grid size-11 place-items-center rounded-full text-xl transition-transform active:scale-95",
                  posee ? "bg-accent-soft" : "hover:bg-surface-2",
                )}
              >
                <span aria-hidden="true">{reaction.emoji}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Une pastille par emoji, dans l'ordre du jeu de six. */
function grouper(reactions: Reaction[]): { emoji: string; par: Who[] }[] {
  const par = new Map<string, Who[]>();
  for (const reaction of reactions) {
    const liste = par.get(reaction.emoji) ?? [];
    if (!liste.includes(reaction.by)) liste.push(reaction.by);
    par.set(reaction.emoji, liste);
  }

  const rang = (emoji: string) => {
    const index = REACTIONS.findIndex((reaction) => reaction.emoji === emoji);
    return index < 0 ? REACTIONS.length : index;
  };

  return [...par.entries()]
    .map(([emoji, personnes]) => ({ emoji, par: personnes }))
    .sort((a, b) => rang(a.emoji) - rang(b.emoji));
}
