"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { Avatar, Textarea, cx } from "@/components/ui";
import { IconCorbeille, IconFleche } from "@/components/icons";
import { formatTime, whoLabel } from "@/lib/format";
import type { Comment, Who } from "@/lib/types";
import { ajouterCommentaire, supprimerCommentaire } from "@/app/(app)/fil/actions";

export function Commentaires({
  postId,
  comments,
  who,
}: {
  postId: string;
  comments: Comment[];
  who: Who;
}) {
  return (
    <div className="border-t border-line">
      {comments.length > 0 ? (
        <ul className="flex flex-col gap-2.5 px-4 pb-1 pt-3">
          {comments.map((comment) => (
            <CommentaireLigne key={comment.id} postId={postId} comment={comment} who={who} />
          ))}
        </ul>
      ) : null}

      <ChampReponse postId={postId} who={who} />
    </div>
  );
}

function CommentaireLigne({
  postId,
  comment,
  who,
}: {
  postId: string;
  comment: Comment;
  who: Who;
}) {
  const [enCours, demarrer] = useTransition();

  function supprimer() {
    demarrer(async () => {
      await supprimerCommentaire(postId, comment.id);
    });
  }

  return (
    <li className={cx("flex items-start gap-2.5", enCours && "opacity-50")}>
      <Avatar who={comment.by} size={28} className="mt-0.5" />

      <div className="min-w-0 flex-1 rounded-sm bg-surface-2 px-3 py-2">
        <p className="flex items-baseline gap-2">
          <span className="text-[0.8125rem] font-semibold text-ink">{whoLabel(comment.by)}</span>
          <time dateTime={comment.at} className="tabular text-[0.6875rem] text-ink-3">
            {formatTime(comment.at)}
          </time>
        </p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-2">
          {comment.body}
        </p>
      </div>

      {comment.by === who ? (
        <button
          type="button"
          onClick={supprimer}
          disabled={enCours}
          aria-label="Supprimer ce commentaire"
          className="grid size-11 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-bad-soft hover:text-bad"
        >
          <IconCorbeille size={15} />
        </button>
      ) : null}
    </li>
  );
}

/* -------------------------------- Répondre -------------------------------- */

function ChampReponse({ postId, who }: { postId: string; who: Who }) {
  const [texte, setTexte] = useState("");
  const [enCours, demarrer] = useTransition();
  const champ = useRef<HTMLTextAreaElement>(null);

  // Le champ grandit avec la réponse, puis retrouve sa hauteur d'une ligne.
  useEffect(() => {
    const element = champ.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${element.scrollHeight}px`;
  }, [texte]);

  function envoyer() {
    const body = texte.trim();
    if (!body || enCours) return;
    setTexte("");
    demarrer(async () => {
      await ajouterCommentaire(postId, body);
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    envoyer();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      envoyer();
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2 px-4 py-2.5">
      <Avatar who={who} size={28} className="mb-1.5" />

      <Textarea
        ref={champ}
        rows={1}
        value={texte}
        onChange={(event) => setTexte(event.target.value)}
        onKeyDown={onKeyDown}
        maxLength={4000}
        placeholder="Répondre…"
        aria-label="Répondre à ce message"
        className="max-h-32 min-h-11 flex-1 overflow-y-auto"
      />

      <button
        type="submit"
        disabled={!texte.trim() || enCours}
        aria-label="Envoyer la réponse"
        className={cx(
          "grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-on",
          "shadow-[var(--shadow-sm)] transition-[background-color,opacity] hover:bg-accent-hover",
          "disabled:pointer-events-none disabled:opacity-40",
        )}
      >
        <IconFleche size={18} />
      </button>
    </form>
  );
}
