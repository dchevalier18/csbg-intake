"use client";
/* Intake wizard — guided new-client intake with FPL calc, dup detection, completeness meter */
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Chip, Field, PageHead, Panel } from "@/components/ui";
import { I } from "@/components/icons";
import { useToast } from "@/components/toast";
import { money } from "@/lib/format";
import { FPL_BANDS, fplBand } from "@/lib/csbg-catalog";
import { INCOME_PERIODS, annualizeEntries, type IncomePeriod } from "@/lib/income";
import { CSBG_CORE } from "@/lib/completeness";
import { checkDuplicates, submitIntake, type DupMatch } from "./actions";
import { attachApplicationDoc } from "../eligibility/actions";

const UPLOAD_ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,.tif,.tiff";
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const INTAKE_STEPS = ["Identity", "Household", "Income", "Characteristics", "Program & docs", "Review"];

export interface IntakeFieldDef {
  id: string;
  label: string;
  code: string;
  type: string;            // 'list' | 'choice' | 'yesno' | 'text' | 'number' | 'date'
  listKey: string | null;
  optionsText: string | null;
}

export interface IntakeClientProps {
  lists: Record<string, string[]>;           // answer lists by key
  fields: IntakeFieldDef[];                  // enabled intake fields (characteristics step)
  programs: Array<{ id: string; name: string; ceiling: number }>; // limited to programs assigned to the user; ceiling = effective FPL % for that program
  requiredDocs: Record<string, string[]>;    // programId → required doc keys
  docTypes: Record<string, string>;          // doc key → label
  fpl: { year: number; base: number; perAdditional: number }; // ACTIVE schedule
  ceiling: number;                           // org CSBG eligibility ceiling (% of FPL) — fallback before a program is chosen
  lookbackDays: number;                      // state income-documentation policy (Settings → Organization)
  user: { id: string; name: string };
  prefill: { first: string; last: string; seminarAttendeeId: string };
}

const parseFieldOptions = (fd: IntakeFieldDef) =>
  (fd.optionsText || "").split(",").map((s) => s.trim()).filter(Boolean);

export function IntakeClient({ lists, fields, programs, requiredDocs, docTypes, fpl, ceiling, lookbackDays, prefill }: IntakeClientProps) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const listValues = (key: string | null | undefined) => (key ? lists[key] ?? [] : []);

  const [f, setF] = useState<Record<string, string>>(() => ({
    first: prefill.first, last: prefill.last, dob: "", phone: "", address: "",
    county: listValues("county")[0] ?? "Lehigh",
    hhType: "", hhSize: "1", housing: "",
    income: "", incomeSrc: "",
    program: "",
  }));
  const [docs, setDocs] = useState<Record<string, boolean>>({});
  // structured income worksheet — entries annualize into the single income figure
  // (server recomputes; the mirror here keeps the preview honest)
  const [entries, setEntries] = useState<Array<{ source: string; amount: string; period: IncomePeriod }>>([]);
  function setEntry(i: number, patch: Partial<{ source: string; amount: string; period: IncomePeriod }>) {
    setEntries((prev) => {
      const next = prev.map((e, j) => (j === i ? { ...e, ...patch } : e));
      syncIncomeFrom(next);
      return next;
    });
  }
  function addEntry() {
    setEntries((prev) => {
      const next = [...prev, { source: "", amount: "", period: "monthly" as IncomePeriod }];
      return next;
    });
  }
  function removeEntry(i: number) {
    setEntries((prev) => {
      const next = prev.filter((_, j) => j !== i);
      syncIncomeFrom(next);
      return next;
    });
  }
  function syncIncomeFrom(list: Array<{ source: string; amount: string; period: IncomePeriod }>) {
    const valid = list.filter((e) => e.source.trim() && Number(e.amount) > 0);
    if (valid.length > 0) {
      const total = annualizeEntries(valid.map((e) => ({ source: e.source, amount: Number(e.amount), period: e.period })));
      setF((prev) => ({ ...prev, income: String(total) }));
    }
  }
  const hasWorksheet = entries.some((e) => e.source.trim() && Number(e.amount) > 0);
  // optional scans attached during intake — uploaded right after the application is created
  const [docFiles, setDocFiles] = useState<Record<string, File>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const pickKey = useRef<string | null>(null);
  const set = (k: string, v: string) => setF((prev) => ({ ...prev, [k]: v }));

  function pickFile(key: string) {
    pickKey.current = key;
    fileRef.current?.click();
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const key = pickKey.current;
    e.target.value = "";
    if (!file || !key) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast("Files up to 4 MB are supported — scan at a lower resolution or split the document.");
      return;
    }
    setDocFiles((prev) => ({ ...prev, [key]: file }));
    setDocs((prev) => ({ ...prev, [key]: true })); // a scan in hand IS the document, submitted today
  }
  function removeFile(key: string) {
    setDocFiles((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  // duplicate detection — debounced agency-wide server lookup
  const [dupes, setDupes] = useState<DupMatch[]>([]);
  const dupSeq = useRef(0);
  useEffect(() => {
    const { first, last, dob } = f;
    const seq = ++dupSeq.current;
    if (first.length < 2 || last.length < 2) { setDupes([]); return; }
    const timer = setTimeout(() => {
      checkDuplicates(first, last, dob)
        .then((res) => { if (dupSeq.current === seq) setDupes(res); })
        .catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [f.first, f.last, f.dob]); // eslint-disable-line react-hooks/exhaustive-deps

  const metricFields: Array<[string, string]> = [
    ...CSBG_CORE,
    ...fields.map((fd) => [fd.id, (fd.code ? fd.code + " " : "") + fd.label] as [string, string]),
  ];
  const filled = metricFields.filter(([k]) => String(f[k] || "").trim() !== "").length;
  const completeness = Math.round((filled / metricFields.length) * 100);

  // mirror the server's normalization exactly (intake actions clamp hhSize to
  // [1,12] and round income) so the preview can never disagree with the stored
  // determination
  const normSize = (s: string | number) => Math.min(12, Math.max(1, Math.round(Number(s) || 1)));
  const normIncome = (i: string | number) => Math.max(0, Math.round(Number(i) || 0));
  const annualFor = (size: string | number) => fpl.base + fpl.perAdditional * (normSize(size) - 1);
  // eligibility is judged against the ENROLLING program's ceiling; before a
  // program is chosen the preview falls back to the agency-wide default
  const selectedProgram = programs.find((p) => p.id === f.program);
  const effCeiling = selectedProgram?.ceiling ?? ceiling;
  const fplPct = f.income !== "" && Number(f.hhSize)
    ? Math.round((normIncome(f.income) / annualFor(f.hhSize)) * 100)
    : null;
  const st = fplPct !== null
    ? (fplPct <= effCeiling
      ? { label: fplPct + "% FPL", tone: "sage", eligible: true }
      : fplPct <= 200
        ? { label: fplPct + "% FPL", tone: "amber", eligible: false }
        : { label: fplPct + "% FPL", tone: "red", eligible: false })
    : null;
  const reqDocs = f.program ? (requiredDocs[f.program] || []) : [];

  const canNext = [
    !!(f.first && f.last && f.dob),
    !!(f.hhType && f.housing),
    f.income !== "" && !!f.incomeSrc,
    true, // characteristics optional but tracked by meter
    !!f.program,
    true,
  ][step];

  function submit() {
    if (pending) return;
    startTransition(async () => {
      const res = await submitIntake({
        first: f.first, last: f.last, dob: f.dob, phone: f.phone, address: f.address, county: f.county,
        hhType: f.hhType, hhSize: Number(f.hhSize), housing: f.housing,
        income: Number(f.income), incomeSrc: f.incomeSrc,
        incomeEntries: entries
          .filter((e) => e.source.trim() && Number(e.amount) > 0)
          .map((e) => ({ source: e.source.trim(), amount: Number(e.amount), period: e.period })),
        characteristics: Object.fromEntries(fields.map((fd) => [fd.id, f[fd.id] || ""])),
        programId: f.program,
        docs: Object.fromEntries(reqDocs.map((k) => [k, !!docs[k] || !!docFiles[k]])),
        seminarAttendeeId: prefill.seminarAttendeeId,
      });
      if (!res.ok) { toast(res.message); return; }
      // upload attached scans one at a time — each call stays well under the
      // action body limit; a failed upload never loses the application (the
      // scan can be re-attached from the eligibility queue)
      for (const key of reqDocs.filter((k) => docFiles[k])) {
        const file = docFiles[key];
        try {
          const up = await attachApplicationDoc(res.id, key, file.name, await fileToBase64(file));
          if (!up.ok) toast(`${docTypes[key]}: ${up.message}`);
        } catch {
          toast(`${docTypes[key]}: upload failed — re-attach it from the eligibility queue.`);
        }
      }
      router.push("/eligibility");
    });
  }

  const opts = (arr: string[]): ReactNode[] => [
    <option key="" value="">Select…</option>,
    ...arr.map((o) => <option key={o} value={o}>{o}</option>),
  ];

  return (
    <div data-screen-label="New intake wizard">
      <PageHead
        title="New"
        titleAccent="intake."
        lede="One pass captures everything the CSBG Annual Report needs — no re-keying at year end."
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 290px", gap: 13, alignItems: "start" }}>
        <Panel>
          {/* stepper */}
          <div className="stepper">
            {INTAKE_STEPS.map((s, i) => (
              <button
                key={s} type="button"
                className={i === step ? "current" : i < step ? "done" : ""}
                onClick={() => i < step && setStep(i)}
              >
                {i < step ? "✓ " : (i + 1) + ". "}{s}
              </button>
            ))}
          </div>

          {step === 0 ? (
            <div className="fgrid c2">
              <Field label="First name" required><input value={f.first} onChange={(e) => set("first", e.target.value)} placeholder="First name" /></Field>
              <Field label="Last name" required><input value={f.last} onChange={(e) => set("last", e.target.value)} placeholder="Last name" /></Field>
              <Field label="Date of birth" required><input type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} /></Field>
              <Field label="Phone"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(610) 555-0100" /></Field>
              <Field label="Street address" span={2}><input value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, city, ZIP" /></Field>
              <Field label="County" required>
                <select value={f.county} onChange={(e) => set("county", e.target.value)}>{listValues("county").map((o) => <option key={o}>{o}</option>)}</select>
              </Field>
              {dupes.length > 0 ? (
                <div style={{ gridColumn: "span 2", background: "var(--calv-amber-15)", border: "1px solid var(--calv-amber-35)", borderRadius: 4, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5 }}>
                  <I name="alert" size={16} style={{ color: "#8A6410", marginTop: 1 }} />
                  <div>
                    <strong style={{ fontWeight: 600 }}>Possible duplicate found.</strong>{" "}
                    {dupes.filter((d) => d.inScope).map((d) => `${d.first} ${d.last} (${d.id}, DOB ${d.dob})`).join("; ")}
                    {dupes.some((d) => d.inScope) ? " already exists. " : ""}
                    {dupes.some((d) => !d.inScope) ? `${dupes.filter((d) => !d.inScope).length} matching record${dupes.filter((d) => !d.inScope).length === 1 ? "" : "s"} exist${dupes.filter((d) => !d.inScope).length === 1 ? "s" : ""} in a program outside your assignments — ask an administrator before creating a new one. ` : ""}
                    Open the existing record instead of creating a new one — duplicates split service history and inflate unduplicated counts.
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="fgrid c2">
              <Field label="Household type (D9)" required><select value={f.hhType} onChange={(e) => set("hhType", e.target.value)}>{opts(listValues("hhType"))}</select></Field>
              <Field label="Household size (D10)" required><input type="number" min="1" max="12" value={f.hhSize} onChange={(e) => set("hhSize", e.target.value)} /></Field>
              <Field label="Housing situation (D11)" required><select value={f.housing} onChange={(e) => set("housing", e.target.value)}>{opts(listValues("housing"))}</select></Field>
              <div className="field"><label>Household members</label>
                <div style={{ fontSize: 12.5, color: "var(--calv-slate-65)", lineHeight: 1.5 }}>Add each member after the primary applicant is created — their characteristics also count in the report.</div></div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="fgrid c2">
              <Field label="Total annual household income" required
                hint={hasWorksheet ? "Computed from the worksheet below" : `Gross, annualized from documented income (${lookbackDays}-day lookback per state policy)`}>
                <input type="number" min="0" value={f.income} onChange={(e) => set("income", e.target.value)} placeholder="$" disabled={hasWorksheet} />
              </Field>
              <Field label="Income sources (D13)" required>
                <select value={f.incomeSrc} onChange={(e) => set("incomeSrc", e.target.value)}>{opts(listValues("incomeSrc"))}</select>
              </Field>
              <div style={{ gridColumn: "span 2" }}>
                <h3 className="calv-label" style={{ margin: "2px 0 8px" }}>Income worksheet (optional) — entries annualize automatically</h3>
                {entries.map((e, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 130px 160px auto", gap: 10, marginBottom: 8, alignItems: "end" }}>
                    <Field label={i === 0 ? "Source (employer, SSI, child support …)" : ""}>
                      <input value={e.source} onChange={(ev) => setEntry(i, { source: ev.target.value })} placeholder="Source" />
                    </Field>
                    <Field label={i === 0 ? "Amount ($)" : ""}>
                      <input type="number" min="0" step="0.01" value={e.amount} onChange={(ev) => setEntry(i, { amount: ev.target.value })} placeholder="$" />
                    </Field>
                    <Field label={i === 0 ? "Paid" : ""}>
                      <select value={e.period} onChange={(ev) => setEntry(i, { period: ev.target.value as IncomePeriod })}>
                        {INCOME_PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                    </Field>
                    <button type="button" className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => removeEntry(i)} style={{ marginBottom: 2 }}>Remove</button>
                  </div>
                ))}
                <button type="button" className="calv-btn calv-btn--quiet calv-btn--sm" onClick={addEntry}>+ Add income entry</button>
                {hasWorksheet ? (
                  <span style={{ marginLeft: 12, fontSize: 12.5, color: "var(--calv-slate-65)" }}>
                    Annualized total: <strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>{money(Number(f.income) || 0)}/yr</strong> — the worksheet is retained on the application for audit.
                  </span>
                ) : null}
              </div>
              {st && fplPct !== null ? (
                <div style={{ gridColumn: "span 2", borderRadius: 4, padding: "16px 18px", border: "1px solid", display: "flex", gap: 16, alignItems: "center", background: st.eligible ? "var(--calv-sage-15)" : "var(--calv-red-15)", borderColor: st.eligible ? "var(--calv-sage-35)" : "var(--calv-red-35)" }}>
                  <span style={{ fontFamily: "var(--font-h1)", fontSize: 40, lineHeight: 1, color: st.eligible ? "#2F5A41" : "var(--calv-red)" }}>{fplPct}%</span>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                    <strong style={{ fontWeight: 600 }}>of the Federal Poverty Level</strong> — household of {normSize(f.hhSize)}, {fpl.year} guideline {money(annualFor(f.hhSize))}/yr.<br />
                    {st.eligible
                      ? "Within the " + effCeiling + "% eligibility ceiling" + (selectedProgram ? " for " + selectedProgram.name : "") + "."
                      : "Above the " + effCeiling + "% ceiling" + (selectedProgram ? " for " + selectedProgram.name : "") + " — intake can continue, but enrollment will require denial + referral or another funding source."}
                    <span style={{ color: "var(--calv-slate-65)" }}> Band: {FPL_BANDS[fplBand(fplPct)]} (D12 — auto-recorded).</span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="fgrid c3">
              {fields.map((fd) => (
                <Field key={fd.id} label={fd.label + (fd.code ? " (" + fd.code + ")" : "")}>
                  {fd.type === "list" ? <select value={f[fd.id] || ""} onChange={(e) => set(fd.id, e.target.value)}>{opts(listValues(fd.listKey))}</select>
                    : fd.type === "choice" ? <select value={f[fd.id] || ""} onChange={(e) => set(fd.id, e.target.value)}>{opts(parseFieldOptions(fd))}</select>
                      : fd.type === "yesno" ? <select value={f[fd.id] || ""} onChange={(e) => set(fd.id, e.target.value)}>{opts(["No", "Yes"])}</select>
                        : fd.type === "number" ? <input type="number" value={f[fd.id] || ""} onChange={(e) => set(fd.id, e.target.value)} />
                          : fd.type === "date" ? <input type="date" value={f[fd.id] || ""} onChange={(e) => set(fd.id, e.target.value)} />
                            : <input value={f[fd.id] || ""} onChange={(e) => set(fd.id, e.target.value)} />}
                </Field>
              ))}
              <div style={{ gridColumn: "span 3", alignSelf: "end", fontSize: 12, color: "var(--calv-slate-65)", lineHeight: 1.5 }}>
                Every blank here becomes “Unknown / Not Reported” in the federal report — skip if the client declines; the meter on the right tracks what&apos;s left. Questions and answer lists on this step are managed in <strong style={{ fontWeight: 600 }}>Settings → Forms</strong>.
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div>
              <div className="fgrid c2" style={{ marginBottom: 18 }}>
                <Field label="Enrolling program" required hint="Limited to programs assigned to you">
                  <select value={f.program} onChange={(e) => set("program", e.target.value)}>{[
                    <option key="" value="">Select…</option>,
                    ...programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>),
                  ]}</select>
                </Field>
                {selectedProgram ? (
                  <div className="field"><label>Income eligibility</label>
                    <div style={{ fontSize: 12.5, color: "var(--calv-slate-65)", lineHeight: 1.5 }}>
                      This program qualifies households up to <strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>{selectedProgram.ceiling}% of FPL</strong>{selectedProgram.ceiling !== ceiling ? " (program-specific ceiling)" : " (agency default)"}.
                      {fplPct !== null ? <> This household is at <strong style={{ fontWeight: 600, color: fplPct <= selectedProgram.ceiling ? "#2F5A41" : "var(--calv-red)" }}>{fplPct}%</strong>.</> : null}
                    </div>
                  </div>
                ) : null}
              </div>
              {f.program ? (
                <div>
                  <h3 className="calv-label" style={{ marginBottom: 10 }}>Required documents — check what the client brought today</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {reqDocs.map((k) => (
                      <div key={k} style={{ padding: "10px 12px", border: "1px solid var(--calv-slate-15)", borderRadius: 4, fontSize: 13 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <label style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, cursor: "pointer" }}>
                            <input type="checkbox" checked={!!docs[k]} onChange={(e) => setDocs({ ...docs, [k]: e.target.checked })} style={{ width: 16, height: 16, accentColor: "var(--calv-red)" }} />
                            {docTypes[k]}
                            {docs[k] ? <Chip tone="teal">Submitted today</Chip> : <Chip tone="amber">Will follow</Chip>}
                          </label>
                          {!docFiles[k] ? (
                            <button type="button" className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => pickFile(k)} title="Optional — attach the scanned document now instead of from the eligibility queue">
                              <I name="upload" size={13} /> Attach scan
                            </button>
                          ) : null}
                        </div>
                        {docFiles[k] ? (
                          <div style={{ marginTop: 7, paddingLeft: 26, display: "flex", gap: 10, alignItems: "center", fontSize: 11.5, color: "var(--calv-slate-65)" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><I name="doc" size={12} /> {docFiles[k].name}</span>
                            <span>· uploads on submit</span>
                            <button type="button" className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => removeFile(k)} title="Remove the attached file"><I name="x" size={11} /> Remove</button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <input type="file" ref={fileRef} style={{ display: "none" }} accept={UPLOAD_ACCEPT} onChange={onFile} />
                  <p style={{ fontSize: 12, color: "var(--calv-slate-65)", marginTop: 12 }}>
                    Attaching scans here is optional — missing documents don&apos;t block intake. The application waits in the eligibility queue, where staff can attach files later or the client can upload from their phone via the self-service portal.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 5 ? (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 24px", marginBottom: 18 }}>
                {([["Name", f.first + " " + f.last], ["DOB", f.dob], ["County", f.county],
                ["Household", (f.hhType || "—") + " · " + f.hhSize], ["Housing", f.housing || "—"],
                ["Income", f.income !== "" ? money(Number(f.income)) + "/yr · " + fplPct + "% FPL" : "—"],
                ["Program", f.program ? (programs.find((p) => p.id === f.program)?.name ?? "—") : "—"],
                ["Docs in hand", reqDocs.filter((k) => docs[k] || docFiles[k]).length + " of " + reqDocs.length +
                  (reqDocs.some((k) => docFiles[k]) ? " (" + reqDocs.filter((k) => docFiles[k]).length + " scanned)" : "")]] as Array<[string, string]>).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--calv-slate-15)", fontSize: 13 }}>
                    <span style={{ color: "var(--calv-slate-65)" }}>{k}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: "var(--calv-sand-15)", border: "1px solid var(--calv-sand-35)", borderRadius: 4, padding: "12px 14px", fontSize: 12.5, lineHeight: 1.55 }}>
                Submitting creates an <strong style={{ fontWeight: 600 }}>application</strong> in the eligibility queue — an SDA 1a eligibility determination is logged, and enrollment happens only after documents are verified and the application is approved.
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
            <button type="button" className="calv-btn calv-btn--quiet calv-btn--sm" style={{ visibility: step === 0 ? "hidden" : "visible" }} onClick={() => setStep(step - 1)}>← Back</button>
            {step < INTAKE_STEPS.length - 1 ?
              <button type="button" className="calv-btn calv-btn--primary calv-btn--sm" disabled={!canNext} style={!canNext ? { opacity: 0.45, cursor: "not-allowed" } : undefined} onClick={() => setStep(step + 1)}>Continue <I name="arrow" size={13} /></button> :
              <button type="button" className="calv-btn calv-btn--primary" disabled={pending} style={pending ? { opacity: 0.45, cursor: "not-allowed" } : undefined} onClick={submit}><I name="check" size={15} /> Submit to eligibility queue</button>}
          </div>
        </Panel>

        {/* right rail — CSBG completeness */}
        <div style={{ position: "sticky", top: 16, display: "flex", flexDirection: "column", gap: 13 }}>
          <Panel title="Report readiness" sub="All Characteristics Report coverage for this record.">
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
              <span style={{ fontFamily: "var(--font-h1)", fontSize: 44, lineHeight: 1, color: completeness === 100 ? "#2F5A41" : "var(--calv-slate)" }}>{completeness}%</span>
              <span style={{ fontSize: 12, color: "var(--calv-slate-65)" }}>{filled} of {metricFields.length} fields</span>
            </div>
            <div className={"meter " + (completeness >= 90 ? "" : completeness >= 60 ? "warn" : "bad")} style={{ marginBottom: 16 }}><i style={{ width: completeness + "%" }}></i></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {metricFields.map(([k, label]) => {
                const ok = String(f[k] || "").trim() !== "";
                return (
                  <div key={k} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: ok ? "var(--calv-slate)" : "var(--calv-slate-65)" }}>
                    <span style={{ color: ok ? "var(--calv-sage)" : "var(--calv-slate-35)", display: "flex" }}><I name={ok ? "check" : "x"} size={12} /></span>
                    {label}
                  </div>
                );
              })}
            </div>
          </Panel>
          {st ? <Panel>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Chip tone={st.tone}>{st.label}</Chip>
              <span style={{ fontSize: 12, color: "var(--calv-slate-65)" }}>{st.eligible ? "Income-eligible" : `Over ${effCeiling}% ceiling`}</span>
            </div>
          </Panel> : null}
        </div>
      </div>
    </div>
  );
}
