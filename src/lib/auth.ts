import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import crypto from "node:crypto";
import { db, t } from "@/db";
import { eq, lt } from "drizzle-orm";
import type { User } from "@/db/schema";

/* ============================================================
   Session auth — scrypt password hashes, DB-backed sessions,
   httpOnly cookie. No external dependencies.
   ============================================================ */

const COOKIE = "csbg_session";
const SESSION_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export async function createSession(userId: string): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  // opportunistic cleanup of expired sessions
  db.delete(t.sessions).where(lt(t.sessions.expiresAt, new Date().toISOString())).run();
  db.insert(t.sessions).values({ token, userId, expiresAt }).run();
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.CSBG_ALLOW_HTTP !== "1",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) db.delete(t.sessions).where(eq(t.sessions.token, token)).run();
  jar.delete(COOKIE);
}

/** Current signed-in user, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = db.select().from(t.sessions).where(eq(t.sessions.token, token)).get();
  if (!session || session.expiresAt < new Date().toISOString()) return null;
  const user = db.select().from(t.users).where(eq(t.users.id, session.userId)).get();
  return user && user.active ? user : null;
});

/** Require a signed-in user; redirects to /login otherwise. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function isAdmin(user: User): boolean {
  return user.role === "Data Admin" || user.role === "Program Manager";
}

/** Require an admin (Data Admin / Program Manager); redirects non-admins to /dashboard. */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/dashboard");
  return user;
}
