import type { Who, WhoOrBoth } from "@/lib/types";

/** Fuseau fixé : le serveur et le navigateur doivent afficher la même chose. */
const TZ = "Europe/Paris";

const dayFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const shortDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TZ,
  month: "long",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDay(iso: string): string {
  return dayFormatter.format(new Date(iso));
}

export function formatShortDate(iso: string): string {
  return shortDateFormatter.format(new Date(iso));
}

export function formatMonth(iso: string): string {
  return monthFormatter.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

/** « à l'instant », « il y a 3 h », « le 14 mars 2025 ». */
export function formatAgo(iso: string, from = new Date()): string {
  const seconds = Math.round((from.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "à l'instant";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} jours`;
  if (days < 31) return `il y a ${Math.round(days / 7)} sem.`;
  return `le ${formatShortDate(iso)}`;
}

/** Nombre de jours pleins écoulés depuis une date. */
export function daysSince(iso: string, from = new Date()): number {
  const start = new Date(iso).getTime();
  return Math.max(0, Math.floor((from.getTime() - start) / 86_400_000));
}

/** « 2 341 jours » — espace fine insécable, comme il se doit en français. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

export function whoLabel(who: WhoOrBoth): string {
  if (who === "alice") return "Alice";
  if (who === "joseph") return "Joseph";
  return "Tous les deux";
}

export function whoInitial(who: Who): string {
  return who === "alice" ? "A" : "J";
}

/** Accorde une phrase selon la personne connectée. */
export function possessive(who: Who, viewer: Who): string {
  return who === viewer ? "toi" : whoLabel(who);
}

export function plural(count: number, one: string, many: string): string {
  return count > 1 ? many : one;
}
