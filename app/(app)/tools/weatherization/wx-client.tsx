"use client";
/* Weatherization — Jobs / Contractors / Vouchers tabs with stage-advance,
   credential reminders, and the contractor expense-voucher pipeline. */
import { useState, useTransition } from "react";
import Link from "next/link";
import { Chip, Empty, Field, Kpi, Panel } from "@/components/ui";
import { Modal, Seg } from "@/components/ui-client";
import { useToast } from "@/components/toast";
import { I } from "@/components/icons";
import { money, shortDate } from "@/lib/format";
import { advanceJob, advanceVoucher, createContractor, createJob, createVoucher, remindContractor } from "./actions";

interface Job {
  id: string; client: string; clientId: string | null; address: string;
  stage: string; contractorId: string | null; contractor: string | null;
  funding: string; measures: string;
}
interface Contractor {
  id: string; name: string; phone: string; trade: string; crews: number;
  activeJobs: number; insurance: string; bpi: string; epaRrp: string; qcPass: number;
  expired: boolean;
}
interface Voucher {
  id: string; contractor: string; contractorId: string; jobId: string | null;
  date: string; amount: number; memo: string; status: string; paidAt: string | null;
}
interface Kpis {
  activeJobs: number; unitsFY: number; avgDays: number;
  expiringCount: number; expiringFoot: string;
}

const WX_STAGES = [
  { id: "audit", label: "Energy audit" },
  { id: "install", label: "Installation" },
  { id: "qc", label: "QC inspection" },
  { id: "complete", label: "Complete" },
];

const VOUCHER_STATUS: Record<string, { tone: string; label: string }> = {
  submitted: { tone: "amber", label: "Submitted" },
  approved: { tone: "teal", label: "Approved" },
  paid: { tone: "sage", label: "Paid" },
};

const fmtExp = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });

const emptyJob = { clientId: "", clientName: "", address: "", funding: "", measures: "", contractorId: "" };
const emptyContractor = { name: "", trade: "", crews: "1", phone: "", insuranceExp: "", bpiExp: "", epaRrpExp: "" };

export function WxClient({ kpis, jobs, contractors, vouchers, clients, cutoff, today, admin }: {
  kpis: Kpis; jobs: Job[]; contractors: Contractor[]; vouchers: Voucher[];
  clients: { id: string; name: string }[]; cutoff: string; today: string; admin: boolean;
}) {
  const toast = useToast();
  const [tab, setTab] = useState("Jobs");
  const [pending, startTransition] = useTransition();
  const [jobModal, setJobModal] = useState(false);
  const [jobForm, setJobForm] = useState(emptyJob);
  const [conModal, setConModal] = useState(false);
  const [conForm, setConForm] = useState(emptyContractor);
  const [vchModal, setVchModal] = useState(false);
  const [vchForm, setVchForm] = useState({ contractorId: "", jobId: "", amount: "", date: today, memo: "" });
  const [busy, setBusy] = useState(false);
  const stageIdx = (s: string) => WX_STAGES.findIndex((x) => x.id === s);

  function onAdvance(id: string) {
    startTransition(async () => {
      const res = await advanceJob(id);
      toast(res.message);
    });
  }
  function onRemind(id: string) {
    startTransition(async () => {
      const res = await remindContractor(id);
      toast(res.message);
    });
  }
  function onAdvanceVoucher(id: string) {
    startTransition(async () => {
      const res = await advanceVoucher(id);
      toast(res.message);
    });
  }

  function openNewJob() {
    setJobForm(emptyJob);
    setJobModal(true);
  }
  const canCreateJob = Boolean(jobForm.clientId) || jobForm.clientName.trim().length > 0;
  async function submitJob() {
    if (!canCreateJob || busy) return;
    setBusy(true);
    const res = await createJob({
      clientId: jobForm.clientId || null,
      clientName: jobForm.clientName,
      address: jobForm.address,
      funding: jobForm.funding,
      measures: jobForm.measures,
      contractorId: jobForm.contractorId || null,
    });
    setBusy(false);
    toast(res.message);
    if (res.ok) setJobModal(false);
  }

  function openNewContractor() {
    setConForm(emptyContractor);
    setConModal(true);
  }
  const canCreateCon = conForm.name.trim().length > 0 && Boolean(conForm.insuranceExp) && Boolean(conForm.bpiExp) && Boolean(conForm.epaRrpExp);
  async function submitContractor() {
    if (!canCreateCon || busy) return;
    setBusy(true);
    const res = await createContractor({
      name: conForm.name, trade: conForm.trade, crews: Number(conForm.crews) || 1, phone: conForm.phone,
      insuranceExp: conForm.insuranceExp, bpiExp: conForm.bpiExp, epaRrpExp: conForm.epaRrpExp,
    });
    setBusy(false);
    toast(res.message);
    if (res.ok) setConModal(false);
  }

  function openNewVoucher(contractorId?: string) {
    setVchForm({ contractorId: contractorId ?? contractors[0]?.id ?? "", jobId: "", amount: "", date: today, memo: "" });
    setVchModal(true);
  }
  const contractorJobs = jobs.filter((j) => j.contractorId === vchForm.contractorId);
  const canCreateVch = Boolean(vchForm.contractorId) && Number(vchForm.amount) > 0 && Boolean(vchForm.date);
  async function submitVoucher() {
    if (!canCreateVch || busy) return;
    setBusy(true);
    const res = await createVoucher({
      contractorId: vchForm.contractorId,
      jobId: vchForm.jobId || null,
      amount: Number(vchForm.amount),
      date: vchForm.date,
      memo: vchForm.memo,
    });
    setBusy(false);
    toast(res.message);
    if (res.ok) setVchModal(false);
  }

  const outstanding = vouchers.filter((v) => v.status !== "paid").reduce((s, v) => s + v.amount, 0);

  return (
    <div data-screen-label="Weatherization">
      <div style={{ marginBottom: 12 }}>
        <a className="tlink" style={{ fontSize: 12.5, textDecoration: "none", cursor: "pointer" }} onClick={() => history.back()}>← Back</a>
      </div>

      <div className="page-head">
        <div>
          <h1 className="page-h1">Weatherization<span className="red">.</span></h1>
          <p className="lede">Job pipeline from audit to QC, contractor records that keep DOE monitors happy, and the expense vouchers that pay them.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Seg options={["Jobs", "Contractors", "Vouchers"]} value={tab} onChange={setTab} />
          {tab === "Jobs" ? (
            <button className="calv-btn calv-btn--primary calv-btn--sm" onClick={openNewJob}><I name="plus" size={14} /> New job</button>
          ) : tab === "Contractors" ? (
            <button className="calv-btn calv-btn--primary calv-btn--sm" onClick={openNewContractor}><I name="plus" size={14} /> Add contractor</button>
          ) : (
            <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={contractors.length === 0}
              style={contractors.length === 0 ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
              title={contractors.length === 0 ? "Add a contractor first" : undefined}
              onClick={() => openNewVoucher()}><I name="plus" size={14} /> New voucher</button>
          )}
        </div>
      </div>

      <div className="kpis">
        <Kpi kick="Active jobs" value={kpis.activeJobs} accent="var(--calv-sage)" />
        <Kpi kick="Units completed this FY" value={kpis.unitsFY} foot="FNPI 4f — households improved energy efficiency" accent="var(--calv-sage)" />
        <Kpi kick="Avg days audit → QC" value={kpis.avgDays}
          foot={kpis.avgDays <= 45 ? "DOE target 45 — ahead" : "DOE target 45 — behind"}
          tone={kpis.avgDays <= 45 ? "good" : "bad"} accent="var(--calv-teal)" />
        <Kpi kick="Credentials expiring ≤ 60 days" value={kpis.expiringCount}
          foot={kpis.expiringCount ? kpis.expiringFoot : "none within 60 days"}
          tone={kpis.expiringCount ? "bad" : "good"} accent="var(--calv-amber)" />
      </div>

      {tab === "Jobs" ? (
        <Panel title="Job pipeline" sub="Each completed job posts SRV 4g for the household and rolls into FNPI 4f outcomes.">
          {jobs.length === 0 ? <Empty>No jobs yet — open the first one above.</Empty> : (
          <table className="data">
            <thead><tr><th>Job</th><th>Household</th><th>Stage</th><th style={{ minWidth: 170 }}>Progress</th><th>Contractor</th><th>Funding</th><th>Measures</th><th></th></tr></thead>
            <tbody>
              {jobs.map((j) => {
                const idx = stageIdx(j.stage);
                return (
                  <tr key={j.id}>
                    <td className="cname">{j.id}</td>
                    <td>{j.clientId ? <Link className="tlink" style={{ textDecoration: "none", fontWeight: 600 }} href={"/clients/" + j.clientId}>{j.client}</Link> : j.client}
                      <div style={{ fontSize: 11.5, color: "var(--calv-slate-65)" }}>{j.address}</div></td>
                    <td><Chip tone={j.stage === "complete" ? "sage" : j.stage === "qc" ? "teal" : j.stage === "install" ? "amber" : ""}>{WX_STAGES[idx]?.label ?? j.stage}</Chip></td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        {WX_STAGES.map((s, i) => (
                          <span key={s.id} title={s.label} style={{ flex: 1, height: 6, borderRadius: 99, background: i <= idx ? "var(--calv-sage)" : "var(--calv-slate-15)" }}></span>
                        ))}
                      </div>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{j.contractor ?? "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{j.funding}</td>
                    <td style={{ color: "var(--calv-slate-65)", maxWidth: 250 }}>{j.measures}</td>
                    <td style={{ textAlign: "right" }}>
                      {j.stage !== "complete" ? (
                        <button className="calv-btn calv-btn--quiet calv-btn--sm" disabled={pending} onClick={() => onAdvance(j.id)}>Advance</button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </Panel>
      ) : tab === "Contractors" ? (
        <Panel title="Contractor records" sub="Insurance, BPI certification, and EPA RRP (lead-safe) expirations tracked per contractor — expired credentials block new job assignments.">
          {contractors.length === 0 ? <Empty>No contractors yet — add the first one above.</Empty> : (
          <table className="data">
            <thead><tr><th>Contractor</th><th>Trade</th><th className="num">Crews</th><th className="num">Active jobs</th><th>Insurance exp.</th><th>BPI cert exp.</th><th>EPA RRP exp.</th><th className="num">QC pass rate</th><th></th></tr></thead>
            <tbody>
              {contractors.map((c) => {
                const DateCell = ({ d }: { d: string }) => (
                  <td style={{ whiteSpace: "nowrap" }}>
                    {d <= today ? <Chip tone="red">{fmtExp(d)}</Chip> : d <= cutoff ? <Chip tone="amber">{fmtExp(d)}</Chip> : fmtExp(d)}
                  </td>
                );
                return (
                  <tr key={c.id}>
                    <td className="cname">{c.name}<div style={{ fontFamily: "var(--font-body)", fontWeight: 300, fontSize: 11.5, color: "var(--calv-slate-65)", textTransform: "none" }}>{c.phone}</div></td>
                    <td>{c.trade}</td>
                    <td className="num">{c.crews}</td>
                    <td className="num">{c.activeJobs}</td>
                    <DateCell d={c.insurance} />
                    <DateCell d={c.bpi} />
                    <DateCell d={c.epaRrp} />
                    <td className="num" style={{ color: c.qcPass >= 95 ? "#2F5A41" : "inherit" }}>{c.qcPass}%</td>
                    <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                      <button className="calv-btn calv-btn--quiet calv-btn--sm" disabled={pending} onClick={() => onRemind(c.id)}>Remind</button>
                      <button className="calv-btn calv-btn--quiet calv-btn--sm" style={{ marginLeft: 6 }} onClick={() => { openNewVoucher(c.id); }}>Voucher</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </Panel>
      ) : (
        <Panel title="Expense vouchers" right={<span style={{ fontSize: 12.5, color: "var(--calv-slate-65)" }}>{money(outstanding)} outstanding</span>}
          sub="Contractor charges against the program — submitted by staff, approved by a manager, then marked paid. Every step is audited.">
          {vouchers.length === 0 ? <Empty>No vouchers yet — create one from a contractor&apos;s invoice.</Empty> : (
          <table className="data">
            <thead><tr><th>Voucher</th><th>Contractor</th><th>Job</th><th>Invoice date</th><th className="num">Amount</th><th>Memo</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {vouchers.map((v) => {
                const st = VOUCHER_STATUS[v.status] ?? VOUCHER_STATUS.submitted;
                return (
                  <tr key={v.id}>
                    <td className="cname">{v.id}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{v.contractor}</td>
                    <td>{v.jobId ?? "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{shortDate(v.date)}</td>
                    <td className="num">{money(v.amount)}</td>
                    <td style={{ color: "var(--calv-slate-65)", maxWidth: 260 }}>{v.memo || "—"}</td>
                    <td><Chip tone={st.tone}>{st.label}</Chip>{v.status === "paid" && v.paidAt ? <div style={{ fontSize: 11, color: "var(--calv-slate-65)", marginTop: 2 }}>{shortDate(v.paidAt)}</div> : null}</td>
                    <td style={{ textAlign: "right" }}>
                      {admin && v.status === "submitted" ? (
                        <button className="calv-btn calv-btn--quiet calv-btn--sm" disabled={pending} onClick={() => onAdvanceVoucher(v.id)}>Approve</button>
                      ) : admin && v.status === "approved" ? (
                        <button className="calv-btn calv-btn--quiet calv-btn--sm" disabled={pending} onClick={() => onAdvanceVoucher(v.id)}>Mark paid</button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
          {!admin ? (
            <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--calv-slate-65)" }}>
              Approving and paying vouchers needs a Program Manager or Data Admin.
            </div>
          ) : null}
        </Panel>
      )}

      {jobModal ? (
        <Modal title="New weatherization job" width={560} onClose={() => setJobModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
            <div className="fgrid c2">
              <Field label="Household record" hint="Linking counts the completed unit under FNPI 4f automatically.">
                <select value={jobForm.clientId} onChange={(e) => setJobForm((f) => ({ ...f, clientId: e.target.value }))}>
                  <option value="">Not linked — name below</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.id}</option>)}
                </select>
              </Field>
              <Field label="Household name" required={!jobForm.clientId} hint={jobForm.clientId ? "Taken from the linked record." : ""}>
                <input value={jobForm.clientName} onChange={(e) => setJobForm((f) => ({ ...f, clientName: e.target.value }))} placeholder="e.g. Ana Reyes" disabled={Boolean(jobForm.clientId)} />
              </Field>
            </div>
            <Field label="Address">
              <input value={jobForm.address} onChange={(e) => setJobForm((f) => ({ ...f, address: e.target.value }))} placeholder="e.g. 731 N 7th St, Allentown" />
            </Field>
            <div className="fgrid c2">
              <Field label="Contractor" hint="Contractors with expired credentials can't take new jobs.">
                <select value={jobForm.contractorId} onChange={(e) => setJobForm((f) => ({ ...f, contractorId: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id} disabled={c.expired}>{c.name}{c.expired ? " — credentials expired" : ""}</option>
                  ))}
                </select>
              </Field>
              <Field label="Funding">
                <input value={jobForm.funding} onChange={(e) => setJobForm((f) => ({ ...f, funding: e.target.value }))} placeholder="e.g. DOE WAP" />
              </Field>
            </div>
            <Field label="Planned measures">
              <input value={jobForm.measures} onChange={(e) => setJobForm((f) => ({ ...f, measures: e.target.value }))} placeholder="e.g. Attic insulation, air sealing, CO detectors" />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setJobModal(false)}>Cancel</button>
            <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={!canCreateJob || busy} style={!canCreateJob || busy ? { opacity: 0.45, cursor: "not-allowed" } : undefined} onClick={submitJob}>
              <I name="check" size={14} /> Open job
            </button>
          </div>
        </Modal>
      ) : null}

      {conModal ? (
        <Modal title="Add contractor" width={560} onClose={() => setConModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
            <div className="fgrid c2">
              <Field label="Name" required>
                <input value={conForm.name} onChange={(e) => setConForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Keystone Insulation Co." autoFocus />
              </Field>
              <Field label="Trade">
                <input value={conForm.trade} onChange={(e) => setConForm((f) => ({ ...f, trade: e.target.value }))} placeholder="e.g. Insulation / air sealing" />
              </Field>
            </div>
            <div className="fgrid c2">
              <Field label="Phone">
                <input value={conForm.phone} onChange={(e) => setConForm((f) => ({ ...f, phone: e.target.value }))} placeholder="e.g. (610) 555-0201" />
              </Field>
              <Field label="Crews">
                <input type="number" min={1} step={1} value={conForm.crews} onChange={(e) => setConForm((f) => ({ ...f, crews: e.target.value }))} />
              </Field>
            </div>
            <div className="fgrid c3">
              <Field label="Insurance exp." required>
                <input type="date" value={conForm.insuranceExp} onChange={(e) => setConForm((f) => ({ ...f, insuranceExp: e.target.value }))} />
              </Field>
              <Field label="BPI cert exp." required>
                <input type="date" value={conForm.bpiExp} onChange={(e) => setConForm((f) => ({ ...f, bpiExp: e.target.value }))} />
              </Field>
              <Field label="EPA RRP exp." required>
                <input type="date" value={conForm.epaRrpExp} onChange={(e) => setConForm((f) => ({ ...f, epaRrpExp: e.target.value }))} />
              </Field>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setConModal(false)}>Cancel</button>
            <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={!canCreateCon || busy} style={!canCreateCon || busy ? { opacity: 0.45, cursor: "not-allowed" } : undefined} onClick={submitContractor}>
              <I name="check" size={14} /> Add contractor
            </button>
          </div>
        </Modal>
      ) : null}

      {vchModal ? (
        <Modal title="New expense voucher" width={520} onClose={() => setVchModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
            <div className="fgrid c2">
              <Field label="Contractor" required>
                <select value={vchForm.contractorId} onChange={(e) => setVchForm((f) => ({ ...f, contractorId: e.target.value, jobId: "" }))}>
                  {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Job" hint="Optional — ties the charge to a unit in the pipeline.">
                <select value={vchForm.jobId} onChange={(e) => setVchForm((f) => ({ ...f, jobId: e.target.value }))}>
                  <option value="">Not tied to a job</option>
                  {contractorJobs.map((j) => <option key={j.id} value={j.id}>{j.id} — {j.client}</option>)}
                </select>
              </Field>
            </div>
            <div className="fgrid c2">
              <Field label="Amount ($)" required>
                <input type="number" min={0} value={vchForm.amount} onChange={(e) => setVchForm((f) => ({ ...f, amount: e.target.value }))} placeholder="e.g. 4425" autoFocus />
              </Field>
              <Field label="Invoice date" required>
                <input type="date" value={vchForm.date} onChange={(e) => setVchForm((f) => ({ ...f, date: e.target.value }))} max={today} />
              </Field>
            </div>
            <Field label="Memo">
              <input value={vchForm.memo} onChange={(e) => setVchForm((f) => ({ ...f, memo: e.target.value }))} placeholder="e.g. Furnace replacement — progress billing 2 of 3" />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setVchModal(false)}>Cancel</button>
            <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={!canCreateVch || busy} style={!canCreateVch || busy ? { opacity: 0.45, cursor: "not-allowed" } : undefined} onClick={submitVoucher}>
              <I name="check" size={14} /> Submit voucher
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
