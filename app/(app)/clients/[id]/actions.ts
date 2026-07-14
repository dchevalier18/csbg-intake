"use server";
/* Server actions for the client 360° profile. Every action re-checks
   auth + program-based visibility before touching the row. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { visibleClient, userCanSeeProgram, getProgram, audit , orgFY} from "@/lib/access";
import { getEnabledIntakeFields, nextApplicationId, programCeiling, requiredDocKeys, OPEN_STAGES } from "@/lib/data/core";
import { getActiveFpl, fplStatusFor } from "@/lib/fpl";
import { fnpiByCode } from "@/lib/csbg-catalog";
import { todayIso } from "@/lib/format";
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

  const fy = await orgFY();
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

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");
const safeSegment = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, "_");

/** Enroll an existing client into another program — creates a pre-filled
    application in that program's eligibility queue, LINKED to this client
    (applications.client_id). Approval adds the membership to the existing
    record instead of creating a duplicate client, so the service history and
    unduplicated counts stay intact. The target program's document checklist
    and income ceiling still apply: verified documents from the client's prior
    applications carry over where requirements overlap (stored files are
    copied, so later replacements never orphan the original determination);
    bypass sign-offs do NOT carry — they were signed for that determination. */
export async function enrollInProgram(clientId: string, programId: string): Promise<ActionResult> {
  const user = await requireUser();
  const c = await visibleClient(user, clientId);
  if (!c) return { ok: false, message: "You don't have access to this client record." };
  if (c.status !== "active") {
    return { ok: false, message: "This client record is closed — reactivate it before enrolling in another program." };
  }

  if (!programId || !await userCanSeeProgram(user, programId)) {
    return { ok: false, message: "You don't have access to enroll clients into that program." };
  }
  const program = await getProgram(programId);
  if (!program || program.active !== 1) return { ok: false, message: "That program no longer exists." };
  if (c.programIds.includes(programId)) {
    return { ok: false, message: `${c.first} is already enrolled in ${program.short}.` };
  }

  // one open determination per client × program — don't stack queue entries
  const priorApps = (await db.select().from(t.applications).where(eq(t.applications.clientId, clientId)))
    .sort((a, b) => b.applied.localeCompare(a.applied));
  const open = priorApps.find((a) => a.programId === programId && (OPEN_STAGES as readonly string[]).includes(a.stage));
  if (open) {
    return { ok: false, message: `${c.first} already has an open application for ${program.short} (${open.id}) — decide it in the eligibility queue first.` };
  }

  // eligibility is re-assessed NOW: active FPL schedule, target program's ceiling
  const active = await getActiveFpl();
  const ceiling = await programCeiling(programId);
  const st = await fplStatusFor(c.income, c.hhSize, active.year, ceiling);

  const id = await nextApplicationId();
  const reqDocs = await requiredDocKeys(programId);

  // Carry over verified documents from this client's prior applications where
  // requirements overlap — newest application wins per key. Only rows with a
  // stored file that is still on disk qualify (re-verification without the
  // underlying document would be an unbacked sign-off).
  const priorDocs = priorApps.length > 0
    ? await db.select().from(t.applicationDocs)
        .where(inArray(t.applicationDocs.applicationId, priorApps.map((a) => a.id)))
    : [];
  const appOrder = new Map(priorApps.map((a, i) => [a.id, i]));
  type CarriedDoc = typeof t.applicationDocs.$inferSelect;
  const carried = new Map<string, CarriedDoc>();
  for (const key of reqDocs) {
    const best = priorDocs
      .filter((d) => d.docKey === key && d.status === "verified" && d.fileName && d.filePath)
      .sort((x, y) => (appOrder.get(x.applicationId) ?? 99) - (appOrder.get(y.applicationId) ?? 99))[0];
    if (!best) continue;
    const src = path.resolve(UPLOADS_DIR, best.filePath!);
    if (!src.startsWith(path.resolve(UPLOADS_DIR) + path.sep) || !fs.existsSync(src)) continue;
    carried.set(key, best);
  }

  await db.insert(t.applications).values({
    id,
    first: c.first, last: c.last, dob: c.dob,
    phone: c.phone, address: c.address, county: c.county,
    sex: c.sex, race: c.race, edu: c.edu, work: c.work,
    insurance: c.insurance, military: c.military, disability: c.disability,
    hhType: c.hhType, hhSize: c.hhSize, housing: c.housing,
    income: c.income, incomeSrc: c.incomeSrc, custom: c.custom,
    programId,
    caseworkerId: user.id,
    stage: reqDocs.every((k) => carried.has(k)) ? "review" : "docs",
    applied: todayIso(),
    fplYear: active.year,
    notes: `Cross-enrollment by ${user.name}: existing client ${c.id} adding ${program.short}. ` +
      `Approval adds the program to the existing record — no duplicate client is created. ` +
      (st.eligible ? "Income-eligible at intake." : `⚠ Income above the ${ceiling}% FPL ceiling — flag for review.`),
    clientId: c.id, // the link — approval enrolls THIS record instead of creating one
    portalToken: crypto.randomBytes(32).toString("hex"),
  });

  const now = new Date().toISOString();
  for (const docKey of reqDocs) {
    const prior = carried.get(docKey);
    if (prior) {
      // independent stored copy: replacing the doc on either application later
      // must never delete the file out from under the other determination
      const ext = path.extname(prior.filePath!);
      const dir = path.join(UPLOADS_DIR, safeSegment(id));
      fs.mkdirSync(dir, { recursive: true });
      const storedName = `${safeSegment(docKey)}-${Date.now()}${ext}`;
      fs.copyFileSync(path.resolve(UPLOADS_DIR, prior.filePath!), path.join(dir, storedName));
      await db.insert(t.applicationDocs).values({
        applicationId: id,
        docKey,
        status: "verified",
        source: prior.source,
        updatedAt: now,
        fileName: prior.fileName,
        filePath: `${safeSegment(id)}/${storedName}`,
        fileBy: prior.fileBy,
        fileAt: prior.fileAt,
        verifiedBy: prior.verifiedBy,
        verifiedAt: prior.verifiedAt,
      });
    } else {
      await db.insert(t.applicationDocs).values({
        applicationId: id, docKey, status: "missing", source: "staff", updatedAt: now,
      });
    }
  }

  await audit(user.id, "application.create", "application", id,
    `${c.first} ${c.last} (existing client ${c.id}) → ${programId} (${st.pct}% FPL, ${active.year} guideline)` +
    (carried.size > 0 ? ` — ${carried.size} verified document${carried.size === 1 ? "" : "s"} carried over` : ""));
  revalidatePath("/eligibility");
  revalidateClient(clientId);

  const docsLeft = reqDocs.length - carried.size;
  return {
    ok: true,
    message: reqDocs.length === 0 || docsLeft === 0
      ? `Application ${id} created and ready for review — ${reqDocs.length === 0 ? `${program.short} requires no documents` : "every required document carried over verified"}. Approval adds ${program.short} to this record.`
      : `Application ${id} created — ${c.first} is in the eligibility queue for ${program.short}, waiting on ${docsLeft} document${docsLeft === 1 ? "" : "s"}${carried.size > 0 ? ` (${carried.size} carried over verified)` : ""}.`,
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
