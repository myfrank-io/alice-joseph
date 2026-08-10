"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { endSession, requireWho } from "@/lib/auth";
import { get, insert, update } from "@/lib/data/store";
import type { Settings } from "@/lib/types";

function texte(value: FormDataEntryValue | null, repli: string): string {
  const brut = typeof value === "string" ? value.trim() : "";
  return brut.length > 0 ? brut.slice(0, 40) : repli;
}

export async function enregistrerReglages(formData: FormData): Promise<void> {
  await requireWho();

  const dateBrute = String(formData.get("since") ?? "").trim();
  const since = /^\d{4}-\d{2}-\d{2}$/.test(dateBrute) ? dateBrute : undefined;

  const patch = {
    aliceLabel: texte(formData.get("aliceLabel"), "Alice"),
    josephLabel: texte(formData.get("josephLabel"), "Joseph"),
    since,
  };

  const existant = await get<Settings>("settings", "settings");
  if (existant) {
    await update<Settings>("settings", "settings", patch);
  } else {
    await insert<Settings>("settings", { id: "settings", ...patch });
  }

  revalidatePath("/reglages");
  revalidatePath("/nous");
}

export async function seDeconnecter(): Promise<void> {
  await endSession();
  redirect("/entrer");
}
