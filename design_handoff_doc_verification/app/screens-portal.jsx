// Client self-service portal — mobile preview inside an iPhone frame
function ScreenPortal({ toast, tweaks, onUpload }) {
  const [docs, setDocs] = useState(PORTAL_USER.docs);
  const u = PORTAL_USER;
  const submitted = docs.filter(d => d.status !== "missing").length;

  function upload(key) {
    setDocs(prev => prev.map(d => d.key === key ? { ...d, status: "submitted", hint: "Received — being reviewed" } : d));
    if (onUpload) onUpload(key);
    toast("Document received — Dana is notified and the eligibility queue updates in real time.");
  }

  const DOC_UI = {
    submitted: { chip: <Chip tone="teal">Submitted</Chip> },
    verified: { chip: <Chip tone="sage">Verified</Chip> },
    missing: { chip: <Chip tone="amber">Needed</Chip> },
  };

  return (
    <div data-screen-label="Client self-service portal">
      <div className="page-head">
        <div>
          <h1 className="page-h1">Client <span className="red">portal.</span></h1>
          <p className="lede">What applicants see on their phone — large type, plain language, three things only: where you stand, what we need, what's next.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 36, alignItems: "start" }}>
        <IOSDevice title="">
          <div style={{ background: "#F8F6EE", minHeight: "100%", fontFamily: "var(--font-body)", color: "var(--calv-slate)" }}>
            {/* header */}
            <div style={{ background: "var(--calv-slate)", color: "#fff", padding: "18px 20px 20px" }}>
              <img src="calv/logos/primary-notagline-white.svg" alt="Community Action Lehigh Valley" style={{ height: 30, marginBottom: 12 }} />
              <div style={{ fontFamily: "var(--font-h1)", fontSize: 24, textTransform: "uppercase", letterSpacing: ".02em", lineHeight: 1.05 }}>
                Hi, Rosa.
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.75)", marginTop: 4 }}>Housing Counseling application · {u.applicantId}</div>
            </div>

            {/* status steps */}
            <div style={{ padding: "18px 20px 6px" }}>
              <div style={{ fontFamily: "var(--font-sub)", fontWeight: 700, fontSize: 11, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--calv-slate-65)", marginBottom: 10 }}>Where you stand</div>
              <div style={{ background: "#fff", border: "1px solid var(--calv-slate-15)", borderRadius: 6, padding: "14px 16px" }}>
                {u.steps.map((s, i) => (
                  <div key={s.label} style={{ display: "flex", gap: 12, alignItems: "flex-start", position: "relative", paddingBottom: i < u.steps.length - 1 ? 16 : 0 }}>
                    {i < u.steps.length - 1 ? <span style={{ position: "absolute", left: 10, top: 22, bottom: 0, width: 2, background: s.done ? "var(--calv-sage)" : "var(--calv-slate-15)" }}></span> : null}
                    <span style={{
                      width: 22, height: 22, borderRadius: 99, flex: "none", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                      background: s.done ? "var(--calv-sage)" : s.current ? "var(--calv-amber)" : "var(--calv-slate-15)",
                      color: s.done || s.current ? "#fff" : "var(--calv-slate-65)",
                    }}>{s.done ? <I name="check" size={12} /> : <span style={{ fontFamily: "var(--font-h1)", fontSize: 11 }}>{i + 1}</span>}</span>
                    <div>
                      <div style={{ fontSize: 14.5, fontWeight: s.current ? 600 : 400 }}>{s.label}{s.date ? <span style={{ color: "var(--calv-slate-65)", fontWeight: 300 }}> · {s.date}</span> : null}</div>
                      {s.current ? <div style={{ fontSize: 12.5, color: "#8A6410" }}>We're waiting on {3 - submitted === 0 ? "our review" : (3 - submitted) + " document" + (3 - submitted === 1 ? "" : "s")} from you</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* documents */}
            <div style={{ padding: "16px 20px 6px" }}>
              <div style={{ fontFamily: "var(--font-sub)", fontWeight: 700, fontSize: 11, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--calv-slate-65)", marginBottom: 10 }}>What we need</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {docs.map(d => (
                  <div key={d.key} style={{ background: "#fff", border: "1px solid var(--calv-slate-15)", borderRadius: 6, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                    <I name="doc" size={18} style={{ color: d.status === "missing" ? "#8A6410" : "var(--calv-teal)" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{d.label}</div>
                      <div style={{ fontSize: 12, color: "var(--calv-slate-65)" }}>{d.hint}</div>
                    </div>
                    {d.status === "missing" ?
                      <button onClick={() => upload(d.key)} style={{
                        minHeight: 44, padding: "0 16px", border: 0, borderRadius: 5, cursor: "pointer",
                        background: "var(--calv-red)", color: "#fff", fontFamily: "var(--font-sub)", fontWeight: 700,
                        fontSize: 12, letterSpacing: ".03em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 7,
                      }}><I name="upload" size={14} /> Snap a photo</button>
                      : DOC_UI[d.status].chip}
                  </div>
                ))}
              </div>
            </div>

            {/* appointment + caseworker */}
            <div style={{ padding: "16px 20px 28px" }}>
              <div style={{ fontFamily: "var(--font-sub)", fontWeight: 700, fontSize: 11, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--calv-slate-65)", marginBottom: 10 }}>What's next</div>
              <div style={{ background: "#fff", border: "1px solid var(--calv-slate-15)", borderRadius: 6, padding: "14px 16px", marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                  <I name="cal" size={16} style={{ color: "var(--calv-teal)" }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{u.appointment.what}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--calv-slate-65)", lineHeight: 1.5 }}>{u.appointment.when}<br />{u.appointment.where}</div>
              </div>
              <div style={{ background: "var(--calv-teal-15)", borderRadius: 6, padding: "13px 16px", display: "flex", gap: 10, alignItems: "center" }}>
                <I name="phone" size={16} style={{ color: "var(--calv-teal)" }} />
                <div style={{ fontSize: 13, lineHeight: 1.45 }}>
                  <strong style={{ fontWeight: 600 }}>Questions? Call {u.caseworker.name}</strong><br />
                  <span style={{ color: "var(--calv-slate-65)" }}>{u.caseworker.phone} · Mon–Fri 8:30–4:30</span>
                </div>
              </div>
            </div>
          </div>
        </IOSDevice>

        <div style={{ display: "flex", flexDirection: "column", gap: 13, maxWidth: 480, position: "sticky", top: 16 }}>
          <Panel title="Why this matters" sub="The portal closes the slowest loop in eligibility: documents.">
            <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 13, lineHeight: 1.7, color: "var(--calv-slate)" }}>
              <li>Applicants photograph documents instead of making a second office trip — the #1 cause of stalled applications.</li>
              <li>Uploads land directly on the application in the <strong style={{ fontWeight: 600 }}>eligibility queue</strong>, flagged for staff verification. Nothing auto-verifies.</li>
              <li>Plain language, no jargon, no login wall — applicants get a text link tied to their application ID.</li>
              <li>Works in English and Spanish; type scale and 44px+ touch targets meet accessibility guidance.</li>
            </ul>
          </Panel>
          <Panel title="Try it" sub="This preview is wired to Rosa Mejía's real application in this prototype.">
            <p style={{ fontSize: 13, margin: 0, lineHeight: 1.6 }}>
              Tap <strong style={{ fontWeight: 600 }}>“Snap a photo”</strong> on a document, then open the <strong style={{ fontWeight: 600 }}>Eligibility queue</strong> — Rosa's checklist shows the document as submitted and waiting for staff verification.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
window.ScreenPortal = ScreenPortal;
