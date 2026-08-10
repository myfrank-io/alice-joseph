import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
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
 * Sans DATABASE_URL : mode démo, tout est en mémoire, réinitialisé au repos.
 * Avec DATABASE_URL : Postgres, la table est créée toute seule au premier accès.
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

let sqlClient: NeonQueryFunction<false, false> | null | undefined;

function getSql(): NeonQueryFunction<false, false> | null {
  if (sqlClient !== undefined) return sqlClient;
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  sqlClient = url ? neon(url) : null;
  return sqlClient;
}

/** Vrai quand les écritures sont réellement sauvegardées. */
export function isPersistent(): boolean {
  return getSql() !== null;
}

export function hasBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

let schemaReady: Promise<void> | null = null;

function ensureSchema(sql: NeonQueryFunction<false, false>): Promise<void> {
  schemaReady ??= (async () => {
    await sql`
      create table if not exists records (
        id text primary key,
        collection text not null,
        data jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `;
    await sql`
      create index if not exists records_collection_created_idx
        on records (collection, created_at desc)
    `;
    await seedIfEmpty(sql);
  })();
  return schemaReady;
}

/** Au tout premier démarrage, on installe le contenu d'exemple pour que rien ne soit vide. */
async function seedIfEmpty(sql: NeonQueryFunction<false, false>): Promise<void> {
  const rows = (await sql`select count(*)::int as n from records`) as { n: number }[];
  if ((rows[0]?.n ?? 0) > 0) return;

  const seed = seedCollections();
  for (const name of COLLECTIONS) {
    for (const doc of seed[name] ?? []) {
      const { id, createdAt, updatedAt, ...rest } = doc;
      await sql`
        insert into records (id, collection, data, created_at, updated_at)
        values (${id}, ${name}, ${JSON.stringify(rest)}::jsonb, ${createdAt}::timestamptz, ${updatedAt}::timestamptz)
        on conflict (id) do nothing
      `;
    }
  }
}

/* ----------------------------- Repli en mémoire ---------------------------- */

type MemoryStore = Record<CollectionName, Doc[]>;

const globalForMemory = globalThis as unknown as { __ajMemory?: MemoryStore };

function memory(): MemoryStore {
  globalForMemory.__ajMemory ??= seedCollections();
  return globalForMemory.__ajMemory;
}

/* --------------------------------- Outils --------------------------------- */

export function newId(prefix = ""): string {
  const raw = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}${raw.replace(/-/g, "").slice(0, 16)}`;
}

function toDoc<T extends Doc>(row: {
  id: string;
  data: Record<string, unknown>;
  created_at: string | Date;
  updated_at: string | Date;
}): T {
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
  const sql = getSql();
  if (!sql) return byRecent(memory()[collection] as T[]);

  await ensureSchema(sql);
  const rows = (await sql`
    select id, data, created_at, updated_at
      from records
     where collection = ${collection}
     order by created_at desc
  `) as Parameters<typeof toDoc>[0][];
  return rows.map((row) => toDoc<T>(row));
}

/**
 * Plusieurs collections d'un coup, pour les pages qui les croisent.
 *
 * Une requête par collection, lancées ensemble : sur le pilote HTTP de Neon
 * c'est aussi rapide qu'une requête unique, et cela évite de dépendre de la
 * façon dont le pilote sérialise un tableau passé en paramètre.
 */
export async function listMany(
  collections: CollectionName[],
): Promise<Record<string, Doc[]>> {
  const results = await Promise.all(collections.map((name) => list(name)));
  return Object.fromEntries(collections.map((name, index) => [name, results[index]]));
}

export async function get<T extends Doc>(
  collection: CollectionName,
  id: string,
): Promise<T | null> {
  const sql = getSql();
  if (!sql) return ((memory()[collection] as T[]).find((d) => d.id === id) ?? null) as T | null;

  await ensureSchema(sql);
  const rows = (await sql`
    select id, data, created_at, updated_at
      from records
     where collection = ${collection} and id = ${id}
     limit 1
  `) as Parameters<typeof toDoc>[0][];
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

  const sql = getSql();
  if (!sql) {
    memory()[collection].unshift(doc);
    return doc;
  }

  await ensureSchema(sql);
  const { id, createdAt, updatedAt, ...rest } = doc;
  await sql`
    insert into records (id, collection, data, created_at, updated_at)
    values (${id}, ${collection}, ${JSON.stringify(rest)}::jsonb, ${createdAt}::timestamptz, ${updatedAt}::timestamptz)
  `;
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

  const sql = getSql();
  if (!sql) {
    const bucket = memory()[collection];
    const index = bucket.findIndex((d) => d.id === id);
    if (index >= 0) bucket[index] = next;
    return next;
  }

  const { id: _id, createdAt: _createdAt, updatedAt, ...rest } = next;
  await sql`
    update records
       set data = ${JSON.stringify(rest)}::jsonb, updated_at = ${updatedAt}::timestamptz
     where collection = ${collection} and id = ${id}
  `;
  return next;
}

export async function remove(collection: CollectionName, id: string): Promise<boolean> {
  const sql = getSql();
  if (!sql) {
    const bucket = memory()[collection];
    const index = bucket.findIndex((d) => d.id === id);
    if (index < 0) return false;
    bucket.splice(index, 1);
    return true;
  }

  await ensureSchema(sql);
  await sql`delete from records where collection = ${collection} and id = ${id}`;
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
