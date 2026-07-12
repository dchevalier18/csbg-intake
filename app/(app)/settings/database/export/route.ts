import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/access";
import { todayIso } from "@/lib/format";

/* ============================================================
   GET /settings/database/export — full-data JSON export.
   Every table, every row, driver-agnostic (works on PostgreSQL
   AND the embedded engine, where pg_dump isn't available).
   Uploaded document FILES are not included — copy data/uploads
   alongside this export for a complete backup.
   ============================================================ */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const user = await requireAdmin();

  const tables = Object.entries(schema).filter(([, v]) => is(v, PgTable)) as Array<[string, PgTable]>;
  const dump: Record<string, unknown[]> = {};
  let rows = 0;
  for (const [, table] of tables) {
    const data = await db.select().from(table as never);
    dump[getTableName(table)] = data;
    rows += data.length;
  }

  const body = JSON.stringify(
    {
      format: "cap-trellis-export",
      version: 1,
      exportedAt: new Date().toISOString(),
      note: "Uploaded document files under data/uploads are not included in this export.",
      tables: dump,
    },
    null,
    1,
  );

  await audit(user.id, "data.export-all", "database", "export", `${tables.length} tables, ${rows} rows`);

  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="cap-trellis-export-${todayIso()}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
