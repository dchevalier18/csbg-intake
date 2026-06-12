"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit, userCanSeeProgram, visibleProgramIds } from "@/lib/access";
import { getEnabledIntakeFields, getOrg, nextApplicationId, requiredDocKeys } from "@/lib/data/core";
import { getActiveFpl, fplStatusFor } from "@/lib/fpl";
import { todayIso } from "@/lib/format";

export interface DupMatch { id: string; first: string; last: string; dob: string; inScope: boolean }

/** Live duplicate scan. MATCHING is agency-wide (duplicates split service history and
    inflate unduplicated counts), but identifying details are only returned for records
    within the caller's assigned programs — out-of-scope matches come back redacted. */
export async function checkDuplicates(first: string, last: string, dob: string): Promise<DupMatch[]> {
  const user = await requireUser();
  if (first.trim().length < 2 || last.trim().length < 2) return [];
  const firstPrefix = first.trim().toLowerCase().slice(0, 3);
  const lastLower = last.trim().toLowerCase();

  const memberships = await db.select().from(t.clientPrograms);
  const byClient = new Map<string, string[]>();
  for (const m of memberships) {
    const arr = byClient.get(m.clientId) ?? [];
    arr.push(m.programId);
    byClient.set(m.clientId, arr);
  }
  const mine = await visibleProgramIds(user);

  return (await db
    .select({ id: t.clients.id, first: t.clients.first, last: t.clients.last, dob: t.clients.dob })
    .from(t.clients))
    .filter((c) =>
      c.last.toLowerCase() === lastLower &&
      (c.first.toLowerCase().startsWith(firstPrefix) || c.dob === dob))
    .map((c) => {
      const inScope = (byClient.get(c.id) ?? []).some((p) => mine.has(p));
      return inScope
        ? { ...c, inScope }
        : { id: "•••", first: "Existing", last: "record", dob: "•••", inScope };
    });
}

export interface IntakePayload {
  first: string;
  last: string;
  dob: string;
  phone: string;
  address: string;
  county: string;
  hhType: string;
  hhSize: number;
  housing: string;
  income: number;
  incomeSrc: string;
  /** intake-field values keyed by field id (builtin + custom) */
  characteristics: Record<string, string>;
  programId: string;
  /** required-doc keys the client brought today */
  docs: Record<string, boolean>;
  /** when the intake started from a seminar attendee row (Tools → Seminars) */
  seminarAttendeeId: string;
}

/** Create the application in the eligibility queue ('docs' stage) and redirect there. */
export async function submitIntake(payload: IntakePayload): Promise<{ ok: false; message: string }> {
  const user = await requireUser();

  if (!payload.first.trim() || !payload.last.trim() || !payload.dob) {
    return { ok: false, message: "First name, last name, and date of birth are required." };
  }
  // never trust the client for program visibility — re-check the assignment server-side
  if (!payload.programId || !await userCanSeeProgram(user, payload.programId)) {
    return { ok: false, message: "You don't have access to enroll clients into that program." };
  }

  const org = await getOrg();
  const active = await getActiveFpl(); // NEW intakes always pin the ACTIVE schedule year
  const hhSize = Math.min(12, Math.max(1, Math.round(Number(payload.hhSize) || 1)));
  const income = Math.max(0, Math.round(Number(payload.income) || 0));
  const st = await fplStatusFor(income, hhSize, active.year, org.csbgCeiling);

  // split characteristic answers: builtin field ids are application columns,
  // everything else lands in the `custom` JSON blob
  const builtinText: Record<string, string | null> = {};
  let disability: number | null = null;
  const custom: Record<string, string> = {};
  for (const fd of await getEnabledIntakeFields()) {
    const v = (payload.characteristics[fd.id] ?? "").trim();
    if (fd.builtin === 1) {
      if (fd.id === "disability") disability = v === "" ? null : v === "Yes" ? 1 : 0;
      else builtinText[fd.id] = v || null;
    } else if (v !== "") {
      custom[fd.id] = v;
    }
  }

  const id = await nextApplicationId();
  const portalToken = crypto.randomBytes(8).toString("hex"); // 16 hex chars
  // programs with no document requirements skip straight to review —
  // there is nothing to collect, so the docs stage would be a dead end
  const reqDocs = await requiredDocKeys(payload.programId);
  await db.insert(t.applications).values({
    id,
    first: payload.first.trim(),
    last: payload.last.trim(),
    dob: payload.dob,
    phone: payload.phone.trim() || null,
    address: payload.address.trim() || null,
    county: payload.county || null,
    sex: builtinText.sex ?? null,
    race: builtinText.race ?? null,
    edu: builtinText.edu ?? null,
    work: builtinText.work ?? null,
    insurance: builtinText.insurance ?? null,
    military: builtinText.military ?? null,
    disability,
    hhType: payload.hhType || null,
    hhSize,
    housing: payload.housing || null,
    income,
    incomeSrc: payload.incomeSrc || null,
    custom,
    programId: payload.programId,
    caseworkerId: user.id,
    stage: reqDocs.length > 0 ? "docs" : "review",
    applied: todayIso(),
    fplYear: active.year,
    notes: "New intake by " + user.name + ". " +
      (st.eligible
        ? "Income-eligible at intake."
        : `⚠ Income above ${org.csbgCeiling}% FPL ceiling — flag for review.`),
    portalToken,
  });

  // required-document checklist — missing docs don't block intake
  const now = new Date().toISOString();
  for (const docKey of reqDocs) {
    await db.insert(t.applicationDocs).values({
      applicationId: id,
      docKey,
      status: payload.docs[docKey] ? "submitted" : "missing",
      source: "staff",
      updatedAt: now,
    });
  }

  // seminar attendee → in-progress intake link (Tools → Seminars hand-off)
  const attendeeId = Number(payload.seminarAttendeeId);
  if (payload.seminarAttendeeId && Number.isInteger(attendeeId)) {
    await db.update(t.seminarAttendees)
      .set({ intakeStatus: "in-progress", applicationId: id })
      .where(eq(t.seminarAttendees.id, attendeeId))
      ;
    revalidatePath("/tools/seminars");
  }

  await audit(user.id, "application.create", "application", id,
    `${payload.first.trim()} ${payload.last.trim()} → ${payload.programId} (${st.pct}% FPL, ${active.year} guideline)`);
  revalidatePath("/eligibility");
  redirect("/eligibility");
}
