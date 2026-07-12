import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import crypto from "node:crypto";
import { db, t } from "@/db";
import { and, eq, lt, ne } from "drizzle-orm";
import type { User } from "@/db/schema";

/* ============================================================
   Session auth — scrypt password hashes, DB-backed sessions,
   httpOnly cookie, optional TOTP MFA (see src/lib/totp.ts).
   No external dependencies.
   ============================================================ */

const COOKIE = "csbg_session";
const SESSION_DAYS = 30;
const MFA_PENDING_MINUTES = 10;

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

async function callerUserAgent(): Promise<string | null> {
  const h = await headers();
  return (h.get("user-agent") ?? "").slice(0, 200) || null;
}

export async function createSession(userId: string, opts?: { mfaPending?: boolean }): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  const pending = opts?.mfaPending === true;
  // pending-MFA sessions live minutes, not days — abandonments expire fast
  const ttlMs = pending ? MFA_PENDING_MINUTES * 60_000 : SESSION_DAYS * 86400_000;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  // opportunistic cleanup of expired sessions
  await db.delete(t.sessions).where(lt(t.sessions.expiresAt, new Date().toISOString()));
  await db.insert(t.sessions).values({
    token,
    userId,
    expiresAt,
    mfaPending: pending ? 1 : 0,
    createdAt: new Date().toISOString(),
    userAgent: await callerUserAgent(),
  });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.CSBG_ALLOW_HTTP !== "1",
    path: "/",
    maxAge: pending ? MFA_PENDING_MINUTES * 60 : SESSION_DAYS * 86400,
  });
}

/** The MFA-pending session on this browser (password verified, code not yet):
    used only by the /login/mfa step. */
export async function getPendingMfaSession(): Promise<{ token: string; user: User } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = (await db.select().from(t.sessions).where(eq(t.sessions.token, token)))[0];
  if (!session || session.mfaPending !== 1 || session.expiresAt < new Date().toISOString()) return null;
  const user = (await db.select().from(t.users).where(eq(t.users.id, session.userId)))[0];
  return user && user.active ? { token, user } : null;
}

/** Promote a pending-MFA session to a full session after the code verifies.
    The token ROTATES — the pre-MFA token never becomes a usable credential. */
export async function completeMfaSession(pendingToken: string, userId: string): Promise<void> {
  await db.delete(t.sessions).where(eq(t.sessions.token, pendingToken));
  await createSession(userId);
}

/** All of a user's full sessions (newest first) for the Security page. */
export async function listSessions(userId: string): Promise<Array<{
  token: string; createdAt: string | null; expiresAt: string; userAgent: string | null; current: boolean;
}>> {
  const jar = await cookies();
  const mine = jar.get(COOKIE)?.value;
  const now = new Date().toISOString();
  return (await db.select().from(t.sessions).where(and(eq(t.sessions.userId, userId), eq(t.sessions.mfaPending, 0))))
    .filter((s) => s.expiresAt >= now)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .map((s) => ({
      token: s.token,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      userAgent: s.userAgent,
      current: s.token === mine,
    }));
}

/** Revoke one of the user's OWN sessions by token. */
export async function revokeSession(userId: string, token: string): Promise<void> {
  await db.delete(t.sessions).where(and(eq(t.sessions.token, token), eq(t.sessions.userId, userId)));
}

/** Sign out everywhere else — every session for the user except this browser's. */
export async function revokeOtherSessions(userId: string): Promise<number> {
  const jar = await cookies();
  const mine = jar.get(COOKIE)?.value ?? "";
  const others = (await db.select({ token: t.sessions.token }).from(t.sessions)
    .where(and(eq(t.sessions.userId, userId), ne(t.sessions.token, mine)))).length;
  await db.delete(t.sessions).where(and(eq(t.sessions.userId, userId), ne(t.sessions.token, mine)));
  return others;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(t.sessions).where(eq(t.sessions.token, token));
  jar.delete(COOKIE);
}

/** Current signed-in user, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = (await db.select().from(t.sessions).where(eq(t.sessions.token, token)))[0];
  // a pending-MFA session is NOT signed in — the TOTP step hasn't happened
  if (!session || session.mfaPending === 1 || session.expiresAt < new Date().toISOString()) return null;
  const user = (await db.select().from(t.users).where(eq(t.users.id, session.userId)))[0];
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
