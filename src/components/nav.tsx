"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";
import {
  IconCarte,
  IconFil,
  IconJeux,
  IconMusique,
  IconNous,
  IconPhotos,
  IconReglages,
} from "@/components/icons";

type Item = {
  href: string;
  label: string;
  Icon: (props: { size?: number }) => React.ReactElement;
  tint: string;
};

/**
 * Chaque app porte une teinte du même jeu pastel. La teinte n'apparaît qu'à
 * l'état actif : elle sert à se repérer, pas à décorer.
 */
export const NAV_ITEMS: Item[] = [
  { href: "/nous", label: "Nous", Icon: IconNous, tint: "--tint-fil" },
  { href: "/fil", label: "Fil", Icon: IconFil, tint: "--tint-fil" },
  { href: "/photos", label: "Photos", Icon: IconPhotos, tint: "--tint-photos" },
  { href: "/musique", label: "Musique", Icon: IconMusique, tint: "--tint-musique" },
  { href: "/carte", label: "Carte", Icon: IconCarte, tint: "--tint-carte" },
  { href: "/jeux", label: "Jeux", Icon: IconJeux, tint: "--tint-jeux" },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/* ------------------------------ Barre du bas ------------------------------ */

export function TabBar() {
  const isActive = useActive();

  return (
    <nav
      aria-label="Navigation principale"
      className="veil safe-b fixed inset-x-0 bottom-0 z-40 border-t border-line lg:hidden"
    >
      <ul className="grid grid-cols-6">
        {NAV_ITEMS.map(({ href, label, Icon, tint }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex flex-col items-center gap-1 pb-2 pt-2.5 transition-colors",
                  active ? "text-ink" : "text-ink-3",
                )}
              >
                <span
                  className="grid h-7 w-11 place-items-center rounded-full transition-colors"
                  style={{
                    background: active
                      ? `color-mix(in oklab, var(${tint}) 42%, transparent)`
                      : undefined,
                  }}
                >
                  <Icon size={20} />
                </span>
                <span className="text-[0.625rem] font-bold tracking-wide">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ------------------------------ Rail de gauche ---------------------------- */

export function SideRail({ footer }: { footer?: React.ReactNode }) {
  const isActive = useActive();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[15.5rem] flex-col border-r border-line bg-surface/60 px-4 py-6 lg:flex">
      <Link href="/nous" className="mb-8 block px-3">
        <span className="font-display text-[1.375rem] leading-tight tracking-tight text-ink">
          Alice <span className="text-accent">&</span> Joseph
        </span>
        <span className="mt-1 block text-xs text-ink-3">Rien qu&rsquo;à nous</span>
      </Link>

      <nav aria-label="Navigation principale">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, Icon, tint }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-semibold transition-colors",
                    active ? "text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                  )}
                  style={{
                    background: active
                      ? `color-mix(in oklab, var(${tint}) 34%, transparent)`
                      : undefined,
                  }}
                >
                  <Icon size={20} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto flex flex-col gap-2 pt-6">
        {footer}
        <Link
          href="/reglages"
          className={cx(
            "flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-semibold transition-colors",
            isActive("/reglages")
              ? "bg-surface-2 text-ink"
              : "text-ink-2 hover:bg-surface-2 hover:text-ink",
          )}
        >
          <IconReglages size={20} />
          Réglages
        </Link>
      </div>
    </aside>
  );
}
