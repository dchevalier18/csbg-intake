import crypto from "node:crypto";

/* ============================================================
   TOTP (RFC 6238) on node:crypto — no external dependencies.
   SHA-1 / 6 digits / 30-second steps, the parameters every
   authenticator app defaults to. Verification allows ±1 step of
   clock drift. Enrollment is manual-entry (base32 secret) plus
   an otpauth:// link; recovery codes are scrypt-hashed at rest.
   ============================================================ */

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32_ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** New 160-bit TOTP secret, base32 (what the user types into their app). */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

/** HOTP (RFC 4226): HMAC-SHA1 + dynamic truncation → 6 digits. */
export function hotp(secretB32: string, counter: number): string {
  const key = base32Decode(secretB32);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = crypto.createHmac("sha1", key).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const code = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

export const TOTP_STEP_SECONDS = 30;

/** Current TOTP code (test hook: pass an epoch-ms timestamp). */
export function totp(secretB32: string, nowMs = Date.now()): string {
  return hotp(secretB32, Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS));
}

/** Constant-time 6-digit code check across a ±1-step drift window. */
export function verifyTotp(secretB32: string, code: string, nowMs = Date.now()): boolean {
  const candidate = String(code ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(candidate)) return false;
  const counter = Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);
  for (const c of [counter, counter - 1, counter + 1]) {
    const expected = hotp(secretB32, c);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(candidate))) return true;
  }
  return false;
}

/** otpauth:// URI for authenticator apps (also works as a tap-link on mobile). */
export function otpauthUrl(secretB32: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${TOTP_STEP_SECONDS}`;
}

/* ---------- recovery codes ---------- */

/** 8 single-use codes, format XXXX-XXXX (unambiguous alphabet). */
export function generateRecoveryCodes(count = 8): string[] {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I/L/O/0/1
  return Array.from({ length: count }, () => {
    const chars = Array.from(crypto.randomBytes(8), (b) => alphabet[b % alphabet.length]);
    return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
  });
}

const normalizeRecovery = (s: string) => s.toUpperCase().replace(/[^A-Z2-9]/g, "");

export function hashRecoveryCode(code: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(normalizeRecovery(code), salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

/** Match a submitted code against the stored hashes → index of the consumed
    code, or -1. Caller removes the consumed hash (single use). */
export function matchRecoveryCode(code: string, hashes: string[]): number {
  const normalized = normalizeRecovery(code ?? "");
  if (normalized.length < 8) return -1;
  for (let i = 0; i < hashes.length; i++) {
    const [scheme, salt, hash] = hashes[i].split("$");
    if (scheme !== "scrypt" || !salt || !hash) continue;
    const candidate = crypto.scryptSync(normalized, salt, 32);
    const expected = Buffer.from(hash, "hex");
    if (candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)) return i;
  }
  return -1;
}
