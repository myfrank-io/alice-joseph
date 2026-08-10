import { requireWho } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";

export default async function NousPage() {
  const who = await requireWho();
  return (
    <>
      <PageHeader title="Nous" subtitle="Provisoire" />
      <p className="mt-6 text-sm text-ink-2">Bonjour {who}.</p>
    </>
  );
}
