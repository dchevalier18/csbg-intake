"use client";
/* Service log — quick entry + recent entries (interactive client surface).
   All data arrives as plain serializable props; mutations go through actions.ts. */
import { useState, useTransition } from "react";
import { CodeChip, Field, Panel, ProgramDot } from "@/components/ui";
import { I } from "@/components/icons";
import { useToast } from "@/components/toast";
import { shortDate } from "@/lib/format";
import { addServiceEntry } from "./actions";

export interface ClientOption {
  id: string;
  first: string;
  last: string;
  programIds: string[];
}

export interface ServiceOption {
  code: string;
  domain: string;
  label: string;
}

export interface DomainOption {
  id: string;
  name: string;
}

export interface ProgramOption {
  id: string;
  short: string;
  color: string;
}

export interface EntryRow {
  id: number;
  date: string;
  clientName: string;
  code: string;
  label: string;
  domain: string;
  programShort: string;
  programColor: string;
  staffInitials: string;
  note: string;
}

export function ServicesClient({ clients, services, domains, programs, visibleProgramIds, initialClient, entries }: {
  clients: ClientOption[];
  services: ServiceOption[];
  domains: DomainOption[];
  programs: ProgramOption[];
  visibleProgramIds: string[];
  initialClient: string;
  entries: EntryRow[];
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const visibleSet = new Set(visibleProgramIds);
  const choicesFor = (clientId: string): string[] => {
    const c = clients.find((x) => x.id === clientId);
    return c ? c.programIds.filter((p) => visibleSet.has(p)) : [];
  };

  const [client, setClient] = useState(initialClient);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [program, setProgram] = useState(() => {
    const opts = choicesFor(initialClient);
    return opts[0] ?? "";
  });
  const [domFilter, setDomFilter] = useState("all");

  const programChoices = choicesFor(client);
  const needsProgram = programChoices.length > 1;
  const effectiveProgram = programChoices.length === 1 ? programChoices[0] : program;

  function pickClient(id: string) {
    setClient(id);
    setProgram(choicesFor(id)[0] ?? "");
  }

  function submit() {
    startTransition(async () => {
      const res = await addServiceEntry({ clientId: client, code, programId: effectiveProgram, note });
      toast(res.message);
      if (res.ok) {
        setClient(""); setCode(""); setNote(""); setProgram("");
      }
    });
  }

  const chosen = code ? services.find((s) => s.code === code) : undefined;
  const chosenDomain = chosen ? domains.find((d) => d.id === chosen.domain) : undefined;
  const shown = entries.filter((s) => domFilter === "all" || s.domain === domFilter);

  return (
    <>
      <Panel title="Quick entry" sub="Three fields. Under fifteen seconds." style={{ marginBottom: 13 }}>
        <div style={{ display: "grid", gridTemplateColumns: needsProgram ? "1fr 1.4fr .9fr 1.6fr auto" : "1fr 1.4fr 1.6fr auto", gap: 12, alignItems: "end" }}>
          <Field label="Client" required>
            <select value={client} onChange={(e) => pickClient(e.target.value)}>
              <option value="">Select…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.first} {c.last} · {c.id}</option>)}
            </select>
          </Field>
          <Field label="Service" required>
            <select value={code} onChange={(e) => setCode(e.target.value)}>
              <option value="">Select…</option>
              {domains.map((d) => (
                <optgroup key={d.id} label={d.name}>
                  {services.filter((s) => s.domain === d.id).map((s) => <option key={s.code} value={s.code}>{s.label + "  (" + s.code + ")"}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          {needsProgram ? (
            <Field label="Program" required>
              <select value={program} onChange={(e) => setProgram(e.target.value)}>
                {programChoices.map((pid) => {
                  const p = programs.find((x) => x.id === pid);
                  return <option key={pid} value={pid}>{p ? p.short : pid}</option>;
                })}
              </select>
            </Field>
          ) : null}
          <Field label="Note (optional)">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened?" />
          </Field>
          <button className="calv-btn calv-btn--primary" disabled={!client || !code || pending}
            style={(!client || !code) ? { opacity: .45, cursor: "not-allowed" } : undefined} onClick={submit}>
            <I name="plus" size={14} /> Log
          </button>
        </div>
        {chosen ? <p style={{ fontSize: 12, color: "var(--calv-slate-65)", margin: "10px 0 0" }}>
          Will report as <span className="code-chip">{chosen.code}</span> under <strong style={{ fontWeight: 600 }}>{chosenDomain?.name}</strong> in Module 3, Section A.
        </p> : null}
      </Panel>

      <Panel title="Recent entries" sub={shown.length + " shown · all staff"}
        right={
          <div className="field" style={{ width: 210 }}>
            <select value={domFilter} onChange={(e) => setDomFilter(e.target.value)}>
              <option value="all">All domains</option>
              {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>}>
        <table className="data">
          <thead><tr><th>Date</th><th>Client</th><th>Service</th><th>Program</th><th>Staff</th><th>Note</th></tr></thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.id}>
                <td style={{ whiteSpace: "nowrap" }}>{shortDate(s.date)}</td>
                <td className="cname">{s.clientName}</td>
                <td><div style={{ display: "flex", gap: 7, alignItems: "center" }}>{s.label} <CodeChip code={s.code} /></div></td>
                <td><ProgramDot color={s.programColor} label={s.programShort} /></td>
                <td>{s.staffInitials}</td>
                <td style={{ color: "var(--calv-slate-65)", maxWidth: 280 }}>{s.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
