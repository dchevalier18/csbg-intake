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

export function getFplHistory(): FplSchedule[] {
  return db.select().from(t.fplSchedules).orderBy(desc(t.fplSchedules.year)).all();
}

export function getActiveFpl(): FplSchedule {
  const active = db.select().from(t.fplSchedules).where(eq(t.fplSchedules.status, "active")).get();
  if (active) return active;
  const latest = db.select().from(t.fplSchedules).orderBy(desc(t.fplSchedules.year)).get();
  if (!latest) throw new Error("No FPL schedules configured");
  return latest;
}

/** Schedule for a pinned year; falls back to the active schedule. */
export function fplSchedule(year?: number | null): FplSchedule {
  if (year != null) {
    const s = db.select().from(t.fplSchedules).where(eq(t.fplSchedules.year, year)).get();
    if (s) return s;
  }
  return getActiveFpl();
}

export function fplAnnualFor(size: number, year?: number | null): number {
  const s = fplSchedule(year);
  return s.base + s.perAdditional * (Math.max(1, size) - 1);
}

/** % of FPL for an income/household size, under a pinned (or active) schedule. */
export function fplPctFor(income: number, size: number, year?: number | null): number {
  return Math.round((income / fplAnnualFor(size, year)) * 100);
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
export function fplStatusFor(income: number, size: number, year: number | null | undefined, ceiling: number): FplStatus {
  const s = fplSchedule(year);
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
