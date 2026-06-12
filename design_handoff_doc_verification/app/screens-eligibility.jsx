// Eligibility queue — pre-enrollment document tracking + approve/deny
function ScreenEligibility({ applicants, setApplicants, toast, tweaks }) {
  const [openId, setOpenId] = useState(null);
  const [stageFilter, setStageFilter] = useState("All");
  // program assignment gates which applications this user can see
  const vApps = applicants.filter(a => userCanSeeProgram(CURRENT_USER, a.program));
  const open = vApps.find(a => a.id === openId);

  const STAGES = [
    { id: "docs", label: "Waiting on documents", tone: "amber" },
    { id: "review", label: "Ready for review", tone: "teal" },
    { id: "decision", label: "Awaiting decision", tone: "red" },
  ];
  const stageOf = (a) => STAGES.find(s => s.id === a.stage);
  const docList = (a) => (PROGRAM_DOCS[a.program] || []).map(k => ({ key: k, label: DOC_TYPES[k], status: a.docs[k] || "missing" }));
  const docsDone = (a) => docList(a).every(d => d.status === "verified");

  const TODAY = "2026-06-09";
  function patchApp(aId, fn) { setApplicants(prev => prev.map(a => a.id === aId ? fn(a) : a)); }
  // keep the stage chip honest in both directions (docs ⇄ review); decisions are left alone
  function recomputeStage(a) {
    const all = (PROGRAM_DOCS[a.program] || []).every(k => a.docs[k] === "verified");
    if (all && a.stage === "docs") return { ...a, stage: "review" };
    if (!all && a.stage === "review") return { ...a, stage: "docs" };
    return a;
  }
  function attachDoc(aId, key, fileName) {
    patchApp(aId, a => ({
      ...a,
      docs: { ...a.docs, [key]: a.docs[key] === "verified" ? "verified" : "submitted" },
      files: { ...(a.files || {}), [key]: { name: fileName, by: CURRENT_USER.id, when: TODAY } },
    }));
    toast("Document attached to the applicant file.");
  }
  function verifyDoc(aId, key, bypassReason) {
    patchApp(aId, a => recomputeStage({
      ...a,
      docs: { ...a.docs, [key]: "verified" },
      verifications: { ...(a.verifications || {}), [key]: { by: CURRENT_USER.id, when: TODAY } },
      bypass: bypassReason ? { ...(a.bypass || {}), [key]: { by: CURRENT_USER.id, when: TODAY, reason: bypassReason } } : (a.bypass || {}),
    }));
    toast(bypassReason ? "Verified without document — your sign-off was written to the determination record." : "Marked verified.");
  }
  function undoVerify(aId, key) {
    patchApp(aId, a => {
      const { [key]: _v, ...verifications } = a.verifications || {};
      const { [key]: _b, ...bypass } = a.bypass || {};
      const hasFile = !!(a.files || {})[key];
      return recomputeStage({ ...a, docs: { ...a.docs, [key]: hasFile ? "submitted" : "missing" }, verifications, bypass });
    });
    toast("Verification undone — status reset and the sign-off was removed.");
  }
  function decide(aId, decision, note) {
    setApplicants(prev => prev.filter(a => a.id !== aId));
    setOpenId(null);
    toast(decision === "approve"
      ? "Approved & enrolled — client record created, SDA 1a eligibility determination logged."
      : "Application denied — determination logged, referral letter queued.");
  }
  function advance(aId) {
    setApplicants(prev => prev.map(a => a.id === aId ? { ...a, stage: "decision" } : a));
    toast("Sent to program manager for decision.");
  }

  const shown = vApps.filter(a => stageFilter === "All" || stageOf(a).label === stageFilter);

  return (
    <div data-screen-label="Eligibility queue">
      <div className="page-head">
        <div>
          <h1 className="page-h1">Eligibility <span className="red">queue.</span></h1>
          <p className="lede">Pre-enrollment pipeline — track required documents, verify income, approve or deny. Nothing enrolls until eligibility is determined.</p>
        </div>
        <Seg options={["All", ...STAGES.map(s => s.label)]} value={stageFilter} onChange={setStageFilter} />
      </div>

      <div className="kpis" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <Kpi kick="In pipeline" value={vApps.length} accent="var(--calv-slate-35)" />
        {STAGES.map(s => (
          <Kpi key={s.id} kick={s.label} value={vApps.filter(a => a.stage === s.id).length}
            accent={s.id === "docs" ? "var(--calv-amber)" : s.id === "review" ? "var(--calv-teal)" : "var(--calv-red)"} />
        ))}
      </div>

      <Panel>
        <table className="data">
          <thead><tr>
            <th>Applicant</th><th>Program</th><th>Applied</th><th>Income vs FPL</th><th>Documents</th><th>Stage</th><th>Case worker</th><th></th>
          </tr></thead>
          <tbody>
            {shown.map(a => {
              const pct = fplPctFor(a.income, a.hhSize, a.fplYear);
              const st = fplStatus(pct);
              const docs = docList(a);
              const verified = docs.filter(d => d.status === "verified").length;
              return (
                <tr key={a.id} className="rowlink" onClick={() => setOpenId(a.id)}>
                  <td className="cname">{a.first} {a.last}<div style={{ fontFamily: "var(--font-body)", fontWeight: 300, fontSize: 11.5, color: "var(--calv-slate-65)", textTransform: "none" }}>{a.id} · HH of {a.hhSize} · {a.county} Co.</div></td>
                  <td><ProgramDot id={a.program} short /></td>
                  <td>{new Date(a.applied + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                  <td><Chip tone={st.tone}>{st.label}</Chip>{!st.eligible ? <div style={{ fontSize: 10.5, color: "#B73719", marginTop: 3 }}>over {FPL.csbgLimit}% ceiling</div> : null}</td>
                  <td style={{ minWidth: 130 }}>
                    <div className="meter-row"><div className={"meter " + (verified === docs.length ? "" : verified >= docs.length - 1 ? "warn" : "bad")} style={{ flex: 1 }}><i style={{ width: (verified / docs.length * 100) + "%" }}></i></div><span className="pct">{verified}/{docs.length}</span></div>
                  </td>
                  <td><Chip tone={stageOf(a).tone}>{stageOf(a).label}</Chip></td>
                  <td>{staffById(a.caseworker).name}</td>
                  <td style={{ textAlign: "right" }}><I name="arrow" size={14} style={{ color: "var(--calv-slate-35)" }} /></td>
                </tr>
              );
            })}
            {shown.length === 0 ? <tr><td colSpan="8"><div className="empty">No applications in this stage.</div></td></tr> : null}
          </tbody>
        </table>
      </Panel>

      {open ? <ApplicantModal a={open} onClose={() => setOpenId(null)} attachDoc={attachDoc} verifyDoc={verifyDoc} undoVerify={undoVerify} decide={decide} advance={advance} docList={docList} docsDone={docsDone} tweaks={tweaks} /> : null}
    </div>
  );
}

const dShort = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

function ApplicantModal({ a, onClose, attachDoc, verifyDoc, undoVerify, decide, advance, docList, docsDone, tweaks }) {
  const [denyNote, setDenyNote] = useState("");
  const [showDeny, setShowDeny] = useState(false);
  const [bypassKey, setBypassKey] = useState(null);
  const fileRef = useRef(null);
  const pickKey = useRef(null);
  const pct = fplPctFor(a.income, a.hhSize, a.fplYear);
  const st = fplStatus(pct);
  const docs = docList(a);
  const ready = docsDone(a);
  const files = a.files || {}, verifs = a.verifications || {}, byps = a.bypass || {};

  function pickFile(key) { pickKey.current = key; if (fileRef.current) fileRef.current.click(); }
  function onFile(e) {
    const f = e.target.files && e.target.files[0];
    if (f && pickKey.current) attachDoc(a.id, pickKey.current, f.name);
    e.target.value = "";
  }

  return (
    <Modal title={a.first + " " + a.last + " — eligibility review"} onClose={onClose} width={620}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <Chip outline><ProgramDot id={a.program} short /></Chip>
        <Chip tone={st.tone}>{st.label} · {st.eligible ? "Income-eligible" : "Exceeds " + FPL.csbgLimit + "% ceiling"}</Chip>
        <Chip outline>HH of {a.hhSize} · {money(a.income)}/yr</Chip>
        <Chip outline>{(a.fplYear || FPL.year)} FPL schedule</Chip>
        <Chip outline>Applied {new Date(a.applied + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Chip>
      </div>

      <div style={{ background: "var(--calv-sand-15)", border: "1px solid var(--calv-sand-35)", borderRadius: 4, padding: "12px 14px", fontSize: 13, lineHeight: 1.55, marginBottom: 18 }}>
        <strong style={{ fontWeight: 600 }}>Case worker note —</strong> {a.notes}
      </div>

      <h3 className="calv-label" style={{ fontSize: 12, marginBottom: 10 }}>Required documents · {a.id}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {docs.map(d => {
          const file = files[d.key], ver = verifs[d.key], byp = byps[d.key];
          return (
            <div key={d.key} style={{ padding: "10px 12px", border: "1px solid var(--calv-slate-15)", borderRadius: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <I name="doc" size={16} style={{ color: d.status === "verified" ? "var(--calv-sage)" : d.status === "submitted" ? "#8A6410" : "var(--calv-red)" }} />
                <span style={{ flex: 1, fontSize: 13 }}>{d.label}</span>
                <Chip tone={d.status === "verified" ? "sage" : d.status === "submitted" ? "amber" : "red"}>{DOC_STATUS[d.status]}</Chip>
                {d.status !== "verified" ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => pickFile(d.key)} title={file ? "Replace the attached file" : "Upload the scanned document"}>
                      <I name="upload" size={13} /> {file ? "Replace" : "Attach"}
                    </button>
                    {file ? (
                      <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => verifyDoc(a.id, d.key)}><I name="check" size={13} /> Verify</button>
                    ) : (
                      <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setBypassKey(d.key)} title="Requires a signed acknowledgement">Verify without doc…</button>
                    )}
                  </div>
                ) : (
                  <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => undoVerify(a.id, d.key)} title="Revert this verification if it was committed by mistake">Undo</button>
                )}
              </div>
              {(file || ver || byp || d.status === "submitted") ? (
                <div style={{ marginTop: 7, paddingLeft: 28, display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: "var(--calv-slate-65)", lineHeight: 1.5 }}>
                  {file ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><I name="doc" size={12} /> {file.name} · uploaded {dShort(file.when)}</span> : null}
                  {!file && d.status === "submitted" ? <span style={{ color: "#8A6410" }}>No file on record — attach the scanned document to verify.</span> : null}
                  {ver ? <span>Verified by {staffById(ver.by).name} · {dShort(ver.when)}</span> : null}
                  {byp ? <span style={{ color: "#8A6410", display: "inline-flex", alignItems: "flex-start", gap: 5 }}><I name="alert" size={12} style={{ marginTop: 2 }} /> No document retained — signed off by {staffById(byp.by).name}: “{byp.reason}”</span> : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <input type="file" ref={fileRef} style={{ display: "none" }} onChange={onFile} accept=".pdf,.jpg,.jpeg,.png,.heic,.tif,.tiff"></input>

      {showDeny ? (
        <div style={{ marginBottom: 16 }}>
          <Field label="Denial reason (required — written to determination record)" required>
            <textarea rows="3" value={denyNote} onChange={e => setDenyNote(e.target.value)}
              placeholder={st.eligible ? "Reason for denial…" : "e.g., Household income " + pct + "% of FPL exceeds CSBG 125% ceiling. Referred to United Way 211."} />
          </Field>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        {a.stage === "review" ? <button className="calv-btn calv-btn--secondary calv-btn--sm" onClick={() => advance(a.id)}>Send for decision <I name="arrow" size={13} /></button> : null}
        {showDeny ?
          <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={denyNote.trim().length < 8} style={denyNote.trim().length < 8 ? { opacity: .45, cursor: "not-allowed" } : null} onClick={() => decide(a.id, "deny", denyNote)}>Confirm denial</button> :
          <button className="calv-btn calv-btn--ghost calv-btn--sm" onClick={() => setShowDeny(true)}>Deny…</button>}
        <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={!ready || !st.eligible}
          style={(!ready || !st.eligible) ? { opacity: .45, cursor: "not-allowed" } : null}
          onClick={() => decide(a.id, "approve")}>
          <I name="check" size={14} /> Approve & enroll
        </button>
      </div>
      {!ready ? <p style={{ fontSize: 11.5, color: "var(--calv-slate-65)", textAlign: "right", margin: "8px 0 0" }}>Approval unlocks when every document is verified.</p> : null}
      {ready && !st.eligible ? <p style={{ fontSize: 11.5, color: "#B73719", textAlign: "right", margin: "8px 0 0" }}>Income exceeds the CSBG {FPL.csbgLimit}% FPL ceiling — approval is blocked; deny with referral.</p> : null}
      {bypassKey ? <BypassPrompt a={a} label={DOC_TYPES[bypassKey]} onCancel={() => setBypassKey(null)} onConfirm={(reason) => { verifyDoc(a.id, bypassKey, reason); setBypassKey(null); }} /> : null}
    </Modal>
  );
}
// signed acknowledgement required to verify a requirement with no supporting document on file
function BypassPrompt({ a, label, onCancel, onConfirm }) {
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const ok = ack && reason.trim().length >= 8;
  return (
    <Modal title="Verify without a supporting document" onClose={onCancel} width={480}>
      <div style={{ background: "var(--calv-amber-15)", border: "1px solid var(--calv-amber-35)", borderRadius: 4, padding: "12px 14px", fontSize: 12.5, lineHeight: 1.55, display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16 }}>
        <I name="alert" size={16} style={{ color: "#8A6410", marginTop: 1 }} />
        <span><strong style={{ fontWeight: 600 }}>{label}</strong> has no scanned document attached. Verifying without one is an audited exception — your sign-off is written to {a.id}'s eligibility determination record and is visible to program monitors.</span>
      </div>
      <Field label="Why is no document on file?" required>
        <textarea rows="3" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="e.g., Original sighted in person — agency policy prohibits retaining a copy."></textarea>
      </Field>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.55, margin: "14px 0 18px", cursor: "pointer" }}>
        <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} style={{ marginTop: 2, flex: "none" }}></input>
        <span>I, <strong style={{ fontWeight: 600 }}>{CURRENT_USER.name}</strong>, acknowledge that I am verifying this requirement without a supporting document on file, and I accept responsibility for this determination.</span>
      </label>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="calv-btn calv-btn--ghost calv-btn--sm" onClick={onCancel}>Cancel</button>
        <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={!ok} style={!ok ? { opacity: .45, cursor: "not-allowed" } : null} onClick={() => onConfirm(reason.trim())}>Sign & verify</button>
      </div>
    </Modal>
  );
}

window.ScreenEligibility = ScreenEligibility;
