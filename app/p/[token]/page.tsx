import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { getProgram } from "@/lib/access";
import { applicationDocList, getOrg, staffById } from "@/lib/data/core";
import { shortDate } from "@/lib/format";
import { I } from "@/components/icons";
import { PortalClient, type PortalDoc, type PortalHintKey } from "./portal-client";

/* Public, tokenized portal page — NO requireUser(): the unguessable portal
   token IS the credential. Everything is looked up server-side from the token;
   unknown tokens get a friendly dead-link page. Always render fresh — staff
   verifications and portal uploads must show immediately. */
export const dynamic = "force-dynamic";

function hintKeyFor(docKey: string, status: string): PortalHintKey {
  if (status === "submitted") return "received";
  if (status === "verified") return "verified";
  if (docKey === "income") return "income";
  if (docKey === "residency") return "residency";
  if (docKey === "id") return "id";
  return "generic";
}

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = (await db.select().from(t.applications).where(eq(t.applications.portalToken, token)))[0];

  if (!app) {
    // Friendly plain dead-link page — no application details leak.
    return (
      <div className="portal-body" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="portal-card" style={{ textAlign: "center", maxWidth: 380, padding: "28px 24px" }}>
          <I name="phone" size={28} style={{ color: "var(--calv-slate-35)" }} />
          <div style={{ fontFamily: "var(--font-h1)", fontSize: 22, textTransform: "uppercase", letterSpacing: ".02em", margin: "12px 0 6px" }}>
            This link isn&apos;t active.
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--calv-slate-65)", margin: 0 }}>
            Call your case worker for a new one.
          </p>
        </div>
      </div>
    );
  }

  const org = await getOrg();
  const program = await getProgram(app.programId);
  const cw = await staffById(app.caseworkerId);

  const docs: PortalDoc[] = (await applicationDocList(app)).map((d) => ({
    key: d.key,
    label: d.label,
    status: d.status,
    hintKey: hintKeyFor(d.key, d.status),
  }));

  // "What's next" appointment — a seminar this application is registered for
  const att = (await db.select().from(t.seminarAttendees).where(eq(t.seminarAttendees.applicationId, app.id)))[0];
  const sem = att ? (await db.select().from(t.seminars).where(eq(t.seminars.id, att.seminarId)))[0] : undefined;
  const appointment = sem
    ? {
        what: sem.title,
        when:
          new Date(sem.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) +
          (sem.time ? " · " + sem.time.split("–")[0].trim() : ""),
        where: sem.site,
      }
    : null;

  return (
    <PortalClient
      token={token}
      first={app.first}
      appId={app.id}
      programName={program?.name ?? app.programId}
      stage={app.stage}
      appliedShort={shortDate(app.applied)}
      docs={docs}
      appointment={appointment}
      caseworkerName={cw?.name ?? "your case worker"}
      org={{ name: org.name, short: org.short, logoMode: org.logoMode, logoData: org.logoData }}
    />
  );
}
