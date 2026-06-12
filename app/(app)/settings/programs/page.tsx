import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { getPrograms } from "@/lib/access";
import { ProgramsSettingsClient } from "./programs-client";

export default async function ProgramsSettingsPage() {
  await requireAdmin();
  const programs = await getPrograms();

  // enrolled = active clients holding a membership in each program
  const activeClientIds = new Set(
    (await db.select({ id: t.clients.id }).from(t.clients).where(eq(t.clients.status, "active"))).map((c) => c.id),
  );
  const memberships = await db.select().from(t.clientPrograms);
  const enrolledByProgram = new Map<string, number>();
  for (const m of memberships) {
    if (!activeClientIds.has(m.clientId)) continue;
    enrolledByProgram.set(m.programId, (enrolledByProgram.get(m.programId) ?? 0) + 1);
  }

  // required-document keys per program (drives the application checklist live)
  const docTypes = (await db.select().from(t.docTypes)).map((d) => ({ key: d.key, label: d.label }));
  const docRows = await db.select().from(t.programDocs);
  const docsByProgram = new Map<string, string[]>();
  for (const d of docRows) {
    const arr = docsByProgram.get(d.programId) ?? [];
    arr.push(d.docKey);
    docsByProgram.set(d.programId, arr);
  }

  return (
    <ProgramsSettingsClient
      docTypes={docTypes}
      programs={programs.map((p) => ({
        id: p.id,
        name: p.name,
        short: p.short,
        color: p.color,
        type: p.type,
        sources: p.sources,
        docs: docsByProgram.get(p.id) ?? [],
        enrolled: enrolledByProgram.get(p.id) ?? 0,
      }))}
    />
  );
}
