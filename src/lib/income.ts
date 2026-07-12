import type { IncomeWorksheet } from "@/db/schema";

/* ============================================================
   Income worksheet math. States define the income documentation
   rules (lookback + annualization); the worksheet records what
   was counted and how it annualized into the single gross-annual
   figure the FPL math uses. Pure functions — unit-tested.
   ============================================================ */

export type IncomePeriod = IncomeWorksheet["entries"][number]["period"];

export const INCOME_PERIODS: Array<{ id: IncomePeriod; label: string; perYear: number }> = [
  { id: "weekly", label: "Weekly", perYear: 52 },
  { id: "biweekly", label: "Every two weeks", perYear: 26 },
  { id: "twice-monthly", label: "Twice a month", perYear: 24 },
  { id: "monthly", label: "Monthly", perYear: 12 },
  { id: "annual", label: "Annual", perYear: 1 },
];

const PER_YEAR: Record<IncomePeriod, number> = Object.fromEntries(
  INCOME_PERIODS.map((p) => [p.id, p.perYear]),
) as Record<IncomePeriod, number>;

/** One entry's annualized dollars (unrounded). */
export function annualizeEntry(amount: number, period: IncomePeriod): number {
  const a = Number(amount);
  if (!Number.isFinite(a) || a <= 0) return 0;
  return a * (PER_YEAR[period] ?? 1);
}

/** Whole-dollar annualized total across worksheet entries. */
export function annualizeEntries(entries: IncomeWorksheet["entries"]): number {
  return Math.round(entries.reduce((sum, e) => sum + annualizeEntry(e.amount, e.period), 0));
}

/** Validate + normalize a client-submitted worksheet payload. Returns null when
    the payload isn't usable (caller falls back to the single income figure). */
export function normalizeWorksheet(raw: unknown, lookbackDays: number): IncomeWorksheet | null {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { entries?: unknown }).entries)) return null;
  const entries: IncomeWorksheet["entries"] = [];
  for (const e of (raw as { entries: unknown[] }).entries) {
    if (!e || typeof e !== "object") continue;
    const source = String((e as { source?: unknown }).source ?? "").trim();
    const amount = Number((e as { amount?: unknown }).amount);
    const period = String((e as { period?: unknown }).period ?? "") as IncomePeriod;
    if (!source || !Number.isFinite(amount) || amount <= 0 || !(period in PER_YEAR)) continue;
    entries.push({ source: source.slice(0, 80), amount: Math.round(amount * 100) / 100, period });
  }
  if (entries.length === 0) return null;
  return { entries, lookbackDays, annualized: annualizeEntries(entries) };
}
