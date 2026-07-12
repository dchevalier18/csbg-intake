import { describe, it, expect, beforeEach } from "vitest";
import { signInBlocked, recordSignInFailure, clearSignInFailures, resetRateLimiter } from "@/lib/rate-limit";

const T0 = 1_750_000_000_000;

describe("sign-in rate limiting", () => {
  beforeEach(() => resetRateLimiter());

  it("allows the first attempts and blocks the account after 10 failures", () => {
    for (let i = 0; i < 10; i++) {
      expect(signInBlocked("joan", "10.0.0.1", T0 + i)).toBe(false);
      recordSignInFailure("joan", "10.0.0.1", T0 + i);
    }
    expect(signInBlocked("joan", "10.0.0.1", T0 + 11)).toBe(true);
    // a different account from a different address is unaffected
    expect(signInBlocked("dana", "10.0.0.2", T0 + 11)).toBe(false);
  });

  it("blocks an address after 30 failures across many accounts", () => {
    for (let i = 0; i < 30; i++) {
      recordSignInFailure(`user${i}`, "203.0.113.9", T0 + i);
    }
    expect(signInBlocked("someone-new", "203.0.113.9", T0 + 31)).toBe(true);
    expect(signInBlocked("someone-new", "203.0.113.10", T0 + 31)).toBe(false);
  });

  it("expires the window after 15 minutes", () => {
    for (let i = 0; i < 10; i++) recordSignInFailure("joan", "10.0.0.1", T0);
    expect(signInBlocked("joan", "10.0.0.1", T0 + 1)).toBe(true);
    expect(signInBlocked("joan", "10.0.0.1", T0 + 15 * 60 * 1000 + 1)).toBe(false);
  });

  it("clears the account counter after a successful sign-in", () => {
    for (let i = 0; i < 10; i++) recordSignInFailure("joan", "10.0.0.1", T0);
    clearSignInFailures("joan");
    expect(signInBlocked("joan", "10.0.0.1", T0 + 1)).toBe(false);
  });
});
