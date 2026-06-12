"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/access";
import { applicationDocsVerified, getDocTypes, openApplications, requiredDocKeys } from "@/lib/data/core";
import { DATA_SOURCES, PROGRAM_COLORS, PROGRAM_TYPES, programType } from "@/lib/program-types";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export interface ProgramInput {
  name: string;
  short: string;
  color: string;
  type: string;
  sources: string[];
  docs: string[];
}

interface CleanProgram {
  name: string;
  short: string;
  color: string;
  type: string;
  sources: string[];
}

/** Validate + normalize editor input. Caps are never stored — they derive from the TYPE at render time. */
async function cleanInput(input: ProgramInput): Promise<{ ok: true; value: CleanProgram; docs: string[] } | { ok: false; message: string }> {
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, message: "Program name is required." };
  if (!PROGRAM_TYPES.some((pt) => pt.id === input.type)) return { ok: false, message: "Pick a program type." };
  const short = ((input.short ?? "").trim() || name).slice(0, 22);
  const color = PROGRAM_COLORS.includes(input.color) ? input.color : PROGRAM_COLORS[1];
  const sources = Array.isArray(input.sources)
    ? input.sources.filter((s) => (DATA_SOURCES as string[]).includes(s))
    : [];
  const types = await getDocTypes();
  const docs = Array.isArray(input.docs) ? [...new Set(input.docs.filter((k) => Object.hasOwn(types, k)))] : [];
  return { ok: true, value: { name, short, color, type: input.type, sources }, docs };
}

/** Replace a program's required-document keys with the given set. */
async function setProgramDocs(programId: string, docs: string[]): Promise<void> {
  await db.delete(t.programDocs).where(eq(t.programDocs.programId, programId));
  if (docs.length > 0) {
    await db.insert(t.programDocs).values(docs.map((docKey) => ({ programId, docKey })));
  }
}

export async function createProgram(input: ProgramInput): Promise<ActionResult> {
  const user = await requireAdmin();
  const v = await cleanInput(input);
  if (!v.ok) return { ok: false, message: v.message };

  const rows = await db.select({ id: t.programs.id, sort: t.programs.sort }).from(t.programs);
  const existing = new Set(rows.map((r) => r.id));
  const base =
    ((input.short || v.value.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 16)) ||
    "program";
  let id = "";
  do {
    id = `${base}-${Math.floor(Math.random() * 900 + 100)}`;
  } while (existing.has(id));
  const sort = rows.reduce((m, r) => Math.max(m, r.sort), 0) + 1;

  await db.insert(t.programs).values({ id, ...v.value, sort, active: 1 });
  await setProgramDocs(id, v.docs);
  await audit(user.id, "program.create", "program", id,
    `${v.value.name} · ${programType(v.value.type).name} · ${v.docs.length} required document${v.docs.length === 1 ? "" : "s"}`);
  revalidatePath("/", "layout");
  return { ok: true, message: `Program “${v.value.name}” added — its tools are now in the sidebar.` };
}

export async function updateProgram(id: string, input: ProgramInput): Promise<ActionResult> {
  const user = await requireAdmin();
  const existing = (await db.select().from(t.programs).where(eq(t.programs.id, id)))[0];
  if (!existing || existing.active !== 1) return { ok: false, message: "That program no longer exists." };
  const v = await cleanInput(input);
  if (!v.ok) return { ok: false, message: v.message };

  const before = (await requiredDocKeys(id)).sort();
  const after = [...v.docs].sort();
  const docsChanged = before.join("|") !== after.join("|");

  await db.update(t.programs).set(v.value).where(eq(t.programs.id, id));
  if (docsChanged) {
    await setProgramDocs(id, v.docs);
    // Requirement edits move the all-verified line in both directions: removing one
    // can leave applications stuck waiting on documents, adding one can leave a
    // 'Ready for review' application with an unverified checklist. The stage
    // recompute otherwise only fires when a document status changes — re-evaluate
    // the program's open applications now (decisions are left alone).
    let advanced = 0, reverted = 0;
    for (const app of await openApplications([id])) {
      const all = await applicationDocsVerified(app);
      if (all && app.stage === "docs") {
        await db.update(t.applications).set({ stage: "review" }).where(eq(t.applications.id, app.id));
        advanced++;
      } else if (!all && app.stage === "review") {
        await db.update(t.applications).set({ stage: "docs" }).where(eq(t.applications.id, app.id));
        reverted++;
      }
    }
    const moves = [
      advanced ? `${advanced} application${advanced === 1 ? "" : "s"} advanced to review` : "",
      reverted ? `${reverted} application${reverted === 1 ? "" : "s"} reverted to waiting on documents` : "",
    ].filter(Boolean).join(" · ");
    await audit(user.id, "program.docs.update", "program", id,
      `Required documents: ${v.docs.length ? v.docs.join(", ") : "none"}${moves ? ` · ${moves}` : ""}`);
  }
  await audit(user.id, "program.update", "program", id, `${v.value.name} · ${programType(v.value.type).name}`);
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: docsChanged
      ? `Program updated — every open application's checklist now reflects the ${v.docs.length ? `${v.docs.length}-document` : "empty"} requirement list.`
      : "Program updated.",
  };
}

export async function removeProgram(id: string): Promise<ActionResult> {
  const user = await requireAdmin();
  const existing = (await db.select().from(t.programs).where(eq(t.programs.id, id)))[0];
  if (!existing || existing.active !== 1) return { ok: false, message: "That program no longer exists." };

  // open applications would become invisible and undecidable once the program
  // disappears from everyone's scope — make staff decide them first
  const openApps = await openApplications([id]);
  if (openApps.length > 0) {
    return {
      ok: false,
      message: `${existing.name} still has ${openApps.length} open application${openApps.length === 1 ? "" : "s"} in the eligibility queue — approve or deny ${openApps.length === 1 ? "it" : "them"} before removing the program.`,
    };
  }

  // Soft delete — history (enrollments, services, decided applications) stays
  // attributed. Stale user assignments are cleaned up so a later program with a
  // recycled id can't inherit access grants.
  await db.update(t.programs).set({ active: 0 }).where(eq(t.programs.id, id));
  await db.delete(t.userPrograms).where(eq(t.userPrograms.programId, id));
  await audit(user.id, "program.remove", "program", id, existing.name);
  revalidatePath("/", "layout");
  return { ok: true, message: `Removed “${existing.name}”. Tools no longer used by any program were hidden.` };
}
