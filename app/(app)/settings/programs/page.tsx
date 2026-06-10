import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { getPrograms } from "@/lib/access";
import { ProgramsSettingsClient } from "./programs-client";

export default async function ProgramsSettingsPage() {
  await requireAdmin();
  const programs = getPrograms();

  // enrolled = active clients holding a membership in each program
  const activeClientIds = new Set(
    db.select({ id: t.clients.id }).from(t.clients).where(eq(t.clients.status, "active")).all().map((c) => c.id),
  );
  const memberships = db.select().from(t.clientPrograms).all();
  const enrolledByProgram = new Map<string, number>();
  for (const m of memberships) {
    if (!activeClientIds.has(m.clientId)) continue;
    enrolledByProgram.set(m.programId, (enrolledByProgram.get(m.programId) ?? 0) + 1);
  }

  return (
    <ProgramsSettingsClient
      programs={programs.map((p) => ({
        id: p.id,
        name: p.name,
        short: p.short,
        color: p.color,
        type: p.type,
        sources: p.sources,
        enrolled: enrolledByProgram.get(p.id) ?? 0,
      }))}
    />
  );
}
