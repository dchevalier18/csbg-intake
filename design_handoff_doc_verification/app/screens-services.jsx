// Service log — quick entry + recent entries; Data & integrations
function ScreenServices({ log, addEntry, toast, tweaks }) {
  const [client, setClient] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [domFilter, setDomFilter] = useState("all");

  function submit() {
    const c = clientById(client);
    addEntry({
      id: Date.now(), date: "2026-06-09", client, code,
      program: c.programs ? c.programs[0] : "cad-a", staff: CURRENT_USER.id, note: note || "—",
    });
    setClient(""); setCode(""); setNote("");
    toast("Service logged — mapped to " + code + " for the FY26 rollup.");
  }
  const shown = log.filter(s => userCanSeeProgram(CURRENT_USER, s.program) && (domFilter === "all" || serviceByCode(s.code).domain === domFilter));

  return (
    <div data-screen-label="Service log">
      <div className="page-head">
        <div>
          <h1 className="page-h1">Service <span className="red">log.</span></h1>
          <p className="lede">Every entry auto-maps to a CSBG service code and domain — the Annual Report tallies itself.</p>
        </div>
      </div>

      <Panel title="Quick entry" sub="Three fields. Under fifteen seconds." style={{ marginBottom: 13 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1.6fr auto", gap: 12, alignItems: "end" }}>
          <Field label="Client" required>
            <select value={client} onChange={e => setClient(e.target.value)}>
              <option value="">Select…</option>
              {visibleClients().map(c => <option key={c.id} value={c.id}>{c.first} {c.last} · {c.id}</option>)}
            </select>
          </Field>
          <Field label="Service" required>
            <select value={code} onChange={e => setCode(e.target.value)}>
              <option value="">Select…</option>
              {DOMAINS.map(d => (
                <optgroup key={d.id} label={d.name}>
                  {SERVICES.filter(s => s.domain === d.id).map(s => <option key={s.code} value={s.code}>{s.label}{tweaks.showCodes ? "  (" + s.code + ")" : ""}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="Note (optional)">
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="What happened?" />
          </Field>
          <button className="calv-btn calv-btn--primary" disabled={!client || !code}
            style={(!client || !code) ? { opacity: .45, cursor: "not-allowed" } : null} onClick={submit}>
            <I name="plus" size={14} /> Log
          </button>
        </div>
        {code ? <p style={{ fontSize: 12, color: "var(--calv-slate-65)", margin: "10px 0 0" }}>
          Will report as <span className="code-chip">{code}</span> under <strong style={{ fontWeight: 600 }}>{DOMAINS.find(d => d.id === serviceByCode(code).domain).name}</strong> in Module 3, Section A.
        </p> : null}
      </Panel>

      <Panel title="Recent entries" sub={shown.length + " shown · all staff"}
        right={
          <div className="field" style={{ width: 210 }}>
            <select value={domFilter} onChange={e => setDomFilter(e.target.value)}>
              <option value="all">All domains</option>
              {DOMAINS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>}>
        <table className="data">
          <thead><tr><th>Date</th><th>Client</th><th>Service</th><th>Program</th><th>Staff</th><th>Note</th></tr></thead>
          <tbody>
            {shown.map(s => {
              const c = clientById(s.client);
              const sv = serviceByCode(s.code);
              return (
                <tr key={s.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(s.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                  <td className="cname">{c.first} {c.last}</td>
                  <td><div style={{ display: "flex", gap: 7, alignItems: "center" }}>{sv.label} <CodeChip code={s.code} show={tweaks.showCodes} /></div></td>
                  <td><ProgramDot id={s.program} short /></td>
                  <td>{staffById(s.staff).initials}</td>
                  <td style={{ color: "var(--calv-slate-65)", maxWidth: 280 }}>{s.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

// ---------- Data & integrations ----------
function ScreenData({ toast }) {
  const tone = { connected: "sage", attention: "amber", ready: "teal" };
  const label = { connected: "Connected", attention: "Needs attention", ready: "Ready" };
  return (
    <div data-screen-label="Data & integrations">
      <div className="page-head">
        <div>
          <h1 className="page-h1">Data & <span className="red">integrations.</span></h1>
          <p className="lede">One client record, many sources — sync from existing systems instead of double entry.</p>
        </div>
        <button className="calv-btn calv-btn--secondary calv-btn--sm" onClick={() => toast("Import wizard opened (prototype).")}><I name="upload" size={14} /> Import spreadsheet</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 13, marginBottom: 13 }}>
        {INTEGRATIONS.map(x => (
          <Panel key={x.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <h3 className="ptitle" style={{ fontSize: 17 }}>{x.name}</h3>
                <p className="psub" style={{ margin: "2px 0 0" }}>{x.detail}</p>
              </div>
              <Chip tone={tone[x.status]}>{label[x.status]}</Chip>
            </div>
            <div style={{ display: "flex", gap: 18, fontSize: 12.5, color: "var(--calv-slate-65)", marginTop: 10, flexWrap: "wrap" }}>
              <span><strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>{x.kind}</strong></span>
              <span>Last sync: {x.last}</span>
              <span>{x.records}</span>
            </div>
            {x.status === "attention" ? (
              <div style={{ marginTop: 12, background: "var(--calv-amber-15)", border: "1px solid var(--calv-amber-35)", borderRadius: 4, padding: "9px 12px", fontSize: 12.5, display: "flex", gap: 10, alignItems: "center" }}>
                <I name="alert" size={14} style={{ color: "#8A6410" }} />
                14 incoming HMIS records matched existing clients with conflicts.
                <button className="calv-btn calv-btn--quiet calv-btn--sm" style={{ marginLeft: "auto" }} onClick={() => toast("De-duplication review opened (prototype).")}>Review matches</button>
              </div>
            ) : null}
          </Panel>
        ))}
        <Panel>
          <h3 className="ptitle" style={{ fontSize: 17 }}>Add a source</h3>
          <p className="psub">Connect another system over API, or map a recurring CSV/XLSX template.</p>
          <button className="calv-btn calv-btn--ghost calv-btn--sm" onClick={() => toast("Connection request sent to IT (prototype).")}><I name="plus" size={13} /> Request connection</button>
        </Panel>
      </div>

      <Panel title="How matching works" sub="Incoming records are matched on name + DOB + last-4 SSN; conflicts queue for human review — nothing merges silently.">
        <div style={{ display: "flex", gap: 24, fontSize: 12.5, color: "var(--calv-slate-65)", flexWrap: "wrap" }}>
          <span><strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>6,988</strong> records matched automatically this FY</span>
          <span><strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>312</strong> resolved by staff review</span>
          <span><strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>14</strong> awaiting review</span>
          <span><strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>0</strong> silent merges — by design</span>
        </div>
      </Panel>
    </div>
  );
}
Object.assign(window, { ScreenServices, ScreenData });
