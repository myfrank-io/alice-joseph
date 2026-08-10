import type { Metadata } from "next";
import { signIn } from "./actions";
import { DEFAULT_PASSCODE, usingDefaultPasscode } from "@/lib/auth-token";
import { Input } from "@/components/ui";
import { IconFleche } from "@/components/icons";

export const metadata: Metadata = { title: "Entrer" };
export const dynamic = "force-dynamic";

export default async function EntrerPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; suite?: string; qui?: string }>;
}) {
  const { erreur, suite = "/nous" } = await searchParams;

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-5 py-12">
      <AmbientBackdrop />

      <div className="animate-rise relative w-full max-w-[26rem]">
        <div className="mb-9 text-center">
          <p className="label-caps mb-4 text-ink-3">Notre plateforme</p>
          <h1 className="font-display text-[2.5rem] leading-[1.05] tracking-tight text-ink">
            Alice <span className="text-accent">&</span> Joseph
          </h1>
          <p className="mx-auto mt-3 max-w-[24ch] text-sm leading-relaxed text-ink-2">
            Le fil, les photos, les musiques, la carte et les jeux. Il faut le code.
          </p>
        </div>

        <form
          action={signIn}
          className="rounded-xl border border-line bg-surface p-5 shadow-[var(--shadow-md)]"
        >
          <input type="hidden" name="suite" value={suite} />

          <label className="flex flex-col gap-1.5">
            <span className="label-caps text-ink-3">Le code</span>
            <Input
              name="code"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              placeholder="••••"
              aria-invalid={erreur === "code"}
              className="text-center text-base tracking-[0.35em]"
            />
          </label>

          {erreur === "code" ? (
            <p role="alert" className="mt-2.5 text-center text-xs font-semibold text-bad">
              Ce n&apos;est pas le bon code. Réessaie.
            </p>
          ) : null}
          {erreur === "personne" ? (
            <p role="alert" className="mt-2.5 text-center text-xs font-semibold text-bad">
              Choisis qui tu es pour entrer.
            </p>
          ) : null}

          <p className="mb-3 mt-6 text-center text-xs font-semibold text-ink-3">Et tu es…</p>

          <div className="grid grid-cols-2 gap-3">
            <WhoButton value="alice" label="Alice" />
            <WhoButton value="joseph" label="Joseph" />
          </div>
        </form>

        {usingDefaultPasscode() ? (
          <p className="mt-5 text-center text-xs leading-relaxed text-ink-3">
            Aucun code personnalisé n&apos;est encore défini : celui d&apos;origine est{" "}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-semibold text-ink-2">
              {DEFAULT_PASSCODE}
            </code>
            . On le change dans les réglages.
          </p>
        ) : null}
      </div>
    </main>
  );
}

function WhoButton({ value, label }: { value: "alice" | "joseph"; label: string }) {
  const tone =
    value === "alice"
      ? "bg-alice-soft text-alice-ink hover:brightness-[0.97]"
      : "bg-joseph-soft text-joseph-ink hover:brightness-[0.97]";

  return (
    <button
      type="submit"
      name="qui"
      value={value}
      className={`group flex h-[4.5rem] flex-col items-center justify-center gap-1 rounded-md font-semibold transition-[filter,transform] active:translate-y-px ${tone}`}
    >
      <span className="font-display text-lg">{label}</span>
      <span className="flex items-center gap-1 text-[0.6875rem] opacity-70 transition-transform group-hover:translate-x-0.5">
        Entrer <IconFleche size={13} />
      </span>
    </button>
  );
}

/** Deux halos très diffus, un par personne : la seule ornementation de la page. */
function AmbientBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div
        className="absolute -left-24 top-[12%] size-[26rem] rounded-full opacity-40 blur-[80px]"
        style={{ background: "var(--alice)" }}
      />
      <div
        className="absolute -right-24 bottom-[8%] size-[24rem] rounded-full opacity-35 blur-[80px]"
        style={{ background: "var(--joseph)" }}
      />
      <div
        className="absolute left-1/2 top-1/2 size-[18rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-[90px]"
        style={{ background: "var(--accent)" }}
      />
    </div>
  );
}
