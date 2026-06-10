"use server";
/* Eligibility-queue mutations — document tracking, stage advancement,
   and the approve/deny eligibility determinations. */
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import type { Application } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { userCanSeeProgram, audit } from "@/lib/access";
import { getOrg, requiredDocKeys, applicationDocsVerified, OPEN_STAGES, nextClientId } from "@/lib/data/core";
import { fplStatusFor } from "@/lib/fpl";
import { todayIso } from "@/lib/format";

export interface ActionResult {
  ok: boolean;
  message: string;
}

function loadApp(id: string): Application | undefined {
  return db.select().from(t.applications).where(eq(t.applications.id, id)).get();
}

function isoDatePlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function revalidateQueue(): void {
  revalidatePath("/eligibility");
  revalidatePath("/dashboard");
  revalidatePath("/clients");
}

/** Update one required document's status; auto-advance docs → review when all are verified. */
export async function setApplicationDoc(appId: string, docKey: string, status: string): Promise<ActionResult> {
  const user = await requireUser();
  const app = loadApp(appId);
  if (!app || !(OPEN_STAGES as readonly string[]).includes(app.stage)) {
    return { ok: false, message: "Application not found or already decided." };
  }
  if (!userCanSeeProgram(user, app.programId)) {
    return { ok: false, message: "No access to this application's program." };
  }
  if (status !== "submitted" && status !== "verified") {
    return { ok: false, message: "Invalid document status." };
  }
  if (!requiredDocKeys(app.programId).includes(docKey)) {
    return { ok: false, message: "That document isn't required for this program." };
  }

  const now = new Date().toISOString();
  const existing = db.select().from(t.applicationDocs)
    .where(and(eq(t.applicationDocs.applicationId, app.id), eq(t.applicationDocs.docKey, docKey)))
    .get();
  if (existing) {
    db.update(t.applicationDocs)
      .set({ status, source: "staff", updatedAt: now })
      .where(and(eq(t.applicationDocs.applicationId, app.id), eq(t.applicationDocs.docKey, docKey)))
      .run();
  } else {
    db.insert(t.applicationDocs)
      .values({ applicationId: app.id, docKey, status, source: "staff", updatedAt: now })
      .run();
  }

  if (status === "verified") {
    audit(user.id, "document.verify", "application", app.id, `${docKey} verified`);
  }

  // Auto-advance: waiting-on-documents → ready-for-review once every required doc is verified.
  if (app.stage === "docs" && applicationDocsVerified(app)) {
    db.update(t.applications).set({ stage: "review" }).where(eq(t.applications.id, app.id)).run();
  }

  revalidateQueue();
  return { ok: true, message: status === "verified" ? "Document verified." : "Document marked submitted." };
}

/** Stage review → decision (hand off to the program manager). */
export async function sendForDecision(appId: string): Promise<ActionResult> {
  const user = await requireUser();
  const app = loadApp(appId);
  if (!app || app.stage !== "review") {
    return { ok: false, message: "Application isn't ready for decision." };
  }
  if (!userCanSeeProgram(user, app.programId)) {
    return { ok: false, message: "No access to this application's program." };
  }
  db.update(t.applications).set({ stage: "decision" }).where(eq(t.applications.id, app.id)).run();
  audit(user.id, "application.advance", "application", app.id, "Sent to program manager for decision");
  revalidateQueue();
  return { ok: true, message: "Sent to program manager for decision." };
}

/** Deny — terminal stage with a required determination note (≥ 8 chars). */
export async function denyApplication(appId: string, note: string): Promise<ActionResult> {
  const user = await requireUser();
  const app = loadApp(appId);
  if (!app || !(OPEN_STAGES as readonly string[]).includes(app.stage)) {
    return { ok: false, message: "Application not found or already decided." };
  }
  if (!userCanSeeProgram(user, app.programId)) {
    return { ok: false, message: "No access to this application's program." };
  }
  const trimmed = note.trim();
  if (trimmed.length < 8) {
    return { ok: false, message: "A denial reason (at least 8 characters) is required." };
  }
  db.update(t.applications).set({
    stage: "denied",
    decisionNote: trimmed,
    decidedBy: user.id,
    decidedAt: new Date().toISOString(),
  }).where(eq(t.applications.id, app.id)).run();
  audit(user.id, "application.deny", "application", app.id, trimmed);
  revalidateQueue();
  return { ok: true, message: "Application denied — determination logged, referral letter queued." };
}

/** Approve & enroll — creates the client record, pins the FPL year, logs SDA 1a. */
export async function approveApplication(appId: string): Promise<ActionResult> {
  const user = await requireUser();
  const app = loadApp(appId);
  if (!app || !(OPEN_STAGES as readonly string[]).includes(app.stage)) {
    return { ok: false, message: "Application not found or already decided." };
  }
  if (!userCanSeeProgram(user, app.programId)) {
    return { ok: false, message: "No access to this application's program." };
  }
  // Server-side re-check — never trust the client's disabled button.
  if (!applicationDocsVerified(app)) {
    return { ok: false, message: "Approval unlocks when every document is verified." };
  }
  const org = getOrg();
  const st = fplStatusFor(app.income, app.hhSize, app.fplYear, org.csbgCeiling);
  if (!st.eligible) {
    return { ok: false, message: `Income exceeds the CSBG ${org.csbgCeiling}% FPL ceiling — approval is blocked; deny with referral.` };
  }

  const clientId = nextClientId();
  const today = todayIso();
  const now = new Date().toISOString();

  db.transaction((tx) => {
    tx.insert(t.clients).values({
      id: clientId,
      first: app.first,
      last: app.last,
      dob: app.dob,
      sex: app.sex,
      race: app.race,
      edu: app.edu,
      work: app.work,
      insurance: app.insurance,
      military: app.military,
      disability: app.disability,
      phone: app.phone,
      address: app.address,
      county: app.county,
      hhType: app.hhType,
      hhSize: app.hhSize,
      housing: app.housing,
      income: app.income,
      incomeSrc: app.incomeSrc,
      caseworkerId: app.caseworkerId,
      enrolled: today,
      fplYear: app.fplYear,            // point-in-time pin carried from the application
      nextFollowUp: isoDatePlusDays(90),
      flags: [],
      custom: app.custom,
      status: "active",
      createdAt: now,
    }).run();
    tx.insert(t.clientPrograms).values({ clientId, programId: app.programId }).run();
    tx.update(t.applications).set({
      stage: "approved",
      clientId,
      decidedBy: user.id,
      decidedAt: now,
    }).where(eq(t.applications.id, app.id)).run();
    tx.insert(t.serviceLog).values({
      date: today,
      clientId,
      code: "SDA 1a",
      programId: app.programId,
      staffId: user.id,
      note: "Eligibility determination — approved & enrolled.",
    }).run();
  });

  audit(user.id, "application.approve", "application", app.id, `Approved & enrolled as ${clientId} (${st.pct}% FPL, ${app.fplYear} schedule)`);
  revalidateQueue();
  return { ok: true, message: "Approved & enrolled — client record created, SDA 1a eligibility determination logged." };
}
