import { requireUser } from "@/lib/auth";
import { Restricted } from "@/components/ui";
import { userHasCap, visibleProgramIds , orgFY} from "@/lib/access";
import { kvGet } from "@/lib/data/core";
import { monthName, prevMonthYm, shortDate, todayIso } from "@/lib/format";
import { db, t } from "@/db";
import { eq } from "drizzle-orm";
import PantryClient, { type PantryRow, type ShfbStats } from "./pantry-client";

export default async function PantryPage() {
  const user = await requireUser();
  if (!await userHasCap(user, "pantry")) return <Restricted what="the pantry network" />;

  // Aggregate cycle: the calendar month that just closed, reports due the 15th.
  const today = todayIso();
  const month = prevMonthYm(today);
  const dueIso = `${today.slice(0, 7)}-15`;

  const ids = await visibleProgramIds(user);
  const agencies = (await db.select().from(t.pantryAgencies)).filter((a) => ids.has(a.programId));
  const reports = await db.select().from(t.pantryReports).where(eq(t.pantryReports.month, month));
  const byAgency = new Map(reports.map((r) => [r.agencyId, r]));

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
      report: r?.status === "received" ? "received" : "missing",
      households: r?.households ?? null,
      lbs: r?.lbs ?? null,
    };
  });

  // Cycle status is always live; the network-wide figures come from the kv
  // rollup when one is seeded (demo shows a wider network than the sample
  // rows), otherwise straight from the tables (real installs).
  const received = rows.filter((r) => r.report === "received").length;
  const kv = await kvGet<ShfbStats>("shfbStats", {
    agencies: 0, countiesServed: 0, lbsYTD: 0, mealsYTD: 0,
    reportsThisMonth: { received: 0, missing: 0 },
  });
  let stats: ShfbStats;
  if (kv.agencies > 0) {
    stats = { ...kv, reportsThisMonth: { received, missing: rows.length - received } };
  } else {
    const fy = await orgFY();
    const agencyIds = new Set(agencies.map((a) => a.id));
    const fyLbs = (await db.select().from(t.pantryReports))
      .filter((r) => r.status === "received" && agencyIds.has(r.agencyId)
        && r.month >= fy.start.slice(0, 7) && r.month <= fy.end.slice(0, 7))
      .reduce((s, r) => s + (r.lbs ?? 0), 0);
    stats = {
      agencies: agencies.length,
      countiesServed: new Set(agencies.map((a) => a.county).filter(Boolean)).size,
      lbsYTD: fyLbs,
      mealsYTD: Math.round(fyLbs / 1.2), // Feeding America meal-equivalent conversion
      reportsThisMonth: { received, missing: rows.length - received },
    };
  }

  return (
    <PantryClient
      stats={stats}
      rows={rows}
      monthLabel={monthName(month)}
      dueLabel={shortDate(dueIso)}
    />
  );
}
