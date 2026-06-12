"use server";
/* Server actions for the client 360° profile. Every action re-checks
   auth + program-based visibility before touching the row. */
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { visibleClient, userCanSeeProgram, audit } from "@/lib/access";
import { getEnabledIntakeFields } from "@/lib/data/core";
import { fnpiByCode } from "@/lib/csbg-catalog";
import { currentFY, todayIso } from "@/lib/format";
import type { Client } from "@/db/schema";

export interface ActionResult { ok: boolean; message: string }

function revalidateClient(clientId: string): void {
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

/** Set the client's next follow-up date (Schedule follow-up modal). */
export async function scheduleFollowUp(clientId: string, date: string): Promise<ActionResult> {
  const user = await requireUser();
  const c = await visibleClient(user, clientId);
  if (!c) return { ok: false, message: "You don't have access to this client record." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "Pick a valid follow-up date." };

  await db.update(t.clients).set({ nextFollowUp: date }).where(eq(t.clients.id, clientId));
  await audit(user.id, "client.followup", "client", clientId, `Next follow-up set to ${date}`);
  revalidateClient(clientId);
  return { ok: true, message: "Follow-up scheduled and added to your queue." };
}

/** Record (or update) a client-level FNPI outcome — feeds Module 3 Section B live.
    One row per client × indicator × FY: recording again within the FY updates the
    existing row, so report counts stay unduplicated individuals. */
export async function recordOutcome(clientId: string, input: {
  code: string;
  programId: string;
  status: string;
  note: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  const c = await visibleClient(user, clientId);
  if (!c) return { ok: false, message: "You don't have access to this client record." };

  const code = String(input.code ?? "").trim();
  const programId = String(input.programId ?? "").trim();
  const status = String(input.status ?? "").trim();
  const note = String(input.note ?? "").trim();

  if (!fnpiByCode(code)) return { ok: false, message: "Pick an indicator first." };
  if (status !== "working" && status !== "achieved") return { ok: false, message: "Pick an outcome status." };
  if (!programId || !c.programIds.includes(programId)) {
    return { ok: false, message: "That client isn't enrolled in the selected program." };
  }
  if (!await userCanSeeProgram(user, programId)) {
    return { ok: false, message: "Your account isn't assigned to that program." };
  }

  const fy = currentFY();
  const today = todayIso();
  // Key the FY upsert on the program too: recording under one program must never
  // silently rewrite (and re-attribute) a row another program recorded — possibly
  // one the recorder can't even see. The rollup counts unduplicated clients per
  // indicator, so a second program's row never double-counts the agency total.
  const existing = (await db.select().from(t.outcomeLog)
    .where(and(eq(t.outcomeLog.clientId, clientId), eq(t.outcomeLog.code, code), eq(t.outcomeLog.programId, programId))))
    .find((o) => o.date >= fy.start && o.date <= fy.end);

  if (existing) {
    await db.update(t.outcomeLog)
      .set({ status, date: today, programId, staffId: user.id, note: note || existing.note })
      .where(eq(t.outcomeLog.id, existing.id));
  } else {
    await db.insert(t.outcomeLog).values({
      date: today, clientId, code, programId, staffId: user.id, status, note,
    });
  }

  await audit(user.id, "outcome.record", "client", clientId,
    `${code} ${status === "achieved" ? "achieved" : "in progress"} · ${c.first} ${c.last} · ${programId}`);
  revalidateClient(clientId);
  const verb = existing ? "updated" : "recorded";
  return {
    ok: true,
    message: status === "achieved"
      ? `Outcome ${verb} — ${code} counts in Module 3, Section B for ${fy.short}.`
      : `Outcome ${verb} — ${c.first} now counts as served under ${code}; mark it achieved at follow-up.`,
  };
}

// CSBG core report fields that live as columns on the clients row
const CORE_TEXT = ["dob", "hhType", "housing", "incomeSrc"] as const;
const BUILTIN_TEXT = ["sex", "race", "edu", "work", "insurance", "military"] as const;
type CoreText = (typeof CORE_TEXT)[number];
type BuiltinText = (typeof BUILTIN_TEXT)[number];

/** Capture missing characteristics ("Capture now" modal). Builtin field ids are
    columns on the clients table; custom intake fields land in the custom JSON. */
export async function captureFields(clientId: string, values: Record<string, string>): Promise<ActionResult> {
  const user = await requireUser();
  const c = await visibleClient(user, clientId);
  if (!c) return { ok: false, message: "You don't have access to this client record." };

  const fields = await getEnabledIntakeFields();
  const fieldById = new Map(fields.map((f) => [f.id, f]));
  const patch: Partial<Client> = {};
  const custom = { ...c.custom };
  let customDirty = false;
  const captured: string[] = [];

  for (const [id, raw] of Object.entries(values)) {
    const v = (raw ?? "").trim();
    if (!v) continue;

    if ((CORE_TEXT as readonly string[]).includes(id) || (BUILTIN_TEXT as readonly string[]).includes(id)) {
      patch[id as CoreText | BuiltinText] = v;
      captured.push(id);
      continue;
    }
    if (id === "hhSize" || id === "income") {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        return { ok: false, message: `Enter a valid number for ${id === "income" ? "annual income" : "household size"}.` };
      }
      patch[id] = Math.round(n);
      captured.push(id);
      continue;
    }
    if (id === "disability") {
      patch.disability = v === "Yes" ? 1 : 0;
      captured.push(id);
      continue;
    }
    const f = fieldById.get(id);
    if (f && f.builtin !== 1) {
      custom[f.id] = v;
      customDirty = true;
      captured.push(id);
    }
    // unknown / disabled ids are ignored — never trust client field lists
  }

  if (captured.length === 0) return { ok: false, message: "Nothing to capture — fill in at least one field." };
  if (customDirty) patch.custom = custom;

  await db.update(t.clients).set(patch).where(eq(t.clients.id, clientId));
  await audit(user.id, "client.capture", "client", clientId, `Captured: ${captured.join(", ")}`);
  revalidateClient(clientId);
  const n = captured.length;
  return { ok: true, message: `${n} field${n === 1 ? "" : "s"} captured — Annual Report readiness updated.` };
}
