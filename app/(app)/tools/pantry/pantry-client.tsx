"use client";

import { useState } from "react";
import { Chip, Field, Kpi, Panel } from "@/components/ui";
import { Modal } from "@/components/ui-client";
import { useToast } from "@/components/toast";
import { I } from "@/components/icons";
import { fmt } from "@/lib/format";
import { enterReport, remindMissing } from "./actions";

export interface PantryRow {
  id: string;
  name: string;
  town: string;
  county: string;
  contact: string;
  phone: string;
  compliance: string;          // 'current' | 'site-visit-due'
  mayReport: "received" | "missing";
  households: number | null;
  lbs: number | null;
}

export interface ShfbStats {
  agencies: number;
  countiesServed: number;
  lbsYTD: number;
  mealsYTD: number;
  reportsThisMonth: { received: number; missing: number };
}

const compactM = (n: number) => (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";

export default function PantryClient({ stats, rows }: { stats: ShfbStats; rows: PantryRow[] }) {
  const toast = useToast();
  const [entering, setEntering] = useState<PantryRow | null>(null);
  const [households, setHouseholds] = useState("");
  const [lbs, setLbs] = useState("");
  const [busy, setBusy] = useState(false);

  const received = stats.reportsThisMonth.received;
  const missing = stats.reportsThisMonth.missing;

  async function remindAll() {
    const res = await remindMissing();
    toast(res.message);
  }

  function openEnter(a: PantryRow) {
    setHouseholds("");
    setLbs("");
    setEntering(a);
  }

  const canSave = Number(households) > 0 && Number(lbs) > 0;

  async function submitReport() {
    if (!entering || !canSave || busy) return;
    setBusy(true);
    const res = await enterReport(entering.id, Number(households), Number(lbs));
    setBusy(false);
    toast(res.message);
    if (res.ok) setEntering(null);
  }

  return (
    <div data-screen-label="Second Harvest pantry network">
      <div style={{ marginBottom: 12 }}>
        <a className="tlink" style={{ fontSize: 12.5, textDecoration: "none", cursor: "pointer" }} onClick={() => history.back()}>← Back</a>
      </div>
      <div className="page-head">
        <div>
          <h1 className="page-h1">Pantry <span className="red">network.</span></h1>
          <p className="lede">Second Harvest member agencies across 6 counties — monthly aggregate reports roll into the CSBG food-distribution totals.</p>
        </div>
        <button className="calv-btn calv-btn--secondary calv-btn--sm" onClick={remindAll}><I name="bell" size={14} /> Remind missing</button>
      </div>

      <div className="kpis">
        <Kpi kick="Member agencies" value={stats.agencies} foot={stats.countiesServed + " counties"} accent="#8A6410" />
        <Kpi kick="May reports received" value={received + " / " + (received + missing)} foot={missing + " outstanding — due Jun 15"} tone={missing > 0 ? "bad" : "good"} accent="var(--calv-amber)" />
        <Kpi kick="Pounds distributed YTD" value={compactM(stats.lbsYTD)} accent="var(--calv-teal)" />
        <Kpi kick="Meals YTD" value={compactM(stats.mealsYTD)} foot="feeds FNPI 5j food security" accent="var(--calv-sage)" />
      </div>

      <Panel title="Member agencies · May reporting" sub="Sample of the network — aggregate household counts and pounds reported by each pantry. Missing reports leave holes in the federal rollup.">
        <table className="data">
          <thead><tr><th>Agency</th><th>Location</th><th>Contact</th><th>May report</th><th className="num">Households</th><th className="num">Pounds</th><th>Compliance</th><th></th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="cname">{a.name}<div style={{ fontFamily: "var(--font-body)", fontWeight: 300, fontSize: 11.5, color: "var(--calv-slate-65)", textTransform: "none" }}>{a.id}</div></td>
                <td>{a.town}<div style={{ fontSize: 11.5, color: "var(--calv-slate-65)" }}>{a.county} Co.</div></td>
                <td style={{ whiteSpace: "nowrap" }}>{a.contact}<div style={{ fontSize: 11.5, color: "var(--calv-slate-65)" }}>{a.phone}</div></td>
                <td>{a.mayReport === "received" ? <Chip tone="sage">Received</Chip> : <Chip tone="red">Missing</Chip>}</td>
                <td className="num">{a.households != null ? fmt(a.households) : "—"}</td>
                <td className="num">{a.lbs != null ? fmt(a.lbs) : "—"}</td>
                <td>{a.compliance === "current" ? <Chip>Current</Chip> : <Chip tone="amber">Site visit due</Chip>}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {a.mayReport === "missing" ? <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => openEnter(a)}>Enter report</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {entering ? (
        <Modal title={"Enter May report — " + entering.name} width={440} onClose={() => setEntering(null)}>
          <div className="fgrid c2" style={{ marginBottom: 18 }}>
            <Field label="Households served" required>
              <input type="number" min={0} value={households} onChange={(e) => setHouseholds(e.target.value)} placeholder="e.g. 240" autoFocus />
            </Field>
            <Field label="Pounds distributed" required>
              <input type="number" min={0} value={lbs} onChange={(e) => setLbs(e.target.value)} placeholder="e.g. 9800" />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setEntering(null)}>Cancel</button>
            <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={!canSave || busy} style={!canSave || busy ? { opacity: 0.45, cursor: "not-allowed" } : undefined} onClick={submitReport}>
              <I name="check" size={14} /> Save report
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
