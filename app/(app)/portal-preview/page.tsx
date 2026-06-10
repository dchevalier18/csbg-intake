import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHead, Panel } from "@/components/ui";

/* Staff preview of the client self-service portal. The phone frame embeds the
   REAL tokenized portal route (/p/demo-rosa — Rosa Mejía's seeded application),
   so taps inside the frame hit the live server action and update the
   eligibility queue in real time. */
export default async function PortalPreviewPage() {
  await requireUser();

  return (
    <div data-screen-label="Client self-service portal">
      <PageHead
        title="Client"
        titleAccent="portal."
        lede="What applicants see on their phone — large type, plain language, three things only: where you stand, what we need, what's next."
      />

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 36, alignItems: "start" }}>
        <div className="phone-frame">
          <div className="phone-notch" />
          <div className="phone-screen">
            <iframe
              src="/p/demo-rosa"
              title="Client portal — Rosa Mejía"
              style={{ width: "100%", height: "100%", border: 0, display: "block" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 13, maxWidth: 480, position: "sticky", top: 16 }}>
          <Panel title="Why this matters" sub="The portal closes the slowest loop in eligibility: documents.">
            <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 13, lineHeight: 1.7, color: "var(--calv-slate)" }}>
              <li>Applicants photograph documents instead of making a second office trip — the #1 cause of stalled applications.</li>
              <li>Uploads land directly on the application in the <strong style={{ fontWeight: 600 }}>eligibility queue</strong>, flagged for staff verification. Nothing auto-verifies.</li>
              <li>Plain language, no jargon, no login wall — applicants get a text link tied to their application ID.</li>
              <li>Works in English and Spanish; type scale and 44px+ touch targets meet accessibility guidance.</li>
            </ul>
          </Panel>
          <Panel title="Try it" sub="This preview is wired to Rosa Mejía's real application.">
            <p style={{ fontSize: 13, margin: 0, lineHeight: 1.6 }}>
              Tap <strong style={{ fontWeight: 600 }}>&ldquo;Snap a photo&rdquo;</strong> on a document, then open the{" "}
              <Link href="/eligibility" className="tlink" style={{ fontWeight: 600 }}>Eligibility queue</Link> — Rosa&apos;s
              checklist shows the document as submitted and waiting for staff verification.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
