import { cx } from "@/components/ui";

/**
 * Les pages lisent la base à chaque visite, donc rien n'est pré-rendu. Ces
 * squelettes s'affichent immédiatement pendant ce temps : la navigation paraît
 * instantanée même quand la base met quelques centaines de millisecondes.
 *
 * Ils reprennent la géométrie réelle de chaque écran — un squelette qui ne
 * ressemble pas à la page qui arrive fait sursauter au moment de la bascule.
 */

export function Bloc({ className }: { className?: string }) {
  return <div className={cx("squelette", className)} aria-hidden />;
}

export function EnTeteSquelette() {
  return (
    <div className="flex items-center justify-between gap-4 py-3 lg:pb-2 lg:pt-10">
      <div className="flex-1">
        <Bloc className="h-6 w-40 lg:h-10 lg:w-64" />
        <Bloc className="mt-2 h-3.5 w-28 lg:mt-3 lg:w-40" />
      </div>
      <Bloc className="h-10 w-24 rounded-full" />
    </div>
  );
}

/** Une pile de cartes : le fil, les listes, les réglages. */
export function ListeSquelette({
  nombre = 4,
  hauteur = "h-32",
  className,
}: {
  nombre?: number;
  hauteur?: string;
  className?: string;
}) {
  return (
    <div className={cx("mt-6 flex flex-col gap-4", className)}>
      {Array.from({ length: nombre }, (_, index) => (
        <Bloc key={index} className={cx(hauteur, "rounded-lg")} />
      ))}
    </div>
  );
}

/** La grille dense de l'app Photos. */
export function GrilleSquelette({ nombre = 12 }: { nombre?: number }) {
  return (
    <div className="mt-6 grid grid-cols-3 gap-[3px] lg:grid-cols-5">
      {Array.from({ length: nombre }, (_, index) => (
        <Bloc key={index} className="aspect-square rounded-none" />
      ))}
    </div>
  );
}

export function PageSquelette({ children }: { children?: React.ReactNode }) {
  return (
    <div className="animate-soften" role="status" aria-label="Chargement">
      <EnTeteSquelette />
      {children ?? <ListeSquelette />}
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
