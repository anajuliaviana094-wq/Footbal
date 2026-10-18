import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Funciona com Neon (connection string "pooled" com sslmode=require) e com Postgres local.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

function createPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada");
  return new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 10_000 });
}

export type Db = NodePgDatabase<typeof schema>;

let _db: Db | null = null;

export function getDb(): Db {
  if (_db) return _db;
  const pool = (globalForDb.pgPool ??= createPool());
  _db = drizzle(pool, { schema });
  return _db;
}

export { schema };

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

export async function closeDb(): Promise<void> {
  await globalForDb.pgPool?.end();
  globalForDb.pgPool = undefined;
  _db = null;
}
