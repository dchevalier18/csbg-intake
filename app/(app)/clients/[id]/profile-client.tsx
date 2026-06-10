"use client";
/* Client 360° profile — interactive shell (follow-up + capture-now modals). */
import { useState, useTransition } from "react";
import Link from "next/link";
import { Chip, CodeChip, Field, Panel, ProgramDot } from "@/components/ui";
import { Modal } from "@/components/ui-client";
import { useToast } from "@/components/toast";
import { I } from "@/components/icons";
import { scheduleFollowUp, captureFields } from "./actions";

export interface GapField {
  id: string;
  label: string;
  type: string;             // 'list' | 'choice' | 'yesno' | 'text' | 'number' | 'date'
  options?: string[];
}

export function ClientProfile({ client, status, programs, completeness, characteristics, gaps, services, followUp }: {
  client: { id: string; first: string; last: string; enrolledLong: string; address: string; phone: string | null };
  status: { tone: string; label: string; eligible: boolean; guidelines: string };
  programs: { color: string; short: string }[];
  completeness: number;
  characteristics: Array<[string, string]>;
  gaps: GapField[];
  services: { id: number; code: string; label: string; date: string; note: string }[];
  followUp: { dueSub?: string; body: string; defaultDate: string };
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [showSchedule, setShowSchedule] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [date, setDate] = useState(followUp.defaultDate);
  const [vals, setVals] = useState<Record<string, string>>({});

  const submitSchedule = () => {
    startTransition(async () => {
      const res = await scheduleFollowUp(client.id, date);
      toast(res.message);
      if (res.ok) setShowSchedule(false);
    });
  };

  const submitCapture = () => {
    startTransition(async () => {
      const res = await captureFields(client.id, vals);
      toast(res.message);
      if (res.ok) { setShowCapture(false); setVals({}); }
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <Link className="tlink" style={{ fontSize: 12.5, textDecoration: "none" }} href="/clients">← Back to clients</Link>
      </div>
      <div className="page-head" style={{ alignItems: "center" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div className="avatar" style={{ width: 56, height: 56, fontSize: 22 }}>{client.first[0]}{client.last[0]}</div>
          <div>
            <h1 className="page-h1" style={{ fontSize: 34 }}>{client.first} <span className="red">{client.last}</span></h1>
            <p className="lede" style={{ margin: "5px 0 0" }}>{client.id} · Enrolled {client.enrolledLong} · {client.address}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="calv-btn calv-btn--secondary calv-btn--sm" style={{ textDecoration: "none" }} href={`/services?client=${client.id}`}><I name="plus" size={13} /> Log service</Link>
          <button className="calv-btn calv-btn--ghost calv-btn--sm" onClick={() => setShowSchedule(true)}><I name="cal" size={13} /> Schedule follow-up</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <Chip tone={status.tone}>{status.label} · {status.eligible ? "CSBG eligible" : "Over income ceiling"}</Chip>
        <Chip outline>{status.guidelines}</Chip>
        {programs.map((p) => <Chip key={p.short} outline><ProgramDot color={p.color} label={p.short} /></Chip>)}
        <Chip outline><I name="phone" size={12} /> {client.phone}</Chip>
        <Chip tone={completeness === 100 ? "sage" : "amber"}>{completeness}% report-ready</Chip>
      </div>

      <div className="row2">
        <Panel title="Household & CSBG characteristics" sub="Feeds the All Characteristics Report (Module 3, Section C) — every field here rolls up automatically.">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 24px" }}>
            {characteristics.map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--calv-slate-15)", fontSize: 13 }}>
                <span style={{ color: "var(--calv-slate-65)" }}>{k}</span>
                <span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>
          {gaps.length > 0 ? (
            <div style={{ marginTop: 14, background: "var(--calv-amber-15)", border: "1px solid var(--calv-amber-35)", borderRadius: 4, padding: "10px 14px", fontSize: 12.5, display: "flex", gap: 10, alignItems: "center" }}>
              <I name="alert" size={15} style={{ color: "#8A6410" }} />
              <span><strong style={{ fontWeight: 600 }}>Gaps to close:</strong> {gaps.map((g) => g.label).join("; ")} — these count as &ldquo;Unknown / Not Reported&rdquo; in the Annual Report until captured.</span>
              <button className="calv-btn calv-btn--quiet calv-btn--sm" style={{ marginLeft: "auto" }} onClick={() => setShowCapture(true)}>Capture now</button>
            </div>
          ) : null}
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <Panel title="Service history" sub={services.length + (services.length === 1 ? " entry" : " entries") + " this FY (most recent first)"}>
            {services.length === 0 ? <div className="empty" style={{ padding: 20 }}>No services logged yet this FY.</div> :
              services.map((s) => (
                <div key={s.id} style={{ padding: "10px 2px", borderBottom: "1px solid var(--calv-slate-15)" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{s.label}</span>
                    <CodeChip code={s.code} />
                    <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--calv-slate-65)" }}>{s.date}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--calv-slate-65)" }}>{s.note}</div>
                </div>
              ))}
          </Panel>
          <Panel title="Next outcome check-in" sub={followUp.dueSub}>
            <p style={{ fontSize: 13, margin: 0, lineHeight: 1.55 }}>{followUp.body}</p>
          </Panel>
        </div>
      </div>

      {showSchedule ? (
        <Modal title="Schedule follow-up" width={380} onClose={() => setShowSchedule(false)}>
          <div className="fgrid">
            <Field label="Follow-up date" required>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
            <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setShowSchedule(false)}>Cancel</button>
            <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={pending} onClick={submitSchedule}><I name="cal" size={13} /> Schedule follow-up</button>
          </div>
        </Modal>
      ) : null}

      {showCapture ? (
        <Modal title="Capture missing characteristics" width={480} onClose={() => setShowCapture(false)}>
          <p style={{ fontSize: 12.5, color: "var(--calv-slate-65)", margin: "0 0 14px" }}>
            These fields count as &ldquo;Unknown / Not Reported&rdquo; in the Annual Report until captured.
          </p>
          <div className="fgrid">
            {gaps.map((g) => (
              <Field key={g.id} label={g.label}>
                {g.type === "list" || g.type === "choice" ? (
                  <select value={vals[g.id] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [g.id]: e.target.value }))}>
                    <option value="">— Select —</option>
                    {(g.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : g.type === "yesno" ? (
                  <select value={vals[g.id] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [g.id]: e.target.value }))}>
                    <option value="">— Select —</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                ) : (
                  <input
                    type={g.type === "number" ? "number" : g.type === "date" ? "date" : "text"}
                    value={vals[g.id] ?? ""}
                    onChange={(e) => setVals((v) => ({ ...v, [g.id]: e.target.value }))}
                  />
                )}
              </Field>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
            <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setShowCapture(false)}>Cancel</button>
            <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={pending} onClick={submitCapture}>Save to record</button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
