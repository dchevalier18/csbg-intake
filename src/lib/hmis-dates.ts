/* The reporting window a PA HMIS sync asks the stored procedure for, and the
   arithmetic that keeps two syncs from pulling the same period twice.

   Split out of @/lib/hmis deliberately: that module imports the database layer,
   so anything a client component needs cannot live there — importing it from the
   browser drags node-postgres into the bundle. Everything here is pure (the only
   dependency is the date maths in @/lib/format), which also means the sync
   dialog and the sync itself agree on one definition of every window. */
import { currentFY } from "@/lib/format";

/** A closed date window, both ends inclusive, as ISO "YYYY-MM-DD".

    ISO dates compare correctly with `<`/`>` as strings, which is why every
    comparison here is lexicographic rather than going through Date. */
export interface HmisDateWindow { start: string; end: string }

/** The procedure's own parameter names for the window. Confirmed with the PA
    HMIS engineer as StartDate/EndDate for CACLV's procedure, but kept
    configurable: they belong to whoever wrote the procedure, and another
    agency's will differ. */
export interface HmisDateParams { startKey: string; endKey: string }

export const DEFAULT_DATE_PARAMS: HmisDateParams = { startKey: "StartDate", endKey: "EndDate" };

/** Presets the sync dialog offers. Not stored — the range is chosen per run, so
    these only seed the date inputs. */
export type HmisWindowPreset =
  | "fiscalYearToDate"    // the agency's FY start (Settings → Organization) → today
  | "calendarYearToDate"  // January 1 → today
  | "lastFullMonth"       // the calendar month before this one, whole
  | "custom";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isIsoDate = (v: string): boolean => ISO_DATE.test(v) && !Number.isNaN(Date.parse(v));

export const isoOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const parseIso = (iso: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

/** Day after / before, as ISO. Used to decide whether two windows touch:
    Jan 1–31 and Feb 1–28 are contiguous coverage, not a gap. */
export const nextDayIso = (iso: string): string => {
  const d = parseIso(iso);
  d.setDate(d.getDate() + 1);
  return isoOf(d);
};

export const prevDayIso = (iso: string): string => {
  const d = parseIso(iso);
  d.setDate(d.getDate() - 1);
  return isoOf(d);
};

/** Inclusive day count, for reporting how much a window covers. */
export const dayCount = (w: HmisDateWindow): number =>
  Math.round((parseIso(w.end).getTime() - parseIso(w.start).getTime()) / 86_400_000) + 1;

export function normalizeDateParams(raw: unknown): HmisDateParams {
  const r = (raw ?? {}) as Partial<HmisDateParams>;
  const startKey = String(r.startKey ?? "").trim();
  const endKey = String(r.endKey ?? "").trim();
  // absent (a config saved before this existed) falls back to the confirmed
  // names rather than to "send nothing", which would be a silent full pull
  if (!startKey && !endKey) return { ...DEFAULT_DATE_PARAMS };
  return { startKey, endKey };
}

/** `HMIS_DATE_PARAMS="StartDate,EndDate"` — the ops-managed fallback. */
export function parseDateParamsEnv(raw: string): HmisDateParams {
  const [startKey = "", endKey = ""] = (raw ?? "").split(",").map((s) => s.trim());
  return startKey || endKey ? { startKey, endKey } : { ...DEFAULT_DATE_PARAMS };
}

/** Seed dates for a preset. Pure — `today` and `fyStart` are arguments, so the
    dialog and any test agree without mocking the clock. */
export function presetWindow(
  preset: HmisWindowPreset,
  today: Date = new Date(),
  fyStart = "October",
): HmisDateWindow | null {
  const todayIso = isoOf(today);
  if (preset === "fiscalYearToDate") return { start: currentFY(today, fyStart).start, end: todayIso };
  if (preset === "calendarYearToDate") return { start: `${today.getFullYear()}-01-01`, end: todayIso };
  if (preset === "lastFullMonth") {
    const firstOfThis = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastOfPrev = new Date(firstOfThis.getTime() - 86_400_000);
    return { start: isoOf(new Date(lastOfPrev.getFullYear(), lastOfPrev.getMonth(), 1)), end: isoOf(lastOfPrev) };
  }
  return null;
}

/** Valid as a request: both ends present and in order. */
export function validateWindow(w: Partial<HmisDateWindow>): { ok: true; value: HmisDateWindow } | { ok: false; message: string } {
  const start = (w.start ?? "").trim();
  const end = (w.end ?? "").trim();
  if (!start || !end) return { ok: false, message: "Pick both a start and an end date for the period to sync." };
  if (!isIsoDate(start) || !isIsoDate(end)) return { ok: false, message: "Dates must be calendar dates (YYYY-MM-DD)." };
  if (start > end) return { ok: false, message: "The start date must fall on or before the end date." };
  return { ok: true, value: { start, end } };
}

/** Overlapping or merely touching windows collapsed into the fewest that cover
    the same days. Adjacency counts: Jan 1–31 followed by Feb 1–28 is one
    unbroken stretch, and treating it as two would report a phantom gap. */
export function mergeRanges(ranges: HmisDateWindow[]): HmisDateWindow[] {
  const sorted = [...ranges].filter((r) => r.start && r.end && r.start <= r.end)
    .sort((a, b) => (a.start === b.start ? a.end.localeCompare(b.end) : a.start.localeCompare(b.start)));
  const out: HmisDateWindow[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= nextDayIso(last.end)) {
      if (r.end > last.end) last.end = r.end;
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

/** The parts of `requested` no window in `covered` already accounts for.

    Empty result = every day requested has been synced before. One result equal
    to `requested` = none of it has. Anything else is a partial overlap, and the
    caller decides whether to narrow to the gaps or ask. */
export function subtractRanges(requested: HmisDateWindow, covered: HmisDateWindow[]): HmisDateWindow[] {
  const gaps: HmisDateWindow[] = [];
  let cursor = requested.start;
  for (const c of mergeRanges(covered)) {
    if (c.end < cursor) continue;          // entirely before what's left
    if (c.start > requested.end) break;    // sorted, so nothing later can overlap
    if (c.start > cursor) gaps.push({ start: cursor, end: prevDayIso(c.start) });
    // resume the day after this covered stretch ends
    if (c.end >= requested.end) return gaps;
    cursor = nextDayIso(c.end);
  }
  if (cursor <= requested.end) gaps.push({ start: cursor, end: requested.end });
  return gaps;
}

export interface CoverageVerdict {
  /** Every requested day was already synced. */
  fullyCovered: boolean;
  /** Nothing requested has been synced before. */
  untouched: boolean;
  /** The days still needing a pull. */
  gaps: HmisDateWindow[];
  /** Previously synced windows that intersect the request, for the message. */
  overlapping: HmisDateWindow[];
}

export function assessCoverage(requested: HmisDateWindow, covered: HmisDateWindow[]): CoverageVerdict {
  const gaps = subtractRanges(requested, covered);
  const overlapping = mergeRanges(covered)
    .filter((c) => c.start <= requested.end && c.end >= requested.start);
  const untouched = gaps.length === 1
    && gaps[0].start === requested.start && gaps[0].end === requested.end;
  return { fullyCovered: gaps.length === 0, untouched, gaps, overlapping };
}

/** "Jan 1 – Mar 31, 2026" — for sync results, the audit log, and the history
    list. Dates are not identifying data, so these are safe to show in full. */
export function describeWindow(w: HmisDateWindow): string {
  const fmt = (iso: string, withYear: boolean) =>
    parseIso(iso).toLocaleDateString("en-US",
      withYear ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" });
  if (w.start === w.end) return fmt(w.start, true);
  const sameYear = w.start.slice(0, 4) === w.end.slice(0, 4);
  return `${fmt(w.start, !sameYear)} – ${fmt(w.end, true)}`;
}

export const describeWindows = (ws: HmisDateWindow[]): string =>
  ws.map(describeWindow).join(", ");
