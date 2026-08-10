"use client";

import { useEffect, useId, useState } from "react";
import { Sheet } from "@/components/sheet";
import { Button, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { IconValider } from "@/components/icons";
import { IconCible, IconClavier } from "@/components/carte/icones-carte";
import { SUGGESTIONS_PAYS } from "@/lib/carte/pays";
import { formatCoordonnees, validerEntree, type EntreeLieu, type PhotoLegere } from "@/lib/carte/lieu";

/**
 * Le formulaire d'ajout et de modification. Les coordonnées se remplissent de deux
 * façons, présentées côte à côte : en pointant sur la carte, ou à la main pour les
 * précis. Le brouillon vit chez le parent — il survit à la fermeture du panneau
 * pendant qu'on va choisir un point sur la carte.
 */
export function SheetFormulaire({
  ouvert,
  mode,
  valeur,
  photos,
  enCours,
  erreur,
  onChange,
  onPlacerSurLaCarte,
  onFermer,
  onEnregistrer,
}: {
  ouvert: boolean;
  mode: "ajout" | "edition";
  valeur: EntreeLieu;
  photos: PhotoLegere[];
  enCours: boolean;
  erreur: string | null;
  onChange: (entree: EntreeLieu) => void;
  onPlacerSurLaCarte: () => void;
  onFermer: () => void;
  onEnregistrer: () => void;
}) {
  const listeId = useId();
  const [lat, setLat] = useChampNombre(valeur.lat, (nombre) => onChange({ ...valeur, lat: nombre }));
  const [lng, setLng] = useChampNombre(valeur.lng, (nombre) => onChange({ ...valeur, lng: nombre }));

  const position = validerEntree(valeur);
  const place = Number.isFinite(valeur.lat) && Number.isFinite(valeur.lng);
  /* On ne gronde pas tant que rien n'a été saisi : le formulaire s'ouvre vide. */
  const message = erreur ?? (position.ok || !valeur.name.trim() ? null : position.erreur);

  if (!ouvert) return null;

  return (
    <Sheet
      open
      onClose={onFermer}
      size="lg"
      title={mode === "ajout" ? "Ajouter un lieu" : "Modifier le lieu"}
      description={
        mode === "ajout"
          ? "Un endroit où l’on est allés, ou un endroit dont on rêve."
          : undefined
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onFermer} disabled={enCours}>
            Annuler
          </Button>
          <Button size="sm" onClick={onEnregistrer} disabled={enCours || !position.ok}>
            <IconValider size={16} />
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(evenement) => {
          evenement.preventDefault();
          if (position.ok) onEnregistrer();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom">
            <Input
              data-autofocus
              value={valeur.name}
              maxLength={80}
              placeholder="Lisbonne"
              onChange={(evenement) => onChange({ ...valeur, name: evenement.target.value })}
            />
          </Field>

          <Field label="Pays" hint="Il sert à teindre le pays sur la carte.">
            <Input
              value={valeur.country}
              maxLength={60}
              list={listeId}
              placeholder="Portugal"
              onChange={(evenement) => onChange({ ...valeur, country: evenement.target.value })}
            />
          </Field>
          <datalist id={listeId}>
            {SUGGESTIONS_PAYS.map((pays) => (
              <option key={pays} value={pays} />
            ))}
          </datalist>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="label-caps text-ink-3">Type</span>
            <div className="grid grid-cols-2 gap-1 rounded-sm bg-surface-2 p-1">
              {(["visite", "envie"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={valeur.kind === type}
                  onClick={() => onChange({ ...valeur, kind: type })}
                  className={cx(
                    "h-11 rounded-xs text-sm font-semibold transition-colors",
                    valeur.kind === type
                      ? "bg-surface text-ink shadow-[var(--shadow-sm)]"
                      : "text-ink-2 hover:text-ink",
                  )}
                >
                  {type === "visite" ? "Visité" : "Envie"}
                </button>
              ))}
            </div>
          </div>

          {valeur.kind === "visite" ? (
            <Field label="Date" hint="Le jour, ou seulement le mois.">
              <Input
                type="date"
                value={valeur.visitedAt ?? ""}
                onChange={(evenement) => onChange({ ...valeur, visitedAt: evenement.target.value })}
              />
            </Field>
          ) : (
            <div className="flex flex-col justify-end">
              <p className="text-xs leading-snug text-ink-3">
                Une envie n’a pas de date : elle attend dans « Un jour ».
              </p>
            </div>
          )}
        </div>

        <fieldset className="rounded-sm border border-line bg-surface-2/50 p-3.5">
          <legend className="label-caps px-1 text-ink-3">Position</legend>

          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant={place ? "outline" : "primary"}
              onClick={onPlacerSurLaCarte}
              className="w-full"
            >
              <IconCible size={18} />
              {place ? "Choisir un autre point sur la carte" : "Placer sur la carte"}
            </Button>

            <p className="flex items-center gap-2 text-xs font-semibold text-ink-3">
              <span className="h-px flex-1 bg-line" />
              <IconClavier size={15} />
              ou à la main
              <span className="h-px flex-1 bg-line" />
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude" hint="−90 à 90">
                <Input
                  inputMode="decimal"
                  value={lat}
                  placeholder="38,7223"
                  onChange={(evenement) => setLat(evenement.target.value)}
                />
              </Field>
              <Field label="Longitude" hint="−180 à 180">
                <Input
                  inputMode="decimal"
                  value={lng}
                  placeholder="−9,1393"
                  onChange={(evenement) => setLng(evenement.target.value)}
                />
              </Field>
            </div>

            {place ? (
              <p className="text-xs text-ink-3">{formatCoordonnees(valeur.lat, valeur.lng)}</p>
            ) : null}
          </div>
        </fieldset>

        <Field label="Note" hint="Ce qu’on veut se rappeler de cet endroit.">
          <Textarea
            rows={3}
            maxLength={600}
            value={valeur.note ?? ""}
            placeholder="Le thé sur le toit, tous les soirs."
            onChange={(evenement) => onChange({ ...valeur, note: evenement.target.value })}
          />
        </Field>

        {photos.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="label-caps text-ink-3">
              Photos rattachées{" "}
              {valeur.photoIds.length > 0 ? (
                <span className="text-accent-ink">({valeur.photoIds.length})</span>
              ) : null}
            </span>
            <ul className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto rounded-sm border border-line p-2 sm:grid-cols-6">
              {photos.map((photo) => {
                const choisie = valeur.photoIds.includes(photo.id);
                return (
                  <li key={photo.id}>
                    <button
                      type="button"
                      aria-pressed={choisie}
                      aria-label={photo.caption ?? "Rattacher cette photo"}
                      onClick={() =>
                        onChange({
                          ...valeur,
                          photoIds: choisie
                            ? valeur.photoIds.filter((id) => id !== photo.id)
                            : [...valeur.photoIds, photo.id],
                        })
                      }
                      className={cx(
                        "relative block w-full overflow-hidden rounded-xs border-2 transition-colors",
                        choisie ? "border-accent" : "border-transparent hover:border-line-strong",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.thumbUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className={cx(
                          "aspect-square w-full object-cover transition-opacity",
                          choisie ? "opacity-100" : "opacity-80",
                        )}
                      />
                      {choisie ? (
                        <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-accent text-accent-on">
                          <IconValider size={12} />
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <Field label="Avec">
          <Select
            value={valeur.with}
            onChange={(evenement) =>
              onChange({ ...valeur, with: evenement.target.value as EntreeLieu["with"] })
            }
          >
            <option value="les-deux">Tous les deux</option>
            <option value="alice">Alice</option>
            <option value="joseph">Joseph</option>
          </Select>
        </Field>

        {message ? (
          <p className="rounded-sm bg-bad-soft px-3 py-2 text-[0.8125rem] font-semibold text-bad">
            {message}
          </p>
        ) : null}

        {/* Permet la validation au clavier depuis n'importe quel champ. */}
        <button type="submit" className="sr-only">
          Enregistrer
        </button>
      </form>
    </Sheet>
  );
}

/**
 * Un champ numérique qui laisse taper « −9,1 » sans se faire réécrire à chaque
 * frappe : on ne resynchronise le texte que si la valeur vient vraiment d'ailleurs
 * (un point posé sur la carte, par exemple).
 */
function useChampNombre(
  valeur: number,
  onValeur: (nombre: number) => void,
): [string, (texte: string) => void] {
  const [texte, setTexte] = useState(() => (Number.isFinite(valeur) ? String(valeur) : ""));

  useEffect(() => {
    const local = lire(texte);
    const identique = Number.isFinite(local)
      ? Number.isFinite(valeur) && Math.abs(local - valeur) < 1e-9
      : !Number.isFinite(valeur);
    if (!identique) setTexte(Number.isFinite(valeur) ? String(arrondir(valeur)) : "");
    // On ne réagit qu'à la valeur venue du parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur]);

  return [
    texte,
    (nouveau: string) => {
      setTexte(nouveau);
      onValeur(lire(nouveau));
    },
  ];
}

function lire(texte: string): number {
  const propre = texte.trim().replace(",", ".").replace("−", "-");
  return propre === "" ? Number.NaN : Number(propre);
}

function arrondir(valeur: number): number {
  return Math.round(valeur * 1e4) / 1e4;
}
