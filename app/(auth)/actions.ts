"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/access";

export interface SignInState {
  error?: string;
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username and password." };

  const user = (await db.select().from(t.users).where(eq(t.users.username, username)))[0];
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    return { error: "Username or password didn't match. Demo accounts use password demo1234." };
  }

  await createSession(user.id);
  await audit(user.id, "auth.signin", "user", user.id);
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}
