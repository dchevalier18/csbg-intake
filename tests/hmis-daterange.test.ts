import { describe, expect, it } from "vitest";
import {
  DEFAULT_DATE_RANGE, MAX_ROLLING_DAYS, describeDateWindow, fetchHmisClients,
  normalizeDateRange, parseDateParamsEnv, parseDateRangeEnv, resolveHmisDateWindow,
  resolveProcedureParams, type HmisConfig, type HmisDateRange,
} from "../src/lib/hmis";

/* The date window handed to the stored procedure. Resolution is pure — `today`
   and the FY start month are arguments — so a rolling window is assertable
   without mocking the clock. Nothing here touches api.clienttrack.net. */

const PROC = "dbo.C_Report_Placeholder_API";
// a Wednesday mid-FY: October start means FY 2026 began 2025-10-01
const TODAY = new Date(2026, 5, 15); // 2026-06-15

const range = (over: Partial<HmisDateRange> = {}): HmisDateRange => ({
  ...DEFAULT_DATE_RANGE, startKey: "StartDate", endKey: "EndDate", ...over,
});

const cfg = (over: Partial<HmisConfig> = {}): HmisConfig => ({
  baseUrl: "https://api.clienttrack.net",
  subscriptionKey: "sub-key-placeholder",
  apiKey: "api-key-placeholder",
  orgId: "",
  pageSize: 200,
  storedProcedure: PROC,
  storedProcedureParams: {},
  dateRange: DEFAULT_DATE_RANGE,
  ...over,
});

describe("resolveHmisDateWindow", () => {
  it("sends nothing when no range is configured", () => {
    expect(resolveHmisDateWindow(range({ mode: "none" }), TODAY)).toBeNull();
  });

  it("refuses a window it can't name — both parameter names are required", () => {
    // half a window is worse than none: the procedure would default the other end
    expect(resolveHmisDateWindow(range({ mode: "fiscalYearToDate", startKey: "" }), TODAY)).toBeNull();
    expect(resolveHmisDateWindow(range({ mode: "fiscalYearToDate", endKey: "" }), TODAY)).toBeNull();
  });

  it("resolves a fixed range verbatim", () => {
    const r = range({ mode: "fixed", start: "2026-01-01", end: "2026-03-31" });
    expect(resolveHmisDateWindow(r, TODAY)).toEqual({ start: "2026-01-01", end: "2026-03-31" });
  });

  it("rejects a fixed range that is incomplete or backwards", () => {
    expect(resolveHmisDateWindow(range({ mode: "fixed", start: "2026-01-01", end: "" }), TODAY)).toBeNull();
    expect(resolveHmisDateWindow(range({ mode: "fixed", start: "2026-05-01", end: "2026-04-01" }), TODAY)).toBeNull();
  });

  it("rolls a day window back from today, inclusive of today as the end", () => {
    expect(resolveHmisDateWindow(range({ mode: "rollingDays", days: 30 }), TODAY))
      .toEqual({ start: "2026-05-16", end: "2026-06-15" });
  });

  it("crosses month and year boundaries when rolling back", () => {
    const newYear = new Date(2026, 0, 10); // 2026-01-10
    expect(resolveHmisDateWindow(range({ mode: "rollingDays", days: 30 }), newYear))
      .toEqual({ start: "2025-12-11", end: "2026-01-10" });
  });

  it("uses the agency's fiscal-year start, not a hardcoded October", () => {
    const r = range({ mode: "fiscalYearToDate" });
    // federal default: FY 2026 runs Oct 1 2025 – Sep 30 2026
    expect(resolveHmisDateWindow(r, TODAY, "October")).toEqual({ start: "2025-10-01", end: "2026-06-15" });
    // an agency on a July year is mid-FY2026 on the same day, from 2025-07-01
    expect(resolveHmisDateWindow(r, TODAY, "July")).toEqual({ start: "2025-07-01", end: "2026-06-15" });
    // January start coincides with the calendar year
    expect(resolveHmisDateWindow(r, TODAY, "January")).toEqual({ start: "2026-01-01", end: "2026-06-15" });
  });

  it("runs calendar year to date from January 1", () => {
    expect(resolveHmisDateWindow(range({ mode: "calendarYearToDate" }), TODAY))
      .toEqual({ start: "2026-01-01", end: "2026-06-15" });
  });
});

describe("resolveProcedureParams", () => {
  it("leaves the configured parameters alone when no range is set", () => {
    const c = cfg({ storedProcedureParams: { Year: 2026 } });
    const out = resolveProcedureParams(c, TODAY);
    expect(out.params).toEqual({ Year: 2026 });
    expect(out.window).toBeNull();
    expect(out.shadowed).toEqual([]);
  });

  it("adds the window alongside the configured parameters", () => {
    const c = cfg({
      storedProcedureParams: { Year: 2026 },
      dateRange: range({ mode: "calendarYearToDate" }),
    });
    const out = resolveProcedureParams(c, TODAY);
    expect(out.params).toEqual({ Year: 2026, StartDate: "2026-01-01", EndDate: "2026-06-15" });
  });

  it("shadows a literal date left in the parameters JSON, and reports it", () => {
    // the whole point of the feature: a hand-typed date must not win over the
    // rolling window, and the operator has to be told it was replaced
    const c = cfg({
      storedProcedureParams: { StartDate: "2020-01-01", Other: "keep" },
      dateRange: range({ mode: "calendarYearToDate" }),
    });
    const out = resolveProcedureParams(c, TODAY);
    expect(out.params.StartDate).toBe("2026-01-01");
    expect(out.params.Other).toBe("keep");
    expect(out.shadowed).toEqual(["StartDate"]);
  });
});

describe("normalizeDateRange", () => {
  it("reads a config saved before the feature existed as 'no dates'", () => {
    expect(normalizeDateRange(undefined).mode).toBe("none");
  });

  it("falls back to none on an unrecognized mode rather than throwing", () => {
    // the settings page has to render in order to fix a bad value
    expect(normalizeDateRange({ mode: "lastTuesday" }).mode).toBe("none");
  });

  it("clamps a nonsense day count", () => {
    expect(normalizeDateRange({ mode: "rollingDays", days: -5 }).days).toBe(DEFAULT_DATE_RANGE.days);
    expect(normalizeDateRange({ mode: "rollingDays", days: 99999 }).days).toBe(MAX_ROLLING_DAYS);
  });

  it("trims parameter names", () => {
    expect(normalizeDateRange({ startKey: "  StartDate " }).startKey).toBe("StartDate");
  });
});

describe("environment fallback", () => {
  it("reads the parameter names as a pair", () => {
    expect(parseDateParamsEnv("StartDate, EndDate")).toEqual({ startKey: "StartDate", endKey: "EndDate" });
  });

  it("understands the compact range specs", () => {
    expect(parseDateRangeEnv("fy").mode).toBe("fiscalYearToDate");
    expect(parseDateRangeEnv("cy").mode).toBe("calendarYearToDate");
    expect(parseDateRangeEnv("rolling:45")).toMatchObject({ mode: "rollingDays", days: 45 });
    expect(parseDateRangeEnv("2026-01-01..2026-06-30"))
      .toMatchObject({ mode: "fixed", start: "2026-01-01", end: "2026-06-30" });
  });

  it("ignores an unparseable spec instead of guessing", () => {
    expect(parseDateRangeEnv("last-quarter-ish").mode).toBe("none");
  });
});

describe("describeDateWindow", () => {
  it("names the parameters and values it sent", () => {
    const r = range({ mode: "rollingDays", days: 30 });
    const w = resolveHmisDateWindow(r, TODAY)!;
    expect(describeDateWindow(r, w)).toBe("Rolling window (last 30 days): StartDate=2026-05-16, EndDate=2026-06-15");
  });

  it("says why nothing was sent when the names are missing", () => {
    const r = range({ mode: "fiscalYearToDate", startKey: "" });
    expect(describeDateWindow(r, null)).toContain("parameter names are blank");
  });
});

describe("the window reaches the request body", () => {
  it("posts the resolved dates to the procedure endpoint", async () => {
    let body: unknown;
    const fetchImpl = (async (_input: URL | RequestInfo, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({ output: [], result: { table1: [] } }),
        text: async () => "",
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const c = cfg({ dateRange: range({ mode: "fixed", start: "2026-02-01", end: "2026-02-28" }) });
    const pull = await fetchHmisClients(c, { fetchImpl, retryDelayMs: 0, today: TODAY });
    expect(body).toEqual({ StartDate: "2026-02-01", EndDate: "2026-02-28" });
    expect(pull.dateWindow).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });

  it("posts a bare parameter set when no range is configured", async () => {
    let body: unknown;
    const fetchImpl = (async (_input: URL | RequestInfo, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({ output: [], result: { table1: [] } }),
        text: async () => "",
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const pull = await fetchHmisClients(cfg(), { fetchImpl, retryDelayMs: 0, today: TODAY });
    expect(body).toEqual({});
    expect(pull.dateWindow).toBeNull();
  });

  it("never applies a window to the CRQL path, which has no WHERE clause", async () => {
    const urls: string[] = [];
    const fetchImpl = (async (input: URL | RequestInfo) => {
      urls.push(String(input));
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => "",
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const c = cfg({ storedProcedure: "", dateRange: range({ mode: "calendarYearToDate" }) });
    const pull = await fetchHmisClients(c, { fetchImpl, retryDelayMs: 0, today: TODAY });
    expect(pull.source).toBe("crql");
    expect(pull.dateWindow).toBeNull();
    expect(urls.join(" ")).not.toContain("StartDate");
  });
});
