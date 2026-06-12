import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db, databaseInfo } from "@/db";
import { fmt, localDateOf, longDate } from "@/lib/format";
import { DatabaseSettingsClient } from "./database-client";

const mb = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function scalar(query: ReturnType<typeof sql>): Promise<string> {
  const r = await db.execute(query);
  const row = (r.rows[0] ?? {}) as Record<string, unknown>;
  return String(row.v ?? "");
}

export default async function DatabaseSettingsPage() {
  await requireAdmin();
  const info = databaseInfo();

  // live facts about the PostgreSQL runtime, through the pooled connection
  const serverVersion = await scalar(sql`SELECT current_setting('server_version') AS v`);
  const dbSize = Number(await scalar(sql`SELECT pg_database_size(current_database()) AS v`));
  const tableCount = Number(await scalar(
    sql`SELECT COUNT(*) AS v FROM information_schema.tables WHERE table_schema = 'public'`,
  ));
  const countOf = (table: string) => scalar(sql`SELECT COUNT(*) AS v FROM ${sql.raw(table)}`);
  const rowCounts = [
    { label: "Clients", n: Number(await countOf("clients")) },
    { label: "Applications", n: Number(await countOf("applications")) },
    { label: "Service entries", n: Number(await countOf("service_log")) },
    { label: "Outcomes", n: Number(await countOf("outcome_log")) },
    { label: "Audit events", n: Number(await countOf("audit_log")) },
  ];

  // pg_dump backups on disk (newest first)
  const backupDir = path.join(process.cwd(), "data", "backups");
  const backups = (fs.existsSync(backupDir) ? fs.readdirSync(backupDir) : [])
    .filter((f) => f.endsWith(".sql") || f.endsWith(".db"))
    .map((f) => {
      const st = fs.statSync(path.join(backupDir, f));
      return { name: f, size: mb(st.size), createdMs: st.mtimeMs, created: longDate(localDateOf(st.mtime.toISOString())) };
    })
    .sort((a, b) => b.createdMs - a.createdMs)
    .slice(0, 8)
    .map(({ createdMs: _m, ...b }) => b);

  return (
    <DatabaseSettingsClient
      stats={{
        engine: `PostgreSQL ${serverVersion}`,
        server: `${info.host}:${info.port}`,
        database: info.database,
        role: info.user,
        size: mb(dbSize),
        tables: tableCount,
        rowCounts: rowCounts.map((r) => ({ label: r.label, n: fmt(r.n) })),
      }}
      backups={backups}
    />
  );
}
