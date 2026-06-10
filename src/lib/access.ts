import "server-only";
import { db, t } from "@/db";
import { eq, asc, inArray } from "drizzle-orm";
import type { User, Program, Client } from "@/db/schema";
import { programType } from "@/lib/program-types";

/* ============================================================
   Access control — program assignment gates everything a user
   can see: clients, applications, services, tools. Enforce at
   the QUERY layer (server), never only in the UI.
   ============================================================ */

export function getPrograms(): Program[] {
  return db.select().from(t.programs).where(eq(t.programs.active, 1)).orderBy(asc(t.programs.sort)).all();
}

export function getProgram(id: string): Program | undefined {
  return db.select().from(t.programs).where(eq(t.programs.id, id)).get();
}

/** Program ids the user is assigned to (or all program ids for all-access users). */
export function visibleProgramIds(user: User): Set<string> {
  if (user.access === "all") return new Set(getPrograms().map((p) => p.id));
  const rows = db.select().from(t.userPrograms).where(eq(t.userPrograms.userId, user.id)).all();
  return new Set(rows.map((r) => r.programId));
}

/** Programs visible to the user, in nav order. */
export function visiblePrograms(user: User): Program[] {
  const ids = visibleProgramIds(user);
  return getPrograms().filter((p) => ids.has(p.id));
}

export function userCanSeeProgram(user: User, programId: string): boolean {
  if (user.access === "all") return true;
  return visibleProgramIds(user).has(programId);
}

/** Does any program visible to the user activate this capability? */
export function userHasCap(user: User, cap: string): boolean {
  return visiblePrograms(user).some((p) => (programType(p.type).caps as string[]).includes(cap));
}

export interface ClientWithPrograms extends Client {
  programIds: string[];
}

/** All active clients visible to the user (joined with their program ids). */
export function visibleClients(user: User): ClientWithPrograms[] {
  const ids = visibleProgramIds(user);
  const memberships = db.select().from(t.clientPrograms).all();
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
  const rows = db.select().from(t.clients).where(inArray(t.clients.id, visibleIds)).all();
  return rows
    .filter((c) => c.status === "active")
    .map((c) => ({ ...c, programIds: byClient.get(c.id) ?? [] }));
}

/** A single client IF visible to the user; undefined otherwise (or not found). */
export function visibleClient(user: User, clientId: string): ClientWithPrograms | undefined {
  const c = db.select().from(t.clients).where(eq(t.clients.id, clientId)).get();
  if (!c) return undefined;
  const memberships = db.select().from(t.clientPrograms).where(eq(t.clientPrograms.clientId, clientId)).all();
  const programIds = memberships.map((m) => m.programId);
  const ids = visibleProgramIds(user);
  if (!programIds.some((p) => ids.has(p))) return undefined;
  return { ...c, programIds };
}

/** Audit-log helper. */
export function audit(userId: string | null, action: string, entity: string, entityId: string, detail = ""): void {
  db.insert(t.auditLog).values({ at: new Date().toISOString(), userId, action, entity, entityId, detail }).run();
}
