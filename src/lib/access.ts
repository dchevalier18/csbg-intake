import "server-only";
import { db, t } from "@/db";
import { eq, asc, inArray } from "drizzle-orm";
import type { User, Program, Client } from "@/db/schema";
import { programType } from "@/lib/program-types";
import { currentFY, type FiscalYear } from "@/lib/format";

/* ============================================================
   Access control — program assignment gates everything a user
   can see: clients, applications, services, tools. Enforce at
   the QUERY layer (server), never only in the UI.
   ============================================================ */

export async function getPrograms(): Promise<Program[]> {
  return db.select().from(t.programs).where(eq(t.programs.active, 1)).orderBy(asc(t.programs.sort));
}

export async function getProgram(id: string): Promise<Program | undefined> {
  return (await db.select().from(t.programs).where(eq(t.programs.id, id)))[0];
}

/** Program ids the user is assigned to (or all program ids for all-access users). */
export async function visibleProgramIds(user: User): Promise<Set<string>> {
  if (user.access === "all") return new Set((await getPrograms()).map((p) => p.id));
  const rows = await db.select().from(t.userPrograms).where(eq(t.userPrograms.userId, user.id));
  return new Set(rows.map((r) => r.programId));
}

/** Programs visible to the user, in nav order. */
export async function visiblePrograms(user: User): Promise<Program[]> {
  const ids = await visibleProgramIds(user);
  return (await getPrograms()).filter((p) => ids.has(p.id));
}

export async function userCanSeeProgram(user: User, programId: string): Promise<boolean> {
  if (user.access === "all") return true;
  return (await visibleProgramIds(user)).has(programId);
}

/** Does any program visible to the user activate this capability? */
export async function userHasCap(user: User, cap: string): Promise<boolean> {
  return (await visiblePrograms(user)).some((p) => (programType(p.type).caps as string[]).includes(cap));
}

export interface ClientWithPrograms extends Client {
  programIds: string[];
}

/** All active clients visible to the user (joined with their program ids). */
export async function visibleClients(user: User): Promise<ClientWithPrograms[]> {
  const ids = await visibleProgramIds(user);
  const memberships = await db.select().from(t.clientPrograms);
  const byClient = new Map<string, string[]>();
  for (const m of memberships) {
    const arr = byClient.get(m.clientId) ?? [];
    arr.push(m.programId);
    byClient.set(m.clientId, arr);
  }
  const visibleIds = [...byClient.entries()]
    .filter(([, programIds]) => programIds.some((p) => ids.has(p)))
    .map(([clientId]) => clientId);
  if (visibleIds.length === 0) return [];
  const rows = await db.select().from(t.clients).where(inArray(t.clients.id, visibleIds));
  return rows
    .filter((c) => c.status === "active")
    .map((c) => ({ ...c, programIds: byClient.get(c.id) ?? [] }));
}

/** A single client IF visible to the user; undefined otherwise (or not found). */
export async function visibleClient(user: User, clientId: string): Promise<ClientWithPrograms | undefined> {
  const c = (await db.select().from(t.clients).where(eq(t.clients.id, clientId)))[0];
  if (!c) return undefined;
  const memberships = await db.select().from(t.clientPrograms).where(eq(t.clientPrograms.clientId, clientId));
  const programIds = memberships.map((m) => m.programId);
  const ids = await visibleProgramIds(user);
  if (!programIds.some((p) => ids.has(p))) return undefined;
  return { ...c, programIds };
}

/** The agency's CURRENT fiscal year, honoring the FY start month from
    Settings → Organization. Server-side counterpart to currentFY(). */
export async function orgFY(): Promise<FiscalYear> {
  const org = (await db.select().from(t.organization).where(eq(t.organization.id, 1)))[0];
  return currentFY(new Date(), org?.fyStart);
}

/** Audit-log helper. */
export async function audit(userId: string | null, action: string, entity: string, entityId: string, detail = ""): Promise<void> {
  await db.insert(t.auditLog).values({ at: new Date().toISOString(), userId, action, entity, entityId, detail });
}
