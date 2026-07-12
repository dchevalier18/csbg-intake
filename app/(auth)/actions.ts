"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import {
  createSession, destroySession, verifyPassword,
  getPendingMfaSession, completeMfaSession,
} from "@/lib/auth";
import { audit } from "@/lib/access";
import { verifyTotp, matchRecoveryCode } from "@/lib/totp";
import { signInBlocked, recordSignInFailure, clearSignInFailures } from "@/lib/rate-limit";

export interface SignInState {
  error?: string;
}

async function callerAddress(): Promise<string> {
  const h = await headers();
  // first hop of x-forwarded-for when behind the reverse proxy; empty string
  // (one shared bucket) when the header is absent
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim();
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username and password." };

  const address = await callerAddress();
  if (signInBlocked(username, address)) {
    await audit(null, "auth.signin-blocked", "user", username, "rate limit");
    return { error: "Too many sign-in attempts. Wait 15 minutes and try again." };
  }

  const user = (await db.select().from(t.users).where(eq(t.users.username, username)))[0];
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    recordSignInFailure(username, address);
    return { error: "Username or password didn't match. Demo accounts use password demo1234." };
  }

  clearSignInFailures(username);

  // second factor enrolled → password alone is NOT a session; hand off to /login/mfa
  if (user.totpEnabled === 1) {
    await createSession(user.id, { mfaPending: true });
    redirect("/login/mfa");
  }

  await createSession(user.id);
  await audit(user.id, "auth.signin", "user", user.id);
  redirect("/dashboard");
}

/** Second step: verify the authenticator code (or a single-use recovery code)
    against the pending-MFA session. Rate-limited per account. */
export async function verifyMfa(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const pending = await getPendingMfaSession();
  if (!pending) redirect("/login"); // expired or absent — start over

  const { user, token } = pending;
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Enter the 6-digit code from your authenticator app." };

  const address = await callerAddress();
  const limiterKey = `mfa:${user.username}`;
  if (signInBlocked(limiterKey, address)) {
    await audit(user.id, "auth.mfa-blocked", "user", user.id, "rate limit");
    return { error: "Too many code attempts. Wait 15 minutes and try again." };
  }

  const totpOk = user.totpSecret ? verifyTotp(user.totpSecret, code) : false;
  if (!totpOk) {
    // fall back to a single-use recovery code
    const idx = matchRecoveryCode(code, user.recoveryCodes);
    if (idx === -1) {
      recordSignInFailure(limiterKey, address);
      return { error: "That code didn't match. Codes rotate every 30 seconds — check your app and try again, or use a recovery code." };
    }
    const remaining = user.recoveryCodes.filter((_, i) => i !== idx);
    await db.update(t.users).set({ recoveryCodes: remaining }).where(eq(t.users.id, user.id));
    await audit(user.id, "auth.mfa-recovery", "user", user.id,
      `Recovery code used — ${remaining.length} remaining`);
  }

  clearSignInFailures(limiterKey);
  await completeMfaSession(token, user.id);
  await audit(user.id, "auth.signin", "user", user.id, "with MFA");
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}
