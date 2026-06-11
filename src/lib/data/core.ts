import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import type { Application, IntakeField, Organization, User } from "@/db/schema";

/* ============================================================
   Shared query helpers used across screens. All reads here are
   raw (unscoped) — apply access scoping with src/lib/access.ts
   unless a screen is explicitly agency-wide (e.g. Reports).
   ============================================================ */

export function getOrg(): Organization {
  return db.select().from(t.organization).where(eq(t.organization.id, 1)).get()!;
}

export function getStaff(): User[] {
  return db.select().from(t.users).where(eq(t.users.active, 1)).orderBy(asc(t.users.name)).all();
}

export function staffById(id: string | null | undefined): User | undefined {
  if (!id) return undefined;
  return db.select().from(t.users).where(eq(t.users.id, id)).get();
}

// ---------- intake form configuration ----------
export function getAllIntakeFields(): IntakeField[] {
  return db.select().from(t.intakeFields).orderBy(asc(t.intakeFields.sort)).all();
}

export function getEnabledIntakeFields(): IntakeField[] {
  return getAllIntakeFields().filter((f) => f.enabled === 1);
}

export interface AnswerList { key: string; label: string; values: string[] }

export function getListsWithValues(): AnswerList[] {
  const ls = db.select().from(t.lists).all();
  const vals = db.select().from(t.listValues).orderBy(asc(t.listValues.sort)).all();
  return ls.map((l) => ({
    key: l.key,
    label: l.label,
    values: vals.filter((v) => v.listKey === l.key).map((v) => v.value),
  }));
}

export function listValuesFor(key: string): string[] {
  return db.select().from(t.listValues)
    .where(eq(t.listValues.listKey, key))
    .orderBy(asc(t.listValues.sort))
    .all()
    .map((v) => v.value);
}

// ---------- documents ----------
export function getDocTypes(): Record<string, string> {
  return Object.fromEntries(db.select().from(t.docTypes).all().map((d) => [d.key, d.label]));
}

export function requiredDocKeys(programId: string): string[] {
  return db.select().from(t.programDocs).where(eq(t.programDocs.programId, programId)).all().map((d) => d.docKey);
}

export interface AppDoc { key: string; label: string; status: string; source: string | null }

export const DOC_STATUS_LABEL: Record<string, string> = {
  verified: "Verified",
  submitted: "Submitted — needs review",
  missing: "Missing",
};

/** Required-document checklist for an application (program requirements ∪ stored statuses). */
export function applicationDocList(app: Application): AppDoc[] {
  const types = getDocTypes();
  const stored = db.select().from(t.applicationDocs)
    .where(eq(t.applicationDocs.applicationId, app.id)).all();
  const byKey = new Map(stored.map((d) => [d.docKey, d]));
  return requiredDocKeys(app.programId).map((key) => ({
    key,
    label: types[key] ?? key,
    status: byKey.get(key)?.status ?? "missing",
    source: byKey.get(key)?.source ?? null,
  }));
}

export function applicationDocsVerified(app: Application): boolean {
  // vacuous truth: a program with no configured document requirements is
  // documents-satisfied — otherwise applications to admin-created programs
  // (which start with zero required docs) could never be approved
  return applicationDocList(app).every((d) => d.status === "verified");
}

// ---------- applications ----------
export const OPEN_STAGES = ["docs", "review", "decision"] as const;

/** Open (non-terminal) applications for a set of program ids, newest first. */
export function openApplications(programIds: string[]): Application[] {
  if (programIds.length === 0) return [];
  return db.select().from(t.applications)
    .where(inArray(t.applications.programId, programIds))
    .all()
    .filter((a) => (OPEN_STAGES as readonly string[]).includes(a.stage))
    .sort((a, b) => b.applied.localeCompare(a.applied));
}

// ---------- id generation ----------
function nextNumericId(prefix: string, existing: string[]): string {
  let max = 0;
  for (const id of existing) {
    const n = Number(id.replace(prefix, ""));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${max + 1}`;
}

export function nextClientId(): string {
  return nextNumericId("C-", db.select({ id: t.clients.id }).from(t.clients).all().map((r) => r.id));
}

export function nextApplicationId(): string {
  return nextNumericId("A-", db.select({ id: t.applications.id }).from(t.applications).all().map((r) => r.id));
}

// ---------- kv aggregates ----------
export function kvGet<T>(key: string, fallback: T): T {
  const row = db.select().from(t.kv).where(eq(t.kv.key, key)).get();
  return row ? (row.value as T) : fallback;
}

export function kvSet(key: string, value: unknown): void {
  const existing = db.select().from(t.kv).where(eq(t.kv.key, key)).get();
  if (existing) db.update(t.kv).set({ value }).where(eq(t.kv.key, key)).run();
  else db.insert(t.kv).values({ key, value }).run();
}
