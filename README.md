# Alice & Joseph

Une plateforme privée pour deux personnes, qui rassemble six choses au même endroit :

| App | Ce qu'elle fait |
| --- | --- |
| **Nous** | L'accueil : un souvenir du jour, le dernier mot de l'autre, les compteurs. |
| **Fil** | Le mur où l'on se parle : messages, photos, humeurs, réactions, réponses. |
| **Photos** | Toute la bibliothèque : grille, moments par mois, albums, visionneuse plein écran. |
| **Musique** | Les morceaux et playlists, avec les lecteurs Spotify / YouTube / Deezer intégrés. |
| **Carte** | La mapmonde des endroits visités et des envies, avec zoom et épingles. |
| **Jeux** | Puissance 4 aux couleurs des deux, et « Qui est-ce ? » avec les gens qu'on connaît. |

## Démarrer

```bash
npm install
npm run dev
```

Le site s'ouvre sur `/entrer`. Sans configuration, le code d'accès est `nous`
et la plateforme tourne avec un contenu d'exemple.

## Passer en mode conservé

Rien à modifier dans le code : la plateforme détecte ce qui est branché.

1. Vercel → **Storage** → **Create Database** → **Neon (Postgres)**, reliée au projet.
   La variable `DATABASE_URL` est ajoutée automatiquement.
2. Vercel → **Storage** → **Blob**. La variable `BLOB_READ_WRITE_TOKEN` est
   ajoutée automatiquement. C'est elle qui conserve les photos.
3. **Redeploy**. Au premier chargement, la table est créée et le contenu
   d'exemple installé une seule fois.

Puis, pour la sécurité, ajoutez dans **Settings → Environment Variables** :

- `APP_PASSCODE` — le code d'entrée
- `AUTH_SECRET` — une longue suite de caractères au hasard

## Comment c'est fait

- **Next.js 15** (App Router), **React 19**, **TypeScript** strict, **Tailwind v4**.
- Un **magasin documentaire unique** (`src/lib/data/store.ts`) : une table
  `records` en Postgres, ou un repli en mémoire quand aucune base n'est
  branchée. Même contrat des deux côtés, donc aucune branche conditionnelle
  dans les pages.
- **Session** par code partagé et choix de la personne, signée en JWT dans un
  cookie `httpOnly`.
- **Images** redimensionnées dans le navigateur avant l'envoi, puis rangées sur
  Vercel Blob — ou gardées en data URL en mode démonstration.
- **Carte** rendue en SVG maison, projection Equal Earth, sans tuiles ni
  service externe.

Les conventions de code sont dans [`CLAUDE.md`](./CLAUDE.md).
