/* The reporting window handed to the PA HMIS stored procedure.

   Split out of @/lib/hmis deliberately: that module imports the database layer,
   so anything a client component needs cannot live there — importing it from the
   browser drags node-postgres into the bundle. Everything here is pure (the only
   dependency is the date maths in @/lib/format), which also means the settings
   form and the sync agree on one definition of every window instead of two. */
import { currentFY } from "@/lib/format";

/** How the sync decides the window it asks the procedure for.

    The procedure's parameter NAMES are vendor-defined — ours has never returned
    a row, so nothing here can be a constant — which is why the names are
    configuration alongside the mode. Blank names mean no dates are sent at all,
    and the procedure's own internal filtering (whatever it is) applies. */
export type HmisDateRangeMode =
  | "none"                // send no date parameters
  | "fixed"               // an explicit start and end, for a one-off backfill
  | "rollingDays"         // start = today − days, end = today
  | "fiscalYearToDate"    // the agency's FY start (Settings → Organization) → today
  | "calendarYearToDate"; // January 1 → today

export interface HmisDateRange {
  mode: HmisDateRangeMode;
  /** Procedure parameter that receives the window start. Blank → send nothing. */
  startKey: string;
  /** Procedure parameter that receives the window end. Blank → send nothing. */
  endKey: string;
  /** ISO dates, mode "fixed" only. */
  start: string;
  end: string;
  /** Days back from today, mode "rollingDays" only. */
  days: number;
}

export interface HmisDateWindow { start: string; end: string }

export const DEFAULT_DATE_RANGE: HmisDateRange = {
  mode: "none", startKey: "", endKey: "", start: "", end: "", days: 90,
};

/** Picker order: off, then the two that need no dates typed, then the two that do. */
export const DATE_RANGE_MODES: HmisDateRangeMode[] = [
  "none", "fiscalYearToDate", "calendarYearToDate", "rollingDays", "fixed",
];

/** Human label for a mode, shared by the settings form and the audit log. */
export const DATE_RANGE_LABELS: Record<HmisDateRangeMode, string> = {
  none: "No date parameters",
  fixed: "Fixed dates",
  rollingDays: "Rolling window",
  fiscalYearToDate: "Fiscal year to date",
  calendarYearToDate: "Calendar year to date",
};

/** Longest rolling window offered — ~10 years, enough for any backfill, and a
    bound so a hand-edited config can't ask for a nonsense window. */
export const MAX_ROLLING_DAYS = 3650;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isIsoDate = (v: string): boolean => ISO_DATE.test(v) && !Number.isNaN(Date.parse(v));

export const isoOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Coerce anything stored (or hand-edited) into a usable range. Tolerant on
    purpose: an unrecognized mode reads as "none" rather than throwing on a page
    an admin needs in order to fix it. */
export function normalizeDateRange(raw: unknown): HmisDateRange {
  const r = (raw ?? {}) as Partial<HmisDateRange>;
  const mode = DATE_RANGE_MODES.includes(r.mode as HmisDateRangeMode)
    ? (r.mode as HmisDateRangeMode)
    : "none";
  const days = Math.round(Number(r.days));
  return {
    mode,
    startKey: String(r.startKey ?? "").trim(),
    endKey: String(r.endKey ?? "").trim(),
    start: String(r.start ?? "").trim(),
    end: String(r.end ?? "").trim(),
    days: Number.isFinite(days) && days > 0 ? Math.min(days, MAX_ROLLING_DAYS) : DEFAULT_DATE_RANGE.days,
  };
}

/** The window a range resolves to for a given day, or null when no dates should
    be sent. Pure — `today` and `fyStart` are arguments, not ambient state, so a
    rolling window is testable without mocking the clock.

    Returns null (rather than a partial window) whenever the configuration can't
    describe both ends: no mode, no parameter names to send them as, or a "fixed"
    range missing a date. Sending one half of a window is worse than sending
    none, because the procedure would silently apply its own default to the
    other end. */
export function resolveHmisDateWindow(
  range: HmisDateRange,
  today: Date = new Date(),
  fyStart = "October",
): HmisDateWindow | null {
  const { mode, startKey, endKey } = range;
  if (mode === "none") return null;
  // both names are required: the window is only meaningful as a pair
  if (!startKey || !endKey) return null;

  const todayIso = isoOf(today);
  if (mode === "fixed") {
    if (!isIsoDate(range.start) || !isIsoDate(range.end)) return null;
    if (range.start > range.end) return null;
    return { start: range.start, end: range.end };
  }
  if (mode === "rollingDays") {
    const back = new Date(today.getFullYear(), today.getMonth(), today.getDate() - range.days);
    return { start: isoOf(back), end: todayIso };
  }
  if (mode === "fiscalYearToDate") {
    // the agency's configured FY start, so this matches what Reports calls
    // "current FY" instead of inventing a second definition of the year
    return { start: currentFY(today, fyStart).start, end: todayIso };
  }
  return { start: `${today.getFullYear()}-01-01`, end: todayIso };
}

/** One line describing the window, for sync results, the audit log and Test
    connection. Dates are not identifying data, so unlike parameter VALUES in
    general these are safe to show and worth showing. */
export function describeDateWindow(range: HmisDateRange, window: HmisDateWindow | null): string {
  if (!window) {
    if (range.mode === "none") return "no date parameters sent";
    if (!range.startKey || !range.endKey) return "date range configured but the parameter names are blank — no dates sent";
    return "date range incomplete — no dates sent";
  }
  const detail = range.mode === "rollingDays" ? ` (last ${range.days} days)` : "";
  return `${DATE_RANGE_LABELS[range.mode]}${detail}: ${range.startKey}=${window.start}, ${range.endKey}=${window.end}`;
}

/** `HMIS_DATE_PARAMS="StartDate,EndDate"` — the two parameter names. */
export function parseDateParamsEnv(raw: string): { startKey: string; endKey: string } {
  const [startKey = "", endKey = ""] = (raw ?? "").split(",").map((s) => s.trim());
  return { startKey, endKey };
}

/** `HMIS_DATE_RANGE` — `fy`, `cy`, `rolling:90`, or `2026-01-01..2026-06-30`.
    A compact spec because the environment path is the ops-managed fallback; the
    settings form is the primary way to configure this. */
export function parseDateRangeEnv(raw: string): Pick<HmisDateRange, "mode" | "start" | "end" | "days"> {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return { mode: "none", start: "", end: "", days: DEFAULT_DATE_RANGE.days };
  if (v === "fy") return { mode: "fiscalYearToDate", start: "", end: "", days: DEFAULT_DATE_RANGE.days };
  if (v === "cy") return { mode: "calendarYearToDate", start: "", end: "", days: DEFAULT_DATE_RANGE.days };
  const rolling = /^rolling:(\d+)$/.exec(v);
  if (rolling) {
    const days = Math.min(Number(rolling[1]), MAX_ROLLING_DAYS);
    return { mode: "rollingDays", start: "", end: "", days: days > 0 ? days : DEFAULT_DATE_RANGE.days };
  }
  const fixed = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(v);
  if (fixed && isIsoDate(fixed[1]) && isIsoDate(fixed[2])) {
    return { mode: "fixed", start: fixed[1], end: fixed[2], days: DEFAULT_DATE_RANGE.days };
  }
  console.warn(`[hmis] HMIS_DATE_RANGE ignored — expected fy, cy, rolling:<days>, or <start>..<end>, got "${raw}"`);
  return { mode: "none", start: "", end: "", days: DEFAULT_DATE_RANGE.days };
}
