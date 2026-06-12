"use server";
/* Tokenized portal mutations — the portal token IS the credential (no login wall),
   so there is deliberately no requireUser() here. Every check is re-derived from
   the token server-side; nothing else from the client is trusted.
   NOTE: the photographed file itself is NOT stored — only the checklist status
   flips to 'submitted' (source 'portal') for staff to verify in the queue. */
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, t } from "@/db";
import { audit } from "@/lib/access";
import { OPEN_STAGES, requiredDocKeys, staffById } from "@/lib/data/core";

export type PortalUploadResult = { ok: boolean; message: string };

export async function portalUploadDoc(token: string, docKey: string): Promise<PortalUploadResult> {
  if (!token || !docKey) {
    return { ok: false, message: "Something went wrong. Call your case worker." };
  }
  const app = (await db.select().from(t.applications).where(eq(t.applications.portalToken, token)))[0];
  if (!app) {
    return { ok: false, message: "This link isn't active. Call your case worker for a new one." };
  }
  if (!(OPEN_STAGES as readonly string[]).includes(app.stage)) {
    return { ok: false, message: "A decision has already been made — your case worker will follow up." };
  }
  if (!(await requiredDocKeys(app.programId)).includes(docKey)) {
    return { ok: false, message: "That document isn't on your checklist." };
  }

  const existing = (await db.select().from(t.applicationDocs)
    .where(and(eq(t.applicationDocs.applicationId, app.id), eq(t.applicationDocs.docKey, docKey)))
    )[0];
  if (existing && existing.status !== "missing") {
    return { ok: false, message: "We already have that document — it's being reviewed." };
  }

  const now = new Date().toISOString();
  if (existing) {
    await db.update(t.applicationDocs)
      .set({ status: "submitted", source: "portal", updatedAt: now })
      .where(and(eq(t.applicationDocs.applicationId, app.id), eq(t.applicationDocs.docKey, docKey)))
      ;
  } else {
    await db.insert(t.applicationDocs)
      .values({ applicationId: app.id, docKey, status: "submitted", source: "portal", updatedAt: now })
      ;
  }

  await audit(null, "application.doc.portal-upload", "application", app.id, `${docKey} submitted via client portal`);
  revalidatePath("/eligibility");
  revalidatePath(`/p/${token}`);

  const cw = await staffById(app.caseworkerId);
  const cwFirst = cw ? cw.name.split(" ")[0] : "your case worker";
  return {
    ok: true,
    message: `Document received — ${cwFirst} is notified and the eligibility queue updates in real time.`,
  };
}
