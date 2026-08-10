"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import type { Who } from "@/lib/types";
import type { ReponseSync, ReponseTest } from "@/lib/icloud";
import { Avatar, Button, Chip, Field, Input, Spinner, cx } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { IconLien } from "@/components/icons";
import { formatAgo, plural, whoLabel } from "@/lib/format";
import {
  connecterSource,
  deconnecterSource,
  synchroniserSource,
  testerSource,
} from "@/app/(app)/photos/icloud-actions";

/**
 * Les albums partagés iCloud, dans un panneau ouvert depuis l'en-tête.
 *
 * Pourquoi une `Sheet` plutôt qu'une quatrième vue `?vue=sources` : les trois
 * segments existants sont trois façons de *regarder* les photos — grille,
 * moments, albums. Un branchement n'est pas une façon de regarder ; le glisser
 * dans le même sélecteur mélangerait deux natures, et rétrécirait les segments
 * sur un écran de téléphone. Le panneau, lui, se referme sur la galerie, qui est
 * précisément là où l'on veut être après une synchronisation.
 *
 * Le jeton de l'album ne descend jamais jusqu'ici : la page n'envoie que ce qui
 * s'affiche. Et aucune action ne prend d'identifiant — le serveur agit toujours
 * sur la source de la personne connectée, jamais sur celle de l'autre.
 */

export interface VueSource {
  who: Who;
  albumName?: string;
  lastSyncAt?: string;
  lastError?: string;
  importedCount: number;
}

type Message = { ton: "bon" | "mauvais"; texte: string } | null;

/** Guillemets français avec leurs espaces insécables, sans y penser à chaque fois. */
function guillemets(texte: string): string {
  return `\u00ab\u00a0${texte}\u00a0\u00bb`;
}

export function BoutonSourcesICloud({
  who,
  sources,
  stockagePret,
}: {
  who: Who;
  sources: VueSource[];
  stockagePret: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);

  const autre: Who = who === "alice" ? "joseph" : "alice";
  const mienne = sources.find((source) => source.who === who) ?? null;
  const sienne = sources.find((source) => source.who === autre) ?? null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-label="Albums partagés iCloud"
        title="Albums partagés iCloud"
        className="relative grid size-11 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <IconLien size={19} />
        {mienne?.lastError ? (
          <span
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 size-2 rounded-full bg-bad ring-2 ring-ground"
          />
        ) : null}
      </button>

      <Sheet
        open={ouvert}
        onClose={() => setOuvert(false)}
        size="lg"
        title="Sources"
        description="Chacun branche son album partagé iCloud une fois. Ensuite, les nouvelles photos arrivent à chaque synchronisation."
      >
        <div className="flex flex-col gap-4">
          {stockagePret ? null : <SansStockage />}

          <CarteSource personne={who} source={mienne} amoi stockagePret={stockagePret} />
          <CarteSource personne={autre} source={sienne} amoi={false} stockagePret={stockagePret} />

          <ModeDEmploi />
        </div>
      </Sheet>
    </>
  );
}

/* ------------------------------ Sans stockage ------------------------------ */

function SansStockage() {
  return (
    <div className="rounded-md border border-line bg-surface-2 px-4 py-3.5">
      <p className="text-sm font-semibold text-warn">L’import est impossible pour l’instant</p>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-2">
        Les adresses que donne Apple expirent au bout d’une heure&nbsp;: sans stockage à nous,
        la photothèque serait vide dès ce soir. Ajoute la variable{" "}
        <code className="rounded bg-surface px-1.5 py-0.5 text-xs">BLOB_READ_WRITE_TOKEN</code>{" "}
        sur Vercel (Storage → Blob store), redéploie, et la synchronisation s’ouvrira. Tester la
        connexion reste possible dès maintenant.
      </p>
    </div>
  );
}

/* -------------------------------- Une carte -------------------------------- */

function CarteSource({
  personne,
  source,
  amoi,
  stockagePret,
}: {
  personne: Who;
  source: VueSource | null;
  amoi: boolean;
  stockagePret: boolean;
}) {
  const [lien, setLien] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [confirme, setConfirme] = useState(false);
  const [enCours, demarrer] = useTransition();

  function connecter(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setMessage(null);
    demarrer(async () => {
      const donnees = new FormData();
      donnees.set("lien", lien);
      const reponse = await connecterSource(donnees);
      if (reponse.ok) {
        setLien("");
        setMessage({
          ton: "bon",
          texte:
            `Album ${guillemets(reponse.albumName)} reconnu\u00a0: ${reponse.photos} ` +
            `${plural(reponse.photos, "photo", "photos")}. ` +
            "Lance la synchronisation pour les importer.",
        });
      } else {
        setMessage({ ton: "mauvais", texte: reponse.erreur });
      }
    });
  }

  function tester() {
    setMessage(null);
    demarrer(async () => {
      const reponse: ReponseTest = await testerSource();
      setMessage(
        reponse.ok
          ? {
              ton: "bon",
              texte:
                `Album ${guillemets(reponse.albumName)}\u00a0: ${reponse.photos} ` +
                `${plural(reponse.photos, "photo", "photos")} chez Apple, ` +
                (reponse.nouvelles === 0
                  ? "aucune nouvelle."
                  : `${reponse.nouvelles} ${plural(reponse.nouvelles, "nouvelle", "nouvelles")}.`),
            }
          : { ton: "mauvais", texte: reponse.erreur },
      );
    });
  }

  function synchroniser() {
    setMessage(null);
    demarrer(async () => {
      const reponse: ReponseSync = await synchroniserSource();
      setMessage(
        reponse.ok
          ? { ton: "bon", texte: resumeSync(reponse) }
          : { ton: "mauvais", texte: reponse.erreur },
      );
    });
  }

  function deconnecter() {
    setMessage(null);
    demarrer(async () => {
      const reponse = await deconnecterSource();
      setConfirme(false);
      setMessage(
        reponse.ok
          ? {
              ton: "bon",
              texte: "Album déconnecté. Les photos déjà importées restent dans la photothèque.",
            }
          : { ton: "mauvais", texte: reponse.erreur },
      );
    });
  }

  return (
    <section className="rounded-md border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <Avatar who={personne} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-heading text-ink">
            {whoLabel(personne)}
            {amoi ? <span className="ml-1.5 text-sm font-normal text-ink-3">· toi</span> : null}
          </p>
          {source ? (
            <p className="mt-0.5 truncate text-[0.8125rem] text-ink-3">
              {source.albumName ?? "Album partagé"}
            </p>
          ) : null}
        </div>
        <Chip tone={source ? "accent" : "neutre"}>{source ? "Connecté" : "Pas connecté"}</Chip>
      </div>

      {source ? (
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-2">
          {source.importedCount} {plural(source.importedCount, "photo importée", "photos importées")}
          {" · "}
          {source.lastSyncAt
            ? `synchronisé ${formatAgo(source.lastSyncAt)}`
            : "jamais synchronisé"}
        </p>
      ) : null}

      {source?.lastError ? (
        <p className="mt-2 rounded-sm bg-bad-soft px-3 py-2 text-[0.8125rem] leading-relaxed text-bad">
          {source.lastError}
        </p>
      ) : null}

      {/* ------------------------- Ce que je peux faire ------------------------ */}

      {amoi && !source ? (
        <form onSubmit={connecter} className="mt-4 flex flex-col gap-3">
          <Field
            label="Le lien public de ton album"
            hint="Les deux formes conviennent : www.icloud.com/sharedalbum/#… ou share.icloud.com/photos/…"
          >
            <Input
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={lien}
              onChange={(evenement) => setLien(evenement.target.value)}
              placeholder="https://www.icloud.com/sharedalbum/#B0…"
            />
          </Field>
          <div>
            <Button type="submit" className="min-h-11" disabled={enCours || lien.trim() === ""}>
              {enCours ? <Spinner /> : null}
              {enCours ? "On vérifie…" : "Connecter"}
            </Button>
          </div>
        </form>
      ) : null}

      {amoi && source ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={synchroniser} className="min-h-11" disabled={enCours || !stockagePret}>
            {enCours ? <Spinner /> : null}
            Synchroniser
          </Button>
          <Button variant="soft" onClick={tester} className="min-h-11" disabled={enCours}>
            Tester la connexion
          </Button>
          {confirme ? (
            <>
              <Button variant="danger" onClick={deconnecter} className="min-h-11" disabled={enCours}>
                Confirmer
              </Button>
              <Button variant="ghost" onClick={() => setConfirme(false)} className="min-h-11">
                Annuler
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setConfirme(true)}
              className="min-h-11"
              disabled={enCours}
            >
              Déconnecter
            </Button>
          )}
        </div>
      ) : null}

      {!amoi ? (
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-3">
          {source
            ? `Cet album est branché par ${whoLabel(personne)}. Ses photos arrivent dans la photothèque comme les tiennes.`
            : `Seul${personne === "alice" ? "e" : ""} ${whoLabel(personne)} peut brancher son album partagé, depuis son propre écran.`}
        </p>
      ) : null}

      {message ? (
        <p
          className={cx(
            "mt-3 text-[0.8125rem] leading-relaxed",
            message.ton === "bon" ? "text-accent-ink" : "text-bad",
          )}
          role="status"
        >
          {message.texte}
        </p>
      ) : null}
    </section>
  );
}

/** « 18 photos importées. Il en reste 42 : relance la synchronisation. » */
function resumeSync(reponse: Extract<ReponseSync, { ok: true }>): string {
  const morceaux: string[] = [];

  morceaux.push(
    reponse.importees === 0
      ? "Rien de nouveau à importer."
      : `${reponse.importees} ${plural(reponse.importees, "photo importée", "photos importées")}.`,
  );

  if (reponse.restantes > 0) {
    morceaux.push(
      `Il en reste ${reponse.restantes} : relance la synchronisation pour continuer.`,
    );
  }
  if (reponse.ignorees > 0) {
    morceaux.push(
      `${reponse.ignorees} ${plural(reponse.ignorees, "vidéo laissée", "vidéos laissées")} de côté.`,
    );
  }

  return morceaux.join(" ");
}

/* ------------------------------ Mode d’emploi ------------------------------ */

function ModeDEmploi() {
  return (
    <div className="rounded-md border border-dashed border-line-strong px-4 py-3.5">
      <h3 className="font-display text-heading text-ink">Créer le lien, sur iPhone</h3>
      <ol className="mt-2 flex flex-col gap-1.5 text-[0.8125rem] leading-relaxed text-ink-2">
        <Etape numero={1}>
          <strong className="font-semibold text-ink">Photos → Albums → +</strong> →{" "}
          <strong className="font-semibold text-ink">Nouvel album partagé</strong>.
        </Etape>
        <Etape numero={2}>
          Ouvre l’album, puis l’onglet <strong className="font-semibold text-ink">Personnes</strong>.
        </Etape>
        <Etape numero={3}>
          Active <strong className="font-semibold text-ink">Site web public</strong>.
        </Etape>
        <Etape numero={4}>Copie le lien qui apparaît, et colle-le ici.</Etape>
      </ol>
      <p className="mt-3 text-xs leading-relaxed text-ink-3">
        Tout ce que tu ajoutes ensuite à cet album depuis ton iPhone entrera ici à la
        synchronisation suivante. Les photos sont recopiées chez nous&nbsp;: elles restent visibles
        même si l’album iCloud disparaît.
      </p>
    </div>
  );
}

function Etape({ numero, children }: { numero: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="tabular grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[0.6875rem] font-bold text-ink-2">
        {numero}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}
