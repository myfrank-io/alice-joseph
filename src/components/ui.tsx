import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import type { Who } from "@/lib/types";
import { whoInitial, whoLabel } from "@/lib/format";

export const cx = clsx;

/* --------------------------------- Boutons -------------------------------- */

type Variant = "primary" | "soft" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-on hover:bg-accent-hover shadow-[0_1px_2px_rgb(44_40_48/0.10)] active:translate-y-px",
  soft: "bg-surface-2 text-ink hover:bg-surface-3 active:translate-y-px",
  ghost: "text-ink-2 hover:text-ink hover:bg-surface-2",
  outline: "border border-line-strong text-ink hover:bg-surface-2 active:translate-y-px",
  danger: "bg-bad-soft text-bad hover:brightness-95 active:translate-y-px",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[0.8125rem] rounded-xs gap-1.5",
  md: "h-10 px-4 text-sm rounded-sm gap-2",
  lg: "h-12 px-5 text-[0.9375rem] rounded-md gap-2",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex select-none items-center justify-center font-semibold whitespace-nowrap",
    "transition-[background-color,color,transform,box-shadow] duration-150",
    "disabled:pointer-events-none disabled:opacity-45",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...rest} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

/* -------------------------------- Surfaces -------------------------------- */

/** Classe de surface réutilisable, pour habiller un `li`, un `article`, un `form`… */
export const cardClass = "rounded-lg border border-line bg-surface shadow-[var(--shadow-sm)]";

export function Card({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cx(cardClass, className)} {...rest} />;
}

export function SectionTitle({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="label-caps mb-1.5 text-ink-3">{eyebrow}</p> : null}
        <h2 className="font-display text-title text-ink">{title}</h2>
      </div>
      {action ? <div className="shrink-0 pb-1">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line-strong bg-surface-2/50 px-6 py-12 text-center">
      {icon ? (
        <div className="mb-4 grid size-12 place-items-center rounded-full bg-surface text-ink-3 shadow-[var(--shadow-sm)]">
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-heading text-ink">{title}</h3>
      {children ? (
        <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-ink-2">{children}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* -------------------------------- Étiquettes ------------------------------ */

export function Chip({
  className,
  tone = "neutre",
  ...rest
}: ComponentProps<"span"> & { tone?: "neutre" | "accent" | "alice" | "joseph" }) {
  const tones = {
    neutre: "bg-surface-2 text-ink-2",
    accent: "bg-accent-soft text-accent-ink",
    alice: "bg-alice-soft text-alice-ink",
    joseph: "bg-joseph-soft text-joseph-ink",
  } as const;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}

/* --------------------------------- Avatars -------------------------------- */

export function Avatar({
  who,
  src,
  size = 36,
  className,
  ring = false,
}: {
  who: Who;
  src?: string;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const tone =
    who === "alice"
      ? "bg-alice-soft text-alice-ink"
      : "bg-joseph-soft text-joseph-ink";

  return (
    <span
      className={cx(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-display font-semibold",
        tone,
        ring && (who === "alice" ? "ring-2 ring-alice" : "ring-2 ring-joseph"),
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      title={whoLabel(who)}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        whoInitial(who)
      )}
    </span>
  );
}

/** Les deux visages côte à côte, pour tout ce qui appartient au couple. */
export function AvatarPair({ size = 30 }: { size?: number }) {
  return (
    <span className="inline-flex items-center" style={{ paddingRight: size * 0.32 }}>
      <Avatar who="alice" size={size} />
      <Avatar
        who="joseph"
        size={size}
        className="-ml-2 ring-2 ring-surface"
      />
    </span>
  );
}

/* ------------------------------- Formulaires ------------------------------ */

const fieldBase =
  "w-full rounded-sm border border-line bg-surface px-3.5 py-2.5 text-sm text-ink " +
  "shadow-[inset_0_1px_1px_rgb(44_40_48/0.03)] transition-colors " +
  "placeholder:text-ink-3 hover:border-line-strong focus:border-accent focus-visible:shadow-[var(--ring)]";

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cx(fieldBase, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return (
    <textarea className={cx(fieldBase, "resize-none leading-relaxed", className)} {...rest} />
  );
}

export function Select({ className, ...rest }: ComponentProps<"select">) {
  return (
    <select
      className={cx(fieldBase, "cursor-pointer appearance-none bg-no-repeat pr-9", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238b8390' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>\")",
        backgroundPosition: "right 0.75rem center",
      }}
      {...rest}
    />
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("flex flex-col gap-1.5", className)}>
      <span className="label-caps text-ink-3">{label}</span>
      {children}
      {hint ? <span className="text-xs leading-snug text-ink-3">{hint}</span> : null}
    </label>
  );
}

/* --------------------------------- Divers --------------------------------- */

export function Divider({ className }: { className?: string }) {
  return <hr className={cx("border-0 border-t border-line", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60",
        className,
      )}
      role="status"
      aria-label="Chargement"
    />
  );
}
