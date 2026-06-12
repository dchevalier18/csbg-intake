// Clients — directory + 360° profile
function ScreenClients({ openClient, tweaks }) {
  const [prog, setProg] = useState("all");
  const [cw, setCw] = useState("all");
  const base = visibleClients();
  const myPrograms = (window.ACTIVE_PROGRAMS || []).filter(p => userCanSeeProgram(CURRENT_USER, p.id));
  const shown = base.filter(c =>
    (prog === "all" || c.programs.includes(prog)) && (cw === "all" || c.caseworker === cw));

  return (
    <div data-screen-label="Clients directory">
      <div className="page-head">
        <div>
          <h1 className="page-h1">Clients<span className="red">.</span></h1>
          <p className="lede">{fmt(base.length)} enrolled households on your view · scoped to your assigned programs</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="field" style={{ width: 250 }}>
          <select value={prog} onChange={e => setProg(e.target.value)}>
            <option value="all">All my programs</option>
            {myPrograms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ width: 200 }}>
          <select value={cw} onChange={e => setCw(e.target.value)}>
            <option value="all">All case workers</option>
            {STAFF.filter(s => s.role === "Case Worker").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--calv-slate-65)" }}>{shown.length} shown</span>
      </div>

      <Panel>
        <table className="data">
          <thead><tr><th>Client</th><th>Household</th><th>Income vs FPL</th><th>Programs</th><th>CSBG completeness</th><th>Case worker</th><th>Next follow-up</th></tr></thead>
          <tbody>
            {shown.map(c => {
              const pct = fplPctFor(c.income, c.hhSize, c.fplYear);
              const st = fplStatus(pct);
              return (
                <tr key={c.id} className="rowlink" onClick={() => openClient(c.id)}>
                  <td className="cname">{c.first} {c.last}
                    <div style={{ fontFamily: "var(--font-body)", fontWeight: 300, fontSize: 11.5, color: "var(--calv-slate-65)", textTransform: "none" }}>{c.id} · {c.address.split(",").slice(1, 2)}</div></td>
                  <td>{c.hhType}<div style={{ fontSize: 11.5, color: "var(--calv-slate-65)" }}>{c.hhSize} member{c.hhSize > 1 ? "s" : ""} · {c.housing}</div></td>
                  <td><Chip tone={st.tone}>{st.label}</Chip></td>
                  <td><div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{c.programs.map(p => <ProgramDot key={p} id={p} short />)}</div></td>
                  <td style={{ minWidth: 130 }}><Meter pct={c.completeness} /></td>
                  <td>{staffById(c.caseworker).name}</td>
                  <td>{new Date(c.nextFollowUp + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

// ---------- 360° profile ----------
function ScreenClientProfile({ clientId, back, tweaks, toast }) {
  const c = clientById(clientId);
  if (!c.id) return <div className="empty">Client not found.</div>;
  if (!clientVisible(CURRENT_USER, c)) return <Restricted what={"this client record"} />;
  const pct = fplPctFor(c.income, c.hhSize, c.fplYear);
  const st = fplStatus(pct);
  const services = SERVICE_LOG.filter(s => s.client === c.id);
  const missing = c.flags.filter(f => f.startsWith("Missing"));

  const characteristics = [
    ["Sex", c.sex], ["Age", c.age + " (" + c.dob + ")"], ["Race / ethnicity", c.race],
    ["Education level", c.edu], ["Work status", c.work], ["Military status", c.military],
    ["Disability", c.disability ? "Yes" : "No"], ["Health insurance", c.insurance],
    ["Household type", c.hhType], ["Household size", c.hhSize],
    ["Housing", c.housing], ["Income sources", c.incomeSrc],
    ["Annual income", money(c.income)], ["FPL band (D12)", FPL_BANDS[fplBand(pct)]],
    ["Assessed under", (c.fplYear || FPL.year) + " FPL guidelines"],
  ];

  return (
    <div data-screen-label={"Client profile · " + c.first + " " + c.last}>
      <div style={{ marginBottom: 14 }}>
        <a className="tlink" style={{ fontSize: 12.5, textDecoration: "none" }} onClick={back}>← Back to clients</a>
      </div>
      <div className="page-head" style={{ alignItems: "center" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div className="avatar" style={{ width: 56, height: 56, fontSize: 22 }}>{c.first[0]}{c.last[0]}</div>
          <div>
            <h1 className="page-h1" style={{ fontSize: 34 }}>{c.first} <span className="red">{c.last}</span></h1>
            <p className="lede" style={{ margin: "5px 0 0" }}>{c.id} · Enrolled {new Date(c.enrolled + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · {c.address}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="calv-btn calv-btn--secondary calv-btn--sm" onClick={() => toast("Service entry started for " + c.first + " — opens pre-filled in Service log.")}><I name="plus" size={13} /> Log service</button>
          <button className="calv-btn calv-btn--ghost calv-btn--sm" onClick={() => toast("Follow-up scheduled and added to your queue.")}><I name="cal" size={13} /> Schedule follow-up</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <Chip tone={st.tone}>{st.label} · {st.eligible ? "CSBG eligible" : "Over income ceiling"}</Chip>
        <Chip outline>{(c.fplYear || FPL.year)} guidelines</Chip>
        {c.programs.map(p => <Chip key={p} outline><ProgramDot id={p} short /></Chip>)}
        <Chip outline><I name="phone" size={12} /> {c.phone}</Chip>
        <Chip tone={c.completeness === 100 ? "sage" : "amber"}>{c.completeness}% report-ready</Chip>
      </div>

      <div className="row2">
        <Panel title="Household & CSBG characteristics" sub="Feeds the All Characteristics Report (Module 3, Section C) — every field here rolls up automatically.">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 24px" }}>
            {characteristics.map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--calv-slate-15)", fontSize: 13 }}>
                <span style={{ color: "var(--calv-slate-65)" }}>{k}</span>
                <span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>
          {missing.length > 0 ? (
            <div style={{ marginTop: 14, background: "var(--calv-amber-15)", border: "1px solid var(--calv-amber-35)", borderRadius: 4, padding: "10px 14px", fontSize: 12.5, display: "flex", gap: 10, alignItems: "center" }}>
              <I name="alert" size={15} style={{ color: "#8A6410" }} />
              <span><strong style={{ fontWeight: 600 }}>Gaps to close:</strong> {missing.join("; ")} — these count as “Unknown / Not Reported” in the Annual Report until captured.</span>
              <button className="calv-btn calv-btn--quiet calv-btn--sm" style={{ marginLeft: "auto" }} onClick={() => toast("Update form opened (prototype).")}>Capture now</button>
            </div>
          ) : null}
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <Panel title="Service history" sub={services.length + (services.length === 1 ? " entry" : " entries") + " this FY (most recent first)"}>
            {services.length === 0 ? <div className="empty" style={{ padding: 20 }}>No services logged yet this FY.</div> :
              services.map(s => {
                const sv = serviceByCode(s.code);
                return (
                  <div key={s.id} style={{ padding: "10px 2px", borderBottom: "1px solid var(--calv-slate-15)" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{sv.label}</span>
                      <CodeChip code={s.code} show={tweaks.showCodes} />
                      <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--calv-slate-65)" }}>{new Date(s.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--calv-slate-65)" }}>{s.note}</div>
                  </div>
                );
              })}
          </Panel>
          <Panel title="Next outcome check-in" sub={"Due " + new Date(c.nextFollowUp + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}>
            <p style={{ fontSize: 13, margin: 0, lineHeight: 1.55 }}>
              {c.flags[0] || "Quarterly case-plan review — verify outcome progress and update FNPI actuals."}
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
Object.assign(window, { ScreenClients, ScreenClientProfile });
