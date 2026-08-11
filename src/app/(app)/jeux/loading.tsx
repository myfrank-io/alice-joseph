import { Bloc, EnTeteSquelette } from "@/components/skeleton";

export default function Chargement() {
  return (
    <div className="animate-soften" role="status" aria-label="Chargement">
      <EnTeteSquelette />
      <div className="mt-6 flex flex-col gap-4">
        <Bloc className="h-48 rounded-lg" />
        <Bloc className="h-48 rounded-lg" />
        <Bloc className="h-28 rounded-lg" />
      </div>
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
