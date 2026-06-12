// Intake wizard — guided new-client intake with FPL calc, dup detection, completeness meter
const INTAKE_STEPS = ["Identity", "Household", "Income", "Characteristics", "Program & docs", "Review"];

const BLANK = {
  first: "", last: "", dob: "", phone: "", address: "", county: "Lehigh",
  hhType: "", hhSize: 1, housing: "",
  income: "", incomeSrc: "",
  sex: "", race: "", edu: "", work: "", insurance: "", military: "", disability: "",
  program: "", docs: {},
};

// core fields that always feed the All Characteristics Report; the
// characteristics step adds the admin-configured fields (Settings → Forms)
const CSBG_CORE = [
  ["dob", "C2 Age"], ["hhType", "D9 Household type"], ["hhSize", "D10 Household size"],
  ["housing", "D11 Housing"], ["income", "D12 Income level"], ["incomeSrc", "D13 Income sources"],
];

function ScreenIntake({ onSubmit, toast, tweaks }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState(BLANK);
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  // duplicate detection
  const dupes = useMemo(() => {
    if (f.first.length < 2 || f.last.length < 2) return [];
    return CLIENTS.filter(c =>
      c.last.toLowerCase() === f.last.toLowerCase() &&
      (c.first.toLowerCase().startsWith(f.first.toLowerCase().slice(0, 3)) || c.dob === f.dob)
    );
  }, [f.first, f.last, f.dob]);

  const metricFields = [...CSBG_CORE, ...enabledFields().map(fd => [fd.id, (fd.code ? fd.code + " " : "") + fd.label])];
  const filled = metricFields.filter(([k]) => String(f[k] || "").trim() !== "").length;
  const completeness = Math.round(filled / metricFields.length * 100);
  const fplPct = f.income !== "" && f.hhSize ? FPL.pct(Number(f.income), Number(f.hhSize)) : null;
  const st = fplPct !== null ? fplStatus(fplPct) : null;
  const reqDocs = f.program ? (PROGRAM_DOCS[f.program] || []) : [];

  const canNext = [
    f.first && f.last && f.dob,
    f.hhType && f.housing,
    f.income !== "" && f.incomeSrc,
    true, // characteristics optional but tracked by meter
    !!f.program,
    true,
  ][step];

  function submit() {
    onSubmit({
      id: "A-" + (1188 + Math.floor(Math.random() * 100)),
      first: f.first, last: f.last, dob: f.dob, hhSize: Number(f.hhSize), income: Number(f.income),
      program: f.program, caseworker: CURRENT_USER.id, stage: "docs",
      applied: "2026-06-09", county: f.county, fplYear: FPL.year,
      docs: Object.fromEntries(reqDocs.map(k => [k, f.docs[k] ? "submitted" : "missing"])),
      notes: "New intake by " + CURRENT_USER.name + ". " + (st && !st.eligible ? "⚠ Income above 125% FPL ceiling — flag for review." : "Income-eligible at intake."),
    });
  }

  const opts = (arr) => [<option key="" value="">Select…</option>, ...arr.map(o => <option key={o} value={o}>{o}</option>)];

  return (
    <div data-screen-label="New intake wizard">
      <div className="page-head">
        <div>
          <h1 className="page-h1">New <span className="red">intake.</span></h1>
          <p className="lede">One pass captures everything the CSBG Annual Report needs — no re-keying at year end.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 290px", gap: 13, alignItems: "start" }}>
        <Panel>
          {/* stepper */}
          <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "1px solid var(--calv-slate-15)" }}>
            {INTAKE_STEPS.map((s, i) => (
              <button key={s} onClick={() => i < step && setStep(i)}
                style={{
                  background: "none", border: 0, padding: "10px 14px", cursor: i < step ? "pointer" : "default",
                  fontFamily: "var(--font-sub)", fontWeight: 700, fontSize: 11, letterSpacing: ".03em", textTransform: "uppercase",
                  color: i === step ? "var(--calv-red)" : i < step ? "var(--calv-slate)" : "var(--calv-slate-35)",
                  borderBottom: i === step ? "3px solid var(--calv-red)" : "3px solid transparent", marginBottom: -1,
                }}>
                {i < step ? "✓ " : (i + 1) + ". "}{s}
              </button>
            ))}
          </div>

          {step === 0 ? (
            <div className="fgrid c2">
              <Field label="First name" required><input value={f.first} onChange={e => set("first", e.target.value)} placeholder="First name" /></Field>
              <Field label="Last name" required><input value={f.last} onChange={e => set("last", e.target.value)} placeholder="Last name" /></Field>
              <Field label="Date of birth" required><input type="date" value={f.dob} onChange={e => set("dob", e.target.value)} /></Field>
              <Field label="Phone"><input value={f.phone} onChange={e => set("phone", e.target.value)} placeholder="(610) 555-0100" /></Field>
              <Field label="Street address" span={2}><input value={f.address} onChange={e => set("address", e.target.value)} placeholder="Street, city, ZIP" /></Field>
              <Field label="County" required>
                <select value={f.county} onChange={e => set("county", e.target.value)}>{listValues("county").map(o => <option key={o}>{o}</option>)}</select>
              </Field>
              {dupes.length > 0 ? (
                <div style={{ gridColumn: "span 2", background: "var(--calv-amber-15)", border: "1px solid var(--calv-amber-35)", borderRadius: 4, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5 }}>
                  <I name="alert" size={16} style={{ color: "#8A6410", marginTop: 1 }} />
                  <div>
                    <strong style={{ fontWeight: 600 }}>Possible duplicate found.</strong> {dupes.map(d => d.first + " " + d.last + " (" + d.id + ", DOB " + d.dob + ")").join("; ")} already exists.
                    Open the existing record instead of creating a new one — duplicates split service history and inflate unduplicated counts.
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="fgrid c2">
              <Field label="Household type (D9)" required><select value={f.hhType} onChange={e => set("hhType", e.target.value)}>{opts(listValues("hhType"))}</select></Field>
              <Field label="Household size (D10)" required><input type="number" min="1" max="12" value={f.hhSize} onChange={e => set("hhSize", e.target.value)} /></Field>
              <Field label="Housing situation (D11)" required><select value={f.housing} onChange={e => set("housing", e.target.value)}>{opts(listValues("housing"))}</select></Field>
              <div className="field"><label>Household members</label>
                <div style={{ fontSize: 12.5, color: "var(--calv-slate-65)", lineHeight: 1.5 }}>Add each member after the primary applicant is created — their characteristics also count in the report.</div></div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="fgrid c2">
              <Field label="Total annual household income" required hint="Gross, last 12 months or annualized 30-day proof">
                <input type="number" min="0" value={f.income} onChange={e => set("income", e.target.value)} placeholder="$" />
              </Field>
              <Field label="Income sources (D13)" required>
                <select value={f.incomeSrc} onChange={e => set("incomeSrc", e.target.value)}>{opts(listValues("incomeSrc"))}</select>
              </Field>
              {st ? (
                <div style={{ gridColumn: "span 2", borderRadius: 4, padding: "16px 18px", border: "1px solid", display: "flex", gap: 16, alignItems: "center", background: st.eligible ? "var(--calv-sage-15)" : "var(--calv-red-15)", borderColor: st.eligible ? "var(--calv-sage-35)" : "var(--calv-red-35)" }}>
                  <span style={{ fontFamily: "var(--font-h1)", fontSize: 40, lineHeight: 1, color: st.eligible ? "#2F5A41" : "var(--calv-red)" }}>{fplPct}%</span>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                    <strong style={{ fontWeight: 600 }}>of the Federal Poverty Level</strong> — household of {f.hhSize}, {FPL.year} guideline {money(FPL.annualFor(Number(f.hhSize)))}/yr.<br />
                    {st.eligible ? "Within the CSBG " + FPL.csbgLimit + "% eligibility ceiling." : "Above the CSBG " + FPL.csbgLimit + "% ceiling — intake can continue, but enrollment will require denial + referral or another funding source."}
                    <span style={{ color: "var(--calv-slate-65)" }}> Band: {FPL_BANDS[fplBand(fplPct)]} (D12 — auto-recorded).</span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="fgrid c3">
              {enabledFields().map(fd => (
                <Field key={fd.id} label={fd.label + (fd.code ? " (" + fd.code + ")" : "")}>
                  {fd.type === "list" ? <select value={f[fd.id] || ""} onChange={e => set(fd.id, e.target.value)}>{opts(listValues(fd.list))}</select>
                    : fd.type === "choice" ? <select value={f[fd.id] || ""} onChange={e => set(fd.id, e.target.value)}>{opts(parseFieldOptions(fd))}</select>
                      : fd.type === "yesno" ? <select value={f[fd.id] || ""} onChange={e => set(fd.id, e.target.value)}>{opts(["No", "Yes"])}</select>
                        : fd.type === "number" ? <input type="number" value={f[fd.id] || ""} onChange={e => set(fd.id, e.target.value)} />
                          : fd.type === "date" ? <input type="date" value={f[fd.id] || ""} onChange={e => set(fd.id, e.target.value)} />
                            : <input value={f[fd.id] || ""} onChange={e => set(fd.id, e.target.value)} />}
                </Field>
              ))}
              <div style={{ gridColumn: "span 3", alignSelf: "end", fontSize: 12, color: "var(--calv-slate-65)", lineHeight: 1.5 }}>
                Every blank here becomes “Unknown / Not Reported” in the federal report — skip if the client declines; the meter on the right tracks what's left. Questions and answer lists on this step are managed in <strong style={{ fontWeight: 600 }}>Settings → Forms</strong>.
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div>
              <div className="fgrid c2" style={{ marginBottom: 18 }}>
                <Field label="Enrolling program" required hint="Limited to programs assigned to you">
                  <select value={f.program} onChange={e => set("program", e.target.value)}>{[<option key="" value="">Select…</option>, ...(window.ACTIVE_PROGRAMS || []).filter(p => userCanSeeProgram(CURRENT_USER, p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)]}</select>
                </Field>
              </div>
              {f.program ? (
                <div>
                  <h3 className="calv-label" style={{ marginBottom: 10 }}>Required documents — check what the client brought today</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {reqDocs.map(k => (
                      <label key={k} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", border: "1px solid var(--calv-slate-15)", borderRadius: 4, fontSize: 13, cursor: "pointer" }}>
                        <input type="checkbox" checked={!!f.docs[k]} onChange={e => set("docs", { ...f.docs, [k]: e.target.checked })} style={{ width: 16, height: 16, accentColor: "var(--calv-red)" }} />
                        {DOC_TYPES[k]}
                        {f.docs[k] ? <Chip tone="teal">Submitted today</Chip> : <Chip tone="amber">Will follow</Chip>}
                      </label>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: "var(--calv-slate-65)", marginTop: 12 }}>
                    Missing documents don't block intake — the application waits in the eligibility queue and the client can upload from their phone via the self-service portal.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 5 ? (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 24px", marginBottom: 18 }}>
                {[["Name", f.first + " " + f.last], ["DOB", f.dob], ["County", f.county],
                ["Household", (f.hhType || "—") + " · " + f.hhSize], ["Housing", f.housing || "—"],
                ["Income", f.income !== "" ? money(Number(f.income)) + "/yr · " + fplPct + "% FPL" : "—"],
                ["Program", f.program ? programById(f.program).name : "—"],
                ["Docs in hand", reqDocs.filter(k => f.docs[k]).length + " of " + reqDocs.length]].map(([k, v]) => (
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
            <button className="calv-btn calv-btn--quiet calv-btn--sm" style={{ visibility: step === 0 ? "hidden" : "visible" }} onClick={() => setStep(step - 1)}>← Back</button>
            {step < INTAKE_STEPS.length - 1 ?
              <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={!canNext} style={!canNext ? { opacity: .45, cursor: "not-allowed" } : null} onClick={() => setStep(step + 1)}>Continue <I name="arrow" size={13} /></button> :
              <button className="calv-btn calv-btn--primary" onClick={submit}><I name="check" size={15} /> Submit to eligibility queue</button>}
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
              <span style={{ fontSize: 12, color: "var(--calv-slate-65)" }}>{st.eligible ? "CSBG income-eligible" : "Over 125% ceiling"}</span>
            </div>
          </Panel> : null}
        </div>
      </div>
    </div>
  );
}
window.ScreenIntake = ScreenIntake;
