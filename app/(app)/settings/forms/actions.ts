"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/access";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

const FIELD_TYPES = ["choice", "text", "yesno", "number", "date"] as const;

function revalidateForms() {
  revalidatePath("/intake");
  revalidatePath("/settings/forms");
}

// ---------- intake questions ----------

export async function updateIntakeField(
  id: string,
  patch: { label?: string; code?: string; optionsText?: string; enabled?: boolean },
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const field = db.select().from(t.intakeFields).where(eq(t.intakeFields.id, id)).get();
  if (!field) return { ok: false, message: "Question not found." };
  const set: Partial<{ label: string; code: string; optionsText: string; enabled: number }> = {};
  const changes: string[] = [];
  if (patch.label !== undefined && patch.label.trim() && patch.label !== field.label) {
    set.label = patch.label;
    changes.push(`label “${field.label}” → “${patch.label}”`);
  }
  if (patch.code !== undefined && patch.code !== field.code) {
    set.code = patch.code.trim();
    changes.push(`code → “${patch.code.trim()}”`);
  }
  if (patch.optionsText !== undefined && patch.optionsText !== (field.optionsText ?? "")) {
    set.optionsText = patch.optionsText;
    changes.push("options updated");
  }
  if (patch.enabled !== undefined && (patch.enabled ? 1 : 0) !== field.enabled) {
    set.enabled = patch.enabled ? 1 : 0;
    changes.push(patch.enabled ? "enabled" : "disabled");
  }
  if (Object.keys(set).length === 0) return { ok: true };
  db.update(t.intakeFields).set(set).where(eq(t.intakeFields.id, id)).run();
  audit(admin.id, "forms.field.update", "intake_field", id, `${field.label}: ${changes.join("; ")}`);
  revalidateForms();
  return { ok: true };
}

export async function removeIntakeField(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const field = db.select().from(t.intakeFields).where(eq(t.intakeFields.id, id)).get();
  if (!field) return { ok: false, message: "Question not found." };
  if (field.builtin === 1) return { ok: false, message: "Standard questions can't be removed." };
  db.delete(t.intakeFields).where(eq(t.intakeFields.id, id)).run();
  audit(admin.id, "forms.field.remove", "intake_field", id, field.label);
  revalidateForms();
  return { ok: true, message: "Question removed from the intake form." };
}

export async function addIntakeField(
  label: string,
  type: string,
  optionsText: string,
  code: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const cleanLabel = label.trim();
  if (cleanLabel.length < 3) return { ok: false, message: "Give the question a label." };
  if (!(FIELD_TYPES as readonly string[]).includes(type)) return { ok: false, message: "Pick a valid answer type." };
  if (type === "choice" && !optionsText.trim()) return { ok: false, message: "List the choice options, comma-separated." };
  const all = db.select({ sort: t.intakeFields.sort }).from(t.intakeFields).all();
  const maxSort = all.reduce((m, r) => Math.max(m, r.sort), 0);
  const id = "q" + Date.now().toString(36);
  db.insert(t.intakeFields).values({
    id,
    label: cleanLabel,
    code: code.trim(),
    type,
    listKey: null,
    optionsText: type === "choice" ? optionsText.trim() : null,
    enabled: 1,
    builtin: 0,
    sort: maxSort + 1,
  }).run();
  audit(admin.id, "forms.field.add", "intake_field", id, `${cleanLabel} (${type}${code.trim() ? " · " + code.trim() : ""})`);
  revalidateForms();
  return { ok: true, message: "Question added — it's live on the intake form and counts toward report readiness." };
}

// ---------- answer lists ----------

export async function updateListValue(id: number, value: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const v = value.trim();
  if (!v) return { ok: false, message: "Value can't be empty — remove it instead if it's no longer needed." };
  const row = db.select().from(t.listValues).where(eq(t.listValues.id, id)).get();
  if (!row) return { ok: false, message: "Value not found." };
  if (row.value === v) return { ok: true };
  db.update(t.listValues).set({ value: v }).where(eq(t.listValues.id, id)).run();
  audit(admin.id, "forms.list.update", "list_value", String(id), `${row.listKey}: “${row.value}” → “${v}”`);
  revalidateForms();
  return { ok: true };
}

export async function removeListValue(id: number): Promise<ActionResult> {
  const admin = await requireAdmin();
  const row = db.select().from(t.listValues).where(eq(t.listValues.id, id)).get();
  if (!row) return { ok: false, message: "Value not found." };
  db.delete(t.listValues).where(eq(t.listValues.id, id)).run();
  audit(admin.id, "forms.list.remove", "list_value", String(id), `${row.listKey}: “${row.value}”`);
  revalidateForms();
  return { ok: true, message: "Value removed — existing records keep their stored answer." };
}

export async function addListValue(listKey: string, value: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const v = value.trim();
  if (!v) return { ok: false, message: "Type a value first." };
  const list = db.select().from(t.lists).where(eq(t.lists.key, listKey)).get();
  if (!list) return { ok: false, message: "List not found." };
  const existing = db.select({ sort: t.listValues.sort }).from(t.listValues).where(eq(t.listValues.listKey, listKey)).all();
  const maxSort = existing.reduce((m, r) => Math.max(m, r.sort), 0);
  db.insert(t.listValues).values({ listKey, value: v, sort: maxSort + 1 }).run();
  audit(admin.id, "forms.list.add", "list_value", listKey, `${list.label} + “${v}”`);
  revalidateForms();
  return { ok: true, message: `Value added to ${list.label}.` };
}
