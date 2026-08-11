import { Bloc, EnTeteSquelette, ListeSquelette } from "@/components/skeleton";

export default function Chargement() {
  return (
    <div className="animate-soften" role="status" aria-label="Chargement">
      <EnTeteSquelette />
      <Bloc className="mt-4 h-44 rounded-lg" />
      <div className="mt-8 flex gap-3 overflow-hidden">
        <Bloc className="h-32 w-32 shrink-0 rounded-md" />
        <Bloc className="h-32 w-32 shrink-0 rounded-md" />
        <Bloc className="h-32 w-32 shrink-0 rounded-md" />
      </div>
      <ListeSquelette nombre={4} hauteur="h-28" />
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
