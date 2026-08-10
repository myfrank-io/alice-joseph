"use client";

import { Avatar, Chip, cx } from "@/components/ui";
import { formatShortDate, formatTime, whoLabel } from "@/lib/format";
import type { Post, Who } from "@/lib/types";
import { PostPhotos, type PostPhoto } from "@/components/fil/photos";
import { Reactions } from "@/components/fil/reactions";
import { Commentaires } from "@/components/fil/comments";
import { PostMenu } from "@/components/fil/post-menu";

/**
 * Une carte du fil : qui parle, ce qu'il dit, ce qu'on lui répond.
 *
 * Les messages écrits par l'autre depuis la dernière visite portent une pastille
 * et un liseré de sa couleur — assez pour les repérer en défilant, assez discret
 * pour ne pas transformer le fil en tableau de notifications.
 */
export function PostCard({
  post,
  photos,
  who,
  nouveau = false,
  horodatage = "heure",
}: {
  post: Post;
  photos: PostPhoto[];
  who: Who;
  nouveau?: boolean;
  horodatage?: "heure" | "date";
}) {
  const auteur = post.by;
  const sien = auteur === who;
  const teinte = auteur === "alice" ? "alice" : "joseph";
  const liser = auteur === "alice" ? "border-l-alice" : "border-l-joseph";
  const pastille = auteur === "alice" ? "bg-alice" : "bg-joseph";

  const quand =
    horodatage === "date"
      ? `${formatShortDate(post.createdAt)}, ${formatTime(post.createdAt)}`
      : formatTime(post.createdAt);

  return (
    <article
      className={cx(
        "relative rounded-lg border border-line bg-surface shadow-[var(--shadow-sm)]",
        nouveau && ["border-l-[3px]", liser],
      )}
    >
      <header className="flex items-start gap-3 px-4 pt-4">
        <Avatar who={auteur} size={38} />

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            {whoLabel(auteur)}
            {nouveau ? (
              <>
                <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", pastille)} />
                <span className="sr-only">Nouveau depuis ta dernière visite</span>
              </>
            ) : null}
            {post.pinned ? <span className="sr-only">Message épinglé</span> : null}
          </p>
          <time dateTime={post.createdAt} className="tabular text-xs text-ink-3">
            {quand}
          </time>
        </div>

        {sien ? (
          <PostMenu
            postId={post.id}
            epingle={post.pinned}
            avecPhotos={(post.photoIds ?? []).length > 0}
          />
        ) : null}
      </header>

      <p className="whitespace-pre-wrap break-words px-4 pt-3 text-[0.9375rem] leading-relaxed text-ink">
        {post.body}
      </p>

      {post.mood ? (
        <div className="px-4 pt-3">
          <Chip tone={teinte}>
            <span className="sr-only">Humeur&nbsp;: </span>
            <span aria-hidden="true" className="text-sm leading-none">
              {post.mood.emoji}
            </span>
            {post.mood.label}
          </Chip>
        </div>
      ) : null}

      <PostPhotos photos={photos} />

      <div className="mt-3 border-t border-line">
        <Reactions postId={post.id} reactions={post.reactions ?? []} who={who} />
      </div>

      <Commentaires postId={post.id} comments={post.comments ?? []} who={who} />
    </article>
  );
}
