import { describe, it, expect } from "vitest";
import { currentFY } from "@/lib/format";

describe("currentFY (agency fiscal-year math)", () => {
  const JUL_14_2026 = new Date(2026, 6, 14);

  it("defaults to the federal October year, named for the year it ends in", () => {
    const fy = currentFY(JUL_14_2026);
    expect(fy.label).toBe("FY 2026");
    expect(fy.start).toBe("2025-10-01");
    expect(fy.end).toBe("2026-09-30");
    expect(fy.range).toBe("Oct 1, 2025 – Sep 30, 2026");
    expect(fy.shortRange).toBe("Oct 1 – Sep 30");
  });

  it("rolls the federal year over on October 1", () => {
    expect(currentFY(new Date(2026, 8, 30)).label).toBe("FY 2026");
    expect(currentFY(new Date(2026, 9, 1)).label).toBe("FY 2027");
  });

  it("honors a July start", () => {
    const fy = currentFY(JUL_14_2026, "July");
    expect(fy.label).toBe("FY 2027"); // Jul 2026 – Jun 2027
    expect(fy.start).toBe("2026-07-01");
    expect(fy.end).toBe("2027-06-30");
    expect(fy.shortRange).toBe("Jul 1 – Jun 30");
    expect(currentFY(new Date(2026, 5, 30), "July").label).toBe("FY 2026");
  });

  it("treats a January start as the calendar year", () => {
    const fy = currentFY(JUL_14_2026, "January");
    expect(fy.label).toBe("FY 2026");
    expect(fy.start).toBe("2026-01-01");
    expect(fy.end).toBe("2026-12-31");
  });

  it("honors an April start", () => {
    const fy = currentFY(JUL_14_2026, "April");
    expect(fy.label).toBe("FY 2027"); // Apr 2026 – Mar 2027
    expect(fy.start).toBe("2026-04-01");
    expect(fy.end).toBe("2027-03-31");
    expect(currentFY(new Date(2026, 2, 31), "April").label).toBe("FY 2026");
  });

  it("falls back to October for an unknown start month", () => {
    expect(currentFY(JUL_14_2026, "Smarch").start).toBe("2025-10-01");
  });

  it("keeps pctElapsed within 0-100", () => {
    for (const m of ["October", "July", "January", "April"]) {
      const pct = currentFY(JUL_14_2026, m).pctElapsed;
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    }
  });
});
