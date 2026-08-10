import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Who } from "@/lib/types";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
} from "@/lib/auth-token";

export async function startSession(who: Who): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(who), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Qui est connecté, ou null. */
export async function currentWho(): Promise<Who | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/** À utiliser dans toute page protégée : renvoie l'utilisateur ou redirige. */
export async function requireWho(): Promise<Who> {
  const who = await currentWho();
  if (!who) redirect("/entrer");
  return who;
}

export function otherWho(who: Who): Who {
  return who === "alice" ? "joseph" : "alice";
}
