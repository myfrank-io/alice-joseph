"use client";

import { useMemo, useState } from "react";
import { Button, cx } from "@/components/ui";
import { IconLien, IconValider } from "@/components/icons";
import { plural } from "@/lib/format";
import { PLATEFORMES, estLienSur, liensDe, nomPlateforme } from "@/lib/musique";
import type { Plateforme, Track } from "@/lib/types";

/**
 * Une playlist, des deux côtés.
 *
 * Créer une vraie playlist chez Spotify ou Deezer demande de se connecter à
 * leur compte — un OAuth, un secret d'application, un serveur qui garde des
 * jetons. On ne le fait pas, et on le dit : ici personne ne se connecte à rien.
 *
 * Ce qu'on fait à la place tient en un geste : la liste des liens du service
 * choisi, dans le presse-papier. Collée dans la recherche de l'application, un
 * lien après l'autre, elle remplit la playlist aussi vite qu'à la main — sans
 * jamais chercher un titre.
 */

/** Une clé de plus que les plateformes : la page universelle song.link. */
type Choix = Plateforme | "songlink";

interface Colonne {
  cle: Choix;
  nom: string;
  liens: string[];
  /** Les morceaux qui n'ont rien pour ce service : on les nomme, sans les cacher. */
  manquants: string[];
}

async function copier(texte: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texte);
      return true;
    }
  } catch {
    // Presse-papier refusé (page non sécurisée, permission) : on tente le repli.
  }

  try {
    const zone = document.createElement("textarea");
    zone.value = texte;
    zone.setAttribute("readonly", "");
    zone.style.position = "fixed";
    zone.style.top = "0";
    zone.style.opacity = "0";
    document.body.appendChild(zone);
    zone.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(zone);
    return ok;
  } catch {
    return false;
  }
}

export function PartagerPlaylist({
  titre,
  morceaux,
  plateforme,
  plateformeAutre,
}: {
  titre: string;
  morceaux: Track[];
  /** Le service de la personne connectée : son bouton passe devant. */
  plateforme?: Plateforme;
  /** Celui de l'autre : quand les deux sont connus, on s'en tient à ces deux-là. */
  plateformeAutre?: Plateforme;
}) {
  const [copie, setCopie] = useState<Choix | null>(null);
  const [repli, setRepli] = useState<string | null>(null);

  const colonnes = useMemo<Colonne[]>(() => {
    // Quand chacun a dit sur quoi il écoute, deux boutons suffisent. Sinon on
    // propose tout, plutôt que de deviner.
    const declarees =
      plateforme && plateformeAutre
        ? [...new Set<Plateforme>([plateforme, plateformeAutre])]
        : [
            ...(plateforme ? [plateforme] : []),
            ...PLATEFORMES.filter((p) => p !== plateforme),
          ];
    const ordre: Choix[] = [...declarees, "songlink"];

    return ordre
      .map((cle) => {
        const liens: string[] = [];
        const manquants: string[] = [];

        for (const morceau of morceaux) {
          const url =
            cle === "songlink"
              ? estLienSur(morceau.pageUrl)
                ? morceau.pageUrl.trim()
                : undefined
              : liensDe(morceau)[cle];
          if (url) liens.push(url);
          else manquants.push(morceau.title);
        }

        return {
          cle,
          nom: cle === "songlink" ? "song.link" : nomPlateforme(cle),
          liens,
          manquants,
        };
      })
      .filter((colonne) => colonne.liens.length > 0);
  }, [morceaux, plateforme, plateformeAutre]);

  if (morceaux.length === 0) return null;

  const active = copie ? colonnes.find((colonne) => colonne.cle === copie) : undefined;

  return (
    <section aria-label="Emporter cette playlist ailleurs" className="rounded-lg border border-line bg-surface p-4 shadow-[var(--shadow-sm)] sm:p-5">
      <h2 className="font-display text-heading text-ink">Emporter cette playlist</h2>

      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Créer la playlist « {titre} » directement dans Spotify ou Deezer demanderait de connecter
        ton compte chez eux. On ne le fait pas : ici, personne ne se connecte à rien. À la place,
        voilà les liens, prêts à coller un par un dans la recherche de ton application.
      </p>

      {colonnes.length === 0 ? (
        <p className="mt-3 rounded-sm bg-surface-2 px-3 py-2.5 text-sm leading-relaxed text-ink-2">
          Aucun morceau de cette playlist n’a encore de lien partageable. Depuis la page Musique,
          « Retrouver les liens » va les chercher chez song.link.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {colonnes.map((colonne) => {
              const fait = copie === colonne.cle && repli === null;
              return (
                <Button
                  key={colonne.cle}
                  type="button"
                  variant={fait ? "soft" : colonne.cle === plateforme ? "primary" : "outline"}
                  size="md"
                  className="h-11"
                  onClick={() => {
                    void (async () => {
                      const texte = colonne.liens.join("\n");
                      const ok = await copier(texte);
                      setCopie(colonne.cle);
                      setRepli(ok ? null : texte);
                    })();
                  }}
                >
                  {fait ? <IconValider size={16} /> : <IconLien size={16} />}
                  {fait ? "Copié" : `Copier les liens pour ${colonne.nom}`}
                  <span className="font-normal text-[0.8125rem] opacity-70">
                    {colonne.liens.length}/{morceaux.length}
                  </span>
                </Button>
              );
            })}
          </div>

          {active && repli === null ? (
            <p role="status" className="mt-3 text-sm leading-relaxed text-ink-2">
              {active.liens.length} {plural(active.liens.length, "lien", "liens")} dans le
              presse-papier. Ouvre {active.nom}, colle dans la recherche, ajoute à la playlist, et
              recommence pour le suivant.
              {active.manquants.length > 0 ? (
                <>
                  {" "}
                  <span className="text-ink-3">
                    Sans lien {active.nom} : {active.manquants.slice(0, 3).join(", ")}
                    {active.manquants.length > 3
                      ? ` et ${active.manquants.length - 3} ${plural(active.manquants.length - 3, "autre", "autres")}`
                      : ""}
                    .
                  </span>
                </>
              ) : null}
            </p>
          ) : null}

          {repli !== null ? (
            <div className="mt-3 flex flex-col gap-2">
              <p role="alert" className="text-sm leading-relaxed text-bad">
                Ton navigateur n’a pas laissé écrire dans le presse-papier. Les liens sont
                ci-dessous : sélectionne-les et copie-les à la main.
              </p>
              <textarea
                readOnly
                rows={Math.min(8, Math.max(2, repli.split("\n").length))}
                value={repli}
                aria-label="Les liens à copier"
                onFocus={(evenement) => evenement.currentTarget.select()}
                className={cx(
                  "w-full rounded-sm border border-line bg-surface-2 px-3 py-2.5",
                  "font-mono text-xs leading-relaxed text-ink-2",
                  "focus-visible:shadow-[var(--ring)]",
                )}
              />
            </div>
          ) : null}
        </>
      )}

      {colonnes.some((colonne) => colonne.cle === "songlink") ? (
        <p className="mt-3 text-xs leading-relaxed text-ink-3">
          Un lien song.link s’ouvre chez n’importe qui : c’est celui-là qu’on envoie à quelqu’un
          dont on ignore le service.
        </p>
      ) : null}
    </section>
  );
}
