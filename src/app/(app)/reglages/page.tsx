import type { Metadata } from "next";
import { requireWho } from "@/lib/auth";
import { usingDefaultPasscode } from "@/lib/auth-token";
import { get, hasBlobStorage, isPersistent } from "@/lib/data/store";
import type { Settings } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, Button, Card, Field, Input, cx } from "@/components/ui";
import { IconSortie, IconValider } from "@/components/icons";
import { whoLabel } from "@/lib/format";
import { enregistrerReglages, seDeconnecter } from "./actions";

export const metadata: Metadata = { title: "Réglages" };

export default async function ReglagesPage() {
  const who = await requireWho();
  const reglages = await get<Settings>("settings", "settings");

  const baseOk = isPersistent();
  const blobOk = hasBlobStorage();

  return (
    <>
      <PageHeader title="Réglages" subtitle="Ce qui règle la plateforme" />

      <div className="mx-auto mt-6 flex max-w-[42rem] flex-col gap-4">
        {/* ------------------------------- Identité ------------------------------ */}
        <Card className="flex items-center gap-4 p-5">
          <Avatar who={who} size={48} ring />
          <div className="min-w-0 flex-1">
            <p className="font-display text-heading text-ink">{whoLabel(who)}</p>
            <p className="text-sm text-ink-3">C&apos;est toi qui es connecté sur cet appareil.</p>
          </div>
          <form action={seDeconnecter}>
            <Button type="submit" variant="ghost" size="sm">
              <IconSortie size={16} />
              Sortir
            </Button>
          </form>
        </Card>

        {/* ------------------------------ Apparence ------------------------------ */}
        <Card className="p-5">
          <h2 className="font-display text-heading text-ink">Apparence</h2>
          <p className="mb-4 mt-1 text-sm text-ink-2">
            Le mode clair est pensé pour la journée, la chambre noire pour le soir.
          </p>
          <ThemeToggle />
        </Card>

        {/* --------------------------------- Nous -------------------------------- */}
        <Card className="p-5">
          <h2 className="font-display text-heading text-ink">Nous</h2>
          <p className="mb-4 mt-1 text-sm text-ink-2">
            Le prénom affiché et la date depuis laquelle on compte les jours.
          </p>

          <form action={enregistrerReglages} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Elle s’appelle">
                <Input name="aliceLabel" defaultValue={reglages?.aliceLabel ?? "Alice"} maxLength={40} />
              </Field>
              <Field label="Il s’appelle">
                <Input name="josephLabel" defaultValue={reglages?.josephLabel ?? "Joseph"} maxLength={40} />
              </Field>
            </div>
            <Field label="Ensemble depuis" hint="Sert au compteur de jours sur la page d’accueil.">
              <Input type="date" name="since" defaultValue={reglages?.since ?? ""} />
            </Field>
            <div>
              <Button type="submit" size="sm">
                <IconValider size={16} />
                Enregistrer
              </Button>
            </div>
          </form>
        </Card>

        {/* ------------------------------ Sauvegarde ----------------------------- */}
        <Card className="p-5" id="brancher">
          <h2 className="font-display text-heading text-ink">Sauvegarde</h2>
          <p className="mb-4 mt-1 text-sm leading-relaxed text-ink-2">
            {baseOk
              ? "Tout ce que vous ajoutez est conservé."
              : "La plateforme tourne avec un contenu d’exemple. Deux branchements sur Vercel, et elle devient la vôtre pour de bon."}
          </p>

          <div className="mb-5 grid gap-2 sm:grid-cols-2">
            <Statut ok={baseOk} titre="Base de données" detail={baseOk ? "Postgres connecté" : "Non connectée"} />
            <Statut ok={blobOk} titre="Stockage des photos" detail={blobOk ? "Vercel Blob connecté" : "Non connecté"} />
          </div>

          {baseOk && blobOk ? null : (
            <ol className="flex flex-col gap-3 text-sm leading-relaxed text-ink-2">
              <Etape numero={1} fait={baseOk}>
                Sur <strong className="font-semibold text-ink">vercel.com</strong>, ouvrez le
                projet, onglet <strong className="font-semibold text-ink">Storage</strong>, puis{" "}
                <strong className="font-semibold text-ink">Create Database → Neon (Postgres)</strong>.
                Acceptez le plan gratuit et reliez-la au projet : la variable{" "}
                <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">DATABASE_URL</code>{" "}
                s’ajoute toute seule.
              </Etape>
              <Etape numero={2} fait={blobOk}>
                Toujours dans <strong className="font-semibold text-ink">Storage</strong>, créez un{" "}
                <strong className="font-semibold text-ink">Blob store</strong>. La variable{" "}
                <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">
                  BLOB_READ_WRITE_TOKEN
                </code>{" "}
                s’ajoute aussi toute seule. C’est elle qui permet de garder les photos.
              </Etape>
              <Etape numero={3} fait={false}>
                Onglet <strong className="font-semibold text-ink">Deployments</strong>, sur le
                dernier déploiement : <strong className="font-semibold text-ink">Redeploy</strong>.
                Au premier chargement, la plateforme crée ses tables et installe le contenu
                d’exemple, que vous pourrez remplacer par le vôtre.
              </Etape>
            </ol>
          )}
        </Card>

        {/* -------------------------------- Le code ------------------------------ */}
        <Card className="p-5">
          <h2 className="font-display text-heading text-ink">Le code d’entrée</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">
            {usingDefaultPasscode() ? (
              <>
                Le code est encore celui d’origine. Pour le changer, ajoutez dans Vercel →{" "}
                <strong className="font-semibold text-ink">Settings → Environment Variables</strong>{" "}
                une variable{" "}
                <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">APP_PASSCODE</code>{" "}
                avec le code de votre choix, et une variable{" "}
                <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">AUTH_SECRET</code>{" "}
                avec une longue suite de caractères au hasard. Puis redéployez.
              </>
            ) : (
              <>
                Un code personnalisé est en place. Pour le modifier, changez la variable{" "}
                <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">APP_PASSCODE</code>{" "}
                dans Vercel, puis redéployez.
              </>
            )}
          </p>
        </Card>
      </div>
    </>
  );
}

function Statut({ ok, titre, detail }: { ok: boolean; titre: string; detail: string }) {
  return (
    <div
      className={cx(
        "flex items-center gap-3 rounded-sm border px-3.5 py-3",
        ok ? "border-transparent bg-accent-soft" : "border-line bg-surface-2",
      )}
    >
      <span
        className={cx("size-2.5 shrink-0 rounded-full", ok ? "bg-accent" : "bg-ink-3")}
        aria-hidden
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{titre}</span>
        <span className={cx("block text-xs", ok ? "text-accent-ink" : "text-ink-3")}>{detail}</span>
      </span>
    </div>
  );
}

function Etape({
  numero,
  fait,
  children,
}: {
  numero: number;
  fait: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={cx(
          "tabular grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold",
          fait ? "bg-accent text-accent-on" : "bg-surface-2 text-ink-2",
        )}
      >
        {fait ? <IconValider size={13} /> : numero}
      </span>
      <span className={cx("min-w-0 flex-1", fait && "text-ink-3 line-through decoration-1")}>
        {children}
      </span>
    </li>
  );
}
