"use client";

import { useActionState, useEffect, useId, useState, useTransition } from "react";
import { creerPersonne, modifierPersonne, supprimerPersonne } from "@/app/(app)/jeux/actions";
import { FORMULAIRE_VIDE, type PersonneVue } from "@/lib/jeux/types";
import type { Circle, HairColor, PersonTraits, WhoOrBoth } from "@/lib/types";
import { Button, EmptyState, Field, Input, Select, cx } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { ImagePicker } from "@/components/image-picker";
import { IconCorbeille, IconCrayon, IconPlus } from "@/components/icons";
import { plural } from "@/lib/format";

/**
 * Le paquet : les visages que le jeu tire au sort et les attributs qui rendent
 * les questions possibles.
 *
 * Chaque attribut de `PersonTraits` correspond à une question du moteur — un
 * portrait renseigné à moitié rend simplement le jeu moins tranchant, jamais
 * incohérent : les questions inutiles disparaissent d'elles-mêmes.
 */

const COTES: { valeur: WhoOrBoth; label: string }[] = [
  { valeur: "alice", label: "Du côté d’Alice" },
  { valeur: "joseph", label: "Du côté de Joseph" },
  { valeur: "les-deux", label: "Des deux côtés" },
];

const CERCLES: { valeur: Circle; label: string }[] = [
  { valeur: "famille", label: "La famille" },
  { valeur: "amis", label: "Les amis" },
  { valeur: "travail", label: "Le travail" },
  { valeur: "etudes", label: "Les années d’études" },
  { valeur: "voisinage", label: "Le voisinage" },
];

const CHEVEUX: { valeur: HairColor; label: string }[] = [
  { valeur: "brun", label: "Bruns" },
  { valeur: "blond", label: "Blonds" },
  { valeur: "noir", label: "Noirs" },
  { valeur: "roux", label: "Roux" },
  { valeur: "gris", label: "Gris" },
  { valeur: "chauve", label: "Sans cheveux" },
];

const SIGNES: { cle: "cheveuxLongs" | "lunettes" | "barbe" | "chapeau"; label: string }[] = [
  { cle: "cheveuxLongs", label: "Cheveux longs" },
  { cle: "lunettes", label: "Des lunettes" },
  { cle: "barbe", label: "Une barbe" },
  { cle: "chapeau", label: "Un chapeau" },
];

/** « Les amis · du côté d’Alice · brune, lunettes » */
export function libelleTraits(traits: PersonTraits): string {
  const cheveux = CHEVEUX.find((c) => c.valeur === traits.cheveux)?.label.toLowerCase();
  const signes = [
    traits.cheveuxLongs ? "cheveux longs" : null,
    traits.lunettes ? "lunettes" : null,
    traits.barbe ? "barbe" : null,
    traits.chapeau ? "chapeau" : null,
  ].filter(Boolean);

  return [
    CERCLES.find((c) => c.valeur === traits.cercle)?.label,
    // Seule l'initiale passe en minuscule : « Du côté d’Alice » garde son prénom.
    COTES.find((c) => c.valeur === traits.cote)?.label.replace(/^./, (lettre) =>
      lettre.toLowerCase(),
    ),
    [traits.cheveux === "chauve" ? "sans cheveux" : `cheveux ${cheveux}`, ...signes].join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Le visage, ou son initiale quand la photo manque. */
export function Portrait({ personne }: { personne: PersonneVue }) {
  const source = personne.thumbUrl ?? personne.photoUrl;

  if (!source) {
    return (
      <span className="grid size-full place-items-center bg-surface-2 font-display text-[1.75rem] text-ink-3">
        {personne.name.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={source}
      alt=""
      loading="lazy"
      decoding="async"
      className="size-full object-cover"
    />
  );
}

/* ============================== La section =============================== */

type Vue = { mode: "ajout" } | { mode: "modification"; personne: PersonneVue } | null;

export function GestionPaquet({ paquet }: { paquet: PersonneVue[] }) {
  const [vue, setVue] = useState<Vue>(null);

  return (
    <section id="paquet" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-title text-ink">Le paquet</h2>
          <p className="mt-1 text-sm text-ink-2">
            {paquet.length === 0
              ? "Personne pour l’instant."
              : `${paquet.length} ${plural(paquet.length, "visage", "visages")} · quatre au minimum pour jouer.`}
          </p>
        </div>
        <Button type="button" variant="soft" onClick={() => setVue({ mode: "ajout" })}>
          <IconPlus size={17} />
          Ajouter
        </Button>
      </div>

      <div className="mt-4">
        {paquet.length === 0 ? (
          <EmptyState
            title="Le paquet est vide"
            action={
              <Button type="button" size="lg" onClick={() => setVue({ mode: "ajout" })}>
                Ajouter la première personne
              </Button>
            }
          >
            Un prénom, une photo, quelques attributs&nbsp;: c’est tout ce qu’il faut pour qu’une
            personne entre dans le jeu.
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {paquet.map((personne) => (
              <li key={personne.id}>
                <button
                  type="button"
                  onClick={() => setVue({ mode: "modification", personne })}
                  aria-label={`Modifier ${personne.name}`}
                  className={cx(
                    "group block w-full rounded-md text-left transition-transform",
                    "hover:-translate-y-0.5",
                  )}
                >
                  <span className="block aspect-square overflow-hidden rounded-md border border-line bg-surface-2">
                    <Portrait personne={personne} />
                  </span>
                  <span className="mt-2 flex items-center justify-between gap-1.5">
                    <span className="truncate text-sm font-semibold text-ink">{personne.name}</span>
                    <IconCrayon
                      size={15}
                      className="shrink-0 text-ink-3 transition-colors group-hover:text-accent-ink"
                    />
                  </span>
                  <span className="mt-0.5 block truncate text-[0.6875rem] text-ink-3">
                    {libelleTraits(personne.traits)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {vue ? (
        <SheetPersonne
          key={vue.mode === "ajout" ? "ajout" : vue.personne.id}
          personne={vue.mode === "modification" ? vue.personne : null}
          onFermer={() => setVue(null)}
        />
      ) : null}
    </section>
  );
}

/* ============================== Le formulaire ============================= */

function SheetPersonne({
  personne,
  onFermer,
}: {
  personne: PersonneVue | null;
  onFermer: () => void;
}) {
  const idFormulaire = useId();
  const [etatCreation, creer, creationEnCours] = useActionState(creerPersonne, FORMULAIRE_VIDE);
  const [etatEdition, modifier, editionEnCours] = useActionState(modifierPersonne, FORMULAIRE_VIDE);
  const [confirmeSuppression, setConfirmeSuppression] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);
  const [suppressionEnCours, demarrer] = useTransition();

  const edition = personne !== null;
  const etat = edition ? etatEdition : etatCreation;
  const envoyer = edition ? modifier : creer;
  const enCours = edition ? editionEnCours : creationEnCours;

  useEffect(() => {
    if (etat.ok) onFermer();
  }, [etat, onFermer]);

  function supprimer() {
    if (!personne) return;
    setErreurSuppression(null);
    demarrer(async () => {
      const reponse = await supprimerPersonne(personne.id);
      if (reponse.ok) onFermer();
      else setErreurSuppression(reponse.erreur);
    });
  }

  return (
    <Sheet
      open
      onClose={onFermer}
      title={edition ? `Modifier ${personne.name}` : "Ajouter quelqu’un"}
      description={
        edition
          ? "Les attributs servent aux questions du jeu. Sans nouvelle photo, l’ancienne reste."
          : "Un prénom suffit à commencer. Les attributs, eux, font tout le sel des questions."
      }
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onFermer}>
            Annuler
          </Button>
          <Button type="submit" form={idFormulaire} disabled={enCours || suppressionEnCours}>
            {enCours ? "Enregistrement…" : edition ? "Enregistrer" : "Ajouter au paquet"}
          </Button>
        </div>
      }
    >
      <form id={idFormulaire} action={envoyer} className="flex flex-col gap-5">
        {personne ? <input type="hidden" name="id" value={personne.id} /> : null}

        <Field label="Prénom">
          <Input
            name="name"
            defaultValue={personne?.name ?? ""}
            required
            maxLength={40}
            placeholder="Camille"
            data-autofocus
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="label-caps text-ink-3">Photo</span>
          {personne && (personne.thumbUrl ?? personne.photoUrl) ? (
            <div className="mb-1 flex items-center gap-3">
              <span className="block size-14 shrink-0 overflow-hidden rounded-sm border border-line bg-surface-2">
                <Portrait personne={personne} />
              </span>
              <span className="text-xs leading-snug text-ink-3">
                Photo actuelle. En choisir une autre la remplacera.
              </span>
            </div>
          ) : null}
          <ImagePicker
            name="photo"
            max={1}
            shape="carre"
            label={personne ? "Changer la photo" : "Choisir une photo"}
          />
        </div>

        <Field label="Indice" hint="La phrase qui fait dire « ah oui, elle ! » au moment du récapitulatif.">
          <Input
            name="hint"
            defaultValue={personne?.hint ?? ""}
            maxLength={120}
            placeholder="Le mariage où on a dansé La Vie en rose"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Par qui on la connaît">
            <Select name="cote" defaultValue={personne?.traits.cote ?? "les-deux"}>
              {COTES.map(({ valeur, label }) => (
                <option key={valeur} value={valeur}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Le cercle">
            <Select name="cercle" defaultValue={personne?.traits.cercle ?? "amis"}>
              {CERCLES.map(({ valeur, label }) => (
                <option key={valeur} value={valeur}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Les cheveux">
            <Select name="cheveux" defaultValue={personne?.traits.cheveux ?? "brun"}>
              {CHEVEUX.map(({ valeur, label }) => (
                <option key={valeur} value={valeur}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <fieldset>
          <legend className="label-caps mb-2 text-ink-3">Signes particuliers</legend>
          <div className="flex flex-wrap gap-2">
            {SIGNES.map(({ cle, label }) => (
              <label key={cle} className="cursor-pointer">
                <input
                  type="checkbox"
                  name={cle}
                  value="oui"
                  defaultChecked={Boolean(personne?.traits[cle])}
                  className="peer sr-only"
                />
                <span
                  className={cx(
                    "flex h-11 items-center gap-2 rounded-full border border-line bg-surface-2 px-4",
                    "text-sm font-semibold text-ink-2 transition-colors",
                    "peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent-ink",
                    "peer-focus-visible:shadow-[var(--ring)]",
                  )}
                >
                  {label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {etat.erreur ? (
          <p role="alert" className="rounded-sm bg-bad-soft px-3 py-2.5 text-sm leading-snug text-bad">
            {etat.erreur}
          </p>
        ) : null}
      </form>

      {personne ? (
        <div className="mt-6 border-t border-line pt-5">
          {confirmeSuppression ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm leading-relaxed text-ink-2">
                {personne.name} quitte le paquet. Si une manche en cours cherchait cette
                personne, elle s’arrête aussi.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="danger"
                  onClick={supprimer}
                  disabled={suppressionEnCours}
                >
                  {suppressionEnCours ? "Suppression…" : "Confirmer la suppression"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmeSuppression(false)}
                  disabled={suppressionEnCours}
                >
                  Garder
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmeSuppression(true)}
              className={cx(
                "-mx-2 flex min-h-11 items-center gap-2.5 rounded-sm px-2 text-sm font-semibold",
                "text-bad transition-colors hover:bg-surface-2",
              )}
            >
              <IconCorbeille size={17} />
              Retirer du paquet
            </button>
          )}

          {erreurSuppression ? (
            <p role="alert" className="mt-3 text-sm font-semibold text-bad">
              {erreurSuppression}
            </p>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}
