import { Bloc, EnTeteSquelette, ListeSquelette } from "@/components/skeleton";

export default function Chargement() {
  return (
    <div className="animate-soften" role="status" aria-label="Chargement">
      <EnTeteSquelette />
      <Bloc className="mt-4 h-[58dvh] rounded-lg lg:h-[32rem]" />
      <Bloc className="mt-4 h-24 rounded-lg" />
      <ListeSquelette nombre={4} hauteur="h-16" />
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
