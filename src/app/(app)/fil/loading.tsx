import { Bloc, EnTeteSquelette } from "@/components/skeleton";

export default function Chargement() {
  return (
    <div className="mx-auto max-w-[38rem] animate-soften" role="status" aria-label="Chargement">
      <EnTeteSquelette />
      <Bloc className="mt-5 h-14 rounded-lg" />
      <div className="mt-6 flex flex-col gap-4">
        <Bloc className="h-40 rounded-lg" />
        <Bloc className="h-56 rounded-lg" />
        <Bloc className="h-32 rounded-lg" />
      </div>
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
