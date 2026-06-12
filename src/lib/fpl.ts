import { db, t } from "@/db";
import { eq, desc } from "drizzle-orm";
import type { FplSchedule } from "@/db/schema";
import { FPL_BANDS, fplBand } from "@/lib/csbg-catalog";

/* ============================================================
   Federal Poverty Guidelines — versioned schedules with
   point-in-time pinning. Every client/application stores the
   guideline year it was assessed under; FPL math for existing
   records always uses the PINNED schedule, never the active one.
   ============================================================ */

export async function getFplHistory(): Promise<FplSchedule[]> {
  return db.select().from(t.fplSchedules).orderBy(desc(t.fplSchedules.year));
}

export async function getActiveFpl(): Promise<FplSchedule> {
  const active = (await db.select().from(t.fplSchedules).where(eq(t.fplSchedules.status, "active")))[0];
  if (active) return active;
  const latest = (await db.select().from(t.fplSchedules).orderBy(desc(t.fplSchedules.year)))[0];
  if (!latest) throw new Error("No FPL schedules configured");
  return latest;
}

/** Schedule for a pinned year; falls back to the active schedule. */
export async function fplSchedule(year?: number | null): Promise<FplSchedule> {
  if (year != null) {
    const s = (await db.select().from(t.fplSchedules).where(eq(t.fplSchedules.year, year)))[0];
    if (s) return s;
  }
  return getActiveFpl();
}

export async function fplAnnualFor(size: number, year?: number | null): Promise<number> {
  const s = await fplSchedule(year);
  return s.base + s.perAdditional * (Math.max(1, size) - 1);
}

/** % of FPL for an income/household size, under a pinned (or active) schedule. */
export async function fplPctFor(income: number, size: number, year?: number | null): Promise<number> {
  return Math.round((income / (await fplAnnualFor(size, year))) * 100);
}

export interface FplStatus {
  pct: number;
  label: string;
  tone: "sage" | "amber" | "red";
  eligible: boolean;
  band: string;     // D12 income band label
  year: number;     // schedule year the math used
}

/** Eligibility status vs the agency's CSBG ceiling (% of FPL). */
export async function fplStatusFor(income: number, size: number, year: number | null | undefined, ceiling: number): Promise<FplStatus> {
  const s = await fplSchedule(year);
  const pct = Math.round((income / (s.base + s.perAdditional * (Math.max(1, size) - 1))) * 100);
  const tone = pct <= ceiling ? "sage" : pct <= 200 ? "amber" : "red";
  return {
    pct,
    label: pct + "% FPL",
    tone,
    eligible: pct <= ceiling,
    band: FPL_BANDS[fplBand(pct)],
    year: s.year,
  };
}

export { FPL_BANDS, fplBand };
