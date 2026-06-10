"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/access";
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
}

interface CleanProgram {
  name: string;
  short: string;
  color: string;
  type: string;
  sources: string[];
}

/** Validate + normalize editor input. Caps are never stored — they derive from the TYPE at render time. */
function cleanInput(input: ProgramInput): { ok: true; value: CleanProgram } | { ok: false; message: string } {
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, message: "Program name is required." };
  if (!PROGRAM_TYPES.some((pt) => pt.id === input.type)) return { ok: false, message: "Pick a program type." };
  const short = ((input.short ?? "").trim() || name).slice(0, 22);
  const color = PROGRAM_COLORS.includes(input.color) ? input.color : PROGRAM_COLORS[1];
  const sources = Array.isArray(input.sources)
    ? input.sources.filter((s) => (DATA_SOURCES as string[]).includes(s))
    : [];
  return { ok: true, value: { name, short, color, type: input.type, sources } };
}

export async function createProgram(input: ProgramInput): Promise<ActionResult> {
  const user = await requireAdmin();
  const v = cleanInput(input);
  if (!v.ok) return { ok: false, message: v.message };

  const rows = db.select({ id: t.programs.id, sort: t.programs.sort }).from(t.programs).all();
  const existing = new Set(rows.map((r) => r.id));
  const base =
    ((input.short || v.value.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 16)) ||
    "program";
  let id = "";
  do {
    id = `${base}-${Math.floor(Math.random() * 900 + 100)}`;
  } while (existing.has(id));
  const sort = rows.reduce((m, r) => Math.max(m, r.sort), 0) + 1;

  db.insert(t.programs).values({ id, ...v.value, sort, active: 1 }).run();
  audit(user.id, "program.create", "program", id, `${v.value.name} · ${programType(v.value.type).name}`);
  revalidatePath("/", "layout");
  return { ok: true, message: `Program “${v.value.name}” added — its tools are now in the sidebar.` };
}

export async function updateProgram(id: string, input: ProgramInput): Promise<ActionResult> {
  const user = await requireAdmin();
  const existing = db.select().from(t.programs).where(eq(t.programs.id, id)).get();
  if (!existing || existing.active !== 1) return { ok: false, message: "That program no longer exists." };
  const v = cleanInput(input);
  if (!v.ok) return { ok: false, message: v.message };

  db.update(t.programs).set(v.value).where(eq(t.programs.id, id)).run();
  audit(user.id, "program.update", "program", id, `${v.value.name} · ${programType(v.value.type).name}`);
  revalidatePath("/", "layout");
  return { ok: true, message: "Program updated." };
}

export async function removeProgram(id: string): Promise<ActionResult> {
  const user = await requireAdmin();
  const existing = db.select().from(t.programs).where(eq(t.programs.id, id)).get();
  if (!existing || existing.active !== 1) return { ok: false, message: "That program no longer exists." };

  // Soft delete — history (enrollments, services, applications) stays attributed.
  db.update(t.programs).set({ active: 0 }).where(eq(t.programs.id, id)).run();
  audit(user.id, "program.remove", "program", id, existing.name);
  revalidatePath("/", "layout");
  return { ok: true, message: `Removed “${existing.name}”. Tools no longer used by any program were hidden.` };
}
