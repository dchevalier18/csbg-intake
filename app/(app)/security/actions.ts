"use server";
/* My-account security — TOTP enrollment/disable, recovery codes, and
   signed-in-device management. Available to EVERY staff account (not
   admin-gated): second factors protect case workers too. All audited. */
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser, listSessions, revokeSession, revokeOtherSessions } from "@/lib/auth";
import { audit } from "@/lib/access";
import { getOrg } from "@/lib/data/core";
import {
  generateTotpSecret, verifyTotp, otpauthUrl,
  generateRecoveryCodes, hashRecoveryCode, matchRecoveryCode,
} from "@/lib/totp";

export interface SecurityResult {
  ok: boolean;
  message: string;
  /** enrollment start: the secret to type into the authenticator app */
  secret?: string;
  otpauth?: string;
  /** enrollment confirm / regenerate: plaintext recovery codes — shown ONCE */
  recoveryCodes?: string[];
}

const fingerprint = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex").slice(0, 12);

/** Step 1 — generate a secret and hand it to the user's authenticator app.
    Nothing is enforced until a code verifies in step 2. */
export async function startTotpEnrollment(): Promise<SecurityResult> {
  const user = await requireUser();
  if (user.totpEnabled === 1) return { ok: false, message: "Two-step verification is already on for your account." };
  const secret = generateTotpSecret();
  await db.update(t.users).set({ totpSecret: secret, totpEnabled: 0 }).where(eq(t.users.id, user.id));
  const org = await getOrg();
  return {
    ok: true,
    message: "Scan or type the key into your authenticator app, then enter the 6-digit code it shows.",
    secret,
    otpauth: otpauthUrl(secret, user.username, org.short || org.name || "CAP Trellis"),
  };
}

/** Step 2 — the first valid code turns enforcement on and issues recovery codes. */
export async function confirmTotpEnrollment(code: string): Promise<SecurityResult> {
  const user = await requireUser();
  if (user.totpEnabled === 1) return { ok: false, message: "Two-step verification is already on." };
  if (!user.totpSecret) return { ok: false, message: "Start enrollment first." };
  if (!verifyTotp(user.totpSecret, code)) {
    return { ok: false, message: "That code didn't match — codes rotate every 30 seconds. Check the app and try again." };
  }
  const codes = generateRecoveryCodes();
  await db.update(t.users)
    .set({ totpEnabled: 1, recoveryCodes: codes.map(hashRecoveryCode) })
    .where(eq(t.users.id, user.id));
  await audit(user.id, "auth.mfa-enabled", "user", user.id);
  revalidatePath("/security");
  return {
    ok: true,
    message: "Two-step verification is ON. Save these recovery codes somewhere safe — they are shown only once.",
    recoveryCodes: codes,
  };
}

/** Turn MFA off — requires a current code (or recovery code), so a walk-up
    attacker at an unlocked screen can't silently strip the second factor. */
export async function disableTotp(code: string): Promise<SecurityResult> {
  const user = await requireUser();
  if (user.totpEnabled !== 1 || !user.totpSecret) return { ok: false, message: "Two-step verification isn't on." };
  const ok = verifyTotp(user.totpSecret, code) || matchRecoveryCode(code, user.recoveryCodes) !== -1;
  if (!ok) return { ok: false, message: "Enter a current authenticator code (or a recovery code) to turn this off." };
  await db.update(t.users)
    .set({ totpEnabled: 0, totpSecret: null, recoveryCodes: [] })
    .where(eq(t.users.id, user.id));
  await audit(user.id, "auth.mfa-disabled", "user", user.id);
  revalidatePath("/security");
  return { ok: true, message: "Two-step verification is off. You can re-enroll any time." };
}

/** Fresh recovery codes (invalidates the old set) — requires a current code. */
export async function regenerateRecovery(code: string): Promise<SecurityResult> {
  const user = await requireUser();
  if (user.totpEnabled !== 1 || !user.totpSecret) return { ok: false, message: "Two-step verification isn't on." };
  if (!verifyTotp(user.totpSecret, code)) {
    return { ok: false, message: "Enter a current authenticator code to issue new recovery codes." };
  }
  const codes = generateRecoveryCodes();
  await db.update(t.users).set({ recoveryCodes: codes.map(hashRecoveryCode) }).where(eq(t.users.id, user.id));
  await audit(user.id, "auth.mfa-recovery-rotated", "user", user.id);
  revalidatePath("/security");
  return { ok: true, message: "New recovery codes issued — the old set no longer works.", recoveryCodes: codes };
}

/** Revoke one of MY sessions by fingerprint (raw tokens never reach the client). */
export async function revokeMySession(fp: string): Promise<SecurityResult> {
  const user = await requireUser();
  const sessions = await listSessions(user.id);
  const target = sessions.find((s) => fingerprint(s.token) === fp);
  if (!target) return { ok: false, message: "That session is already gone." };
  if (target.current) return { ok: false, message: "That's this browser — use Sign out instead." };
  await revokeSession(user.id, target.token);
  await audit(user.id, "auth.session-revoked", "user", user.id, target.userAgent ?? "unknown device");
  revalidatePath("/security");
  return { ok: true, message: "Signed that device out." };
}

export async function signOutEverywhereElse(): Promise<SecurityResult> {
  const user = await requireUser();
  const n = await revokeOtherSessions(user.id);
  await audit(user.id, "auth.sessions-revoked-all", "user", user.id, `${n} other session${n === 1 ? "" : "s"}`);
  revalidatePath("/security");
  return { ok: true, message: n === 0 ? "No other sessions to sign out." : `Signed out ${n} other session${n === 1 ? "" : "s"}.` };
}

/** Serializable session list for the page (tokens replaced by fingerprints). */
export async function mySessionList(): Promise<Array<{
  fp: string; createdAt: string | null; expiresAt: string; userAgent: string | null; current: boolean;
}>> {
  const user = await requireUser();
  return (await listSessions(user.id)).map((s) => ({
    fp: fingerprint(s.token),
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    userAgent: s.userAgent,
    current: s.current,
  }));
}
