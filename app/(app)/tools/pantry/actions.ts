"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit, userHasCap, visibleProgramIds, visiblePrograms } from "@/lib/access";
import { programType } from "@/lib/program-types";
import { fmt, monthName, prevMonthYm, todayIso } from "@/lib/format";

export interface ActionResult { ok: boolean; message: string }

/** The open reporting cycle — the calendar month that just closed. */
const reportMonth = () => prevMonthYm(todayIso());

/** "Remind missing" — counts the visible agencies still missing the cycle's report. */
export async function remindMissing(): Promise<ActionResult> {
  const user = await requireUser();
  if (!await userHasCap(user, "pantry")) return { ok: false, message: "No access to the pantry network." };

  const month = reportMonth();
  const ids = await visibleProgramIds(user);
  const agencies = (await db.select().from(t.pantryAgencies)).filter((a) => ids.has(a.programId));
  const reports = await db.select().from(t.pantryReports).where(eq(t.pantryReports.month, month));
  const byAgency = new Map(reports.map((r) => [r.agencyId, r]));
  const missing = agencies.filter((a) => byAgency.get(a.id)?.status !== "received");

  await audit(user.id, "pantry.remind", "pantry_report", month,
    `Reminder sent to ${missing.length} agencies with missing ${monthName(month)} reports`);
  return { ok: true, message: `Reminder sent to ${missing.length} agencies with missing ${monthName(month)} reports.` };
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

  const month = reportMonth();
  const hh = Math.round(households);
  const pounds = Math.round(lbs);
  const existing = (await db.select().from(t.pantryReports)
    .where(and(eq(t.pantryReports.agencyId, agencyId), eq(t.pantryReports.month, month)))
    )[0];
  if (existing) {
    await db.update(t.pantryReports)
      .set({ status: "received", households: hh, lbs: pounds })
      .where(eq(t.pantryReports.id, existing.id));
  } else {
    await db.insert(t.pantryReports)
      .values({ agencyId, month, status: "received", households: hh, lbs: pounds });
  }

  await audit(user.id, "pantry.report.enter", "pantry_agency", agencyId,
    `${monthName(month)} aggregate — ${fmt(hh)} households · ${fmt(pounds)} lbs`);
  revalidatePath("/tools/pantry");
  return { ok: true, message: `Aggregate report entered for ${agency.name} — rolls into SRV 5r totals.` };
}

export interface AgencyInput {
  name: string;
  town: string;
  county: string;
  contact: string;
  phone: string;
}

async function nextAgencyId(): Promise<string> {
  let max = 0;
  for (const r of await db.select({ id: t.pantryAgencies.id }).from(t.pantryAgencies)) {
    const n = Number(r.id.replace("P-", ""));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return "P-" + String(max + 1).padStart(3, "0");
}

/** Add a member agency to the visible food-bank program's network. */
export async function createAgency(input: AgencyInput): Promise<ActionResult> {
  const user = await requireUser();
  if (!await userHasCap(user, "pantry")) return { ok: false, message: "No access to the pantry network." };
  const prog = (await visiblePrograms(user)).find((p) => programType(p.type).caps.includes("pantry"));
  if (!prog) return { ok: false, message: "No access to the pantry network." };

  const name = input.name.trim();
  if (!name) return { ok: false, message: "Enter the agency's name." };
  const dupe = (await db.select().from(t.pantryAgencies))
    .find((a) => a.name.trim().toLowerCase() === name.toLowerCase());
  if (dupe) return { ok: false, message: `${dupe.id} is already named “${dupe.name}”.` };

  const id = await nextAgencyId();
  await db.insert(t.pantryAgencies).values({
    id,
    programId: prog.id,
    name,
    town: input.town.trim(),
    county: input.county.trim(),
    contact: input.contact.trim(),
    phone: input.phone.trim(),
    compliance: "current",
  });

  await audit(user.id, "pantry.agency.create", "pantry_agency", id,
    `${name}${input.town.trim() ? " — " + input.town.trim() : ""}`);
  revalidatePath("/tools/pantry");
  return { ok: true, message: `${name} added to the network as ${id} — its ${monthName(reportMonth())} report is now expected.` };
}

/** Update a member agency's contact details / compliance standing. */
export async function updateAgency(agencyId: string, input: AgencyInput & { compliance: string }): Promise<ActionResult> {
  const user = await requireUser();
  if (!await userHasCap(user, "pantry")) return { ok: false, message: "No access to the pantry network." };

  const agency = (await db.select().from(t.pantryAgencies).where(eq(t.pantryAgencies.id, agencyId)))[0];
  if (!agency || !(await visibleProgramIds(user)).has(agency.programId)) {
    return { ok: false, message: "Agency not found." };
  }
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Enter the agency's name." };
  if (input.compliance !== "current" && input.compliance !== "site-visit-due") {
    return { ok: false, message: "Invalid compliance status." };
  }

  await db.update(t.pantryAgencies).set({
    name,
    town: input.town.trim(),
    county: input.county.trim(),
    contact: input.contact.trim(),
    phone: input.phone.trim(),
    compliance: input.compliance,
  }).where(eq(t.pantryAgencies.id, agencyId));

  await audit(user.id, "pantry.agency.update", "pantry_agency", agencyId, `${name} — details updated`);
  revalidatePath("/tools/pantry");
  return { ok: true, message: `${name} updated.` };
}
