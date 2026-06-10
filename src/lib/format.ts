/* Shared formatting helpers — safe in both server and client components. */

export const fmt = (n: number): string => Number(n).toLocaleString("en-US");

export const money = (n: number): string => "$" + fmt(Math.round(n));

/** "Jun 9" — short date from an ISO date string (noon-anchored to dodge TZ shifts). */
export const shortDate = (iso: string): string =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** "June 9, 2026" */
export const longDate = (iso: string): string =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/** Today's date as "YYYY-MM-DD" (local). */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ageFromDob(dob: string, onDate?: string): number {
  const ref = onDate ? new Date(onDate + "T12:00:00") : new Date();
  const b = new Date(dob + "T12:00:00");
  let age = ref.getFullYear() - b.getFullYear();
  const m = ref.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < b.getDate())) age--;
  return age;
}

export function initialsOf(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

/* ---------- Federal fiscal year (Oct 1 – Sep 30) ---------- */
export interface FiscalYear {
  label: string;     // "FY 2026"
  short: string;     // "FY26"
  range: string;     // "Oct 1, 2025 – Sep 30, 2026"
  start: string;     // ISO
  end: string;       // ISO
  pctElapsed: number;
}

export function currentFY(now = new Date()): FiscalYear {
  const fy = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
  const start = new Date(fy - 1, 9, 1);
  const end = new Date(fy, 8, 30);
  const pctElapsed = Math.min(100, Math.max(0,
    Math.round(((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100)));
  return {
    label: `FY ${fy}`,
    short: `FY${String(fy).slice(2)}`,
    range: `Oct 1, ${fy - 1} – Sep 30, ${fy}`,
    start: `${fy - 1}-10-01`,
    end: `${fy}-09-30`,
    pctElapsed,
  };
}
