"use server";
/* Settings → Database & storage. PostgreSQL runtime health + on-demand pg_dump
   backups. The connection itself is configured by DATABASE_URL in the server
   environment (.env / systemd unit), never stored in the database. */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db, databaseUrl, databaseInfo } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/access";

const execFileAsync = promisify(execFile);

export interface ActionResult { ok: boolean; message: string }

function shortError(e: unknown): string {
  // pg surfaces connection refusals as AggregateError with an empty message
  if (e instanceof AggregateError && e.errors.length > 0) return shortError(e.errors[0]);
  const err = e as NodeJS.ErrnoException;
  const msg = (e instanceof Error ? e.message : String(e)) || err?.code || "no response from the server";
  return msg.replace(/\s+/g, " ").slice(0, 160);
}

/** Round-trip health check against the live pool. */
export async function runHealthCheck(): Promise<ActionResult> {
  const user = await requireAdmin();
  try {
    const started = Date.now();
    await db.execute(sql`SELECT 1`);
    const ms = Date.now() - started;
    const info = databaseInfo();
    await audit(user.id, "db.health", "settings", "database", `SELECT 1 round-trip in ${ms} ms`);
    return { ok: true, message: `Healthy — ${info.host}:${info.port}/${info.database} answered in ${ms} ms.` };
  } catch (e) {
    return { ok: false, message: `Health check failed — ${shortError(e)}` };
  }
}

/** On-demand logical backup via pg_dump, written to data/backups/. */
export async function backupNow(): Promise<ActionResult> {
  const user = await requireAdmin();
  const dir = path.join(process.cwd(), "data", "backups");
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
  const dest = path.join(dir, `csbg-${stamp}.sql`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    await execFileAsync("pg_dump", ["--no-owner", "--format=plain", `--file=${dest}`, databaseUrl], { timeout: 120_000 });
    const size = fs.statSync(dest).size;
    await audit(user.id, "db.backup", "settings", "database", `${path.basename(dest)} · ${size} bytes`);
    revalidatePath("/settings/database");
    return { ok: true, message: `Backup written — ${path.basename(dest)} (${(size / 1024 / 1024).toFixed(1)} MB).` };
  } catch (e) {
    return { ok: false, message: `Backup failed — ${shortError(e)}. pg_dump must be installed on the app server.` };
  }
}
