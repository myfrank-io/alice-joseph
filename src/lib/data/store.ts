import type { Doc } from "@/lib/types";
import { seedCollections } from "@/lib/data/seed";

/**
 * Toutes les données de la plateforme vivent dans une seule table de documents.
 *
 * Deux raisons : à l'échelle de deux personnes, une base relationnelle complète
 * n'apporte rien qu'un index sur (collection, created_at) ne fasse déjà ; et
 * surtout, le même contrat s'implémente à l'identique en mémoire — ce qui permet
 * au site d'être entièrement navigable avant même qu'une base soit branchée.
 *
 * Le pilote est choisi d'après l'adresse : Neon parle en HTTP, ce qui est idéal
 * en serverless ; n'importe quel autre Postgres (Supabase, Railway, Render, une
 * machine à soi) passe par `pg`. Sans adresse du tout : mode démonstration en
 * mémoire, réinitialisé dès que l'instance est recyclée.
 */

export type CollectionName =
  | "posts"
  | "photos"
  | "albums"
  | "tracks"
  | "playlists"
  | "places"
  | "people"
  | "games"
  | "settings"
  | "sources";

export const COLLECTIONS: CollectionName[] = [
  "posts",
  "photos",
  "albums",
  "tracks",
  "playlists",
  "places",
  "people",
  "games",
  "settings",
  "sources",
];

/* ------------------------------- Connexion -------------------------------- */

/** Une requête paramétrée, quel que soit le pilote derrière. */
type Query = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

/**
 * Vercel expose l'adresse sous plusieurs noms selon l'intégration choisie.
 * On les accepte toutes plutôt que d'obliger à renommer une variable.
 */
function databaseUrl(): string | null {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.NEON_DATABASE_URL,
  ];
  const url = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
  return url?.trim() ?? null;
}

let queryFn: Promise<Query> | null = null;

/** Le pilote n'est chargé que si une base existe, et une seule fois par instance. */
function getQuery(): Promise<Query> | null {
  if (databaseUrl() === null) return null;
  queryFn ??= construireQuery();
  return queryFn;
}

async function construireQuery(): Promise<Query> {
  const url = databaseUrl()!;

  // Neon parle HTTP : une requête = un aller-retour, sans connexion à tenir ouverte.
  if (/neon\.(tech|build)/i.test(url)) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    return async (text, params = []) =>
      (await sql.query(text, params)) as Record<string, unknown>[];
  }

  // Tout le reste : pilote classique, avec un pool minuscule adapté au serverless.
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({
    connectionString: url,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
  });
  return async (text, params = []) => (await pool.query(text, params)).rows;
}

/** Vrai quand les écritures sont réellement sauvegardées. */
export function isPersistent(): boolean {
  return databaseUrl() !== null;
}

export function hasBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

let schemaReady: Promise<void> | null = null;

function ensureSchema(query: Query): Promise<void> {
  schemaReady ??= (async () => {
    await query(`
      create table if not exists records (
        id text primary key,
        collection text not null,
        data jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `);
    await query(`
      create index if not exists records_collection_created_idx
        on records (collection, created_at desc)
    `);
    await seedIfEmpty(query);
  })();
  return schemaReady;
}

/** Au tout premier démarrage, on installe le contenu d'exemple pour que rien ne soit vide. */
async function seedIfEmpty(query: Query): Promise<void> {
  const rows = await query(`select count(*)::int as n from records`);
  if (Number(rows[0]?.n ?? 0) > 0) return;

  const seed = seedCollections();
  const valeurs: unknown[] = [];
  const morceaux: string[] = [];

  for (const name of COLLECTIONS) {
    for (const doc of seed[name] ?? []) {
      const { id, createdAt, updatedAt, ...rest } = doc;
      const base = valeurs.length;
      morceaux.push(
        `($${base + 1}, $${base + 2}, $${base + 3}::jsonb, $${base + 4}::timestamptz, $${base + 5}::timestamptz)`,
      );
      valeurs.push(id, name, JSON.stringify(rest), createdAt, updatedAt);
    }
  }

  if (morceaux.length === 0) return;

  // Une seule insertion : sur une base distante, cent allers-retours coûteraient
  // plusieurs secondes au tout premier chargement.
  await query(
    `insert into records (id, collection, data, created_at, updated_at)
     values ${morceaux.join(", ")}
     on conflict (id) do nothing`,
    valeurs,
  );
}

/* ----------------------------- Repli en mémoire ---------------------------- */

type MemoryStore = Record<CollectionName, Doc[]>;

const globalForMemory = globalThis as unknown as { __ajMemory?: MemoryStore };

function memory(): MemoryStore {
  globalForMemory.__ajMemory ??= seedCollections();
  return globalForMemory.__ajMemory;
}

/* ---------------------------------- Cache --------------------------------- */

/**
 * Un rendu de page lit souvent la même collection plusieurs fois, et deux pages
 * consécutives lisent presque toujours les mêmes données. Ce cache très court
 * supprime ces allers-retours ; toute écriture le vide, et sa durée de vie
 * borne l'attente avant de voir ce que l'autre vient d'écrire depuis une autre
 * instance.
 */
const TTL_MS = 4_000;

const globalForCache = globalThis as unknown as {
  __ajCache?: Map<CollectionName, { at: number; docs: Doc[] }>;
};

function cache(): Map<CollectionName, { at: number; docs: Doc[] }> {
  globalForCache.__ajCache ??= new Map();
  return globalForCache.__ajCache;
}

function lireCache(collection: CollectionName): Doc[] | null {
  const entree = cache().get(collection);
  if (!entree) return null;
  if (Date.now() - entree.at > TTL_MS) {
    cache().delete(collection);
    return null;
  }
  return entree.docs;
}

function ecrireCache(collection: CollectionName, docs: Doc[]): void {
  cache().set(collection, { at: Date.now(), docs });
}

function viderCache(collection?: CollectionName): void {
  if (collection) cache().delete(collection);
  else cache().clear();
}

/* --------------------------------- Outils --------------------------------- */

export function newId(prefix = ""): string {
  const raw = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}${raw.replace(/-/g, "").slice(0, 16)}`;
}

type Row = {
  id: string;
  data: Record<string, unknown>;
  created_at: string | Date;
  updated_at: string | Date;
  collection?: string;
};

function toDoc<T extends Doc>(row: Row): T {
  return {
    ...row.data,
    id: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  } as T;
}

/** Tri stable, du plus récent au plus ancien. */
function byRecent<T extends Doc>(docs: T[]): T[] {
  return [...docs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ---------------------------------- API ----------------------------------- */

export async function list<T extends Doc>(collection: CollectionName): Promise<T[]> {
  const query = await getQuery();
  if (!query) return byRecent(memory()[collection] as T[]);

  const enCache = lireCache(collection);
  if (enCache) return enCache as T[];

  await ensureSchema(query);
  const rows = (await query(
    `select id, data, created_at, updated_at
       from records
      where collection = $1
      order by created_at desc`,
    [collection],
  )) as Row[];

  const docs = rows.map((row) => toDoc<T>(row));
  ecrireCache(collection, docs);
  return docs;
}

/**
 * Plusieurs collections en **une seule** requête.
 *
 * La page d'accueil en croise huit : autant d'allers-retours coûtaient autant de
 * fois la latence vers la base, ce qui se voyait à l'œil nu.
 */
export async function listMany(
  collections: CollectionName[],
): Promise<Record<string, Doc[]>> {
  const query = await getQuery();
  if (!query) {
    return Object.fromEntries(collections.map((c) => [c, byRecent(memory()[c])]));
  }

  const manquantes = collections.filter((c) => lireCache(c) === null);
  const out: Record<string, Doc[]> = Object.fromEntries(
    collections.map((c) => [c, lireCache(c) ?? []]),
  );

  if (manquantes.length === 0) return out;

  await ensureSchema(query);
  const rows = (await query(
    `select id, collection, data, created_at, updated_at
       from records
      where collection = any($1::text[])
      order by created_at desc`,
    [manquantes],
  )) as Row[];

  const groupes = new Map<string, Doc[]>(manquantes.map((c) => [c, []]));
  for (const row of rows) groupes.get(String(row.collection))?.push(toDoc(row));

  for (const nom of manquantes) {
    const docs = groupes.get(nom) ?? [];
    ecrireCache(nom, docs);
    out[nom] = docs;
  }

  return out;
}

export async function get<T extends Doc>(
  collection: CollectionName,
  id: string,
): Promise<T | null> {
  const query = await getQuery();
  if (!query) return ((memory()[collection] as T[]).find((d) => d.id === id) ?? null) as T | null;

  // Si la collection est déjà chargée, inutile d'interroger la base pour un seul document.
  const enCache = lireCache(collection);
  if (enCache) return ((enCache as T[]).find((d) => d.id === id) ?? null) as T | null;

  await ensureSchema(query);
  const rows = (await query(
    `select id, data, created_at, updated_at
       from records
      where collection = $1 and id = $2
      limit 1`,
    [collection, id],
  )) as Row[];
  return rows[0] ? toDoc<T>(rows[0]) : null;
}

export async function insert<T extends Doc>(
  collection: CollectionName,
  value: Omit<T, keyof Doc> & Partial<Doc>,
): Promise<T> {
  const now = new Date().toISOString();
  const doc = {
    ...value,
    id: value.id ?? newId(),
    createdAt: value.createdAt ?? now,
    updatedAt: now,
  } as T;

  const query = await getQuery();
  if (!query) {
    memory()[collection].unshift(doc);
    return doc;
  }

  await ensureSchema(query);
  const { id, createdAt, updatedAt, ...rest } = doc;
  await query(
    `insert into records (id, collection, data, created_at, updated_at)
     values ($1, $2, $3::jsonb, $4::timestamptz, $5::timestamptz)`,
    [id, collection, JSON.stringify(rest), createdAt, updatedAt],
  );
  viderCache(collection);
  return doc;
}

export async function update<T extends Doc>(
  collection: CollectionName,
  id: string,
  patch: Partial<Omit<T, keyof Doc>>,
): Promise<T | null> {
  const current = await get<T>(collection, id);
  if (!current) return null;

  const next = { ...current, ...patch, updatedAt: new Date().toISOString() } as T;

  const query = await getQuery();
  if (!query) {
    const bucket = memory()[collection];
    const index = bucket.findIndex((d) => d.id === id);
    if (index >= 0) bucket[index] = next;
    return next;
  }

  const { id: _id, createdAt: _createdAt, updatedAt, ...rest } = next;
  await query(
    `update records
        set data = $1::jsonb, updated_at = $2::timestamptz
      where collection = $3 and id = $4`,
    [JSON.stringify(rest), updatedAt, collection, id],
  );
  viderCache(collection);
  return next;
}

export async function remove(collection: CollectionName, id: string): Promise<boolean> {
  const query = await getQuery();
  if (!query) {
    const bucket = memory()[collection];
    const index = bucket.findIndex((d) => d.id === id);
    if (index < 0) return false;
    bucket.splice(index, 1);
    return true;
  }

  await ensureSchema(query);
  await query(`delete from records where collection = $1 and id = $2`, [collection, id]);
  viderCache(collection);
  return true;
}

/** Retire un identifiant d'un tableau de références dans toute une collection. */
export async function detachReference<T extends Doc>(
  collection: CollectionName,
  field: keyof T,
  value: string,
): Promise<void> {
  const docs = await list<T>(collection);
  for (const doc of docs) {
    const refs = doc[field];
    if (Array.isArray(refs) && refs.includes(value)) {
      await update<T>(collection, doc.id, {
        [field]: refs.filter((r) => r !== value),
      } as Partial<Omit<T, keyof Doc>>);
    }
  }
}
