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

/* ---------- pure schedule math (unit-tested; no DB) ---------- */

export type ScheduleFigures = Pick<FplSchedule, "base" | "perAdditional">;

/** Annual guideline dollars for a household size under one schedule. */
export function annualForSchedule(s: ScheduleFigures, size: number): number {
  return s.base + s.perAdditional * (Math.max(1, size) - 1);
}

/** % of FPL (rounded) for an income + household size under one schedule. */
export function pctForSchedule(s: ScheduleFigures, income: number, size: number): number {
  return Math.round((income / annualForSchedule(s, size)) * 100);
}

/* ---------- schedule-resolving wrappers ---------- */

export async function fplAnnualFor(size: number, year?: number | null): Promise<number> {
  return annualForSchedule(await fplSchedule(year), size);
}

/** % of FPL for an income/household size, under a pinned (or active) schedule. */
export async function fplPctFor(income: number, size: number, year?: number | null): Promise<number> {
  return pctForSchedule(await fplSchedule(year), income, size);
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
  return statusForSchedule(s, income, size, ceiling);
}

/** Pure status math for one resolved schedule (unit-tested; no DB). */
export function statusForSchedule(s: FplSchedule, income: number, size: number, ceiling: number): FplStatus {
  const pct = pctForSchedule(s, income, size);
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
