import { requireUser } from "@/lib/auth";
import { Restricted } from "@/components/ui";
import { getPrograms, userHasCap, visibleClients, visibleProgramIds } from "@/lib/access";
import { kvGet } from "@/lib/data/core";
import { currentFY, todayIso } from "@/lib/format";
import { db, t } from "@/db";
import VolunteersClient, { type VolRow, type VolStats } from "./volunteers-client";

export default async function VolunteersPage() {
  const user = await requireUser();
  if (!userHasCap(user, "volunteers")) return <Restricted what="volunteer tracking" />;

  const ids = visibleProgramIds(user);
  const links = db.select().from(t.volunteerPrograms).all();
  const byVol = new Map<string, string[]>();
  for (const l of links) {
    const arr = byVol.get(l.volunteerId) ?? [];
    arr.push(l.programId);
    byVol.set(l.volunteerId, arr);
  }

  const programs = getPrograms();
  const progById = new Map(programs.map((p) => [p.id, p]));
  const clientIds = new Set(visibleClients(user).map((c) => c.id));

  const rows: VolRow[] = db.select().from(t.volunteers).all()
    .filter((v) => (byVol.get(v.id) ?? []).some((pid) => ids.has(pid)))
    .map((v) => ({
      id: v.id,
      name: v.name,
      clientId: v.clientId,
      clientHref: v.clientId && clientIds.has(v.clientId) ? `/clients/${v.clientId}` : null,
      role: v.role,
      programs: (byVol.get(v.id) ?? [])
        .map((pid) => progById.get(pid))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .map((p) => ({ color: p.color, short: p.short })),
      hoursFY: v.hoursFY,
      lowIncome: v.lowIncome === 1,
      lastShift: v.lastShift,
    }));

  const stats = kvGet<VolStats>("volStats", { totalHoursFY: 0, lowIncomeHoursFY: 0, activeVolunteers: 0 });

  return <VolunteersClient stats={stats} rows={rows} fyShort={currentFY().short} today={todayIso()} />;
}
