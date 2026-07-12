import { describe, it, expect } from "vitest";
import { annualForSchedule, pctForSchedule, statusForSchedule } from "@/lib/fpl";
import { FPL_BANDS, fplBand } from "@/lib/csbg-catalog";
import type { FplSchedule } from "@/db/schema";

// 2025 HHS guidelines, 48 contiguous states + DC (90 FR 5917)
const FPL_2025: FplSchedule = {
  year: 2025, base: 15650, perAdditional: 5500, effective: "2025-01-15", status: "active",
} as FplSchedule;

describe("annualForSchedule", () => {
  it("computes household sizes 1-8 against the published 2025 table", () => {
    const expected = [15650, 21150, 26650, 32150, 37650, 43150, 48650, 54150];
    expected.forEach((dollars, i) => {
      expect(annualForSchedule(FPL_2025, i + 1)).toBe(dollars);
    });
  });

  it("treats size 0 or negative as a household of one", () => {
    expect(annualForSchedule(FPL_2025, 0)).toBe(15650);
    expect(annualForSchedule(FPL_2025, -3)).toBe(15650);
  });

  it("extends past size 8 by the per-additional increment", () => {
    expect(annualForSchedule(FPL_2025, 10)).toBe(15650 + 9 * 5500);
  });
});

describe("pctForSchedule", () => {
  it("computes and rounds % of guideline", () => {
    expect(pctForSchedule(FPL_2025, 15650, 1)).toBe(100);
    expect(pctForSchedule(FPL_2025, 31300, 1)).toBe(200);
    expect(pctForSchedule(FPL_2025, 21150 * 1.25, 2)).toBe(125);
    expect(pctForSchedule(FPL_2025, 20000, 3)).toBe(75); // 20000/26650 = 75.05 → 75
  });
});

describe("statusForSchedule (eligibility vs ceiling)", () => {
  it("marks income at exactly the ceiling as eligible", () => {
    const s = statusForSchedule(FPL_2025, 15650 * 1.25, 1, 125);
    expect(s.pct).toBe(125);
    expect(s.eligible).toBe(true);
    expect(s.tone).toBe("sage");
    expect(s.year).toBe(2025);
  });

  it("marks income one dollar over the rounding boundary as ineligible", () => {
    // 126% of the size-1 guideline
    const s = statusForSchedule(FPL_2025, Math.ceil(15650 * 1.255), 1, 125);
    expect(s.eligible).toBe(false);
    expect(s.tone).toBe("amber"); // over ceiling but under 200%
  });

  it("uses red tone above 200%", () => {
    const s = statusForSchedule(FPL_2025, 15650 * 2.5, 1, 125);
    expect(s.tone).toBe("red");
    expect(s.eligible).toBe(false);
  });

  it("honors a program-specific 200% ceiling", () => {
    const s = statusForSchedule(FPL_2025, 15650 * 1.8, 1, 200);
    expect(s.eligible).toBe(true);
  });

  it("reports the band label from the shared catalog", () => {
    const s = statusForSchedule(FPL_2025, 15650 * 0.4, 1, 125);
    expect(s.band).toBe(FPL_BANDS[0]);
  });
});

describe("fplBand boundaries", () => {
  it("maps each boundary percent into the right band", () => {
    expect(FPL_BANDS[fplBand(0)]).toBe("Up to 50%");
    expect(FPL_BANDS[fplBand(50)]).toBe("Up to 50%");
    expect(FPL_BANDS[fplBand(51)]).toBe("51% to 75%");
    expect(FPL_BANDS[fplBand(75)]).toBe("51% to 75%");
    expect(FPL_BANDS[fplBand(76)]).toBe("76% to 100%");
    expect(FPL_BANDS[fplBand(100)]).toBe("76% to 100%");
    expect(FPL_BANDS[fplBand(101)]).toBe("101% to 125%");
    expect(FPL_BANDS[fplBand(125)]).toBe("101% to 125%");
    expect(FPL_BANDS[fplBand(126)]).toBe("126% to 150%");
    expect(FPL_BANDS[fplBand(200)]).toBe("176% to 200%");
    expect(fplBand(201)).toBe(7);
    expect(fplBand(100000)).toBe(FPL_BANDS.length - 1);
  });

  it("band count matches the label list", () => {
    // every percent from 0..300 lands inside the list
    for (let p = 0; p <= 300; p++) {
      const i = fplBand(p);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(FPL_BANDS.length);
    }
  });
});
