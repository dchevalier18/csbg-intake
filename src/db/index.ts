import fs from "node:fs";
import path from "node:path";
import { Pool, Client } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";
import { runSeed } from "./seed";
import { runInit } from "./init";
import { BOOTSTRAP } from "./ddl";

/* ============================================================
   Database connection — DATABASE_URL selects the driver:

     postgres://…        PostgreSQL via node-postgres (server installs)
     pglite://<dir>      embedded Postgres (PGlite) storing data under
                         <dir> — zero-setup local/offline mode
     pglite://memory     embedded, in-memory (tests/preview)

   Either way the exported `db` is usable synchronously everywhere:
   a proxy gates every query behind a one-time bootstrap (DDL +
   auto-seed of an empty database) so callers never await an init.
   ============================================================ */

const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://csbg:csbg@localhost:5432/csbg_intake";

const EMBEDDED = DATABASE_URL.startsWith("pglite://");

/** Full connection string (server-side only — used by the seed CLI). */
export const databaseUrl = DATABASE_URL;

/** True when running on the embedded (PGlite) driver. */
export const isEmbeddedDb = EMBEDDED;

/** Connection target (no credentials) for Settings → Database & storage. */
export function databaseInfo(): { host: string; port: string; database: string; user: string } {
  if (EMBEDDED) {
    const dir = DATABASE_URL.slice("pglite://".length) || "./data/pglite";
    return { host: "embedded (PGlite)", port: "—", database: dir, user: "—" };
  }
  const u = new URL(DATABASE_URL);
  return {
    host: u.hostname,
    port: u.port || "5432",
    database: u.pathname.replace(/^\//, ""),
    user: u.username,
  };
}

type DB = NodePgDatabase<typeof schema>;

interface Conn {
  db: DB;
  ensureBoot: () => Promise<void>;
  /** Forget the completed bootstrap so the next query re-runs DDL + seed
      (seed CLI only — used right after dropping every table). */
  resetBoot: () => void;
}

/* ---------- PostgreSQL (node-postgres) ---------- */

/* One-time bootstrap on a dedicated connection: DDL + auto-seed of an empty
   database, serialized across processes (next build workers, dev + seed CLI)
   with an advisory lock. Queries through the exported `db` wait on this. */
const BOOT_LOCK = 727274001;

/* Empty-database initialization: the demo dataset by default (evaluation,
   `npm run dev`), or the minimal production init (canonical taxonomy, no
   users → /setup wizard) when CSBG_DEMO_SEED=0. Docker compose ships with
   CSBG_DEMO_SEED=0 so real installs start clean. */
const wantDemoSeed = () => process.env.CSBG_DEMO_SEED !== "0";

async function bootstrapPg(): Promise<void> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query(`SELECT pg_advisory_lock(${BOOT_LOCK})`);
    try {
      await client.query(BOOTSTRAP);
      const r = await client.query("SELECT COUNT(*)::int AS n FROM organization");
      if (r.rows[0].n === 0) {
        const db = drizzle(client, { schema });
        if (wantDemoSeed()) await runSeed(db);
        else await runInit(db);
      }
    } finally {
      await client.query(`SELECT pg_advisory_unlock(${BOOT_LOCK})`);
    }
  } finally {
    await client.end();
  }
}

function createPgConn(): Conn {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 10 });
  const conn = { booted: undefined as Promise<void> | undefined };
  const ensureBoot = () => (conn.booted ??= bootstrapPg());
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
  return {
    db: drizzle(gatedPool, { schema }),
    ensureBoot,
    resetBoot: () => { conn.booted = undefined; },
  };
}

/* ---------- Embedded (PGlite) ---------- */

function createPgliteConn(): Conn {
  let dir = DATABASE_URL.slice("pglite://".length);
  // `next build` prerenders pages from PARALLEL worker processes; several
  // engines opening one on-disk data dir at once aborts the WASM runtime
  // (and would seed the real database as a build side effect). Build-time
  // page data always comes from a throwaway in-memory engine instead —
  // the same thing the Docker build does explicitly.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    dir = "memory";
  }
  // PGlite's own mkdir is NOT recursive — a nested data dir (./data/pglite)
  // fails with ENOENT unless the parents exist. Create the full path first.
  if (dir && dir !== "memory") {
    const abs = path.resolve(dir);
    fs.mkdirSync(abs, { recursive: true });
    // A data dir a crashed instance left PARTIALLY initialized (e.g. killed
    // mid-initdb) aborts every later open. A healthy PGlite dir always has a
    // PG_VERSION file — quarantine anything non-empty without one (moved
    // aside, never deleted) so the engine can initialize fresh.
    const entries = fs.readdirSync(abs);
    const healthy = entries.includes("PG_VERSION") && entries.includes("postgresql.conf");
    if (entries.length > 0 && !healthy) {
      const quarantine = `${abs}.corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}`;
      fs.renameSync(abs, quarantine);
      fs.mkdirSync(abs, { recursive: true });
      console.warn(`[db] embedded data dir was partially initialized — moved to ${quarantine} and starting fresh`);
    }
  }
  // single in-process engine — no advisory lock needed (or available across processes);
  // embedded mode is for one local server, never for multi-process deployments
  const client = dir && dir !== "memory" ? new PGlite(dir) : new PGlite();
  const conn = { booted: undefined as Promise<void> | undefined };
  const boot = async () => {
    await client.exec(BOOTSTRAP);
    const r = await client.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM organization");
    if (r.rows[0].n === 0) {
      const db = drizzlePglite(client, { schema }) as unknown as DB;
      if (wantDemoSeed()) await runSeed(db);
      else await runInit(db);
    }
  };
  const ensureBoot = () => (conn.booted ??= boot());
  const gated = new Proxy(client, {
    get(target, prop) {
      if (prop === "query" || prop === "exec" || prop === "transaction") {
        return (...args: unknown[]) =>
          ensureBoot().then(() =>
            (target[prop as "query" | "exec" | "transaction"] as (...a: unknown[]) => unknown).apply(target, args));
      }
      const v = Reflect.get(target, prop, target);
      return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
  });
  return {
    db: drizzlePglite(gated as PGlite, { schema }) as unknown as DB,
    ensureBoot,
    resetBoot: () => { conn.booted = undefined; },
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __csbgConn: Conn | undefined;
}

// survive Next.js dev-mode hot reloads with a single pool/engine
const conn: Conn = globalThis.__csbgConn ?? (EMBEDDED ? createPgliteConn() : createPgConn());
if (process.env.NODE_ENV !== "production") globalThis.__csbgConn = conn;

export const db: DB = conn.db;

/** Force bootstrap (used by the seed CLI; app code never needs this). */
export function dbReady(): Promise<void> {
  return conn.ensureBoot();
}

/** Drop-everything reset hook for the seed CLI: forget the completed bootstrap
    so the next dbReady() re-runs DDL + auto-seed. App code never calls this. */
export function dbResetBootstrap(): void {
  conn.resetBoot();
}

export * as t from "./schema";
