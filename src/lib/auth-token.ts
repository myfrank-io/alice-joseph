import { SignJWT, jwtVerify } from "jose";
import type { Who } from "@/lib/types";

/**
 * Primitives de session, sans dépendance à `next/headers` : ce module doit
 * pouvoir tourner aussi bien dans le middleware que dans les composants serveur.
 */

export const SESSION_COOKIE = "aj_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

/** Code d'accès de repli, utilisé tant qu'APP_PASSCODE n'est pas défini. */
export const DEFAULT_PASSCODE = "nous";

export function expectedPasscode(): string {
  return process.env.APP_PASSCODE?.trim() || DEFAULT_PASSCODE;
}

export function usingDefaultPasscode(): boolean {
  return !process.env.APP_PASSCODE?.trim();
}

function secretKey(): Uint8Array {
  const raw =
    process.env.AUTH_SECRET?.trim() ||
    `alice-joseph-${expectedPasscode()}-cle-locale-non-secrete`;
  return new TextEncoder().encode(raw.padEnd(32, "·"));
}

/** Comparaison à durée constante, pour ne pas laisser fuiter le code caractère par caractère. */
export function passcodeMatches(candidate: string): boolean {
  const expected = expectedPasscode();
  const a = new TextEncoder().encode(candidate.trim());
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

export async function signSession(who: Who): Promise<string> {
  return new SignJWT({ who })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<Who | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const who = payload.who;
    return who === "alice" || who === "joseph" ? who : null;
  } catch {
    return null;
  }
}
