"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { retrouverLiens } from "@/app/(app)/musique/actions";
import { Button, cx } from "@/components/ui";
import { IconLien } from "@/components/icons";
import { plural } from "@/lib/format";

/**
 * Le rattrapage : retrouver, chez tous les services, les morceaux ajoutés quand
 * song.link ne répondait pas.
 *
 * Deux règles, imposées par le service : une dizaine de recherches par minute,
 * pas plus. On espace donc de sept secondes, et on s'arrête à dix morceaux par
 * lot — en disant à l'écran combien il en reste. Rien ne part tout seul : c'est
 * toujours quelqu'un qui appuie.
 */

/** Sept secondes entre deux appels : dix par minute, la limite annoncée. */
const PAUSE_MS = 7000;

/** Dix morceaux par lot : un peu plus d'une minute, et on reprend la main. */
export const TAILLE_LOT = 10;

function attendre(ms: number): Promise<void> {
  return new Promise((resoudre) => setTimeout(resoudre, ms));
}

/* ---------------------------- Un seul morceau ----------------------------- */

/**
 * Le bouton d'un morceau, dans son menu. Un appel, un seul, à la demande.
 */
export function BoutonRetrouverLiens({
  trackId,
  onFini,
}: {
  trackId: string;
  /** Appelé quand la recherche a abouti : le menu peut se refermer. */
  onFini?: () => void;
}) {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-ink-2">
        On demande à song.link où se trouve ce morceau chez les autres services. Un seul appel,
        gardé pour toujours.
      </p>

      <Button
        type="button"
        variant="soft"
        size="md"
        disabled={enCours}
        className="h-11 self-start"
        onClick={() => {
          setMessage(null);
          demarrer(async () => {
            const resultat = await retrouverLiens(trackId);
            if (resultat.ok) {
              const trouves = resultat.trouves ?? 0;
              setMessage({
                ok: true,
                texte:
                  trouves > 0
                    ? `Trouvé sur ${trouves} ${plural(trouves, "service", "services")}.`
                    : "Trouvé, mais sur aucun service connu : reste la page song.link.",
              });
              onFini?.();
            } else {
              setMessage({ ok: false, texte: resultat.erreur ?? "Rien trouvé." });
            }
          });
        }}
      >
        <IconLien size={16} />
        {enCours ? "On cherche…" : "Retrouver les liens"}
      </Button>

      {message ? (
        <p
          role="status"
          className={cx(
            "rounded-sm px-3 py-2.5 text-sm leading-snug",
            message.ok ? "bg-accent-soft text-accent-ink" : "bg-bad-soft text-bad",
          )}
        >
          {message.texte}
        </p>
      ) : null}
    </div>
  );
}

/* --------------------------- Toute la bibliothèque ------------------------ */

export interface MorceauAResoudre {
  id: string;
  title: string;
}

/**
 * Le bandeau de rattrapage. Il n'apparaît que s'il y a vraiment quelque chose à
 * rattraper — un morceau dont le lien est reconnu mais dont les équivalents
 * manquent. Les morceaux d'exemple, qui ne pointent nulle part, ne comptent pas.
 */
export function BandeauRetrouverLiens({ candidats }: { candidats: MorceauAResoudre[] }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [fait, setFait] = useState(0);
  const [total, setTotal] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [bilan, setBilan] = useState<string | null>(null);
  const arret = useRef(false);

  if (candidats.length === 0) return null;

  const lancer = async () => {
    const lot = candidats.slice(0, TAILLE_LOT);
    arret.current = false;
    setEnCours(true);
    setErreur(null);
    setBilan(null);
    setFait(0);
    setTotal(lot.length);

    let reussis = 0;
    let dernierEchec: string | null = null;

    for (let index = 0; index < lot.length; index += 1) {
      if (arret.current) break;
      // Sept secondes entre deux appels, jamais avant le premier.
      if (index > 0) await attendre(PAUSE_MS);
      if (arret.current) break;

      const resultat = await retrouverLiens(lot[index].id, true);
      setFait(index + 1);

      if (resultat.ok) {
        reussis += 1;
      } else {
        dernierEchec = resultat.erreur ?? "Recherche impossible.";
        // Limite atteinte : insister ne ferait qu’empirer les choses.
        if (resultat.limite) {
          setErreur(dernierEchec);
          break;
        }
      }
    }

    const restants = candidats.length - reussis;
    setBilan(
      `${reussis} ${plural(reussis, "morceau retrouvé", "morceaux retrouvés")}` +
        (restants > 0
          ? ` · ${restants} en attente${dernierEchec && !arret.current ? ` — ${dernierEchec}` : ""}`
          : " · la bibliothèque est complète."),
    );
    setEnCours(false);
    arret.current = false;
    router.refresh();
  };

  const reste = candidats.length - Math.min(candidats.length, TAILLE_LOT);

  return (
    <section
      aria-label="Morceaux sans liens partagés"
      className="rounded-lg border border-dashed border-line-strong bg-surface-2/50 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[1.0625rem] leading-snug text-ink">
            {candidats.length === 1
              ? "Un morceau n’a pas encore ses liens"
              : `${candidats.length} morceaux n’ont pas encore leurs liens`}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">
            Personne n’est encore allé voir chez les autres services, ou song.link n’avait pas
            répondu ce jour-là. Sans ces liens, le bouton « Écouter sur… » renvoie au service
            d’origine. On réessaie par lots de {TAILLE_LOT}, sept secondes entre chaque : c’est la
            limite du service.
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          {enCours ? (
            <Button
              type="button"
              variant="ghost"
              size="md"
              className="h-11"
              onClick={() => {
                arret.current = true;
              }}
            >
              Arrêter
            </Button>
          ) : null}
          <Button
            type="button"
            variant="soft"
            size="md"
            className="h-11"
            disabled={enCours}
            onClick={() => {
              void lancer();
            }}
          >
            <IconLien size={16} />
            {enCours ? "En cours…" : "Retrouver les liens"}
          </Button>
        </div>
      </div>

      {enCours ? (
        <p role="status" className="mt-3 text-sm text-ink-2">
          {fait} sur {total}
          {reste > 0 ? ` · ${reste} ${plural(reste, "morceau", "morceaux")} après ce lot` : ""}
          {" · "}environ sept secondes entre chaque.
        </p>
      ) : null}

      {erreur ? (
        <p role="alert" className="mt-3 rounded-sm bg-bad-soft px-3 py-2.5 text-sm leading-snug text-bad">
          {erreur}
        </p>
      ) : null}

      {bilan && !enCours ? (
        <p role="status" className="mt-3 text-sm text-ink-2">
          {bilan}
        </p>
      ) : null}
    </section>
  );
}
