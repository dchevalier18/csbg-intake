"use client";
/* Weatherization — Jobs / Contractors tabs with stage-advance and credential reminders. */
import { useState, useTransition } from "react";
import Link from "next/link";
import { Chip, Kpi, Panel } from "@/components/ui";
import { Seg } from "@/components/ui-client";
import { useToast } from "@/components/toast";
import { advanceJob, remindContractor } from "./actions";

interface Job {
  id: string; client: string; clientId: string | null; address: string;
  stage: string; contractor: string | null; funding: string; measures: string;
}
interface Contractor {
  id: string; name: string; phone: string; trade: string; crews: number;
  activeJobs: number; insurance: string; bpi: string; epaRrp: string; qcPass: number;
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

const fmtExp = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });

export function WxClient({ kpis, jobs, contractors, cutoff }: {
  kpis: Kpis; jobs: Job[]; contractors: Contractor[]; cutoff: string;
}) {
  const toast = useToast();
  const [tab, setTab] = useState("Jobs");
  const [pending, startTransition] = useTransition();
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

  const DateCell = ({ d }: { d: string }) => (
    <td style={{ whiteSpace: "nowrap" }}>
      {d <= cutoff ? <Chip tone="amber">{fmtExp(d)}</Chip> : fmtExp(d)}
    </td>
  );

  return (
    <div data-screen-label="Weatherization">
      <div style={{ marginBottom: 12 }}>
        <a className="tlink" style={{ fontSize: 12.5, textDecoration: "none", cursor: "pointer" }} onClick={() => history.back()}>← Back</a>
      </div>

      <div className="page-head">
        <div>
          <h1 className="page-h1">Weatherization<span className="red">.</span></h1>
          <p className="lede">Job pipeline from audit to QC, plus the contractor records that keep DOE monitors happy.</p>
        </div>
        <Seg options={["Jobs", "Contractors"]} value={tab} onChange={setTab} />
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
        </Panel>
      ) : (
        <Panel title="Contractor records" sub="Insurance, BPI certification, and EPA RRP (lead-safe) expirations tracked per contractor — expiring credentials block new job assignments.">
          <table className="data">
            <thead><tr><th>Contractor</th><th>Trade</th><th className="num">Crews</th><th className="num">Active jobs</th><th>Insurance exp.</th><th>BPI cert exp.</th><th>EPA RRP exp.</th><th className="num">QC pass rate</th><th></th></tr></thead>
            <tbody>
              {contractors.map((c) => (
                <tr key={c.id}>
                  <td className="cname">{c.name}<div style={{ fontFamily: "var(--font-body)", fontWeight: 300, fontSize: 11.5, color: "var(--calv-slate-65)", textTransform: "none" }}>{c.phone}</div></td>
                  <td>{c.trade}</td>
                  <td className="num">{c.crews}</td>
                  <td className="num">{c.activeJobs}</td>
                  <DateCell d={c.insurance} />
                  <DateCell d={c.bpi} />
                  <DateCell d={c.epaRrp} />
                  <td className="num" style={{ color: c.qcPass >= 95 ? "#2F5A41" : "inherit" }}>{c.qcPass}%</td>
                  <td><button className="calv-btn calv-btn--quiet calv-btn--sm" disabled={pending} onClick={() => onRemind(c.id)}>Remind</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
