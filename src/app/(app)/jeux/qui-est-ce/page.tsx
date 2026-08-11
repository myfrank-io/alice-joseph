import { requireWho } from "@/lib/auth";
import { listMany } from "@/lib/data/store";
import type { Doc, Person } from "@/lib/types";
import { estQuiEstCe } from "@/lib/jeux/parties";
import { erreursDe, scoreQuiEstCe, type QuiEstCeManche } from "@/lib/jeux/qui-est-ce";
import type { MancheVue, PersonneVue } from "@/lib/jeux/types";
import { PageHeader } from "@/components/page-header";
import { QuiEstCe } from "@/components/jeux/qui-est-ce";
import { GestionPaquet } from "@/components/jeux/paquet";
import { plural } from "@/lib/format";

/**
 * Le « qui est-ce ? ».
 *
 * La page lit le paquet et les manches, puis n'envoie au navigateur que ce qu'il
 * a le droit de savoir : `secretPersonId` reste nul tant que la manche court,
 * sans quoi le mode défi n'aurait plus aucun sens — l'inspecteur du navigateur
 * donnerait la réponse en deux clics.
 *
 * Depuis que le tirage au sort se joue entièrement dans le navigateur, les
 * seules manches en cours qui vivent ici sont les défis : celles dont la réponse
 * a été choisie par l'autre et ne doit pas descendre. Le paquet, lui, part une
 * seule fois avec la page — c'est tout ce dont le jeu a besoin ensuite.
 */

function vueManche(manche: QuiEstCeManche): MancheVue {
  return {
    id: manche.id,
    player: manche.player,
    setBy: manche.setBy,
    status: manche.status,
    questionsAsked: manche.questionsAsked,
    erreurs: erreursDe(manche),
    eliminated: manche.eliminated,
    etapes: manche.etapes ?? [],
    secretPersonId: manche.status === "en-cours" ? null : manche.secretPersonId,
  };
}

export default async function QuiEstCePage() {
  const who = await requireWho();

  const donnees = await listMany(["people", "games"]);
  const manches = (donnees.games as Doc[]).filter(estQuiEstCe);

  // Le plateau se lit mieux dans un ordre stable : l'alphabet fait l'affaire.
  const paquet: PersonneVue[] = [...(donnees.people as Person[])].sort((a, b) =>
    a.name.localeCompare(b.name, "fr"),
  );

  const mesManches = manches.filter((manche) => manche.player === who);
  /** Un défi posé par l'autre et pas encore relevé : la seule manche encore arbitrée ici. */
  const defi = mesManches.find((manche) => manche.status === "en-cours") ?? null;
  /** La dernière finie, pour que le récapitulatif ait le temps d'être lu. */
  const derniere = mesManches.find((manche) => manche.status !== "en-cours") ?? null;

  const historique = manches
    .filter((manche) => manche.status !== "en-cours")
    .slice(0, 6)
    .map(vueManche);

  const scores = {
    alice: scoreQuiEstCe(manches.filter((manche) => manche.player === "alice")),
    joseph: scoreQuiEstCe(manches.filter((manche) => manche.player === "joseph")),
  };

  const finies = scores.alice.jouees + scores.joseph.jouees;

  return (
    <>
      <PageHeader
        title="Qui est-ce ?"
        subtitle={
          finies === 0
            ? `${paquet.length} ${plural(paquet.length, "visage", "visages")} dans le paquet`
            : `${paquet.length} ${plural(paquet.length, "visage", "visages")} · ${finies} ${plural(finies, "manche jouée", "manches jouées")}`
        }
        back={{ href: "/jeux", label: "Retour aux jeux" }}
      />

      <QuiEstCe
        who={who}
        paquet={paquet}
        defi={defi ? vueManche(defi) : null}
        derniere={derniere ? vueManche(derniere) : null}
        historique={historique}
        scores={scores}
        autreEnCours={manches.some(
          (manche) => manche.player !== who && manche.status === "en-cours",
        )}
      />

      <div className="mt-12">
        <GestionPaquet paquet={paquet} />
      </div>
    </>
  );
}
