import { Pool, Client } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { runSeed } from "./seed";
import { BOOTSTRAP } from "./ddl";

/* ============================================================
   PostgreSQL connection — dedicated database, DATABASE_URL.
   The exported `db` is usable synchronously everywhere: a proxy
   gates every query/connection behind a one-time bootstrap
   (DDL + auto-seed) so callers never have to await an init step.
   ============================================================ */

const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://csbg:csbg@localhost:5432/csbg_intake";

/** Full connection string (server-side only — used by the seed CLI). */
export const databaseUrl = DATABASE_URL;

/** Connection target (no credentials) for Settings → Database & storage. */
export function databaseInfo(): { host: string; port: string; database: string; user: string } {
  const u = new URL(DATABASE_URL);
  return {
    host: u.hostname,
    port: u.port || "5432",
    database: u.pathname.replace(/^\//, ""),
    user: u.username,
  };
}

type DB = NodePgDatabase<typeof schema>;

/* One-time bootstrap on a dedicated connection: DDL + auto-seed of an empty
   database, serialized across processes (next build workers, dev + seed CLI)
   with an advisory lock. Queries through the exported `db` wait on this. */
const BOOT_LOCK = 727274001;

async function bootstrap(): Promise<void> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query(`SELECT pg_advisory_lock(${BOOT_LOCK})`);
    try {
      await client.query(BOOTSTRAP);
      const r = await client.query("SELECT COUNT(*)::int AS n FROM organization");
      // auto-seed an empty database so `npm run dev` works out of the box
      if (r.rows[0].n === 0) await runSeed(drizzle(client, { schema }));
    } finally {
      await client.query(`SELECT pg_advisory_unlock(${BOOT_LOCK})`);
    }
  } finally {
    await client.end();
  }
}

interface Conn {
  pool: Pool;
  db: DB;
  booted?: Promise<void>;
}

function createConn(): Conn {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 10 });
  const conn: Conn = { pool, db: undefined as unknown as DB };
  const ensureBoot = () => (conn.booted ??= bootstrap());
  // Gate the two entry points drizzle uses (pool.query for one-shot statements,
  // pool.connect for transactions) behind the bootstrap promise. The proxy keeps
  // the Pool prototype, so drizzle's `instanceof Pool` transaction path still works.
  const gatedPool = new Proxy(pool, {
    get(target, prop) {
      if (prop === "query" || prop === "connect") {
        return (...args: unknown[]) =>
          ensureBoot().then(() => (target[prop as "query" | "connect"] as (...a: unknown[]) => unknown)(...args));
      }
      const v = Reflect.get(target, prop, target);
      return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
  });
  conn.db = drizzle(gatedPool, { schema });
  return conn;
}

declare global {
  // eslint-disable-next-line no-var
  var __csbgConn: Conn | undefined;
}

// survive Next.js dev-mode hot reloads with a single pool
const conn: Conn = globalThis.__csbgConn ?? createConn();
if (process.env.NODE_ENV !== "production") globalThis.__csbgConn = conn;

export const db: DB = conn.db;

/** Force bootstrap (used by the seed CLI; app code never needs this). */
export function dbReady(): Promise<void> {
  return (conn.booted ??= bootstrap());
}

export * as t from "./schema";
