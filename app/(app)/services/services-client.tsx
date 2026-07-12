"use client";
/* Service log — quick entry + recent entries (interactive client surface).
   All data arrives as plain serializable props; mutations go through actions.ts. */
import { useRef, useState, useTransition } from "react";
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
  fileName: string | null;
}

export const UPLOAD_ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,.tif,.tiff";

/** Service options offered by a program — programs without a configured list get the full catalog. */
export function servicesForProgram(services: ServiceOption[], restrictions: Record<string, string[]>, programId: string): ServiceOption[] {
  const allowed = restrictions[programId];
  return allowed ? services.filter((s) => allowed.includes(s.code)) : services;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ServicesClient({ clients, services, domains, programs, visibleProgramIds, restrictions, initialClient, entries }: {
  clients: ClientOption[];
  services: ServiceOption[];
  domains: DomainOption[];
  programs: ProgramOption[];
  visibleProgramIds: string[];
  restrictions: Record<string, string[]>;
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
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [domFilter, setDomFilter] = useState("all");

  const programChoices = choicesFor(client);
  const needsProgram = programChoices.length > 1;
  const effectiveProgram = programChoices.length === 1 ? programChoices[0] : program;

  // service picker follows the effective program's offered list (full catalog until a program is known)
  const offered = effectiveProgram ? servicesForProgram(services, restrictions, effectiveProgram) : services;

  function keepCodeIfOffered(programId: string) {
    if (code && programId && !servicesForProgram(services, restrictions, programId).some((s) => s.code === code)) setCode("");
  }
  function pickClient(id: string) {
    setClient(id);
    const first = choicesFor(id)[0] ?? "";
    setProgram(first);
    keepCodeIfOffered(first);
  }
  function pickProgram(pid: string) {
    setProgram(pid);
    keepCodeIfOffered(pid);
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > 4 * 1024 * 1024) {
      toast("Files up to 4 MB are supported — scan at a lower resolution or split the document.");
      e.target.value = "";
      return;
    }
    setFile(f);
  }

  function submit() {
    startTransition(async () => {
      const attachment = file ? { name: file.name, base64: await fileToBase64(file) } : null;
      const res = await addServiceEntry({ clientId: client, code, programId: effectiveProgram, note, attachment });
      toast(res.message);
      if (res.ok) {
        setClient(""); setCode(""); setNote(""); setProgram(""); setFile(null);
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  }

  const chosen = code ? services.find((s) => s.code === code) : undefined;
  const chosenDomain = chosen ? domains.find((d) => d.id === chosen.domain) : undefined;
  const shown = entries.filter((s) => domFilter === "all" || s.domain === domFilter);

  return (
    <>
      <Panel title="Quick entry" sub="Three fields. Under fifteen seconds." style={{ marginBottom: 13 }}>
        <div style={{ display: "grid", gridTemplateColumns: needsProgram ? "1fr 1.4fr .9fr 1.6fr auto auto" : "1fr 1.4fr 1.6fr auto auto", gap: 12, alignItems: "end" }}>
          <Field label="Client" required>
            <select value={client} onChange={(e) => pickClient(e.target.value)}>
              <option value="">Select…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.first} {c.last} · {c.id}</option>)}
            </select>
          </Field>
          <Field label="Service" required>
            <select value={code} onChange={(e) => setCode(e.target.value)}>
              <option value="">Select…</option>
              {domains.map((d) => {
                const group = offered.filter((s) => s.domain === d.id);
                return group.length ? (
                  <optgroup key={d.id} label={d.name}>
                    {group.map((s) => <option key={s.code} value={s.code}>{s.label + "  (" + s.code + ")"}</option>)}
                  </optgroup>
                ) : null;
              })}
            </select>
          </Field>
          {needsProgram ? (
            <Field label="Program" required>
              <select value={program} onChange={(e) => pickProgram(e.target.value)}>
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
          <button className="calv-btn calv-btn--quiet" onClick={() => fileRef.current?.click()}
            title={file ? `Attached: ${file.name} — click to replace` : "Attach a file (receipt, award letter, signed form …)"}
            style={file ? { color: "var(--brand)" } : undefined}>
            <I name="clip" size={14} />
          </button>
          <button className="calv-btn calv-btn--primary" disabled={!client || !code || pending}
            style={(!client || !code) ? { opacity: .45, cursor: "not-allowed" } : undefined} onClick={submit}>
            <I name="plus" size={14} /> Log
          </button>
        </div>
        <input type="file" ref={fileRef} style={{ display: "none" }} accept={UPLOAD_ACCEPT} onChange={onFile} />
        {(chosen || file) ? (
          <p style={{ fontSize: 12, color: "var(--calv-slate-65)", margin: "10px 0 0", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            {chosen ? <span>
              Will report as <span className="code-chip">{chosen.code}</span> under <strong style={{ fontWeight: 600 }}>{chosenDomain?.name}</strong> in Module 4, Section A.
            </span> : null}
            {file ? <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <I name="clip" size={12} /> {file.name}
              <button className="tlink" style={{ fontSize: 12 }} onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}>remove</button>
            </span> : null}
          </p>
        ) : null}
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
          <thead><tr><th>Date</th><th>Client</th><th>Service</th><th>Program</th><th>Staff</th><th>Note</th><th>File</th></tr></thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.id}>
                <td style={{ whiteSpace: "nowrap" }}>{shortDate(s.date)}</td>
                <td className="cname">{s.clientName}</td>
                <td><div style={{ display: "flex", gap: 7, alignItems: "center" }}>{s.label} <CodeChip code={s.code} /></div></td>
                <td><ProgramDot color={s.programColor} label={s.programShort} /></td>
                <td>{s.staffInitials}</td>
                <td style={{ color: "var(--calv-slate-65)", maxWidth: 280 }}>{s.note}</td>
                <td>
                  {s.fileName ? (
                    <a className="tlink" href={`/services/file/${s.id}`} target="_blank" rel="noreferrer"
                      title={s.fileName} style={{ display: "inline-flex", gap: 5, alignItems: "center", fontSize: 12 }}>
                      <I name="clip" size={12} /> View
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
