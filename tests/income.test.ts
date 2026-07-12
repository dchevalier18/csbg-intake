import { describe, it, expect } from "vitest";
import { annualizeEntry, annualizeEntries, normalizeWorksheet } from "@/lib/income";

describe("income worksheet annualization", () => {
  it("annualizes each pay period correctly", () => {
    expect(annualizeEntry(500, "weekly")).toBe(26000);
    expect(annualizeEntry(1000, "biweekly")).toBe(26000);
    expect(annualizeEntry(1083.33, "twice-monthly")).toBeCloseTo(25999.92);
    expect(annualizeEntry(2000, "monthly")).toBe(24000);
    expect(annualizeEntry(30000, "annual")).toBe(30000);
  });

  it("ignores non-positive or non-finite amounts", () => {
    expect(annualizeEntry(0, "monthly")).toBe(0);
    expect(annualizeEntry(-50, "monthly")).toBe(0);
    expect(annualizeEntry(NaN, "monthly")).toBe(0);
  });

  it("sums and rounds to whole dollars", () => {
    expect(annualizeEntries([
      { source: "Employer", amount: 743.5, period: "biweekly" },   // 19,331
      { source: "SSI", amount: 943, period: "monthly" },           // 11,316
    ])).toBe(Math.round(743.5 * 26 + 943 * 12));
  });

  it("normalizeWorksheet keeps valid entries and drops junk", () => {
    const ws = normalizeWorksheet({
      entries: [
        { source: " Employer ", amount: "500", period: "weekly" },
        { source: "", amount: 100, period: "monthly" },          // no source
        { source: "Ghost", amount: -3, period: "monthly" },      // non-positive
        { source: "Alien", amount: 10, period: "hourly" },       // bad period
      ],
    }, 90);
    expect(ws).not.toBeNull();
    expect(ws!.entries).toHaveLength(1);
    expect(ws!.entries[0].source).toBe("Employer");
    expect(ws!.lookbackDays).toBe(90);
    expect(ws!.annualized).toBe(26000);
  });

  it("normalizeWorksheet returns null when nothing valid remains", () => {
    expect(normalizeWorksheet({ entries: [] }, 90)).toBeNull();
    expect(normalizeWorksheet(null, 90)).toBeNull();
    expect(normalizeWorksheet("nope", 90)).toBeNull();
  });
});
