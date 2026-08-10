# Alice & Joseph — conventions

Plateforme privée pour deux personnes. Six apps : **Nous** (accueil), **Fil**,
**Photos**, **Musique**, **Carte**, **Jeux**. Interface entièrement en français.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4.
Postgres (Neon) quand `DATABASE_URL` existe, sinon repli mémoire. Vercel Blob
quand `BLOB_READ_WRITE_TOKEN` existe, sinon data URL.

## Règles non négociables

1. **Aucune couleur en dur.** Tout passe par les tokens de `globals.css`
   (`bg-surface`, `text-ink-2`, `border-line`, `text-accent`, `bg-alice-soft`…).
   Une couleur écrite en dur casse le thème sombre.
2. **Deux thèmes.** Le clair est le défaut, le sombre est une vraie chambre
   noire. Ne jamais définir une couleur uniquement dans un bloc `dark:`.
3. **Mobile d'abord.** Le téléphone est l'usage principal. Zone de tap ≥ 44 px,
   la barre d'onglets mange 5 rem en bas (`pb-28` est déjà appliqué par le shell).
4. **Titres en `font-display`** (Fraunces), interface en Manrope (par défaut).
5. **Français correct** : apostrophes typographiques `’` dans les textes JSX
   (`&apos;` dans le JSX brut), espaces insécables avant `: ; ! ?` si pertinent.
6. **Pas de librairie ajoutée** sans nécessité réelle. Les icônes sont dans
   `src/components/icons.tsx`.

## Données

Un seul magasin documentaire : `src/lib/data/store.ts`.

```ts
import { list, get, insert, update, remove, listMany } from "@/lib/data/store";

const posts = await list<Post>("posts");
const post = await get<Post>("posts", id);
await insert<Post>("posts", { by, body, photoIds: [], … });   // id/dates ajoutés
await update<Post>("posts", id, { pinned: true });
await remove("posts", id);
```

Collections : `posts` `photos` `albums` `tracks` `playlists` `places` `people`
`games` `settings`. Types dans `src/lib/types.ts` — les étendre plutôt que les
contourner.

`isPersistent()` dit si les écritures survivent ; `hasBlobStorage()` idem pour
les images. Ne jamais bloquer une fonctionnalité parce qu'on est en mode démo.

## Pages

Chaque app vit dans `src/app/(app)/<app>/`. Le shell fournit déjà la navigation,
les marges et `export const dynamic = "force-dynamic"`.

```tsx
export default async function Page() {
  const who = await requireWho();          // "alice" | "joseph"
  const items = await list<Post>("posts");
  return (
    <>
      <PageHeader title="Fil" subtitle="…" action={…} />
      …
    </>
  );
}
```

Mutations : un `actions.ts` par app, en tête `"use server"`, et
`revalidatePath("/fil")` à la fin de chaque écriture. Les actions vérifient
toujours l'identité avec `requireWho()` — jamais une valeur venue du client.

## Composants disponibles

`src/components/ui.tsx` — `Button` `LinkButton` `Card` `cardClass`
`SectionTitle` `EmptyState` `Chip` `Avatar` `AvatarPair` `Input` `Textarea`
`Select` `Field` `Divider` `Spinner` `cx`.
`src/components/sheet.tsx` — `Sheet` (modal montant du bas sur téléphone).
`src/components/image-picker.tsx` — `ImagePicker` (redimensionne puis sérialise
en JSON dans un champ caché ; côté serveur, `storeImage()` de `src/lib/upload.ts`).
`src/components/page-header.tsx` — `PageHeader`.
`src/lib/format.ts` — dates et libellés en français, fuseau Europe/Paris fixé.

## Images

Toujours `<img>` simple avec `loading="lazy"`, `decoding="async"` et un ratio
explicite (les sources sont soit des Blob déjà dimensionnés, soit des data URL).

## Vérifier

```bash
npx tsc --noEmit && npx next build
```
