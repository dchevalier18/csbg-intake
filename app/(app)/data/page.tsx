import { desc } from "drizzle-orm";
import { db, t } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { getStaff, kvGet } from "@/lib/data/core";
import { getPrograms } from "@/lib/access";
import { getFplHistory } from "@/lib/fpl";
import { importTemplate } from "@/lib/import-templates";
import { localDateOf, shortDate } from "@/lib/format";
import { DataClient, type MatchingStats } from "./data-client";

export default async function DataPage() {
  await requireAdmin();

  const integrations = await db.select().from(t.integrations);
  const matching = await kvGet<MatchingStats>("matching", { auto: 0, staff: 0, awaiting: 0, silent: 0 });

  const programs = (await getPrograms()).map((p) => ({ id: p.id, short: p.short, name: p.name }));
  const fplYears = (await getFplHistory()).map((s) => s.year);

  const staff = new Map((await getStaff()).map((s) => [s.id, s.initials]));
  const importJobs = (await db.select().from(t.importJobs)
    .orderBy(desc(t.importJobs.id))
    .limit(8))
    .map((j) => ({
      id: j.id,
      when: shortDate(localDateOf(j.at)),
      template: importTemplate(j.template)?.name ?? j.template,
      filename: j.filename,
      imported: j.imported,
      updated: j.updated,
      skipped: j.skipped,
      staffInitials: staff.get(j.staffId) ?? j.staffId,
      canUndo: j.template === "clients",
    }));

  return (
    <DataClient
      integrations={integrations.map((x) => ({
        id: x.id,
        name: x.name,
        kind: x.kind,
        status: x.status,
        lastSync: x.lastSync,
        records: x.records,
        detail: x.detail,
      }))}
      matching={matching}
      importJobs={importJobs}
      programs={programs}
      fplYears={fplYears}
    />
  );
}
