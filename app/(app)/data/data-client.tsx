"use client";
/* Data & integrations — admin-only. Integration cards + matching stats, plus the
   spreadsheet import wizard (template → upload → map columns → results). */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Chip, Empty, Field, Notice, PageHead, Panel } from "@/components/ui";
import { Modal } from "@/components/ui-client";
import { I } from "@/components/icons";
import { useToast } from "@/components/toast";
import { fmt } from "@/lib/format";
import { IMPORT_TEMPLATES, autoMapColumns, importTemplate, templateCsv, type ImportTemplate, type ImportField } from "@/lib/import-templates";
import { parseImportFile, commitImport, undoImport, type ImportSummary } from "./actions";
import { INCOME_PERIODS } from "@/lib/income";

export interface IntegrationRow {
  id: string;
  name: string;
  kind: string;
  status: string;
  lastSync: string;
  records: string;
  detail: string;
}

export interface MatchingStats {
  auto: number;
  staff: number;
  awaiting: number;
  silent: number;
}

export interface ImportJobRow {
  id: number;
  when: string;
  template: string;
  filename: string;
  imported: number;
  updated: number;
  skipped: number;
  staffInitials: string;
  canUndo: boolean;
}

const tone: Record<string, string> = { connected: "sage", attention: "amber", ready: "teal" };
const label: Record<string, string> = { connected: "Connected", attention: "Needs attention", ready: "Ready" };

export interface ProgramOption { id: string; short: string; name: string; }
export interface ServiceOption { code: string; label: string; }

export function DataClient({ integrations, matching, importJobs, programs, fplYears, services }: {
  integrations: IntegrationRow[];
  matching: MatchingStats;
  importJobs: ImportJobRow[];
  programs: ProgramOption[];
  fplYears: number[];
  services: ServiceOption[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [undoJob, setUndoJob] = useState<ImportJobRow | null>(null);
  const [undoPending, startUndo] = useTransition();

  function confirmUndo() {
    if (!undoJob) return;
    const job = undoJob;
    startUndo(async () => {
      const res = await undoImport(job.id);
      toast(res.message);
      setUndoJob(null);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div>
      <PageHead
        title="Data &"
        titleAccent="integrations."
        lede="One client record, many sources — sync from existing systems instead of double entry."
        right={
          <button className="calv-btn calv-btn--secondary calv-btn--sm" onClick={() => setWizardOpen(true)}>
            <I name="upload" size={14} /> Import spreadsheet
          </button>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 13, marginBottom: 13 }}>
        {integrations.map((x) => (
          <Panel key={x.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <h3 className="ptitle" style={{ fontSize: 17 }}>{x.name}</h3>
                <p className="psub" style={{ margin: "2px 0 0" }}>{x.detail}</p>
              </div>
              <Chip tone={tone[x.status] ?? ""}>{label[x.status] ?? x.status}</Chip>
            </div>
            <div style={{ display: "flex", gap: 18, fontSize: 12.5, color: "var(--calv-slate-65)", marginTop: 10, flexWrap: "wrap" }}>
              <span><strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>{x.kind}</strong></span>
              <span>Last sync: {x.lastSync}</span>
              <span>{x.records}</span>
            </div>
            {x.status === "attention" ? (
              <div style={{ marginTop: 12, background: "var(--calv-amber-15)", border: "1px solid var(--calv-amber-35)", borderRadius: 4, padding: "9px 12px", fontSize: 12.5, display: "flex", gap: 10, alignItems: "center" }}>
                <I name="alert" size={14} style={{ color: "#8A6410" }} />
                14 incoming HMIS records matched existing clients with conflicts.
                <button className="calv-btn calv-btn--quiet calv-btn--sm" style={{ marginLeft: "auto" }}
                  onClick={() => toast("De-duplication review queued — conflicts assigned to the data team.")}>Review matches</button>
              </div>
            ) : null}
            {x.id === "sheets" ? (
              <div style={{ marginTop: 12 }}>
                <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setWizardOpen(true)}>
                  <I name="upload" size={13} /> Run an import
                </button>
              </div>
            ) : null}
          </Panel>
        ))}
        <Panel>
          <h3 className="ptitle" style={{ fontSize: 17 }}>Add a source</h3>
          <p className="psub">Connect another system over API, or map a recurring CSV/XLSX template.</p>
          <button className="calv-btn calv-btn--ghost calv-btn--sm"
            onClick={() => toast("Connection request sent to IT.")}>
            <I name="plus" size={13} /> Request connection
          </button>
        </Panel>
      </div>

      <Panel title="Recent imports" sub="Spreadsheet imports land here with row-level results." style={{ marginBottom: 13 }}>
        {importJobs.length === 0 ? (
          <Empty padding={20}>No spreadsheet imports yet — run one with the button above.</Empty>
        ) : (
          <table className="data">
            <thead><tr><th>Date</th><th>Template</th><th>File</th><th className="num">Added</th><th className="num">Updated</th><th className="num">Skipped</th><th>By</th><th></th></tr></thead>
            <tbody>
              {importJobs.map((j) => (
                <tr key={j.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{j.when}</td>
                  <td className="cname">{j.template}</td>
                  <td style={{ color: "var(--calv-slate-65)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>{j.filename}</td>
                  <td className="num">{fmt(j.imported)}</td>
                  <td className="num">{fmt(j.updated)}</td>
                  <td className="num">{j.skipped > 0 ? <Chip tone="amber">{fmt(j.skipped)}</Chip> : "0"}</td>
                  <td>{j.staffInitials}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {j.canUndo ? (
                      <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setUndoJob(j)}>Undo</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="How matching works" sub="Incoming records are matched on name + DOB + last-4 SSN; conflicts queue for human review — nothing merges silently.">
        <div style={{ display: "flex", gap: 24, fontSize: 12.5, color: "var(--calv-slate-65)", flexWrap: "wrap" }}>
          <span><strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>{fmt(matching.auto)}</strong> records matched automatically this FY</span>
          <span><strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>{fmt(matching.staff)}</strong> resolved by staff review</span>
          <span><strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>{fmt(matching.awaiting)}</strong> awaiting review</span>
          <span><strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>{fmt(matching.silent)}</strong> silent merges — by design</span>
        </div>
      </Panel>

      {wizardOpen ? <ImportWizard onClose={() => setWizardOpen(false)} toast={toast} programs={programs} fplYears={fplYears} services={services} /> : null}

      {undoJob ? (
        <Modal title="Undo this import?" width={460} onClose={() => { if (!undoPending) setUndoJob(null); }}>
          <p style={{ fontSize: 13, color: "var(--calv-slate)", margin: "0 0 8px", lineHeight: 1.5 }}>
            This permanently removes the <strong>{fmt(undoJob.imported)}</strong> client{undoJob.imported === 1 ? "" : "s"} added by{" "}
            <strong>{undoJob.filename}</strong>, along with their program enrollments and any services logged to them.
          </p>
          <p style={{ fontSize: 12.5, color: "var(--calv-slate-65)", margin: 0, lineHeight: 1.5 }}>
            Clients added or imported separately aren&rsquo;t affected. This can&rsquo;t be reversed.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
            <button className="calv-btn calv-btn--quiet calv-btn--sm" disabled={undoPending} onClick={() => setUndoJob(null)}>Cancel</button>
            <button
              className="calv-btn calv-btn--primary calv-btn--sm"
              disabled={undoPending}
              style={{ background: "#b3261e", borderColor: "#b3261e" }}
              onClick={confirmUndo}
            >
              {undoPending ? "Removing…" : `Remove ${fmt(undoJob.imported)} client${undoJob.imported === 1 ? "" : "s"}`}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/* One fixed value applied to every imported row when a field has no column.
   Program, poverty-year, and service get controlled dropdowns; everything
   else is text. */
function FixedValueInput({ field, programs, fplYears, services, value, onChange }: {
  field: ImportField;
  programs: ProgramOption[];
  fplYears: number[];
  services: ServiceOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.fixed === "program") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={`Set ${field.label} for all rows`}>
        <option value="">— set a program for all rows —</option>
        {programs.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.short})</option>)}
      </select>
    );
  }
  if (field.fixed === "year") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={`Set ${field.label} for all rows`}>
        <option value="">— use the active schedule —</option>
        {fplYears.map((y) => <option key={y} value={String(y)}>{y}</option>)}
      </select>
    );
  }
  if (field.fixed === "period") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={`Set ${field.label} for all rows`}>
        <option value="">— annual (as provided) —</option>
        {INCOME_PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
    );
  }
  if (field.fixed === "service") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={`Set ${field.label} for all rows`}>
        <option value="">— no service logged —</option>
        {services.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.label}</option>)}
      </select>
    );
  }
  return (
    <input
      type="text"
      value={value}
      placeholder="…or set one value for every row"
      onChange={(e) => onChange(e.target.value)}
      aria-label={`Set ${field.label} for all rows`}
    />
  );
}

/* ---------- Import wizard: template → upload → map columns → results ---------- */

/** Save a blank CSV for a template: exact headers + one example row the
    importer skips if it's left in. BOM so Excel opens it as UTF-8. */
function downloadTemplate(tp: ImportTemplate) {
  const blob = new Blob(["\uFEFF" + templateCsv(tp)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cap-trellis-import-${tp.id}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type WizardStep = "pick" | "map" | "done";

function ImportWizard({ onClose, toast, programs, fplYears, services }: {
  onClose: () => void; toast: (msg: string) => void; programs: ProgramOption[]; fplYears: number[]; services: ServiceOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<WizardStep>("pick");
  const [templateId, setTemplateId] = useState<string>("");
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [constants, setConstants] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportSummary | null>(null);

  const tpl: ImportTemplate | undefined = importTemplate(templateId);
  // Fixed-value assignment (a field with no column takes one value for the whole
  // file) is only offered on the client-migration template, per product scope.
  const allowFixed = tpl?.id === "clients";

  function pickFile(file: File | undefined) {
    if (!file || !tpl) return;
    if (file.size > 4 * 1024 * 1024) {
      toast("Files up to 4 MB are supported — split larger exports.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result ?? "").split(",")[1] ?? "";
      startTransition(async () => {
        const res = await parseImportFile(file.name, base64);
        if (!res.ok || !res.headers || !res.rows) {
          toast(res.message ?? "That file couldn't be read.");
          return;
        }
        setFilename(file.name);
        setHeaders(res.headers);
        setRows(res.rows);
        setMapping(autoMapColumns(tpl, res.headers));
        setConstants({});
        setStep("map");
      });
    };
    reader.readAsDataURL(file);
  }

  function runImport() {
    if (!tpl) return;
    startTransition(async () => {
      const res = await commitImport(tpl.id, filename, mapping, rows, allowFixed ? constants : {});
      if (!res.ok) {
        toast(res.message);
        return;
      }
      setResult(res);
      setStep("done");
      toast(res.message);
    });
  }

  const hasConst = (key: string) => allowFixed && (constants[key]?.trim().length ?? 0) > 0;
  const fieldSet = (f: { key: string }) => (mapping[f.key] ?? -1) >= 0 || hasConst(f.key);
  const requiredMapped = tpl ? tpl.fields.every((f) => !f.required || fieldSet(f)) : false;
  const previewFields = tpl ? tpl.fields.filter(fieldSet) : [];

  return (
    <Modal title="Import a spreadsheet" width={760} onClose={onClose}>
      {step === "pick" ? (
        <>
          <p style={{ fontSize: 12.5, color: "var(--calv-slate-65)", margin: "0 0 12px" }}>
            Pick the recurring template, then upload the CSV or XLSX export — columns map automatically and nothing lands without your review.
            Starting from scratch? Download a blank template below, fill it in, and upload it.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 12 }}>
            {IMPORT_TEMPLATES.map((tp) => (
              <button
                key={tp.id}
                type="button"
                onClick={() => setTemplateId(tp.id)}
                style={{
                  textAlign: "left", padding: "12px 14px", borderRadius: 4, cursor: "pointer", background: "#fff",
                  border: templateId === tp.id ? "2px solid var(--brand)" : "1px solid var(--calv-slate-15)",
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 5 }}>
                  <I name="upload" size={14} style={{ color: templateId === tp.id ? "var(--brand)" : "var(--calv-slate-65)" }} />
                  <span style={{ fontFamily: "var(--font-sub)", fontWeight: 700, fontSize: 12.5, textTransform: "uppercase", letterSpacing: ".02em" }}>{tp.name}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--calv-slate-65)", lineHeight: 1.45 }}>{tp.blurb}</div>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap", fontSize: 12, color: "var(--calv-slate-65)", marginBottom: 14 }}>
            <I name="doc" size={12} style={{ alignSelf: "center" }} />
            <span>Blank templates (CSV, with an example row to replace):</span>
            {IMPORT_TEMPLATES.map((tp, i) => (
              <span key={tp.id}>
                <a className="tlink" style={{ cursor: "pointer" }} onClick={() => downloadTemplate(tp)}>{tp.name}</a>
                {i < IMPORT_TEMPLATES.length - 1 ? <span style={{ color: "var(--calv-slate-35)" }}> · </span> : null}
              </span>
            ))}
          </div>
          <div className="fgrid">
            <Field label="Spreadsheet file" required hint={tpl ? `Expected columns: ${tpl.fields.map((f) => f.label).join(", ")}` : "Pick a template first"}>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                disabled={!tpl || pending}
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </Field>
          </div>
          {pending ? <p style={{ fontSize: 12.5, color: "var(--calv-slate-65)", margin: "10px 0 0" }}>Reading the file…</p> : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
            <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={onClose}>Cancel</button>
          </div>
        </>
      ) : null}

      {step === "map" && tpl ? (
        <>
          <p style={{ fontSize: 12.5, color: "var(--calv-slate-65)", margin: "0 0 12px" }}>
            <strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>{filename}</strong> — {fmt(rows.length)} data row{rows.length === 1 ? "" : "s"}. Match each {tpl.name.toLowerCase()} field to a column.
          </p>
          {allowFixed ? (
            <p style={{ fontSize: 11.5, color: "var(--calv-slate-65)", margin: "0 0 10px" }}>
              No column for a field? Leave it on <em>“No column”</em> and set one value applied to every row —
              handy when the sheet omits the program or the poverty-guideline year.
            </p>
          ) : null}
          <div className="fgrid c3" style={{ marginBottom: 14 }}>
            {tpl.fields.map((f) => {
              const mapped = (mapping[f.key] ?? -1) >= 0;
              return (
                <Field key={f.key} label={f.label} required={f.required} hint={f.hint}>
                  <select
                    value={String(mapping[f.key] ?? -1)}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setMapping((m) => ({ ...m, [f.key]: v }));
                      if (v >= 0) setConstants((c) => { const n = { ...c }; delete n[f.key]; return n; });
                    }}
                  >
                    <option value="-1">{allowFixed ? "— No column —" : "— Not mapped —"}</option>
                    {headers.map((h, i) => <option key={i} value={String(i)}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                  {allowFixed && !mapped ? (
                    <div style={{ marginTop: 6 }}>
                      <FixedValueInput
                        field={f}
                        programs={programs}
                        fplYears={fplYears}
                        services={services}
                        value={constants[f.key] ?? ""}
                        onChange={(val) =>
                          setConstants((c) => {
                            const n = { ...c };
                            if (val) n[f.key] = val; else delete n[f.key];
                            return n;
                          })}
                      />
                    </div>
                  ) : null}
                </Field>
              );
            })}
          </div>
          {previewFields.length > 0 ? (
            <div className="compact" style={{ marginBottom: 4 }}>
              <table className="data">
                <thead><tr>{previewFields.map((f) => <th key={f.key}>{f.label}</th>)}</tr></thead>
                <tbody>
                  {rows.slice(0, 6).map((r, i) => (
                    <tr key={i}>
                      {previewFields.map((f) => {
                    const val = (mapping[f.key] ?? -1) >= 0 ? r[mapping[f.key]] : constants[f.key];
                    return <td key={f.key} style={{ color: "var(--calv-slate-65)" }}>{val || "—"}</td>;
                  })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 6 ? <p style={{ fontSize: 11.5, color: "var(--calv-slate-65)", margin: "8px 0 0" }}>…and {fmt(rows.length - 6)} more row{rows.length - 6 === 1 ? "" : "s"}.</p> : null}
            </div>
          ) : null}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 18 }}>
            <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => { setStep("pick"); setHeaders([]); setRows([]); setConstants({}); }}>← Back</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={onClose}>Cancel</button>
              <button
                className="calv-btn calv-btn--primary calv-btn--sm"
                disabled={!requiredMapped || pending}
                style={!requiredMapped || pending ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
                onClick={runImport}
              >
                <I name="check" size={13} /> Import {fmt(rows.length)} row{rows.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {step === "done" && result ? (
        <>
          <Notice tone={result.imported + result.updated > 0 ? "good" : "warn"} icon={result.imported + result.updated > 0 ? "check" : "alert"}>
            {result.message}
          </Notice>
          {result.errors.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontFamily: "var(--font-sub)", fontSize: 10, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--calv-slate-65)", marginBottom: 6 }}>
                Skipped rows
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--calv-slate-65)", lineHeight: 1.7 }}>
                {result.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
              {result.errors.length > 8 ? <p style={{ fontSize: 11.5, color: "var(--calv-slate-65)", margin: "6px 0 0" }}>…and {result.errors.length - 8} more — fix the rows and re-import; duplicates are skipped automatically.</p> : null}
            </div>
          ) : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
            <button className="calv-btn calv-btn--primary calv-btn--sm" onClick={onClose}><I name="check" size={13} /> Done</button>
          </div>
        </>
      ) : null}
    </Modal>
  );
}
