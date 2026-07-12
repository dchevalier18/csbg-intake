"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit, userHasCap, visibleClient, visibleProgramIds } from "@/lib/access";
import { kvGet, kvSet } from "@/lib/data/core";

export interface ActionResult { ok: boolean; message: string }

interface VolStatsKv { totalHoursFY: number; lowIncomeHoursFY: number; activeVolunteers: number }

async function nextVolunteerId(): Promise<string> {
  let max = 0;
  for (const r of await db.select({ id: t.volunteers.id }).from(t.volunteers)) {
    const n = Number(r.id.replace("V-", ""));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return "V-" + (max + 1);
}

export interface VolunteerInput {
  name: string;
  role: string;
  programId: string;
  lowIncome: boolean;
  clientId: string | null;
}

/** Add a volunteer to one of the user's programs. Hours are logged per shift
    afterwards (or imported from a spreadsheet on Data & integrations). */
export async function createVolunteer(input: VolunteerInput): Promise<ActionResult> {
  const user = await requireUser();
  if (!await userHasCap(user, "volunteers")) return { ok: false, message: "No access to volunteer tracking." };

  const name = input.name.trim();
  if (!name) return { ok: false, message: "Enter the volunteer's name." };
  const ids = await visibleProgramIds(user);
  if (!ids.has(input.programId)) return { ok: false, message: "Pick one of your programs." };
  const dupe = (await db.select().from(t.volunteers))
    .find((v) => v.name.trim().toLowerCase() === name.toLowerCase());
  if (dupe) return { ok: false, message: `${dupe.id} is already named “${dupe.name}” — shifts log against the existing record.` };

  let clientId: string | null = null;
  if (input.clientId) {
    const c = await visibleClient(user, input.clientId);
    if (!c) return { ok: false, message: "Client record not found." };
    clientId = c.id;
  }

  const id = await nextVolunteerId();
  const lowIncome = input.lowIncome ? 1 : 0;
  await db.insert(t.volunteers).values({
    id, name, clientId, lowIncome, role: input.role.trim(), hoursFY: 0, lastShift: null,
  });
  await db.insert(t.volunteerPrograms).values({ volunteerId: id, programId: input.programId });

  const stats = await kvGet<VolStatsKv>("volStats", { totalHoursFY: 0, lowIncomeHoursFY: 0, activeVolunteers: 0 });
  await kvSet("volStats", { ...stats, activeVolunteers: stats.activeVolunteers + 1 });

  await audit(user.id, "volunteer.create", "volunteer", id,
    `${name}${input.role.trim() ? " — " + input.role.trim() : ""}${lowIncome ? " · low-income (B.1a.1)" : ""}`);
  revalidatePath("/tools/volunteers");
  return { ok: true, message: `${name} added as ${id} — log shifts to count their hours in Module 2.` };
}

/** Update a volunteer's role / low-income status / client link.
    The low-income flag drives how FUTURE hours split into B.1a.1. */
export async function updateVolunteer(
  volunteerId: string,
  input: { role: string; lowIncome: boolean; clientId: string | null },
): Promise<ActionResult> {
  const user = await requireUser();
  if (!await userHasCap(user, "volunteers")) return { ok: false, message: "No access to volunteer tracking." };

  const vol = (await db.select().from(t.volunteers).where(eq(t.volunteers.id, volunteerId)))[0];
  if (!vol) return { ok: false, message: "Volunteer not found." };
  const ids = await visibleProgramIds(user);
  const links = await db.select().from(t.volunteerPrograms).where(eq(t.volunteerPrograms.volunteerId, volunteerId));
  if (!links.some((l) => ids.has(l.programId))) return { ok: false, message: "Volunteer not found." };

  let clientId: string | null = null;
  if (input.clientId) {
    const c = await visibleClient(user, input.clientId);
    if (!c) return { ok: false, message: "Client record not found." };
    clientId = c.id;
  }

  await db.update(t.volunteers)
    .set({ role: input.role.trim(), lowIncome: input.lowIncome ? 1 : 0, clientId })
    .where(eq(t.volunteers.id, volunteerId));

  await audit(user.id, "volunteer.update", "volunteer", volunteerId,
    `${vol.name} — details updated${vol.lowIncome !== (input.lowIncome ? 1 : 0) ? " (low-income flag changed; applies to future hours)" : ""}`);
  revalidatePath("/tools/volunteers");
  return { ok: true, message: `${vol.name} updated — the low-income flag applies to hours logged from now on.` };
}

/** Log a shift — adds hours to the volunteer row and the Module 2 kv rollup. */
export async function logShift(volunteerId: string, hours: number, date: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!await userHasCap(user, "volunteers")) return { ok: false, message: "No access to volunteer tracking." };

  const vol = (await db.select().from(t.volunteers).where(eq(t.volunteers.id, volunteerId)))[0];
  if (!vol) return { ok: false, message: "Volunteer not found." };

  const ids = await visibleProgramIds(user);
  const links = await db.select().from(t.volunteerPrograms).where(eq(t.volunteerPrograms.volunteerId, volunteerId));
  if (!links.some((l) => ids.has(l.programId))) return { ok: false, message: "Volunteer not found." };

  if (!Number.isFinite(hours) || hours <= 0) return { ok: false, message: "Enter the hours donated." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "Enter a valid shift date." };

  const h = Math.round(hours);
  await db.update(t.volunteers)
    .set({ hoursFY: vol.hoursFY + h, lastShift: date })
    .where(eq(t.volunteers.id, volunteerId));

  // Module 2 B.1 rollup (B.1a + the federally-required B.1a.1 low-income split)
  const stats = await kvGet<VolStatsKv>("volStats", { totalHoursFY: 0, lowIncomeHoursFY: 0, activeVolunteers: 0 });
  const next: VolStatsKv = {
    ...stats,
    totalHoursFY: stats.totalHoursFY + h,
    lowIncomeHoursFY: stats.lowIncomeHoursFY + (vol.lowIncome === 1 ? h : 0),
  };
  const existing = (await db.select().from(t.kv).where(eq(t.kv.key, "volStats")))[0];
  if (existing) await db.update(t.kv).set({ value: next }).where(eq(t.kv.key, "volStats"));
  else await db.insert(t.kv).values({ key: "volStats", value: next });

  await audit(user.id, "volunteer.shift.log", "volunteer", volunteerId,
    `${h} hr shift on ${date} — ${vol.name}${vol.lowIncome === 1 ? " (counts in B.1a.1)" : ""}`);
  revalidatePath("/tools/volunteers");
  return { ok: true, message: "Shift logged — hours added to the Module 2 rollup." };
}
