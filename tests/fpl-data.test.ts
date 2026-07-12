import { describe, it, expect } from "vitest";
import { OFFICIAL_FPL, officialFpl, JURISDICTIONS, LATEST_OFFICIAL_FPL_YEAR } from "@/lib/fpl-data";
import { annualForSchedule } from "@/lib/fpl";

describe("official HHS guideline tables", () => {
  it("carries all three jurisdictions for every year", () => {
    for (const [year, tables] of Object.entries(OFFICIAL_FPL)) {
      for (const j of JURISDICTIONS) {
        expect(tables[j.id], `${year} missing ${j.id}`).toBeTruthy();
        expect(tables[j.id].base).toBeGreaterThan(0);
        expect(tables[j.id].perAdditional).toBeGreaterThan(0);
        expect(tables[j.id].effective).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("2026 contiguous figures match 91 FR 1797", () => {
    const t = officialFpl(2026, "contiguous48")!;
    expect(t.base).toBe(15960);
    expect(t.perAdditional).toBe(5680);
    // published household-size rows (1-5 verified in the FR notice)
    expect(annualForSchedule(t, 2)).toBe(21640);
    expect(annualForSchedule(t, 3)).toBe(27320);
    expect(annualForSchedule(t, 4)).toBe(33000);
    expect(annualForSchedule(t, 5)).toBe(38680);
  });

  it("2025 contiguous figures match 90 FR 5917", () => {
    const t = officialFpl(2025, "contiguous48")!;
    expect(t.base).toBe(15650);
    expect(annualForSchedule(t, 8)).toBe(54150);
  });

  it("Alaska and Hawaii run higher than the contiguous table", () => {
    for (const year of Object.keys(OFFICIAL_FPL).map(Number)) {
      const c = officialFpl(year, "contiguous48")!;
      const a = officialFpl(year, "alaska")!;
      const h = officialFpl(year, "hawaii")!;
      expect(a.base).toBeGreaterThan(c.base);
      expect(h.base).toBeGreaterThan(c.base);
      expect(a.base).toBeGreaterThan(h.base);
    }
  });

  it("guidelines increase year over year (2023-2026)", () => {
    for (const j of JURISDICTIONS) {
      let prev = 0;
      for (const year of [2023, 2024, 2025, 2026]) {
        const t = officialFpl(year, j.id)!;
        expect(t.base, `${j.id} ${year}`).toBeGreaterThan(prev);
        prev = t.base;
      }
    }
  });

  it("latest year is 2026 and unknown years return null", () => {
    expect(LATEST_OFFICIAL_FPL_YEAR).toBe(2026);
    expect(officialFpl(1999, "contiguous48")).toBeNull();
  });
});
