import Link from "next/link";
import { requireWho } from "@/lib/auth";
import { isPersistent } from "@/lib/data/store";
import { SideRail, TabBar } from "@/components/nav";
import { Avatar } from "@/components/ui";
import { whoLabel } from "@/lib/format";

/** Toutes les pages lisent des données à chaque visite : rien n'est mis en cache. */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const who = await requireWho();
  const persistent = isPersistent();

  return (
    <div className="min-h-dvh">
      <SideRail
        footer={
          <Link
            href="/reglages"
            className="flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-colors hover:bg-surface-2"
          >
            <Avatar who={who} size={30} />
            <span className="min-w-0">
              <span className="block truncate font-semibold text-ink">{whoLabel(who)}</span>
              <span className="block text-xs text-ink-3">Connectée·connecté</span>
            </span>
          </Link>
        }
      />

      <div className="lg:pl-[15.5rem]">
        {persistent ? null : <DemoNotice />}
        <div className="mx-auto w-full max-w-[72rem] px-4 pb-28 lg:px-10 lg:pb-16">
          {children}
        </div>
      </div>

      <TabBar />
    </div>
  );
}

function DemoNotice() {
  return (
    <p className="border-b border-line bg-surface-2 px-4 py-2 text-center text-xs text-ink-2 lg:px-10">
      Mode démonstration : le contenu est un exemple et les ajouts ne sont pas encore conservés.{" "}
      <Link href="/reglages" className="font-semibold text-accent-ink underline underline-offset-2">
        Brancher la sauvegarde
      </Link>
    </p>
  );
}
