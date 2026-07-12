"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/access";
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
  await createSession(user.id);
  await audit(user.id, "auth.signin", "user", user.id);
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}
