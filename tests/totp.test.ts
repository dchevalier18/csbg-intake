import { describe, it, expect } from "vitest";
import {
  base32Encode, base32Decode, generateTotpSecret, hotp, totp, verifyTotp,
  otpauthUrl, generateRecoveryCodes, hashRecoveryCode, matchRecoveryCode,
} from "@/lib/totp";

// RFC 4226 appendix D test secret ("12345678901234567890")
const RFC_SECRET_B32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("base32", () => {
  it("round-trips arbitrary bytes", () => {
    for (const len of [1, 5, 10, 20, 33]) {
      const buf = Buffer.from(Array.from({ length: len }, (_, i) => (i * 37) % 256));
      expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
    }
  });

  it("encodes the RFC test secret to the known value", () => {
    expect(base32Encode(Buffer.from("12345678901234567890"))).toBe(RFC_SECRET_B32);
  });

  it("decoding ignores case, spaces, and padding", () => {
    expect(base32Decode("gezd gnbv gy3t qojq gezd gnbv gy3t qojq").equals(
      Buffer.from("12345678901234567890"))).toBe(true);
  });
});

describe("HOTP (RFC 4226 appendix D vectors)", () => {
  it("matches the published 6-digit vectors", () => {
    const expected = ["755224", "287082", "359152", "969429", "338314",
      "254676", "287922", "162583", "399871", "520489"];
    expected.forEach((code, counter) => {
      expect(hotp(RFC_SECRET_B32, counter)).toBe(code);
    });
  });
});

describe("TOTP (RFC 6238 appendix B vectors, SHA-1/6-digit truncation)", () => {
  // RFC 6238 vectors are 8-digit; the last 6 digits are the 6-digit code
  const vectors: Array<[number, string]> = [
    [59_000, "287082"],            // 1970-01-01 00:00:59
    [1_111_111_109_000, "081804"], // 2005-03-18 01:58:29
    [1_111_111_111_000, "050471"],
    [1_234_567_890_000, "005924"],
    [2_000_000_000_000, "279037"],
  ];
  it("matches the published vectors", () => {
    for (const [ms, code] of vectors) {
      expect(totp(RFC_SECRET_B32, ms)).toBe(code);
    }
  });

  it("verifies within ±1 step and rejects outside", () => {
    const t0 = 1_111_111_109_000;
    const code = totp(RFC_SECRET_B32, t0);
    expect(verifyTotp(RFC_SECRET_B32, code, t0)).toBe(true);
    expect(verifyTotp(RFC_SECRET_B32, code, t0 + 30_000)).toBe(true);  // one step late
    expect(verifyTotp(RFC_SECRET_B32, code, t0 - 30_000)).toBe(true);  // one step early
    expect(verifyTotp(RFC_SECRET_B32, code, t0 + 90_000)).toBe(false); // too late
  });

  it("rejects malformed codes", () => {
    expect(verifyTotp(RFC_SECRET_B32, "12345", Date.now())).toBe(false);
    expect(verifyTotp(RFC_SECRET_B32, "abcdef", Date.now())).toBe(false);
    expect(verifyTotp(RFC_SECRET_B32, "", Date.now())).toBe(false);
  });

  it("accepts codes typed with spaces", () => {
    const t0 = 1_111_111_109_000;
    expect(verifyTotp(RFC_SECRET_B32, "081 804", t0)).toBe(true);
  });
});

describe("secrets and otpauth", () => {
  it("generates 160-bit base32 secrets", () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(s).length).toBe(20);
    expect(generateTotpSecret()).not.toBe(s);
  });

  it("builds a well-formed otpauth URL", () => {
    const url = otpauthUrl("ABC234", "joan", "CAP Trellis");
    expect(url).toBe("otpauth://totp/CAP%20Trellis%3Ajoan?secret=ABC234&issuer=CAP%20Trellis&algorithm=SHA1&digits=6&period=30");
  });
});

describe("recovery codes", () => {
  it("generates 8 distinct formatted codes", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const c of codes) expect(c).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });

  it("hashes and matches codes case/format-insensitively, single index", () => {
    const codes = generateRecoveryCodes();
    const hashes = codes.map(hashRecoveryCode);
    expect(matchRecoveryCode(codes[3], hashes)).toBe(3);
    expect(matchRecoveryCode(codes[3].toLowerCase().replace("-", " "), hashes)).toBe(3);
    expect(matchRecoveryCode("XXXX-XXXX", hashes)).toBe(-1);
    expect(matchRecoveryCode("", hashes)).toBe(-1);
  });
});
