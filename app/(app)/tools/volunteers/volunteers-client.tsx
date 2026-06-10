"use client";

import { useState } from "react";
import Link from "next/link";
import { Chip, Field, Kpi, Panel, ProgramDot } from "@/components/ui";
import { Modal } from "@/components/ui-client";
import { useToast } from "@/components/toast";
import { I } from "@/components/icons";
import { fmt, shortDate } from "@/lib/format";
import { logShift } from "./actions";

export interface VolRow {
  id: string;
  name: string;
  clientId: string | null;
  clientHref: string | null;
  role: string;
  programs: { color: string; short: string }[];
  hoursFY: number;
  lowIncome: boolean;
  lastShift: string | null;
}

export interface VolStats {
  totalHoursFY: number;
  lowIncomeHoursFY: number;
  activeVolunteers: number;
}

const IS_RATE = 33.49; // Independent Sector value of a volunteer hour

export default function VolunteersClient({ stats, rows, fyShort, today }: {
  stats: VolStats; rows: VolRow[]; fyShort: string; today: string;
}) {
  const toast = useToast();
  const [logging, setLogging] = useState(false);
  const [volId, setVolId] = useState(rows[0]?.id ?? "");
  const [hours, setHours] = useState("");
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);

  const pctLow = stats.totalHoursFY > 0 ? Math.round(stats.lowIncomeHoursFY / stats.totalHoursFY * 100) : 0;
  const value = "$" + Math.round(stats.totalHoursFY * IS_RATE / 1000) + "K";

  function openLog() {
    setVolId(rows[0]?.id ?? "");
    setHours("");
    setDate(today);
    setLogging(true);
  }

  const canLog = Boolean(volId) && Number(hours) > 0 && Boolean(date);

  async function submitShift() {
    if (!canLog || busy) return;
    setBusy(true);
    const res = await logShift(volId, Number(hours), date);
    setBusy(false);
    toast(res.message);
    if (res.ok) setLogging(false);
  }

  return (
    <div data-screen-label="Volunteer tracking">
      <div style={{ marginBottom: 12 }}>
        <a className="tlink" style={{ fontSize: 12.5, textDecoration: "none", cursor: "pointer" }} onClick={() => history.back()}>← Back</a>
      </div>
      <div className="page-head">
        <div>
          <h1 className="page-h1">Volunteers<span className="red">.</span></h1>
          <p className="lede">Hours roll straight into Module 2, Section B.1 — including the federally-required split for hours donated by people with low incomes.</p>
        </div>
        <button className="calv-btn calv-btn--primary calv-btn--sm" onClick={openLog}><I name="plus" size={14} /> Log shift</button>
      </div>

      <div className="kpis">
        <Kpi kick="Active volunteers" value={fmt(stats.activeVolunteers)} accent="var(--calv-teal)" />
        <Kpi kick="Hours donated this FY" value={fmt(stats.totalHoursFY)} foot="Module 2 · B.1a" accent="var(--calv-teal)" />
        <Kpi kick="Hours by people with low incomes" value={fmt(stats.lowIncomeHoursFY)} foot={"B.1a.1 · " + pctLow + "% of all hours"} accent="var(--calv-sage)" />
        <Kpi kick="Value of volunteer time" value={value} foot="@ $33.49/hr Independent Sector rate" accent="var(--calv-amber)" />
      </div>

      <Panel title="Volunteer roster" sub="Volunteers who are also enrolled clients link to their household record — their hours count toward B.1a.1 automatically.">
        <table className="data">
          <thead><tr><th>Volunteer</th><th>Role</th><th>Programs</th><th className="num">Hours {fyShort}</th><th>Low-income hours?</th><th>Last shift</th></tr></thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id}>
                <td className="cname">{v.name}
                  {v.clientId ? (
                    <div style={{ fontFamily: "var(--font-body)", fontWeight: 300, fontSize: 11, textTransform: "none" }}>
                      {v.clientHref
                        ? <Link className="tlink" href={v.clientHref}>client record {v.clientId}</Link>
                        : <>client record {v.clientId}</>}
                    </div>
                  ) : null}
                </td>
                <td>{v.role}</td>
                <td><div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{v.programs.map((p) => <ProgramDot key={p.short} color={p.color} label={p.short} />)}</div></td>
                <td className="num">{v.hoursFY}</td>
                <td>{v.lowIncome ? <Chip tone="sage">Yes — counts in B.1a.1</Chip> : <Chip>No</Chip>}</td>
                <td>{v.lastShift ? shortDate(v.lastShift) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {logging ? (
        <Modal title="Log shift" width={440} onClose={() => setLogging(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
            <Field label="Volunteer" required>
              <select value={volId} onChange={(e) => setVolId(e.target.value)}>
                {rows.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </Field>
            <div className="fgrid c2">
              <Field label="Hours" required>
                <input type="number" min={0} step={1} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. 4" autoFocus />
              </Field>
              <Field label="Date" required>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={today} />
              </Field>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setLogging(false)}>Cancel</button>
            <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={!canLog || busy} style={!canLog || busy ? { opacity: 0.45, cursor: "not-allowed" } : undefined} onClick={submitShift}>
              <I name="check" size={14} /> Log shift
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
