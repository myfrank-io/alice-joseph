import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/components/ui";
import { IconChevronGauche } from "@/components/icons";

/**
 * En-tête commun aux six apps. Sur téléphone il se colle en haut et reste
 * compact ; sur grand écran il se déploie en titre d'ouverture.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  back,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <header
      className={cx(
        "veil sticky top-0 z-30 -mx-4 border-b border-line px-4 py-3",
        "lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:pb-2 lg:pt-10 lg:backdrop-filter-none",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {back ? (
          <Link
            href={back.href}
            aria-label={back.label}
            className="-ml-2 grid size-9 shrink-0 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <IconChevronGauche size={20} />
          </Link>
        ) : null}

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[1.3125rem] leading-tight text-ink lg:text-display lg:leading-[1.04]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[0.8125rem] text-ink-3 lg:mt-2 lg:text-sm">
              {subtitle}
            </p>
          ) : null}
        </div>

        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
    </header>
  );
}
