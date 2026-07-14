"use client";
/* Past denials review — re-check eligibility as of today, correct intake data,
   and reopen (re-enroll) a denied application into the same or a different
   program. Server data arrives as plain props; mutations go through the shared
   eligibility actions. */
import { useState, useTransition } from "react";
import { Chip, Kpi, Panel, Field, ProgramDot } from "@/components/ui";
import { Seg, Modal } from "@/components/ui-client";
import { I } from "@/components/icons";
import { useToast } from "@/components/toast";
import { money, shortDate } from "@/lib/format";
import { reopenApplication, updateApplication, type ApplicationUpdatePayload } from "../eligibility/actions";
import {
  IntakeDetailsForm,
  type AppDocRow, type IntakeAnswers, type IntakeFieldDef, type ProgramOption,
} from "../eligibility/eligibility-client";

export interface DenialRow {
  id: string;
  first: string;
  last: string;
  hhSize: number;
  county: string;
  income: number;
  applied: string;       // ISO date
  notes: string;
  programColor: string;
  programShort: string;
  programName: string;
  ceiling: number;       // program's CURRENT effective FPL ceiling (%)
  caseworker: string;
  denied: { on: string; byName: string; note: string };   // on = ISO date
  /** live re-check under today's ACTIVE FPL schedule + current ceiling */
  fpl: { pct: number; label: string; tone: string; eligible: boolean; year: number };
  intake: IntakeAnswers;
  docs: AppDocRow[];
}

// mirrors DOC_STATUS_LABEL in @/lib/data/core (server-only, can't import here)
const DOC_STATUS: Record<string, string> = {
  verified: "Verified",
  submitted: "Submitted — needs review",
  missing: "Missing",
};

// dark amber for warning text on white — AA-safe (the --calv-amber tint is not)
const AMBER_TEXT = "#8A6410";

const FILTERS = ["All", "Eligible today", "Over ceiling"] as const;

export default function DenialsClient({ rows, lists, fields, programs, fy }: {
  rows: DenialRow[];
  lists: Record<string, string[]>;       // answer lists by key
  fields: IntakeFieldDef[];              // enabled intake fields (characteristics)
  programs: ProgramOption[];             // visible programs — reopen targets
  fy: { label: string; start: string };  // agency fiscal year (from settings)
}) {
  const toast = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>(FILTERS[0]);
  const [, startTransition] = useTransition();
  const open = rows.find((a) => a.id === openId);

  const deniedThisFY = rows.filter((a) => a.denied.on >= fy.start).length;
  const eligibleToday = rows.filter((a) => a.fpl.eligible).length;

  function reopen(aId: string, programId: string, note: string) {
    startTransition(async () => {
      const res = await reopenApplication(aId, programId, note);
      toast(res.message);
      if (res.ok) setOpenId(null);
    });
  }
  function save(aId: string, payload: ApplicationUpdatePayload) {
    startTransition(async () => {
      const res = await updateApplication(aId, payload);
      toast(res.message);
    });
  }

  const shown = rows.filter((a) =>
    filter === "All" || (filter === "Eligible today" ? a.fpl.eligible : !a.fpl.eligible));

  return (
    <div data-screen-label="Denials review">
      <div className="page-head">
        <div>
          <h1 className="page-h1">Past <span className="red">denials.</span></h1>
          <p className="lede">Every denied application stays reviewable — eligibility is re-checked against today&apos;s FPL schedule, intake details stay correctable, and a denial can be reopened into any program for re-enrollment.</p>
        </div>
        <Seg options={[...FILTERS]} value={filter} onChange={setFilter} />
      </div>

      <div className="kpis" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <Kpi kick="Past denials" value={rows.length} accent="var(--calv-slate-35)" />
        <Kpi kick={"Denied in " + fy.label} value={deniedThisFY} accent="var(--calv-red)" />
        <Kpi kick="Income-eligible today" value={eligibleToday} accent="var(--calv-sage)" />
        <Kpi kick="Over ceiling today" value={rows.length - eligibleToday} accent="var(--calv-amber)" />
      </div>

      <Panel>
        <table className="data">
          <thead><tr>
            <th>Applicant</th><th>Program</th><th>Applied</th><th>Denied</th><th>Income vs FPL today</th><th>Denial reason</th><th></th>
          </tr></thead>
          <tbody>
            {shown.map((a) => (
              <tr key={a.id} className="rowlink" onClick={() => setOpenId(a.id)}>
                <td className="cname">{a.first} {a.last}<div style={{ fontFamily: "var(--font-body)", fontWeight: 300, fontSize: 11.5, color: "var(--calv-slate-65)", textTransform: "none" }}>{a.id} · HH of {a.hhSize} · {a.county} Co.</div></td>
                <td><ProgramDot color={a.programColor} label={a.programShort} /></td>
                <td>{shortDate(a.applied)}</td>
                <td>{shortDate(a.denied.on)}<div style={{ fontSize: 11.5, color: "var(--calv-slate-65)" }}>by {a.denied.byName}</div></td>
                <td><Chip tone={a.fpl.tone}>{a.fpl.label}</Chip>{!a.fpl.eligible ? <div style={{ fontSize: 10.5, color: "#B73719", marginTop: 3 }}>over {a.ceiling}% ceiling</div> : null}</td>
                <td style={{ maxWidth: 260 }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12.5, color: "var(--calv-slate-65)" }} title={a.denied.note}>{a.denied.note || "—"}</div></td>
                <td style={{ textAlign: "right" }}><I name="arrow" size={14} style={{ color: "var(--calv-slate-35)" }} /></td>
              </tr>
            ))}
            {shown.length === 0 ? <tr><td colSpan={7}><div className="empty">{rows.length === 0 ? "No denied applications — determinations land here when an application is denied." : "No denials match this filter."}</div></td></tr> : null}
          </tbody>
        </table>
      </Panel>

      {open ? (
        <DenialModal a={open} onClose={() => setOpenId(null)}
          lists={lists} fields={fields} programs={programs}
          reopen={reopen} save={save} />
      ) : null}
    </div>
  );
}

const MODAL_TABS = ["Denial record", "Intake details"];

function DenialModal({ a, onClose, lists, fields, programs, reopen, save }: {
  a: DenialRow;
  onClose: () => void;
  lists: Record<string, string[]>;
  fields: IntakeFieldDef[];
  programs: ProgramOption[];
  reopen: (aId: string, programId: string, note: string) => void;
  save: (aId: string, payload: ApplicationUpdatePayload) => void;
}) {
  const [tab, setTab] = useState(MODAL_TABS[0]);
  const [showReopen, setShowReopen] = useState(false);
  const [reopenNote, setReopenNote] = useState("");
  const [reopenProgram, setReopenProgram] = useState(a.intake.programId);
  const canReopen = reopenNote.trim().length >= 8;
  const target = programs.find((p) => p.id === reopenProgram);
  const verified = a.docs.filter((d) => d.status === "verified").length;

  return (
    <Modal title={a.first + " " + a.last + " — denial review"} onClose={onClose} width={620}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <Chip outline><ProgramDot color={a.programColor} label={a.programShort} /></Chip>
        <Chip tone={a.fpl.tone}>{a.fpl.label} today · {a.fpl.eligible ? "Income-eligible" : "Exceeds " + a.ceiling + "% ceiling"}</Chip>
        <Chip outline>HH of {a.hhSize} · {money(a.income)}/yr</Chip>
        <Chip outline>Applied {shortDate(a.applied)}</Chip>
        <Chip tone="red">Denied {shortDate(a.denied.on)}</Chip>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Seg options={MODAL_TABS} value={tab} onChange={setTab} />
      </div>

      {tab === MODAL_TABS[1] ? (
        <IntakeDetailsForm a={a} lists={lists} fields={fields} programs={programs} programLocked
          onSave={(p) => save(a.id, p)} />
      ) : <>

      <div style={{ background: "var(--calv-red-15)", border: "1px solid var(--calv-red-35)", borderRadius: 4, padding: "12px 14px", fontSize: 13, lineHeight: 1.55, marginBottom: 14 }}>
        <strong style={{ fontWeight: 600 }}>Denied {shortDate(a.denied.on)} by {a.denied.byName} —</strong> {a.denied.note || "no determination note recorded."}
      </div>
      <div style={{ background: "var(--calv-sand-15)", border: "1px solid var(--calv-sand-35)", borderRadius: 4, padding: "12px 14px", fontSize: 13, lineHeight: 1.55, marginBottom: 18 }}>
        <strong style={{ fontWeight: 600 }}>Case worker note —</strong> {a.notes || "—"} <span style={{ color: "var(--calv-slate-65)" }}>(case worker: {a.caseworker})</span>
      </div>

      <h3 className="calv-label" style={{ fontSize: 12, marginBottom: 10 }}>Documents at denial · {a.id} · {verified}/{a.docs.length} verified</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {a.docs.map((d) => (
          <div key={d.key} style={{ padding: "10px 12px", border: "1px solid var(--calv-slate-15)", borderRadius: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <I name="doc" size={16} style={{ color: d.status === "verified" ? "var(--calv-sage)" : d.status === "submitted" ? AMBER_TEXT : "var(--calv-red)" }} />
              <span style={{ flex: 1, fontSize: 13 }}>{d.label}</span>
              <Chip tone={d.status === "verified" ? "sage" : d.status === "submitted" ? "amber" : "red"}>{DOC_STATUS[d.status] ?? d.status}</Chip>
            </div>
            {(d.file || d.verification || d.bypass) ? (
              <div style={{ marginTop: 7, paddingLeft: 28, display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: "var(--calv-slate-65)", lineHeight: 1.5 }}>
                {d.file ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><I name="doc" size={12} /> {d.file.name}{d.file.when ? <> · uploaded {shortDate(d.file.when)}</> : null}</span> : null}
                {d.verification ? <span>Verified by {d.verification.byName}{d.verification.when ? <> · {shortDate(d.verification.when)}</> : null}</span> : null}
                {d.bypass ? <span style={{ color: AMBER_TEXT, display: "inline-flex", alignItems: "flex-start", gap: 5 }}><I name="alert" size={12} style={{ marginTop: 2 }} /> No document retained — signed off by {d.bypass.byName}: “{d.bypass.reason}”</span> : null}
              </div>
            ) : null}
          </div>
        ))}
        {a.docs.length === 0 ? <div className="empty">No documents were required for this program.</div> : null}
      </div>

      {showReopen ? (
        <div style={{ border: "1px solid var(--calv-slate-15)", borderRadius: 4, padding: "14px 14px 16px", marginBottom: 16 }}>
          <h3 className="calv-label" style={{ fontSize: 12, marginBottom: 10 }}>Reopen for re-enrollment</h3>
          <div style={{ background: "var(--calv-sand-15)", border: "1px solid var(--calv-sand-35)", borderRadius: 4, padding: "12px 14px", fontSize: 12.5, lineHeight: 1.55, marginBottom: 14 }}>
            Reopening returns {a.id} to the eligibility queue — no new intake needed. Eligibility is re-assessed under the <strong style={{ fontWeight: 600 }}>current FPL schedule</strong>, the document checklist follows the chosen program (verified documents carry over where requirements overlap), and the applicant&apos;s portal link goes live again for uploads. The original denial stays on the audit record. Enrollment still requires the full review — verified documents and income within the ceiling.
          </div>
          <div className="fgrid c2" style={{ marginBottom: 12 }}>
            <Field label="Reopen into program" hint={target && a.fpl.pct > target.ceiling ? "Heads-up: " + a.fpl.pct + "% FPL today is over this program's " + target.ceiling + "% ceiling" : undefined}>
              <select value={reopenProgram} onChange={(ev) => setReopenProgram(ev.target.value)}>
                {programs.map((p) => <option key={p.id} value={p.id}>{p.name} — eligible up to {p.ceiling}% FPL</option>)}
              </select>
            </Field>
            <Field label="Reason for reopening (required — written to determination record)" required>
              <textarea rows={2} value={reopenNote} onChange={(ev) => setReopenNote(ev.target.value)}
                placeholder="e.g., Household income changed — lost second job in May; re-screen for enrollment." />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="calv-btn calv-btn--ghost calv-btn--sm" onClick={() => setShowReopen(false)}>Cancel</button>
            <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={!canReopen}
              style={!canReopen ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
              onClick={() => reopen(a.id, reopenProgram, reopenNote)}>
              <I name="rotate" size={14} /> Reopen application
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center" }}>
          <span style={{ fontSize: 11.5, color: "var(--calv-slate-65)", marginRight: "auto" }}>Circumstances changed? Correct the intake details, then reopen to re-enroll.</span>
          <button className="calv-btn calv-btn--primary calv-btn--sm" onClick={() => setShowReopen(true)}>
            <I name="rotate" size={14} /> Reopen for re-enrollment…
          </button>
        </div>
      )}
      </>}
    </Modal>
  );
}
