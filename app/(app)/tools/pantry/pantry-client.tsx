"use client";

import { useState } from "react";
import Link from "next/link";
import { Chip, Field, Kpi, Panel } from "@/components/ui";
import { Modal } from "@/components/ui-client";
import { useToast } from "@/components/toast";
import { I } from "@/components/icons";
import { fmt } from "@/lib/format";
import { createAgency, enterReport, remindMissing, updateAgency } from "./actions";

export interface PantryRow {
  id: string;
  name: string;
  town: string;
  county: string;
  contact: string;
  phone: string;
  compliance: string;          // 'current' | 'site-visit-due'
  report: "received" | "missing";
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

const compactM = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : fmt(n);

const emptyAgency = { name: "", town: "", county: "", contact: "", phone: "", compliance: "current" };

export default function PantryClient({ stats, rows, monthLabel, dueLabel }: {
  stats: ShfbStats; rows: PantryRow[]; monthLabel: string; dueLabel: string;
}) {
  const toast = useToast();
  const [entering, setEntering] = useState<PantryRow | null>(null);
  const [households, setHouseholds] = useState("");
  const [lbs, setLbs] = useState("");
  const [agencyModal, setAgencyModal] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyAgency);
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

  function openAdd() {
    setForm(emptyAgency);
    setEditingId(null);
    setAgencyModal("add");
  }

  function openEdit(a: PantryRow) {
    setForm({ name: a.name, town: a.town, county: a.county, contact: a.contact, phone: a.phone, compliance: a.compliance });
    setEditingId(a.id);
    setAgencyModal("edit");
  }

  const canSaveAgency = form.name.trim().length > 0;

  async function submitAgency() {
    if (!canSaveAgency || busy) return;
    setBusy(true);
    const res = agencyModal === "edit" && editingId
      ? await updateAgency(editingId, form)
      : await createAgency(form);
    setBusy(false);
    toast(res.message);
    if (res.ok) setAgencyModal(null);
  }

  const set = (k: keyof typeof emptyAgency) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div data-screen-label="Pantry network">
      <div style={{ marginBottom: 12 }}>
        <a className="tlink" style={{ fontSize: 12.5, textDecoration: "none", cursor: "pointer" }} onClick={() => history.back()}>← Back</a>
      </div>
      <div className="page-head">
        <div>
          <h1 className="page-h1">Pantry <span className="red">network.</span></h1>
          <p className="lede">Member agencies and their monthly aggregate reports — the numbers roll into the CSBG food-distribution totals.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="calv-btn calv-btn--secondary calv-btn--sm" onClick={remindAll}><I name="bell" size={14} /> Remind missing</button>
          <button className="calv-btn calv-btn--primary calv-btn--sm" onClick={openAdd}><I name="plus" size={14} /> Add agency</button>
        </div>
      </div>

      <div className="kpis">
        <Kpi kick="Member agencies" value={stats.agencies} foot={stats.countiesServed + " counties"} accent="#8A6410" />
        <Kpi kick={monthLabel + " reports received"} value={received + " / " + (received + missing)} foot={missing + " outstanding — due " + dueLabel} tone={missing > 0 ? "bad" : "good"} accent="var(--calv-amber)" />
        <Kpi kick="Pounds distributed YTD" value={compactM(stats.lbsYTD)} accent="var(--calv-teal)" />
        <Kpi kick="Meals YTD" value={compactM(stats.mealsYTD)} foot="feeds FNPI 5j food security" accent="var(--calv-sage)" />
      </div>

      <Panel title={"Member agencies · " + monthLabel + " reporting"} sub="Aggregate household counts and pounds reported by each pantry. Missing reports leave holes in the federal rollup.">
        <table className="data">
          <thead><tr><th>Agency</th><th>Location</th><th>Contact</th><th>{monthLabel} report</th><th className="num">Households</th><th className="num">Pounds</th><th>Compliance</th><th></th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="cname">{a.name}<div style={{ fontFamily: "var(--font-body)", fontWeight: 300, fontSize: 11.5, color: "var(--calv-slate-65)", textTransform: "none" }}>{a.id}</div></td>
                <td>{a.town}<div style={{ fontSize: 11.5, color: "var(--calv-slate-65)" }}>{a.county ? a.county + " Co." : ""}</div></td>
                <td style={{ whiteSpace: "nowrap" }}>{a.contact}<div style={{ fontSize: 11.5, color: "var(--calv-slate-65)" }}>{a.phone}</div></td>
                <td>{a.report === "received" ? <Chip tone="sage">Received</Chip> : <Chip tone="red">Missing</Chip>}</td>
                <td className="num">{a.households != null ? fmt(a.households) : "—"}</td>
                <td className="num">{a.lbs != null ? fmt(a.lbs) : "—"}</td>
                <td>{a.compliance === "current" ? <Chip>Current</Chip> : <Chip tone="amber">Site visit due</Chip>}</td>
                <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                  {a.report === "missing" ? <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => openEnter(a)}>Enter report</button> : null}
                  <button className="calv-btn calv-btn--quiet calv-btn--sm" style={{ marginLeft: 6 }} onClick={() => openEdit(a)}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <div style={{ padding: "18px 4px", fontSize: 13, color: "var(--calv-slate-65)" }}>
            No member agencies yet — add the first one above, or import your roster below.
          </div>
        ) : null}
        <div style={{ marginTop: 14, fontSize: 12.5, color: "var(--calv-slate-65)" }}>
          Bringing a roster or monthly totals over from another system? <Link className="tlink" href="/data">Data &amp; integrations → Import spreadsheet</Link> takes
          a member-agency list (Primarius 2.0&apos;s agency export, or any CSV/XLSX) and monthly aggregate reports.
        </div>
      </Panel>

      {entering ? (
        <Modal title={"Enter " + monthLabel + " report — " + entering.name} width={440} onClose={() => setEntering(null)}>
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

      {agencyModal ? (
        <Modal title={agencyModal === "edit" ? "Edit agency — " + editingId : "Add member agency"} width={520} onClose={() => setAgencyModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
            <Field label="Agency name" required>
              <input value={form.name} onChange={set("name")} placeholder="e.g. St. Paul's Food Pantry" autoFocus />
            </Field>
            <div className="fgrid c2">
              <Field label="Town">
                <input value={form.town} onChange={set("town")} placeholder="e.g. Allentown" />
              </Field>
              <Field label="County">
                <input value={form.county} onChange={set("county")} placeholder="e.g. Lehigh" />
              </Field>
            </div>
            <div className="fgrid c2">
              <Field label="Contact">
                <input value={form.contact} onChange={set("contact")} placeholder="e.g. M. Rivera" />
              </Field>
              <Field label="Phone">
                <input value={form.phone} onChange={set("phone")} placeholder="e.g. (610) 555-0100" />
              </Field>
            </div>
            {agencyModal === "edit" ? (
              <Field label="Compliance" hint="Site-visit-due flags the agency for monitoring follow-up.">
                <select value={form.compliance} onChange={set("compliance")}>
                  <option value="current">Current</option>
                  <option value="site-visit-due">Site visit due</option>
                </select>
              </Field>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setAgencyModal(null)}>Cancel</button>
            <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={!canSaveAgency || busy} style={!canSaveAgency || busy ? { opacity: 0.45, cursor: "not-allowed" } : undefined} onClick={submitAgency}>
              <I name="check" size={14} /> {agencyModal === "edit" ? "Save changes" : "Add agency"}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
