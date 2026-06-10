"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { audit } from "@/lib/access";
import { initialsOf } from "@/lib/format";
import { ROLES } from "@/lib/program-types";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export async function addUser(name: string, username: string, role: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const cleanName = name.trim();
  const uname = username.trim().toLowerCase().replace(/\s+/g, "");
  if (cleanName.length < 3) return { ok: false, message: "Enter the user's full name." };
  if (!uname) return { ok: false, message: "Pick a username — it's how they'll sign in." };
  if (!(ROLES as readonly string[]).includes(role)) return { ok: false, message: "Pick a valid role." };
  const taken = db.select().from(t.users).where(eq(t.users.username, uname)).get();
  if (taken) return { ok: false, message: "Username “" + uname + "” is already taken — choose another." };
  const initials = initialsOf(cleanName);
  const id = initials.toLowerCase() + "-" + Date.now().toString(36);
  const allAccess = role === "Data Admin" || role === "Program Manager";
  db.insert(t.users).values({
    id,
    name: cleanName,
    username: uname,
    passwordHash: hashPassword("demo1234"),
    role,
    access: allAccess ? "all" : "assigned",
    initials,
    active: 1,
  }).run();
  audit(admin.id, "user.add", "user", id, `${cleanName} (${role}) · @${uname}`);
  revalidatePath("/", "layout");
  return {
    ok: true,
    message:
      (allAccess ? "User added with all-program access." : "User added — assign their programs below.") +
      " Starter password: demo1234.",
  };
}

export async function updateUserRole(id: string, role: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!(ROLES as readonly string[]).includes(role)) return { ok: false, message: "Pick a valid role." };
  const u = db.select().from(t.users).where(eq(t.users.id, id)).get();
  if (!u || !u.active) return { ok: false, message: "User not found." };
  db.update(t.users).set({ role }).where(eq(t.users.id, id)).run();
  audit(admin.id, "user.role", "user", id, `${u.name}: ${u.role} → ${role}`);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setUserAccess(id: string, all: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  const u = db.select().from(t.users).where(eq(t.users.id, id)).get();
  if (!u || !u.active) return { ok: false, message: "User not found." };
  db.update(t.users).set({ access: all ? "all" : "assigned" }).where(eq(t.users.id, id)).run();
  audit(admin.id, "user.access", "user", id, `${u.name}: ${all ? "all programs" : "assigned programs only"}`);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleUserProgram(userId: string, programId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const u = db.select().from(t.users).where(eq(t.users.id, userId)).get();
  if (!u || !u.active) return { ok: false, message: "User not found." };
  const p = db.select().from(t.programs).where(eq(t.programs.id, programId)).get();
  if (!p) return { ok: false, message: "Program not found." };
  const existing = db.select().from(t.userPrograms)
    .where(and(eq(t.userPrograms.userId, userId), eq(t.userPrograms.programId, programId))).get();
  if (existing) {
    db.delete(t.userPrograms)
      .where(and(eq(t.userPrograms.userId, userId), eq(t.userPrograms.programId, programId))).run();
    audit(admin.id, "user.program.unassign", "user", userId, `${u.name} − ${p.short}`);
  } else {
    db.insert(t.userPrograms).values({ userId, programId }).run();
    audit(admin.id, "user.program.assign", "user", userId, `${u.name} + ${p.short}`);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeUser(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (id === admin.id) return { ok: false, message: "You can't remove yourself." };
  const u = db.select().from(t.users).where(eq(t.users.id, id)).get();
  if (!u || !u.active) return { ok: false, message: "User not found." };
  db.update(t.users).set({ active: 0 }).where(eq(t.users.id, id)).run();
  db.delete(t.sessions).where(eq(t.sessions.userId, id)).run();
  audit(admin.id, "user.remove", "user", id, u.name);
  revalidatePath("/", "layout");
  return { ok: true, message: `Removed ${u.name}. Their historical entries remain attributed.` };
}
