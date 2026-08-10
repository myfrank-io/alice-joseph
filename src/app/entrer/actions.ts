"use server";

import { redirect } from "next/navigation";
import { startSession } from "@/lib/auth";
import { passcodeMatches } from "@/lib/auth-token";

function safeNext(value: FormDataEntryValue | null): string {
  const suite = typeof value === "string" ? value : "";
  return suite.startsWith("/") && !suite.startsWith("//") ? suite : "/nous";
}

export async function signIn(formData: FormData): Promise<void> {
  const who = formData.get("qui");
  const code = String(formData.get("code") ?? "");
  const suite = safeNext(formData.get("suite"));

  if (who !== "alice" && who !== "joseph") {
    redirect(`/entrer?erreur=personne&suite=${encodeURIComponent(suite)}`);
  }

  if (!passcodeMatches(code)) {
    redirect(`/entrer?erreur=code&qui=${who}&suite=${encodeURIComponent(suite)}`);
  }

  await startSession(who);
  redirect(suite);
}
