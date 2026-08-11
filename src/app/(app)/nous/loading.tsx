import { Bloc, EnTeteSquelette } from "@/components/skeleton";

export default function Chargement() {
  return (
    <div className="animate-soften" role="status" aria-label="Chargement">
      <EnTeteSquelette />
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Bloc className="aspect-[4/3] rounded-lg lg:col-span-3" />
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Bloc className="h-40 rounded-lg" />
          <div className="grid grid-cols-2 gap-3">
            <Bloc className="h-28 rounded-md" />
            <Bloc className="h-28 rounded-md" />
            <Bloc className="h-28 rounded-md" />
            <Bloc className="h-28 rounded-md" />
          </div>
        </div>
      </div>
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
