"use client";
/* Client 360° profile — interactive shell (follow-up + capture-now + log-service + record-outcome modals). */
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Chip, CodeChip, Field, Panel, ProgramDot } from "@/components/ui";
import { Modal, Seg } from "@/components/ui-client";
import { useToast } from "@/components/toast";
import { I } from "@/components/icons";
import { DOMAINS, FNPIS } from "@/lib/csbg-catalog";
import { scheduleFollowUp, captureFields, recordOutcome, enrollInProgram } from "./actions";
import { addServiceEntry } from "../../services/actions";
import { servicesForProgram, fileToBase64, UPLOAD_ACCEPT, type ServiceOption } from "../../services/services-client";

export interface EnrollTarget {
  id: string;
  name: string;
  short: string;
  color: string;
  ceiling: number;          // % of FPL this program checks against
  eligible: boolean;        // preview under the active schedule
  pct: number;              // client's income as % of FPL
  docsCount: number;
}

export interface PendingEnrollment {
  id: string;               // application id
  programShort: string;
  stage: string;            // 'docs' | 'review' | 'decision'
}

const STAGE_LABEL: Record<string, string> = {
  docs: "waiting on documents",
  review: "ready for review",
  decision: "awaiting decision",
};

export interface GapField {
  id: string;
  label: string;
  type: string;             // 'list' | 'choice' | 'yesno' | 'text' | 'number' | 'date'
  options?: string[];
}

export interface ServiceRow {
  id: number;
  code: string;
  label: string;
  date: string;
  note: string;
  programShort: string;
  staffInitials: string;
  fileName: string | null;
}

export interface OutcomeRow {
  id: number;
  code: string;
  label: string;
  status: string;           // 'working' | 'achieved'
  date: string;
  note: string;
}

const OUTCOME_STATUS_OPTIONS = ["Achieved", "Working toward"];
const fnpiDomains = DOMAINS.filter((d) => FNPIS.some((f) => f.domain === d.id));

export function ClientProfile({ client, status, programs, completeness, characteristics, gaps, services, serviceOptions, restrictions, outcomes, outcomePrograms, enrollTargets, pendingEnrollments, followUp }: {
  client: { id: string; first: string; last: string; enrolledLong: string; address: string; phone: string | null };
  status: { tone: string; label: string; eligible: boolean; guidelines: string };
  programs: { color: string; short: string }[];
  completeness: number;
  characteristics: Array<[string, string]>;
  gaps: GapField[];
  services: ServiceRow[];
  serviceOptions: ServiceOption[];
  restrictions: Record<string, string[]>;
  outcomes: OutcomeRow[];
  outcomePrograms: { id: string; short: string }[];
  enrollTargets: EnrollTarget[];
  pendingEnrollments: PendingEnrollment[];
  followUp: { dueSub?: string; body: string; defaultDate: string };
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [showSchedule, setShowSchedule] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [showOutcome, setShowOutcome] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);
  const [enrollPick, setEnrollPick] = useState("");
  const [viewService, setViewService] = useState<ServiceRow | null>(null);
  const [date, setDate] = useState(followUp.defaultDate);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [fnpiCode, setFnpiCode] = useState("");
  const [fnpiProgram, setFnpiProgram] = useState(outcomePrograms[0]?.id ?? "");
  const [fnpiStatus, setFnpiStatus] = useState(OUTCOME_STATUS_OPTIONS[0]);
  const [fnpiNote, setFnpiNote] = useState("");
  // log-service modal state
  const [svcCode, setSvcCode] = useState("");
  const [svcProgram, setSvcProgram] = useState(outcomePrograms[0]?.id ?? "");
  const [svcNote, setSvcNote] = useState("");
  const [svcFile, setSvcFile] = useState<File | null>(null);
  const svcFileRef = useRef<HTMLInputElement>(null);

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

  const submitEnroll = () => {
    startTransition(async () => {
      const res = await enrollInProgram(client.id, enrollPick);
      toast(res.message);
      if (res.ok) {
        setShowEnroll(false);
        setEnrollPick("");
      }
    });
  };

  const submitService = () => {
    startTransition(async () => {
      const attachment = svcFile ? { name: svcFile.name, base64: await fileToBase64(svcFile) } : null;
      const res = await addServiceEntry({ clientId: client.id, code: svcCode, programId: svcProgram, note: svcNote, attachment });
      toast(res.message);
      if (res.ok) {
        setShowLog(false);
        setSvcCode(""); setSvcNote(""); setSvcFile(null);
        if (svcFileRef.current) svcFileRef.current.value = "";
      }
    });
  };

  const onSvcFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > 4 * 1024 * 1024) {
      toast("Files up to 4 MB are supported — scan at a lower resolution or split the document.");
      e.target.value = "";
      return;
    }
    setSvcFile(f);
  };

  const submitOutcome = () => {
    startTransition(async () => {
      const res = await recordOutcome(client.id, {
        code: fnpiCode,
        programId: fnpiProgram,
        status: fnpiStatus === "Achieved" ? "achieved" : "working",
        note: fnpiNote,
      });
      toast(res.message);
      if (res.ok) {
        setShowOutcome(false);
        setFnpiCode(""); setFnpiNote(""); setFnpiStatus(OUTCOME_STATUS_OPTIONS[0]);
      }
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
          <button className="calv-btn calv-btn--secondary calv-btn--sm" onClick={() => setShowLog(true)}><I name="plus" size={13} /> Log service</button>
          <button className="calv-btn calv-btn--ghost calv-btn--sm" onClick={() => setShowSchedule(true)}><I name="cal" size={13} /> Schedule follow-up</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <Chip tone={status.tone}>{status.label} · {status.eligible ? "CSBG eligible" : "Over income ceiling"}</Chip>
        <Chip outline>{status.guidelines}</Chip>
        {programs.map((p) => <Chip key={p.short} outline><ProgramDot color={p.color} label={p.short} /></Chip>)}
        {pendingEnrollments.map((p) => (
          <Chip key={p.id} tone="amber" outline>{p.programShort} · in queue ({STAGE_LABEL[p.stage] ?? p.stage})</Chip>
        ))}
        {enrollTargets.length > 0 ? (
          <button className="chip outline" style={{ cursor: "pointer", borderStyle: "dashed" }} onClick={() => setShowEnroll(true)}
            title="Enroll this client in another program — no duplicate record">
            <I name="plus" size={11} /> Enroll in program
          </button>
        ) : null}
        <Chip outline><I name="phone" size={12} /> {client.phone}</Chip>
        <Chip tone={completeness === 100 ? "sage" : "amber"}>{completeness}% report-ready</Chip>
      </div>

      <div className="row2">
        <Panel title="Household & CSBG characteristics" sub="Feeds the All Characteristics Report (Module 4, Section C) — every field here rolls up automatically.">
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
          <Panel title="Service history" sub={services.length + (services.length === 1 ? " entry" : " entries") + " this FY (most recent first) — click an entry for the note & attachment"}>
            {services.length === 0 ? <div className="empty" style={{ padding: 20 }}>No services logged yet this FY.</div> :
              services.map((s) => (
                <div key={s.id} role="button" tabIndex={0} onClick={() => setViewService(s)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setViewService(s); } }}
                  style={{ padding: "10px 2px", borderBottom: "1px solid var(--calv-slate-15)", cursor: "pointer" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{s.label}</span>
                    <CodeChip code={s.code} />
                    {s.fileName ? <I name="clip" size={12} style={{ color: "var(--calv-slate-65)" }} /> : null}
                    <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--calv-slate-65)" }}>{s.date}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--calv-slate-65)" }}>{s.note}</div>
                </div>
              ))}
          </Panel>
          <Panel
            title="Outcomes (FNPI)"
            sub={outcomes.length + (outcomes.length === 1 ? " indicator" : " indicators") + " recorded this FY — rolls into Module 4, Section B."}
            right={
              <button className="calv-btn calv-btn--primary calv-btn--sm" onClick={() => setShowOutcome(true)}>
                <I name="plus" size={13} /> Record outcome
              </button>}
          >
            {outcomes.length === 0 ? <div className="empty" style={{ padding: 20 }}>No outcomes recorded yet this FY.</div> :
              outcomes.map((o) => (
                <div key={o.id} style={{ padding: "10px 2px", borderBottom: "1px solid var(--calv-slate-15)" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{o.label}</span>
                    <CodeChip code={o.code} />
                    <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                      <Chip tone={o.status === "achieved" ? "sage" : "amber"}>{o.status === "achieved" ? "Achieved" : "In progress"}</Chip>
                      <span style={{ fontSize: 11.5, color: "var(--calv-slate-65)" }}>{o.date}</span>
                    </span>
                  </div>
                  {o.note ? <div style={{ fontSize: 12.5, color: "var(--calv-slate-65)" }}>{o.note}</div> : null}
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

      {showEnroll ? (
        <Modal title={`Enroll ${client.first} in another program`} width={560} onClose={() => setShowEnroll(false)}>
          <p style={{ fontSize: 12.5, color: "var(--calv-slate-65)", margin: "0 0 14px", lineHeight: 1.55 }}>
            This creates a pre-filled application in the program&rsquo;s eligibility queue, linked to {client.id}.
            The program&rsquo;s document checklist and income ceiling still apply — verified documents on file carry
            over where requirements overlap. Approval adds the program to this record; <strong style={{ fontWeight: 600 }}>no duplicate client is created</strong>.
          </p>
          {pendingEnrollments.length > 0 ? (
            <div style={{ background: "var(--calv-amber-15)", border: "1px solid var(--calv-amber-35)", borderRadius: 4, padding: "9px 12px", fontSize: 12.5, marginBottom: 14 }}>
              Already in the queue: {pendingEnrollments.map((p) => `${p.programShort} (${p.id} — ${STAGE_LABEL[p.stage] ?? p.stage})`).join(" · ")}
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {enrollTargets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setEnrollPick(p.id)}
                style={{
                  display: "flex", gap: 10, alignItems: "center", textAlign: "left", padding: "11px 13px",
                  borderRadius: 4, cursor: "pointer", background: "#fff", font: "inherit",
                  border: enrollPick === p.id ? "2px solid var(--brand)" : "1px solid var(--calv-slate-15)",
                }}
              >
                <ProgramDot color={p.color} label="" />
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</span>
                <span style={{ marginLeft: "auto", display: "flex", gap: 7, alignItems: "center" }}>
                  <Chip tone={p.eligible ? "sage" : "red"}>
                    {p.eligible ? `Eligible · ${p.pct}% of ${p.ceiling}% FPL` : `Over ${p.ceiling}% FPL ceiling`}
                  </Chip>
                  <span style={{ fontSize: 11.5, color: "var(--calv-slate-65)", whiteSpace: "nowrap" }}>
                    {p.docsCount === 0 ? "no documents" : `${p.docsCount} document${p.docsCount === 1 ? "" : "s"}`}
                  </span>
                </span>
              </button>
            ))}
          </div>
          {enrollPick && !enrollTargets.find((p) => p.id === enrollPick)?.eligible ? (
            <p style={{ fontSize: 12, color: "var(--calv-slate-65)", margin: "12px 0 0" }}>
              Income currently previews over this program&rsquo;s ceiling — the application can still enter the queue
              (circumstances and corrections happen there), but approval stays blocked while income exceeds the ceiling.
            </p>
          ) : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
            <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setShowEnroll(false)}>Cancel</button>
            <button
              className="calv-btn calv-btn--primary calv-btn--sm"
              disabled={!enrollPick || pending}
              style={!enrollPick || pending ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
              onClick={submitEnroll}
            >
              <I name="arrow" size={13} /> Create application
            </button>
          </div>
        </Modal>
      ) : null}

      {showLog ? (
        <Modal title={`Log a service for ${client.first} ${client.last}`} width={520} onClose={() => setShowLog(false)}>
          <div className="fgrid">
            <Field label="Service" required>
              <select value={svcCode} onChange={(e) => setSvcCode(e.target.value)} autoFocus>
                <option value="">Select…</option>
                {DOMAINS.map((d) => {
                  const group = servicesForProgram(serviceOptions, restrictions, svcProgram).filter((s) => s.domain === d.id);
                  return group.length ? (
                    <optgroup key={d.id} label={d.name}>
                      {group.map((s) => <option key={s.code} value={s.code}>{s.label + "  (" + s.code + ")"}</option>)}
                    </optgroup>
                  ) : null;
                })}
              </select>
            </Field>
            {outcomePrograms.length > 1 ? (
              <Field label="Program" required>
                <select value={svcProgram} onChange={(e) => {
                  const pid = e.target.value;
                  setSvcProgram(pid);
                  if (svcCode && !servicesForProgram(serviceOptions, restrictions, pid).some((s) => s.code === svcCode)) setSvcCode("");
                }}>
                  {outcomePrograms.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}
                </select>
              </Field>
            ) : null}
            <Field label="Note (optional)">
              <input value={svcNote} onChange={(e) => setSvcNote(e.target.value)} placeholder="What happened?" />
            </Field>
            <Field label="Attachment (optional)" hint="Receipt, award letter, signed form … PDF or scanned image, up to 4 MB.">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => svcFileRef.current?.click()}>
                  <I name="clip" size={13} /> {svcFile ? "Replace file" : "Attach file"}
                </button>
                {svcFile ? (
                  <span style={{ fontSize: 12.5, color: "var(--calv-slate-65)", display: "inline-flex", gap: 6, alignItems: "center", minWidth: 0 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{svcFile.name}</span>
                    <button className="tlink" style={{ fontSize: 12 }} onClick={() => { setSvcFile(null); if (svcFileRef.current) svcFileRef.current.value = ""; }}>remove</button>
                  </span>
                ) : null}
              </div>
              <input type="file" ref={svcFileRef} style={{ display: "none" }} accept={UPLOAD_ACCEPT} onChange={onSvcFile} />
            </Field>
          </div>
          {svcCode ? (
            <p style={{ fontSize: 12, color: "var(--calv-slate-65)", margin: "12px 0 0" }}>
              Will report as <span className="code-chip">{svcCode}</span> under{" "}
              <strong style={{ fontWeight: 600 }}>{DOMAINS.find((d) => d.id === serviceOptions.find((s) => s.code === svcCode)?.domain)?.name}</strong> in Module 4, Section A.
            </p>
          ) : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
            <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setShowLog(false)}>Cancel</button>
            <button
              className="calv-btn calv-btn--primary calv-btn--sm"
              disabled={!svcCode || pending}
              style={!svcCode || pending ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
              onClick={submitService}
            >
              <I name="plus" size={13} /> Log service
            </button>
          </div>
        </Modal>
      ) : null}

      {viewService ? (
        <Modal title={viewService.label} width={480} onClose={() => setViewService(null)}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <CodeChip code={viewService.code} />
            <Chip outline>{viewService.programShort}</Chip>
            <Chip outline>{viewService.date}</Chip>
            <Chip outline>Logged by {viewService.staffInitials}</Chip>
          </div>
          <div className="calv-label" style={{ marginBottom: 4 }}>Note</div>
          <p style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 16px" }}>{viewService.note || "—"}</p>
          <div className="calv-label" style={{ marginBottom: 4 }}>Attachment</div>
          {viewService.fileName ? (
            <a className="tlink" href={`/services/file/${viewService.id}`} target="_blank" rel="noreferrer"
              style={{ display: "inline-flex", gap: 7, alignItems: "center", fontSize: 13 }}>
              <I name="clip" size={14} /> {viewService.fileName}
            </a>
          ) : (
            <p style={{ fontSize: 12.5, color: "var(--calv-slate-65)", margin: 0 }}>No file attached to this entry.</p>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
            <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setViewService(null)}>Close</button>
          </div>
        </Modal>
      ) : null}

      {showOutcome ? (
        <Modal title="Record an FNPI outcome" width={520} onClose={() => setShowOutcome(false)}>
          <p style={{ fontSize: 12.5, color: "var(--calv-slate-65)", margin: "0 0 14px" }}>
            One record per indicator per FY — recording again updates the existing entry, so Section B counts stay unduplicated.
          </p>
          <div className="fgrid">
            <Field label="Indicator" required>
              <select value={fnpiCode} onChange={(e) => setFnpiCode(e.target.value)} autoFocus>
                <option value="">Select…</option>
                {fnpiDomains.map((d) => (
                  <optgroup key={d.id} label={d.name}>
                    {FNPIS.filter((f) => f.domain === d.id).map((f) => (
                      <option key={f.code} value={f.code}>{f.label + "  (" + f.code + ")"}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            {outcomePrograms.length > 1 ? (
              <Field label="Program" required>
                <select value={fnpiProgram} onChange={(e) => setFnpiProgram(e.target.value)}>
                  {outcomePrograms.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}
                </select>
              </Field>
            ) : null}
            <Field label="Status" required>
              <Seg options={OUTCOME_STATUS_OPTIONS} value={fnpiStatus} onChange={setFnpiStatus} />
            </Field>
            <Field label="Note (optional)">
              <input value={fnpiNote} onChange={(e) => setFnpiNote(e.target.value)} placeholder="What changed for this client?" />
            </Field>
          </div>
          {fnpiCode ? (
            <p style={{ fontSize: 12, color: "var(--calv-slate-65)", margin: "12px 0 0" }}>
              Will count under <span className="code-chip">{fnpiCode}</span> in Module 4, Section B — {fnpiStatus === "Achieved" ? "served and achieving the outcome" : "served, with the outcome in progress"}.
            </p>
          ) : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
            <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setShowOutcome(false)}>Cancel</button>
            <button
              className="calv-btn calv-btn--primary calv-btn--sm"
              disabled={!fnpiCode || pending}
              style={!fnpiCode || pending ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
              onClick={submitOutcome}
            >
              <I name="check" size={13} /> Record outcome
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
