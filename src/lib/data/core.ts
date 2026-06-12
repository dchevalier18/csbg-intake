import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import type { Application, IntakeField, Organization, User } from "@/db/schema";

/* ============================================================
   Shared query helpers used across screens. All reads here are
   raw (unscoped) — apply access scoping with src/lib/access.ts
   unless a screen is explicitly agency-wide (e.g. Reports).
   ============================================================ */

export async function getOrg(): Promise<Organization> {
  return (await db.select().from(t.organization).where(eq(t.organization.id, 1)))[0]!;
}

/** Effective FPL eligibility ceiling (% of FPL) for a program — the program's
    own override when set, otherwise the agency-wide CSBG ceiling. */
export async function programCeiling(programId: string): Promise<number> {
  const row = (await db.select({ fplCeiling: t.programs.fplCeiling })
    .from(t.programs).where(eq(t.programs.id, programId)))[0];
  return row?.fplCeiling ?? (await getOrg()).csbgCeiling;
}

export async function getStaff(): Promise<User[]> {
  return db.select().from(t.users).where(eq(t.users.active, 1)).orderBy(asc(t.users.name));
}

export async function staffById(id: string | null | undefined): Promise<User | undefined> {
  if (!id) return undefined;
  return (await db.select().from(t.users).where(eq(t.users.id, id)))[0];
}

// ---------- intake form configuration ----------
export async function getAllIntakeFields(): Promise<IntakeField[]> {
  return db.select().from(t.intakeFields).orderBy(asc(t.intakeFields.sort));
}

export async function getEnabledIntakeFields(): Promise<IntakeField[]> {
  return (await getAllIntakeFields()).filter((f) => f.enabled === 1);
}

export interface AnswerList { key: string; label: string; values: string[] }

export async function getListsWithValues(): Promise<AnswerList[]> {
  const ls = await db.select().from(t.lists);
  const vals = await db.select().from(t.listValues).orderBy(asc(t.listValues.sort));
  return ls.map((l) => ({
    key: l.key,
    label: l.label,
    values: vals.filter((v) => v.listKey === l.key).map((v) => v.value),
  }));
}

export async function listValuesFor(key: string): Promise<string[]> {
  const rows = await db.select().from(t.listValues)
    .where(eq(t.listValues.listKey, key))
    .orderBy(asc(t.listValues.sort));
  return rows.map((v) => v.value);
}

// ---------- documents ----------
export async function getDocTypes(): Promise<Record<string, string>> {
  return Object.fromEntries((await db.select().from(t.docTypes)).map((d) => [d.key, d.label]));
}

export async function requiredDocKeys(programId: string): Promise<string[]> {
  return (await db.select().from(t.programDocs).where(eq(t.programDocs.programId, programId))).map((d) => d.docKey);
}

export interface AppDoc {
  key: string;
  label: string;
  status: string;
  source: string | null;
  /** Supporting file on record (metadata; the stored copy lives under data/uploads/). */
  file: { name: string; by: string | null; when: string | null } | null;
  /** Verification sign-off — who marked it verified, when. */
  verification: { by: string; when: string | null } | null;
  /** Signed exception — verified without a document retained. */
  bypass: { by: string; when: string | null; reason: string } | null;
}

export const DOC_STATUS_LABEL: Record<string, string> = {
  verified: "Verified",
  submitted: "Submitted — needs review",
  missing: "Missing",
};

/** Required-document checklist for an application (program requirements ∪ stored statuses). */
export async function applicationDocList(app: Application): Promise<AppDoc[]> {
  const types = await getDocTypes();
  const stored = await db.select().from(t.applicationDocs)
    .where(eq(t.applicationDocs.applicationId, app.id));
  const byKey = new Map(stored.map((d) => [d.docKey, d]));
  return (await requiredDocKeys(app.programId)).map((key) => {
    const row = byKey.get(key);
    return {
      key,
      label: Object.hasOwn(types, key) ? types[key] : key,
      status: row?.status ?? "missing",
      source: row?.source ?? null,
      file: row?.fileName ? { name: row.fileName, by: row.fileBy, when: row.fileAt } : null,
      verification: row?.verifiedBy ? { by: row.verifiedBy, when: row.verifiedAt } : null,
      bypass: row?.bypassBy ? { by: row.bypassBy, when: row.bypassAt, reason: row.bypassReason ?? "" } : null,
    };
  });
}

export async function applicationDocsVerified(app: Application): Promise<boolean> {
  // vacuous truth: a program with no configured document requirements is
  // documents-satisfied — otherwise applications to admin-created programs
  // (which start with zero required docs) could never be approved
  return (await applicationDocList(app)).every((d) => d.status === "verified");
}

// ---------- applications ----------
export const OPEN_STAGES = ["docs", "review", "decision"] as const;

/** Open (non-terminal) applications for a set of program ids, newest first. */
export async function openApplications(programIds: string[]): Promise<Application[]> {
  if (programIds.length === 0) return [];
  return (await db.select().from(t.applications)
    .where(inArray(t.applications.programId, programIds)))
    .filter((a) => (OPEN_STAGES as readonly string[]).includes(a.stage))
    .sort((a, b) => b.applied.localeCompare(a.applied));
}

/** Denied applications for a set of program ids, most recent decision first. */
export async function deniedApplications(programIds: string[]): Promise<Application[]> {
  if (programIds.length === 0) return [];
  return (await db.select().from(t.applications)
    .where(inArray(t.applications.programId, programIds)))
    .filter((a) => a.stage === "denied")
    .sort((a, b) => (b.decidedAt ?? b.applied).localeCompare(a.decidedAt ?? a.applied));
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

export async function nextClientId(): Promise<string> {
  return nextNumericId("C-", (await db.select({ id: t.clients.id }).from(t.clients)).map((r) => r.id));
}

export async function nextApplicationId(): Promise<string> {
  return nextNumericId("A-", (await db.select({ id: t.applications.id }).from(t.applications)).map((r) => r.id));
}

// ---------- kv aggregates ----------
export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const row = (await db.select().from(t.kv).where(eq(t.kv.key, key)))[0];
  return row ? (row.value as T) : fallback;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const existing = (await db.select().from(t.kv).where(eq(t.kv.key, key)))[0];
  if (existing) await db.update(t.kv).set({ value }).where(eq(t.kv.key, key));
  else await db.insert(t.kv).values({ key, value });
}
