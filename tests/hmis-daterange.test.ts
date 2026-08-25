import { describe, expect, it } from "vitest";
import {
  DEFAULT_DATE_PARAMS, assessCoverage, dayCount, describeWindow, fetchHmisClients,
  mergeRanges, normalizeDateParams, parseDateParamsEnv, presetWindow, resolveProcedureParams,
  subtractRanges, validateWindow, type HmisConfig, type HmisDateWindow,
} from "../src/lib/hmis";

/* The period a sync asks the stored procedure for, and the interval arithmetic
   that stops two syncs pulling the same days twice. All pure — `today` and the
   FY start month are arguments — so nothing here mocks the clock or touches
   api.clienttrack.net. */

const TODAY = new Date(2026, 5, 15); // 2026-06-15
const w = (start: string, end: string): HmisDateWindow => ({ start, end });

const cfg = (over: Partial<HmisConfig> = {}): HmisConfig => ({
  baseUrl: "https://api.clienttrack.net",
  subscriptionKey: "sub-key-placeholder",
  apiKey: "api-key-placeholder",
  orgId: "",
  pageSize: 200,
  storedProcedure: "dbo.C_Report_Placeholder_API",
  storedProcedureParams: {},
  dateParams: DEFAULT_DATE_PARAMS,
  ...over,
});

describe("date parameters", () => {
  it("defaults to the names PA HMIS confirmed", () => {
    expect(DEFAULT_DATE_PARAMS).toEqual({ startKey: "StartDate", endKey: "EndDate" });
  });

  it("reads a config saved before this existed as the confirmed names", () => {
    // not as "send nothing", which would silently become an unbounded pull
    expect(normalizeDateParams(undefined)).toEqual(DEFAULT_DATE_PARAMS);
  });

  it("keeps a deliberate one-sided config so the form can reject it", () => {
    expect(normalizeDateParams({ startKey: "From", endKey: "" })).toEqual({ startKey: "From", endKey: "" });
  });

  it("reads the env pair, falling back to the defaults", () => {
    expect(parseDateParamsEnv("From, To")).toEqual({ startKey: "From", endKey: "To" });
    expect(parseDateParamsEnv("")).toEqual(DEFAULT_DATE_PARAMS);
  });
});

describe("resolveProcedureParams", () => {
  it("sends no dates when the pull asked for no window", () => {
    const out = resolveProcedureParams(cfg({ storedProcedureParams: { Year: 2026 } }), null);
    expect(out.params).toEqual({ Year: 2026 });
    expect(out.window).toBeNull();
  });

  it("writes the window under the procedure's parameter names", () => {
    const out = resolveProcedureParams(cfg({ storedProcedureParams: { Year: 2026 } }), w("2026-01-01", "2026-03-31"));
    expect(out.params).toEqual({ Year: 2026, StartDate: "2026-01-01", EndDate: "2026-03-31" });
  });

  it("honors renamed parameters", () => {
    const out = resolveProcedureParams(
      cfg({ dateParams: { startKey: "From", endKey: "To" } }), w("2026-01-01", "2026-03-31"));
    expect(out.params).toEqual({ From: "2026-01-01", To: "2026-03-31" });
  });

  it("sends nothing when only one name is configured", () => {
    // a half window is worse than none: the procedure defaults the other end
    const out = resolveProcedureParams(
      cfg({ dateParams: { startKey: "StartDate", endKey: "" } }), w("2026-01-01", "2026-03-31"));
    expect(out.params).toEqual({});
    expect(out.window).toBeNull();
  });

  it("shadows a literal date left in the parameters JSON, and reports it", () => {
    const out = resolveProcedureParams(
      cfg({ storedProcedureParams: { StartDate: "2020-01-01", Other: "keep" } }), w("2026-01-01", "2026-03-31"));
    expect(out.params.StartDate).toBe("2026-01-01");
    expect(out.params.Other).toBe("keep");
    expect(out.shadowed).toEqual(["StartDate"]);
  });
});

describe("presets", () => {
  it("uses the agency's fiscal-year start, not a hardcoded October", () => {
    expect(presetWindow("fiscalYearToDate", TODAY, "October")).toEqual(w("2025-10-01", "2026-06-15"));
    expect(presetWindow("fiscalYearToDate", TODAY, "July")).toEqual(w("2025-07-01", "2026-06-15"));
    expect(presetWindow("fiscalYearToDate", TODAY, "January")).toEqual(w("2026-01-01", "2026-06-15"));
  });

  it("runs calendar year to date from January 1", () => {
    expect(presetWindow("calendarYearToDate", TODAY)).toEqual(w("2026-01-01", "2026-06-15"));
  });

  it("gives the whole previous calendar month", () => {
    expect(presetWindow("lastFullMonth", TODAY)).toEqual(w("2026-05-01", "2026-05-31"));
    // across a year boundary
    expect(presetWindow("lastFullMonth", new Date(2026, 0, 10))).toEqual(w("2025-12-01", "2025-12-31"));
  });
});

describe("validateWindow", () => {
  it("requires both ends", () => {
    expect(validateWindow({ start: "2026-01-01", end: "" }).ok).toBe(false);
  });
  it("rejects a backwards range", () => {
    expect(validateWindow({ start: "2026-05-01", end: "2026-04-01" }).ok).toBe(false);
  });
  it("accepts a single day", () => {
    expect(validateWindow({ start: "2026-01-01", end: "2026-01-01" }).ok).toBe(true);
  });
});

describe("mergeRanges", () => {
  it("merges overlapping windows", () => {
    expect(mergeRanges([w("2026-01-01", "2026-02-15"), w("2026-02-01", "2026-03-31")]))
      .toEqual([w("2026-01-01", "2026-03-31")]);
  });

  it("merges windows that merely touch", () => {
    // Jan 1-31 then Feb 1-28 is one unbroken stretch, not two with a gap
    expect(mergeRanges([w("2026-01-01", "2026-01-31"), w("2026-02-01", "2026-02-28")]))
      .toEqual([w("2026-01-01", "2026-02-28")]);
  });

  it("keeps genuinely separate windows apart", () => {
    // a one-day hole on Feb 1 is a real gap
    expect(mergeRanges([w("2026-01-01", "2026-01-31"), w("2026-02-02", "2026-02-28")]))
      .toEqual([w("2026-01-01", "2026-01-31"), w("2026-02-02", "2026-02-28")]);
  });

  it("absorbs a window fully inside another, in any order", () => {
    expect(mergeRanges([w("2026-02-01", "2026-02-10"), w("2026-01-01", "2026-12-31")]))
      .toEqual([w("2026-01-01", "2026-12-31")]);
  });
});

describe("subtractRanges", () => {
  it("returns the whole request when nothing was synced before", () => {
    expect(subtractRanges(w("2026-01-01", "2026-03-31"), []))
      .toEqual([w("2026-01-01", "2026-03-31")]);
  });

  it("returns nothing when the request was already fully synced", () => {
    expect(subtractRanges(w("2026-02-01", "2026-02-28"), [w("2026-01-01", "2026-12-31")]))
      .toEqual([]);
  });

  it("returns nothing for an exact repeat", () => {
    expect(subtractRanges(w("2026-01-01", "2026-03-31"), [w("2026-01-01", "2026-03-31")]))
      .toEqual([]);
  });

  it("trims a leading overlap", () => {
    expect(subtractRanges(w("2026-01-01", "2026-03-31"), [w("2026-01-01", "2026-01-31")]))
      .toEqual([w("2026-02-01", "2026-03-31")]);
  });

  it("trims a trailing overlap", () => {
    expect(subtractRanges(w("2026-01-01", "2026-03-31"), [w("2026-03-01", "2026-03-31")]))
      .toEqual([w("2026-01-01", "2026-02-28")]);
  });

  it("splits around a covered island, leaving two gaps", () => {
    expect(subtractRanges(w("2026-01-01", "2026-03-31"), [w("2026-02-01", "2026-02-28")]))
      .toEqual([w("2026-01-01", "2026-01-31"), w("2026-03-01", "2026-03-31")]);
  });

  it("ignores covered windows entirely outside the request", () => {
    expect(subtractRanges(w("2026-06-01", "2026-06-30"), [w("2025-01-01", "2025-12-31"), w("2027-01-01", "2027-01-31")]))
      .toEqual([w("2026-06-01", "2026-06-30")]);
  });
});

describe("assessCoverage", () => {
  it("flags an exact repeat as fully covered", () => {
    const v = assessCoverage(w("2026-01-01", "2026-03-31"), [w("2026-01-01", "2026-03-31")]);
    expect(v.fullyCovered).toBe(true);
    expect(v.untouched).toBe(false);
    expect(v.gaps).toEqual([]);
  });

  it("flags a brand-new period as untouched", () => {
    const v = assessCoverage(w("2026-04-01", "2026-06-30"), [w("2026-01-01", "2026-03-31")]);
    expect(v.untouched).toBe(true);
    expect(v.fullyCovered).toBe(false);
  });

  it("reports the gaps and the overlap on a partial repeat", () => {
    const v = assessCoverage(w("2026-01-01", "2026-06-30"), [w("2026-01-01", "2026-03-31")]);
    expect(v.fullyCovered).toBe(false);
    expect(v.untouched).toBe(false);
    expect(v.gaps).toEqual([w("2026-04-01", "2026-06-30")]);
    expect(v.overlapping).toEqual([w("2026-01-01", "2026-03-31")]);
  });
});

describe("describeWindow / dayCount", () => {
  it("names a same-year span once", () => {
    expect(describeWindow(w("2026-01-01", "2026-03-31"))).toBe("Jan 1 – Mar 31, 2026");
  });
  it("names both years on a span that crosses one", () => {
    expect(describeWindow(w("2025-10-01", "2026-06-15"))).toBe("Oct 1, 2025 – Jun 15, 2026");
  });
  it("collapses a single day", () => {
    expect(describeWindow(w("2026-01-01", "2026-01-01"))).toBe("Jan 1, 2026");
  });
  it("counts days inclusively", () => {
    expect(dayCount(w("2026-01-01", "2026-01-31"))).toBe(31);
    expect(dayCount(w("2026-01-01", "2026-01-01"))).toBe(1);
  });
});

describe("the window reaches the request body", () => {
  const okResponse = () => ({
    ok: true, status: 200,
    json: async () => ({ output: [], result: { table1: [] } }),
    text: async () => "",
  } as unknown as Response);

  it("posts the requested period to the procedure endpoint", async () => {
    let body: unknown;
    const fetchImpl = (async (_i: URL | RequestInfo, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return okResponse();
    }) as unknown as typeof fetch;

    const pull = await fetchHmisClients(cfg(),
      { fetchImpl, retryDelayMs: 0, window: w("2026-02-01", "2026-02-28") });
    expect(body).toEqual({ StartDate: "2026-02-01", EndDate: "2026-02-28" });
    expect(pull.dateWindow).toEqual(w("2026-02-01", "2026-02-28"));
  });

  it("posts a bare parameter set when no window is given", async () => {
    let body: unknown;
    const fetchImpl = (async (_i: URL | RequestInfo, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return okResponse();
    }) as unknown as typeof fetch;

    const pull = await fetchHmisClients(cfg(), { fetchImpl, retryDelayMs: 0 });
    expect(body).toEqual({});
    expect(pull.dateWindow).toBeNull();
  });

  it("never applies a window to the CRQL path, which has no WHERE clause", async () => {
    const urls: string[] = [];
    const fetchImpl = (async (i: URL | RequestInfo) => {
      urls.push(String(i));
      return { ok: true, status: 200, json: async () => ({}), text: async () => "" } as unknown as Response;
    }) as unknown as typeof fetch;

    const pull = await fetchHmisClients(cfg({ storedProcedure: "" }),
      { fetchImpl, retryDelayMs: 0, window: w("2026-02-01", "2026-02-28") });
    expect(pull.source).toBe("crql");
    expect(pull.dateWindow).toBeNull();
    expect(urls.join(" ")).not.toContain("StartDate");
  });
});
