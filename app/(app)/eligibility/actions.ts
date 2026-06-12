"use server";
/* Eligibility-queue mutations — document tracking, stage advancement,
   and the approve/deny eligibility determinations. */
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { db, t } from "@/db";
import type { Application, User } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { userCanSeeProgram, audit } from "@/lib/access";
import { requiredDocKeys, applicationDocsVerified, programCeiling, OPEN_STAGES, nextClientId } from "@/lib/data/core";
import { fplStatusFor } from "@/lib/fpl";
import { todayIso } from "@/lib/format";

export interface ActionResult {
  ok: boolean;
  message: string;
}

async function loadApp(id: string): Promise<Application | undefined> {
  return (await db.select().from(t.applications).where(eq(t.applications.id, id)))[0];
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

/* ---------- document verification (attach / verify / signed bypass / undo) ---------- */

const UPLOAD_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".heic", ".tif", ".tiff"];
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

/** Shared guard for the per-document actions: load + access + open stage + requirement.
    Access check FIRST, same message as not-found — out-of-scope callers must not
    be able to distinguish existence or stage of applications they can't see. */
async function guardDocAction(user: User, appId: string, docKey: string):
  Promise<{ ok: true; app: Application } | { ok: false; message: string }> {
  const app = await loadApp(appId);
  if (!app || !await userCanSeeProgram(user, app.programId) || !(OPEN_STAGES as readonly string[]).includes(app.stage)) {
    return { ok: false, message: "Application not found or already decided." };
  }
  if (!(await requiredDocKeys(app.programId)).includes(docKey)) {
    return { ok: false, message: "That document isn't required for this program." };
  }
  return { ok: true, app };
}

async function loadDocRow(appId: string, docKey: string) {
  return (await db.select().from(t.applicationDocs)
    .where(and(eq(t.applicationDocs.applicationId, appId), eq(t.applicationDocs.docKey, docKey))))[0];
}

async function upsertDocRow(appId: string, docKey: string, values: Partial<typeof t.applicationDocs.$inferInsert>): Promise<void> {
  const existing = await loadDocRow(appId, docKey);
  const updatedAt = new Date().toISOString();
  if (existing) {
    await db.update(t.applicationDocs)
      .set({ ...values, updatedAt })
      .where(and(eq(t.applicationDocs.applicationId, appId), eq(t.applicationDocs.docKey, docKey)));
  } else {
    await db.insert(t.applicationDocs)
      .values({ applicationId: appId, docKey, status: "missing", ...values, updatedAt });
  }
}

/** Keep the pipeline stage chip honest in BOTH directions (docs ⇄ review).
    Applications already at 'decision' are never auto-moved — but approval
    re-checks all-docs-verified server-side, so it stays blocked regardless. */
async function recomputeStage(app: Application): Promise<void> {
  const all = await applicationDocsVerified(app);
  if (all && app.stage === "docs") {
    await db.update(t.applications).set({ stage: "review" }).where(eq(t.applications.id, app.id));
  } else if (!all && app.stage === "review") {
    await db.update(t.applications).set({ stage: "docs" }).where(eq(t.applications.id, app.id));
  }
}

const safeSegment = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, "_");

/** Attach (or replace) the scanned supporting document for one requirement.
    The file arrives base64-encoded; the stored copy lives under data/uploads/.
    Attaching sets status to 'submitted' — a verified doc stays verified. */
export async function attachApplicationDoc(appId: string, docKey: string, filename: string, base64: string): Promise<ActionResult> {
  const user = await requireUser();
  const g = await guardDocAction(user, appId, docKey);
  if (!g.ok) return { ok: false, message: g.message };

  const ext = path.extname(filename ?? "").toLowerCase();
  if (!UPLOAD_EXTENSIONS.includes(ext)) {
    return { ok: false, message: "That file type isn't supported — upload a PDF or a scanned image (JPG, PNG, HEIC, TIFF)." };
  }
  const buf = Buffer.from(String(base64 ?? ""), "base64");
  if (buf.length === 0) return { ok: false, message: "That file looks empty — rescan the document and try again." };
  if (buf.length > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "Files up to 4 MB are supported — scan at a lower resolution or split the document." };
  }

  const dir = path.join(UPLOADS_DIR, safeSegment(g.app.id));
  fs.mkdirSync(dir, { recursive: true });
  const storedName = `${safeSegment(docKey)}-${Date.now()}${ext}`;
  fs.writeFileSync(path.join(dir, storedName), buf);

  // a replaced file's stored copy is superseded — remove it (the audit log keeps the history)
  const existing = await loadDocRow(appId, docKey);
  if (existing?.filePath) {
    const old = path.resolve(UPLOADS_DIR, existing.filePath);
    if (old.startsWith(path.resolve(UPLOADS_DIR) + path.sep) && fs.existsSync(old)) fs.rmSync(old);
  }

  await upsertDocRow(appId, docKey, {
    status: existing?.status === "verified" ? "verified" : "submitted",
    source: "staff",
    fileName: filename,
    filePath: `${safeSegment(g.app.id)}/${storedName}`,
    fileBy: user.id,
    fileAt: todayIso(),
  });
  await audit(user.id, "document.attach", "application", g.app.id, `${docKey} — "${filename}" attached`);

  revalidateQueue();
  return { ok: true, message: "Document attached to the applicant file." };
}

/** Verify one requirement — only available once a supporting file is on record. */
export async function verifyApplicationDoc(appId: string, docKey: string): Promise<ActionResult> {
  const user = await requireUser();
  const g = await guardDocAction(user, appId, docKey);
  if (!g.ok) return { ok: false, message: g.message };

  const row = await loadDocRow(appId, docKey);
  if (row?.status === "verified") return { ok: false, message: "That document is already verified." };
  if (!row?.fileName) {
    return { ok: false, message: "No file on record — attach the scanned document to verify, or use the signed bypass." };
  }

  await upsertDocRow(appId, docKey, { status: "verified", verifiedBy: user.id, verifiedAt: todayIso() });
  await audit(user.id, "document.verify", "application", g.app.id, `${docKey} verified`);
  await recomputeStage(g.app);

  revalidateQueue();
  return { ok: true, message: "Marked verified." };
}

/** Signed bypass — verify with NO supporting document on file. Requires the
    acknowledged reason; the sign-off is written to the determination record
    (application_docs row + audit log) and is visible to program monitors. */
export async function bypassVerifyApplicationDoc(appId: string, docKey: string, reason: string): Promise<ActionResult> {
  const user = await requireUser();
  const g = await guardDocAction(user, appId, docKey);
  if (!g.ok) return { ok: false, message: g.message };

  const row = await loadDocRow(appId, docKey);
  if (row?.status === "verified") return { ok: false, message: "That document is already verified." };
  if (row?.fileName) {
    return { ok: false, message: "A scanned document is on record — verify it directly instead of signing a bypass." };
  }
  const trimmed = (reason ?? "").trim();
  if (trimmed.length < 8) {
    return { ok: false, message: "A reason (at least 8 characters) is required to verify without a document." };
  }

  const when = todayIso();
  await upsertDocRow(appId, docKey, {
    status: "verified",
    verifiedBy: user.id,
    verifiedAt: when,
    bypassBy: user.id,
    bypassAt: when,
    bypassReason: trimmed,
  });
  await audit(user.id, "document.bypass", "application", g.app.id,
    `${docKey} verified WITHOUT a document on file — signed by ${user.name}: "${trimmed}"`);
  await recomputeStage(g.app);

  revalidateQueue();
  return { ok: true, message: "Verified without document — your sign-off was written to the determination record." };
}

/** Undo a verification committed by mistake — removes the verification record
    AND any bypass sign-off, resets status from the file on record, and reverts
    a 'Ready for review' stage if the checklist is no longer complete. */
export async function undoApplicationDocVerification(appId: string, docKey: string): Promise<ActionResult> {
  const user = await requireUser();
  const g = await guardDocAction(user, appId, docKey);
  if (!g.ok) return { ok: false, message: g.message };

  const row = await loadDocRow(appId, docKey);
  if (row?.status !== "verified") return { ok: false, message: "That document isn't verified." };

  const hadBypass = !!row.bypassBy;
  await upsertDocRow(appId, docKey, {
    status: row.fileName ? "submitted" : "missing",
    verifiedBy: null,
    verifiedAt: null,
    bypassBy: null,
    bypassAt: null,
    bypassReason: null,
  });
  // the determination record keeps history append-only: the undo itself is audited
  await audit(user.id, "document.unverify", "application", g.app.id,
    `${docKey} verification undone${hadBypass ? " — bypass sign-off removed" : ""}`);
  await recomputeStage(g.app);

  revalidateQueue();
  return { ok: true, message: "Verification undone — status reset and the sign-off was removed." };
}

/** Stage review → decision (hand off to the program manager). */
export async function sendForDecision(appId: string): Promise<ActionResult> {
  const user = await requireUser();
  const app = await loadApp(appId);
  if (!app || !await userCanSeeProgram(user, app.programId) || app.stage !== "review") {
    return { ok: false, message: "Application isn't ready for decision." };
  }
  await db.update(t.applications).set({ stage: "decision" }).where(eq(t.applications.id, app.id));
  await audit(user.id, "application.advance", "application", app.id, "Sent to program manager for decision");
  revalidateQueue();
  return { ok: true, message: "Sent to program manager for decision." };
}

/** Deny — terminal stage with a required determination note (≥ 8 chars). */
export async function denyApplication(appId: string, note: string): Promise<ActionResult> {
  const user = await requireUser();
  const app = await loadApp(appId);
  if (!app || !await userCanSeeProgram(user, app.programId) || !(OPEN_STAGES as readonly string[]).includes(app.stage)) {
    return { ok: false, message: "Application not found or already decided." };
  }
  const trimmed = note.trim();
  if (trimmed.length < 8) {
    return { ok: false, message: "A denial reason (at least 8 characters) is required." };
  }
  await db.update(t.applications).set({
    stage: "denied",
    decisionNote: trimmed,
    decidedBy: user.id,
    decidedAt: new Date().toISOString(),
  }).where(eq(t.applications.id, app.id));
  await audit(user.id, "application.deny", "application", app.id, trimmed);
  revalidateQueue();
  return { ok: true, message: "Application denied — determination logged, referral letter queued." };
}

/** Approve & enroll — creates the client record, pins the FPL year, logs SDA 1a. */
export async function approveApplication(appId: string): Promise<ActionResult> {
  const user = await requireUser();
  const app = await loadApp(appId);
  if (!app || !await userCanSeeProgram(user, app.programId) || !(OPEN_STAGES as readonly string[]).includes(app.stage)) {
    return { ok: false, message: "Application not found or already decided." };
  }
  // Server-side re-check — never trust the client's disabled button.
  if (!await applicationDocsVerified(app)) {
    return { ok: false, message: "Approval unlocks when every document is verified." };
  }
  const ceiling = await programCeiling(app.programId);
  const st = await fplStatusFor(app.income, app.hhSize, app.fplYear, ceiling);
  if (!st.eligible) {
    return { ok: false, message: `Income exceeds this program's ${ceiling}% FPL ceiling — approval is blocked; deny with referral, or reassign to a program with a higher ceiling.` };
  }

  const clientId = await nextClientId();
  const today = todayIso();
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx.insert(t.clients).values({
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
    });
    await tx.insert(t.clientPrograms).values({ clientId, programId: app.programId });
    await tx.update(t.applications).set({
      stage: "approved",
      clientId,
      decidedBy: user.id,
      decidedAt: now,
    }).where(eq(t.applications.id, app.id));
    await tx.insert(t.serviceLog).values({
      date: today,
      clientId,
      code: "SDA 1a",
      programId: app.programId,
      staffId: user.id,
      note: "Eligibility determination — approved & enrolled.",
    });
    // close the seminar → intake → enroll loop: the attendee now has a client
    // record, so posted seminar attendance produces their service entry
    await tx.update(t.seminarAttendees)
      .set({ clientId, intakeStatus: "enrolled" })
      .where(eq(t.seminarAttendees.applicationId, app.id))
      ;
  });
  revalidatePath("/tools/seminars");

  await audit(user.id, "application.approve", "application", app.id, `Approved & enrolled as ${clientId} (${st.pct}% FPL, ${app.fplYear} schedule)`);
  revalidateQueue();
  return { ok: true, message: "Approved & enrolled — client record created, SDA 1a eligibility determination logged." };
}
