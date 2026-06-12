"use client";
/* Eligibility queue — pre-enrollment document tracking + approve/deny.
   Server data arrives as plain props; mutations go through ./actions.ts. */
import { useRef, useState, useTransition } from "react";
import { Chip, Kpi, Panel, Field, ProgramDot } from "@/components/ui";
import { Seg, Modal } from "@/components/ui-client";
import { I } from "@/components/icons";
import { useToast } from "@/components/toast";
import { money, shortDate } from "@/lib/format";
import {
  attachApplicationDoc, verifyApplicationDoc, bypassVerifyApplicationDoc,
  undoApplicationDocVerification, sendForDecision, denyApplication, approveApplication,
} from "./actions";

export interface AppDocRow {
  key: string;
  label: string;
  status: string;        // 'missing' | 'submitted' | 'verified'
  file: { name: string; when: string | null } | null;
  verification: { byName: string; when: string | null } | null;
  bypass: { byName: string; when: string | null; reason: string } | null;
}

export interface AppRow {
  id: string;
  first: string;
  last: string;
  hhSize: number;
  county: string;
  income: number;
  applied: string;       // ISO date
  stage: string;         // 'docs' | 'review' | 'decision'
  notes: string;
  programColor: string;
  programShort: string;
  caseworker: string;
  fpl: { pct: number; label: string; tone: string; eligible: boolean; year: number };
  docs: AppDocRow[];
}

const STAGES = [
  { id: "docs", label: "Waiting on documents", tone: "amber" },
  { id: "review", label: "Ready for review", tone: "teal" },
  { id: "decision", label: "Awaiting decision", tone: "red" },
] as const;

// mirrors DOC_STATUS_LABEL in @/lib/data/core (server-only, can't import here)
const DOC_STATUS: Record<string, string> = {
  verified: "Verified",
  submitted: "Submitted — needs review",
  missing: "Missing",
};

// dark amber for warning text on white — AA-safe (the --calv-amber tint is not)
const AMBER_TEXT = "#8A6410";
const UPLOAD_ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,.tif,.tiff";

const stageOf = (a: AppRow) => STAGES.find((s) => s.id === a.stage) ?? STAGES[0];
// vacuous truth — zero configured requirements counts as documents-satisfied
const docsDone = (a: AppRow) => a.docs.every((d) => d.status === "verified");

export default function EligibilityClient({ rows, ceiling, currentUserName }: {
  rows: AppRow[]; ceiling: number; currentUserName: string;
}) {
  const toast = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState("All");
  const [, startTransition] = useTransition();
  const open = rows.find((a) => a.id === openId);

  function attach(aId: string, key: string, file: File) {
    if (file.size > 4 * 1024 * 1024) {
      toast("Files up to 4 MB are supported — scan at a lower resolution or split the document.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result ?? "").split(",")[1] ?? "";
      startTransition(async () => {
        const res = await attachApplicationDoc(aId, key, file.name, base64);
        toast(res.message);
      });
    };
    reader.readAsDataURL(file);
  }
  function verify(aId: string, key: string) {
    startTransition(async () => {
      const res = await verifyApplicationDoc(aId, key);
      toast(res.message);
    });
  }
  function bypass(aId: string, key: string, reason: string) {
    startTransition(async () => {
      const res = await bypassVerifyApplicationDoc(aId, key, reason);
      toast(res.message);
    });
  }
  function undo(aId: string, key: string) {
    startTransition(async () => {
      const res = await undoApplicationDocVerification(aId, key);
      toast(res.message);
    });
  }
  function advance(aId: string) {
    startTransition(async () => {
      const res = await sendForDecision(aId);
      toast(res.message);
    });
  }
  function decide(aId: string, decision: "approve" | "deny", note?: string) {
    startTransition(async () => {
      const res = decision === "approve" ? await approveApplication(aId) : await denyApplication(aId, note ?? "");
      toast(res.message);
      if (res.ok) setOpenId(null);
    });
  }

  const shown = rows.filter((a) => stageFilter === "All" || stageOf(a).label === stageFilter);

  return (
    <div data-screen-label="Eligibility queue">
      <div className="page-head">
        <div>
          <h1 className="page-h1">Eligibility <span className="red">queue.</span></h1>
          <p className="lede">Pre-enrollment pipeline — track required documents, verify income, approve or deny. Nothing enrolls until eligibility is determined.</p>
        </div>
        <Seg options={["All", ...STAGES.map((s) => s.label)]} value={stageFilter} onChange={setStageFilter} />
      </div>

      <div className="kpis" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <Kpi kick="In pipeline" value={rows.length} accent="var(--calv-slate-35)" />
        {STAGES.map((s) => (
          <Kpi key={s.id} kick={s.label} value={rows.filter((a) => a.stage === s.id).length}
            accent={s.id === "docs" ? "var(--calv-amber)" : s.id === "review" ? "var(--calv-teal)" : "var(--calv-red)"} />
        ))}
      </div>

      <Panel>
        <table className="data">
          <thead><tr>
            <th>Applicant</th><th>Program</th><th>Applied</th><th>Income vs FPL</th><th>Documents</th><th>Stage</th><th>Case worker</th><th></th>
          </tr></thead>
          <tbody>
            {shown.map((a) => {
              const st = a.fpl;
              const docs = a.docs;
              const verified = docs.filter((d) => d.status === "verified").length;
              return (
                <tr key={a.id} className="rowlink" onClick={() => setOpenId(a.id)}>
                  <td className="cname">{a.first} {a.last}<div style={{ fontFamily: "var(--font-body)", fontWeight: 300, fontSize: 11.5, color: "var(--calv-slate-65)", textTransform: "none" }}>{a.id} · HH of {a.hhSize} · {a.county} Co.</div></td>
                  <td><ProgramDot color={a.programColor} label={a.programShort} /></td>
                  <td>{shortDate(a.applied)}</td>
                  <td><Chip tone={st.tone}>{st.label}</Chip>{!st.eligible ? <div style={{ fontSize: 10.5, color: "#B73719", marginTop: 3 }}>over {ceiling}% ceiling</div> : null}</td>
                  <td style={{ minWidth: 130 }}>
                    <div className="meter-row"><div className={"meter " + (verified === docs.length ? "" : verified >= docs.length - 1 ? "warn" : "bad")} style={{ flex: 1 }}><i style={{ width: (docs.length ? (verified / docs.length) * 100 : 100) + "%" }}></i></div><span className="pct">{verified}/{docs.length}</span></div>
                  </td>
                  <td><Chip tone={stageOf(a).tone}>{stageOf(a).label}</Chip></td>
                  <td>{a.caseworker}</td>
                  <td style={{ textAlign: "right" }}><I name="arrow" size={14} style={{ color: "var(--calv-slate-35)" }} /></td>
                </tr>
              );
            })}
            {shown.length === 0 ? <tr><td colSpan={8}><div className="empty">No applications in this stage.</div></td></tr> : null}
          </tbody>
        </table>
      </Panel>

      {open ? (
        <ApplicantModal a={open} ceiling={ceiling} currentUserName={currentUserName} onClose={() => setOpenId(null)}
          attach={attach} verify={verify} bypass={bypass} undo={undo} decide={decide} advance={advance} />
      ) : null}
    </div>
  );
}

function ApplicantModal({ a, ceiling, currentUserName, onClose, attach, verify, bypass, undo, decide, advance }: {
  a: AppRow;
  ceiling: number;
  currentUserName: string;
  onClose: () => void;
  attach: (aId: string, key: string, file: File) => void;
  verify: (aId: string, key: string) => void;
  bypass: (aId: string, key: string, reason: string) => void;
  undo: (aId: string, key: string) => void;
  decide: (aId: string, decision: "approve" | "deny", note?: string) => void;
  advance: (aId: string) => void;
}) {
  const [denyNote, setDenyNote] = useState("");
  const [showDeny, setShowDeny] = useState(false);
  const [bypassKey, setBypassKey] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pickKey = useRef<string | null>(null);
  const st = a.fpl;
  const docs = a.docs;
  const ready = docsDone(a);

  function pickFile(key: string) {
    pickKey.current = key;
    fileRef.current?.click();
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f && pickKey.current) attach(a.id, pickKey.current, f);
    e.target.value = "";
  }

  const bypassDoc = bypassKey ? docs.find((d) => d.key === bypassKey) : undefined;

  return (
    <Modal title={a.first + " " + a.last + " — eligibility review"} onClose={onClose} width={620}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <Chip outline><ProgramDot color={a.programColor} label={a.programShort} /></Chip>
        <Chip tone={st.tone}>{st.label} · {st.eligible ? "Income-eligible" : "Exceeds " + ceiling + "% ceiling"}</Chip>
        <Chip outline>HH of {a.hhSize} · {money(a.income)}/yr</Chip>
        <Chip outline>{st.year} FPL schedule</Chip>
        <Chip outline>Applied {shortDate(a.applied)}</Chip>
      </div>

      <div style={{ background: "var(--calv-sand-15)", border: "1px solid var(--calv-sand-35)", borderRadius: 4, padding: "12px 14px", fontSize: 13, lineHeight: 1.55, marginBottom: 18 }}>
        <strong style={{ fontWeight: 600 }}>Case worker note —</strong> {a.notes}
      </div>

      <h3 className="calv-label" style={{ fontSize: 12, marginBottom: 10 }}>Required documents · {a.id}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {docs.map((d) => (
          <div key={d.key} style={{ padding: "10px 12px", border: "1px solid var(--calv-slate-15)", borderRadius: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <I name="doc" size={16} style={{ color: d.status === "verified" ? "var(--calv-sage)" : d.status === "submitted" ? AMBER_TEXT : "var(--calv-red)" }} />
              <span style={{ flex: 1, fontSize: 13 }}>{d.label}</span>
              <Chip tone={d.status === "verified" ? "sage" : d.status === "submitted" ? "amber" : "red"}>{DOC_STATUS[d.status] ?? d.status}</Chip>
              {d.status !== "verified" ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => pickFile(d.key)} title={d.file ? "Replace the attached file" : "Upload the scanned document"}>
                    <I name="upload" size={13} /> {d.file ? "Replace" : "Attach"}
                  </button>
                  {d.file ? (
                    <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => verify(a.id, d.key)}><I name="check" size={13} /> Verify</button>
                  ) : (
                    <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setBypassKey(d.key)} title="Requires a signed acknowledgement">Verify without doc…</button>
                  )}
                </div>
              ) : (
                <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => undo(a.id, d.key)} title="Revert this verification if it was committed by mistake">Undo</button>
              )}
            </div>
            {(d.file || d.verification || d.bypass || d.status === "submitted") ? (
              <div style={{ marginTop: 7, paddingLeft: 28, display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: "var(--calv-slate-65)", lineHeight: 1.5 }}>
                {d.file ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><I name="doc" size={12} /> {d.file.name}{d.file.when ? <> · uploaded {shortDate(d.file.when)}</> : null}</span> : null}
                {!d.file && d.status === "submitted" ? <span style={{ color: AMBER_TEXT }}>No file on record — attach the scanned document to verify.</span> : null}
                {d.verification ? <span>Verified by {d.verification.byName}{d.verification.when ? <> · {shortDate(d.verification.when)}</> : null}</span> : null}
                {d.bypass ? <span style={{ color: AMBER_TEXT, display: "inline-flex", alignItems: "flex-start", gap: 5 }}><I name="alert" size={12} style={{ marginTop: 2 }} /> No document retained — signed off by {d.bypass.byName}: “{d.bypass.reason}”</span> : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <input type="file" ref={fileRef} style={{ display: "none" }} onChange={onFile} accept={UPLOAD_ACCEPT} />

      {showDeny ? (
        <div style={{ marginBottom: 16 }}>
          <Field label="Denial reason (required — written to determination record)" required>
            <textarea rows={3} value={denyNote} onChange={(e) => setDenyNote(e.target.value)}
              placeholder={st.eligible ? "Reason for denial…" : "e.g., Household income " + st.pct + "% of FPL exceeds CSBG " + ceiling + "% ceiling. Referred to United Way 211."} />
          </Field>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        {a.stage === "review" ? <button className="calv-btn calv-btn--secondary calv-btn--sm" onClick={() => advance(a.id)}>Send for decision <I name="arrow" size={13} /></button> : null}
        {showDeny ?
          <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={denyNote.trim().length < 8} style={denyNote.trim().length < 8 ? { opacity: 0.45, cursor: "not-allowed" } : undefined} onClick={() => decide(a.id, "deny", denyNote)}>Confirm denial</button> :
          <button className="calv-btn calv-btn--ghost calv-btn--sm" onClick={() => setShowDeny(true)}>Deny…</button>}
        <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={!ready || !st.eligible}
          style={(!ready || !st.eligible) ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
          onClick={() => decide(a.id, "approve")}>
          <I name="check" size={14} /> Approve &amp; enroll
        </button>
      </div>
      {!ready ? <p style={{ fontSize: 11.5, color: "var(--calv-slate-65)", textAlign: "right", margin: "8px 0 0" }}>Approval unlocks when every document is verified.</p> : null}
      {ready && !st.eligible ? <p style={{ fontSize: 11.5, color: "#B73719", textAlign: "right", margin: "8px 0 0" }}>Income exceeds the CSBG {ceiling}% FPL ceiling — approval is blocked; deny with referral.</p> : null}

      {bypassKey ? (
        <BypassPrompt applicantId={a.id} label={bypassDoc?.label ?? bypassKey} userName={currentUserName}
          onCancel={() => setBypassKey(null)}
          onConfirm={(reason) => { bypass(a.id, bypassKey, reason); setBypassKey(null); }} />
      ) : null}
    </Modal>
  );
}

// signed acknowledgement required to verify a requirement with no supporting document on file
function BypassPrompt({ applicantId, label, userName, onCancel, onConfirm }: {
  applicantId: string;
  label: string;
  userName: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const ok = ack && reason.trim().length >= 8;
  return (
    <Modal title="Verify without a supporting document" onClose={onCancel} width={480}>
      <div style={{ background: "var(--calv-amber-15)", border: "1px solid var(--calv-amber-35)", borderRadius: 4, padding: "12px 14px", fontSize: 12.5, lineHeight: 1.55, display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16 }}>
        <I name="alert" size={16} style={{ color: AMBER_TEXT, marginTop: 1 }} />
        <span><strong style={{ fontWeight: 600 }}>{label}</strong> has no scanned document attached. Verifying without one is an audited exception — your sign-off is written to {applicantId}&apos;s eligibility determination record and is visible to program monitors.</span>
      </div>
      <Field label="Why is no document on file?" required>
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Original sighted in person — agency policy prohibits retaining a copy." />
      </Field>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.55, margin: "14px 0 18px", cursor: "pointer" }}>
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ marginTop: 2, flex: "none" }} />
        <span>I, <strong style={{ fontWeight: 600 }}>{userName}</strong>, acknowledge that I am verifying this requirement without a supporting document on file, and I accept responsibility for this determination.</span>
      </label>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="calv-btn calv-btn--ghost calv-btn--sm" onClick={onCancel}>Cancel</button>
        <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={!ok} style={!ok ? { opacity: 0.45, cursor: "not-allowed" } : undefined} onClick={() => onConfirm(reason.trim())}>Sign &amp; verify</button>
      </div>
    </Modal>
  );
}
