import { describe, expect, it } from "vitest";
import {
  addMonthsIso,
  allocatePayment,
  amortizationSchedule,
  centsMoney,
  monthlyPaymentCents,
  parseRateBps,
  parseTermMonths,
} from "../src/lib/loan-math";

describe("monthlyPaymentCents", () => {
  it("matches the closed-form level payment", () => {
    // $12,000 at 6.00% APR over 24 months → $531.85/mo (standard tables)
    expect(monthlyPaymentCents(12_000, 600, 24)).toBe(53_185);
  });

  it("splits evenly at zero interest", () => {
    expect(monthlyPaymentCents(1_200, 0, 12)).toBe(10_000);
    // remainder rounds the payment up so the loan still clears in term
    expect(monthlyPaymentCents(1_000, 0, 3)).toBe(33_334);
  });

  it("returns 0 for degenerate inputs", () => {
    expect(monthlyPaymentCents(0, 450, 48)).toBe(0);
    expect(monthlyPaymentCents(10_000, 450, 0)).toBe(0);
  });
});

describe("amortizationSchedule", () => {
  it("retires exactly the principal over the full term", () => {
    const rows = amortizationSchedule(18_000, 450, 48, "2026-01-15");
    expect(rows).toHaveLength(48);
    expect(rows[rows.length - 1].balance).toBe(0);
    const totalPrincipal = rows.reduce((s, r) => s + r.principal, 0);
    expect(totalPrincipal).toBe(18_000 * 100);
    // every row is internally consistent
    for (const r of rows) expect(r.payment).toBe(r.interest + r.principal);
  });

  it("front-loads interest and steps due dates monthly", () => {
    const rows = amortizationSchedule(9_500, 400, 36, "2026-03-31");
    expect(rows[0].interest).toBeGreaterThan(rows[35].interest);
    expect(rows[0].due).toBe("2026-04-30"); // clamped: Mar 31 + 1 month
    expect(rows[11].due).toBe("2027-03-31");
  });

  it("handles zero-rate loans", () => {
    const rows = amortizationSchedule(1_200, 0, 12, "2026-01-01");
    expect(rows.every((r) => r.interest === 0)).toBe(true);
    expect(rows[rows.length - 1].balance).toBe(0);
  });
});

describe("addMonthsIso", () => {
  it("clamps to the shorter month", () => {
    expect(addMonthsIso("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsIso("2028-01-31", 1)).toBe("2028-02-29"); // leap year
  });
  it("rolls across year ends", () => {
    expect(addMonthsIso("2026-11-15", 3)).toBe("2027-02-15");
  });
});

describe("allocatePayment", () => {
  it("applies interest first, remainder to principal", () => {
    // $12,480 at 4.5% APR → one month's interest ≈ $47
    const split = allocatePayment(12_480, 450, 400);
    expect(split.interest).toBe(47);
    expect(split.principal).toBe(353);
  });
  it("caps interest at the payment amount", () => {
    const split = allocatePayment(50_000, 1_000, 100);
    expect(split.interest).toBe(100);
    expect(split.principal).toBe(0);
  });
  it("treats missing rates as principal-only", () => {
    expect(allocatePayment(5_000, null, 250)).toEqual({ interest: 0, principal: 250 });
  });
});

describe("term/rate parsing", () => {
  it("parses rate text", () => {
    expect(parseRateBps("4.5%")).toBe(450);
    expect(parseRateBps("4.5")).toBe(450);
    expect(parseRateBps("450 bps")).toBe(450);
    expect(parseRateBps("prime + 2")).toBeNull();
  });
  it("parses term text", () => {
    expect(parseTermMonths("48 mo")).toBe(48);
    expect(parseTermMonths("48")).toBe(48);
    expect(parseTermMonths("4 yr")).toBe(48);
    expect(parseTermMonths("n/a")).toBeNull();
  });
});

describe("centsMoney", () => {
  it("formats cents with two decimals", () => {
    expect(centsMoney(53_185)).toBe("$531.85");
    expect(centsMoney(1_234_500)).toBe("$12,345.00");
  });
});
