import { requireUser } from "@/lib/auth";
import { Restricted } from "@/components/ui";
import { userHasCap, visibleProgramIds } from "@/lib/access";
import { kvGet } from "@/lib/data/core";
import { db, t } from "@/db";
import { eq } from "drizzle-orm";
import PantryClient, { type PantryRow, type ShfbStats } from "./pantry-client";

// May 2026 aggregate cycle — reports due Jun 15 (today is in June).
const REPORT_MONTH = "2026-05";

export default async function PantryPage() {
  const user = await requireUser();
  if (!await userHasCap(user, "pantry")) return <Restricted what="the pantry network" />;

  const ids = await visibleProgramIds(user);
  const agencies = (await db.select().from(t.pantryAgencies)).filter((a) => ids.has(a.programId));
  const reports = await db.select().from(t.pantryReports).where(eq(t.pantryReports.month, REPORT_MONTH));
  const byAgency = new Map(reports.map((r) => [r.agencyId, r]));

  const stats = await kvGet<ShfbStats>("shfbStats", {
    agencies: 0, countiesServed: 0, lbsYTD: 0, mealsYTD: 0,
    reportsThisMonth: { received: 0, missing: 0 },
  });

  const rows: PantryRow[] = agencies.map((a) => {
    const r = byAgency.get(a.id);
    return {
      id: a.id,
      name: a.name,
      town: a.town,
      county: a.county,
      contact: a.contact,
      phone: a.phone,
      compliance: a.compliance,
      mayReport: r?.status === "received" ? "received" : "missing",
      households: r?.households ?? null,
      lbs: r?.lbs ?? null,
    };
  });

  return <PantryClient stats={stats} rows={rows} />;
}
