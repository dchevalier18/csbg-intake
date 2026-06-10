"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit, userHasCap, visibleProgramIds } from "@/lib/access";
import { kvGet } from "@/lib/data/core";

export interface ActionResult { ok: boolean; message: string }

interface VolStatsKv { totalHoursFY: number; lowIncomeHoursFY: number; activeVolunteers: number }

/** Log a shift — adds hours to the volunteer row and the Module 2 kv rollup. */
export async function logShift(volunteerId: string, hours: number, date: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!userHasCap(user, "volunteers")) return { ok: false, message: "No access to volunteer tracking." };

  const vol = db.select().from(t.volunteers).where(eq(t.volunteers.id, volunteerId)).get();
  if (!vol) return { ok: false, message: "Volunteer not found." };

  const ids = visibleProgramIds(user);
  const links = db.select().from(t.volunteerPrograms).where(eq(t.volunteerPrograms.volunteerId, volunteerId)).all();
  if (!links.some((l) => ids.has(l.programId))) return { ok: false, message: "Volunteer not found." };

  if (!Number.isFinite(hours) || hours <= 0) return { ok: false, message: "Enter the hours donated." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "Enter a valid shift date." };

  const h = Math.round(hours);
  db.update(t.volunteers)
    .set({ hoursFY: vol.hoursFY + h, lastShift: date })
    .where(eq(t.volunteers.id, volunteerId)).run();

  // Module 2 B.1 rollup (B.1a + the federally-required B.1a.1 low-income split)
  const stats = kvGet<VolStatsKv>("volStats", { totalHoursFY: 0, lowIncomeHoursFY: 0, activeVolunteers: 0 });
  const next: VolStatsKv = {
    ...stats,
    totalHoursFY: stats.totalHoursFY + h,
    lowIncomeHoursFY: stats.lowIncomeHoursFY + (vol.lowIncome === 1 ? h : 0),
  };
  const existing = db.select().from(t.kv).where(eq(t.kv.key, "volStats")).get();
  if (existing) db.update(t.kv).set({ value: next }).where(eq(t.kv.key, "volStats")).run();
  else db.insert(t.kv).values({ key: "volStats", value: next }).run();

  audit(user.id, "volunteer.shift.log", "volunteer", volunteerId,
    `${h} hr shift on ${date} — ${vol.name}${vol.lowIncome === 1 ? " (counts in B.1a.1)" : ""}`);
  revalidatePath("/tools/volunteers");
  return { ok: true, message: "Shift logged — hours added to the Module 2 rollup." };
}
