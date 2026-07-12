"use server";
/* ROMA goal management (Org Standard 4.3) — admin-only, audited. */
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/access";
import { fnpiByCode } from "@/lib/csbg-catalog";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export async function addRomaGoal(title: string, description: string, fnpiCodes: string[]): Promise<ActionResult> {
  const user = await requireAdmin();
  const cleanTitle = String(title ?? "").trim();
  if (cleanTitle.length < 4) return { ok: false, message: "Give the goal a title (at least 4 characters)." };
  const codes = [...new Set((fnpiCodes ?? []).map((c) => String(c).trim()).filter(Boolean))];
  const unknown = codes.filter((c) => !fnpiByCode(c));
  if (unknown.length > 0) return { ok: false, message: `Unknown indicator code${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.` };
  if (codes.length === 0) return { ok: false, message: "Link at least one FNPI indicator — that's what makes the goal measurable." };

  await db.insert(t.romaGoals).values({
    title: cleanTitle,
    description: String(description ?? "").trim(),
    fnpiCodes: codes,
    createdAt: new Date().toISOString(),
  });
  await audit(user.id, "roma.goal.add", "roma_goal", cleanTitle, `Linked indicators: ${codes.join(", ")}`);
  revalidatePath("/reports");
  return { ok: true, message: "Goal added — its linked indicators now roll up on the ROMA tab." };
}

export async function removeRomaGoal(id: number): Promise<ActionResult> {
  const user = await requireAdmin();
  const goal = (await db.select().from(t.romaGoals).where(eq(t.romaGoals.id, id)))[0];
  if (!goal) return { ok: false, message: "That goal no longer exists." };
  await db.delete(t.romaGoals).where(eq(t.romaGoals.id, id));
  await audit(user.id, "roma.goal.remove", "roma_goal", goal.title);
  revalidatePath("/reports");
  return { ok: true, message: "Goal removed. The linked indicators themselves are untouched." };
}
