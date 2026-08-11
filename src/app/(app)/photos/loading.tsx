import { Bloc, EnTeteSquelette, GrilleSquelette } from "@/components/skeleton";

export default function Chargement() {
  return (
    <div className="animate-soften" role="status" aria-label="Chargement">
      <EnTeteSquelette />
      <Bloc className="mt-4 h-11 rounded-full" />
      <GrilleSquelette nombre={15} />
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
