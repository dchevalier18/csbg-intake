"use client";
/* Clients directory — client-side filtering over server-scoped rows. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Chip, Meter, Panel, ProgramDot } from "@/components/ui";

export interface ClientRow {
  id: string;
  name: string;
  sub: string;
  hhType: string;
  hhSub: string;
  fplTone: string;
  fplLabel: string;
  programIds: string[];
  programs: { color: string; short: string }[];
  completeness: number;
  caseworkerId: string;
  caseworker: string;
  nextFollowUp: string;
}

export function ClientsDirectory({ rows, programs, caseworkers, canExport }: {
  rows: ClientRow[];
  programs: { id: string; name: string }[];
  caseworkers: { id: string; name: string }[];
  canExport?: boolean;
}) {
  const router = useRouter();
  const [prog, setProg] = useState("all");
  const [cw, setCw] = useState("all");
  const shown = rows.filter((c) =>
    (prog === "all" || c.programIds.includes(prog)) && (cw === "all" || c.caseworkerId === cw));

  return (
    <>
      <div className="toolbar">
        <div className="field" style={{ width: 250 }}>
          <select value={prog} onChange={(e) => setProg(e.target.value)}>
            <option value="all">All my programs</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ width: 200 }}>
          <select value={cw} onChange={(e) => setCw(e.target.value)}>
            <option value="all">All case workers</option>
            {caseworkers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--calv-slate-65)" }}>{shown.length} shown</span>
        {canExport ? (
          <a className="calv-btn calv-btn--quiet calv-btn--sm" href="/clients/export-hmis" download
            title="HUD-shaped client CSV for HMIS/CoC coordination">
            HMIS-aligned CSV
          </a>
        ) : null}
      </div>

      <Panel>
        <table className="data">
          <thead><tr><th>Client</th><th>Household</th><th>Income vs FPL</th><th>Programs</th><th>CSBG completeness</th><th>Case worker</th><th>Next follow-up</th></tr></thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id} className="rowlink" onClick={() => router.push(`/clients/${c.id}`)}>
                <td className="cname">{c.name}
                  <div style={{ fontFamily: "var(--font-body)", fontWeight: 300, fontSize: 11.5, color: "var(--calv-slate-65)", textTransform: "none" }}>{c.sub}</div></td>
                <td>{c.hhType}<div style={{ fontSize: 11.5, color: "var(--calv-slate-65)" }}>{c.hhSub}</div></td>
                <td><Chip tone={c.fplTone}>{c.fplLabel}</Chip></td>
                <td><div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{c.programs.map((p) => <ProgramDot key={p.short} color={p.color} label={p.short} />)}</div></td>
                <td style={{ minWidth: 130 }}><Meter pct={c.completeness} /></td>
                <td>{c.caseworker}</td>
                <td>{c.nextFollowUp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
