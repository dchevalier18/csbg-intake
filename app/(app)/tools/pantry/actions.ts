"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit, userHasCap, visibleProgramIds } from "@/lib/access";
import { fmt } from "@/lib/format";

const REPORT_MONTH = "2026-05";

export interface ActionResult { ok: boolean; message: string }

/** "Remind missing" — counts the visible agencies still missing the May report. */
export async function remindMissing(): Promise<ActionResult> {
  const user = await requireUser();
  if (!await userHasCap(user, "pantry")) return { ok: false, message: "No access to the pantry network." };

  const ids = await visibleProgramIds(user);
  const agencies = (await db.select().from(t.pantryAgencies)).filter((a) => ids.has(a.programId));
  const reports = await db.select().from(t.pantryReports).where(eq(t.pantryReports.month, REPORT_MONTH));
  const byAgency = new Map(reports.map((r) => [r.agencyId, r]));
  const missing = agencies.filter((a) => byAgency.get(a.id)?.status !== "received");

  await audit(user.id, "pantry.remind", "pantry_report", REPORT_MONTH,
    `Reminder sent to ${missing.length} agencies with missing May reports`);
  return { ok: true, message: `Reminder sent to ${missing.length} agencies with missing May reports.` };
}

/** Enter the monthly aggregate for an agency — flips the report row to received. */
export async function enterReport(agencyId: string, households: number, lbs: number): Promise<ActionResult> {
  const user = await requireUser();
  if (!await userHasCap(user, "pantry")) return { ok: false, message: "No access to the pantry network." };

  const agency = (await db.select().from(t.pantryAgencies).where(eq(t.pantryAgencies.id, agencyId)))[0];
  if (!agency || !(await visibleProgramIds(user)).has(agency.programId)) {
    return { ok: false, message: "Agency not found." };
  }
  if (!Number.isFinite(households) || households <= 0 || !Number.isFinite(lbs) || lbs <= 0) {
    return { ok: false, message: "Enter the households served and pounds distributed." };
  }

  const hh = Math.round(households);
  const pounds = Math.round(lbs);
  const existing = (await db.select().from(t.pantryReports)
    .where(and(eq(t.pantryReports.agencyId, agencyId), eq(t.pantryReports.month, REPORT_MONTH)))
    )[0];
  if (existing) {
    await db.update(t.pantryReports)
      .set({ status: "received", households: hh, lbs: pounds })
      .where(eq(t.pantryReports.id, existing.id));
  } else {
    await db.insert(t.pantryReports)
      .values({ agencyId, month: REPORT_MONTH, status: "received", households: hh, lbs: pounds });
  }

  await audit(user.id, "pantry.report.enter", "pantry_agency", agencyId,
    `May aggregate — ${fmt(hh)} households · ${fmt(pounds)} lbs`);
  revalidatePath("/tools/pantry");
  return { ok: true, message: `Aggregate report entered for ${agency.name} — rolls into SRV 5r totals.` };
}
