// Program start page — per-program dashboard housing that program's tools
function ScreenProgram({ programId, go, openClient, applicants, toast, tweaks }) {
  const p = (window.ACTIVE_PROGRAMS || []).find(x => x.id === programId);
  if (!p) return <div className="empty">Program not found — it may have been removed in Settings.</div>;
  if (!userCanSeeProgram(CURRENT_USER, p.id)) return <Restricted what={p.name} />;

  const t = programType(p.type);
  const members = CLIENTS.filter(c => c.programs.includes(p.id));
  const apps = applicants.filter(a => a.program === p.id);
  const svc = SERVICE_LOG.filter(s => s.program === p.id);
  const avgReady = members.length ? Math.round(members.reduce((s, c) => s + c.completeness, 0) / members.length) : 100;
  const tools = (p.caps || []).map(c => ({ cap: c, ...CAP_TOOLS[c] }));

  return (
    <div data-screen-label={"Program · " + p.name}>
      <div className="page-head">
        <div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 4 }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: p.color, flex: "none" }}></span>
            <h1 className="page-h1" style={{ fontSize: 34 }}>{p.name}<span className="red">.</span></h1>
          </div>
          <p className="lede">{t.name} program · {members.length} enrolled · {apps.length} in eligibility pipeline{p.sources.length ? " · syncs with " + p.sources.join(", ") : ""}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="calv-btn calv-btn--primary calv-btn--sm" onClick={() => go("intake")}><I name="plus" size={13} /> New intake</button>
          <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => go("services")}><I name="hand" size={13} /> Log service</button>
        </div>
      </div>

      <div className="kpis">
        <Kpi kick="Enrolled clients" value={members.length} accent={p.color} />
        <Kpi kick="Eligibility pipeline" value={apps.length} foot={apps.filter(a => a.stage === "docs").length + " waiting on documents"} accent="var(--calv-amber)" />
        <Kpi kick="Services this FY" value={svc.length} foot="from this prototype's log" accent="var(--calv-teal)" />
        <Kpi kick="Report-ready records" value={avgReady + "%"} tone={avgReady >= 90 ? "good" : "bad"} accent="var(--calv-sage)" />
      </div>

      {tools.length ? (
        <Panel title="Program tools" sub={"Activated by the " + t.name + " program type."} style={{ marginBottom: 13 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(" + Math.min(tools.length, 3) + ",1fr)", gap: 10 }}>
            {tools.map(tool => (
              <button key={tool.cap} onClick={() => go(tool.route)}
                style={{
                  textAlign: "left", padding: "14px 16px", borderRadius: 4, cursor: "pointer",
                  background: "#fff", border: "1px solid var(--calv-slate-15)", fontFamily: "var(--font-body)",
                }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 5 }}>
                  <span className="pdot" style={{ background: tool.dot, width: 8, height: 8, borderRadius: 99 }}></span>
                  <span style={{ fontFamily: "var(--font-sub)", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: ".02em", color: "var(--calv-slate)" }}>{tool.label}</span>
                  <I name="arrow" size={13} style={{ marginLeft: "auto", color: "var(--calv-slate-35)" }} />
                </div>
                <div style={{ fontSize: 12, color: "var(--calv-slate-65)", lineHeight: 1.45 }}>{CAP_DESCS[tool.cap]}</div>
              </button>
            ))}
          </div>
        </Panel>
      ) : null}

      <div className="row2">
        <Panel title="Enrolled clients" sub={members.length + " households on this program"}>
          {members.length === 0 ? <div className="empty">No enrollments yet — start with a new intake.</div> : (
            <table className="data">
              <thead><tr><th>Client</th><th>Household</th><th>Income vs FPL</th><th>Report-ready</th><th>Case worker</th></tr></thead>
              <tbody>
                {members.map(c => {
                  const pct = fplPctFor(c.income, c.hhSize, c.fplYear);
                  const st = fplStatus(pct);
                  return (
                    <tr key={c.id} className="rowlink" onClick={() => openClient(c.id)}>
                      <td className="cname">{c.first} {c.last}</td>
                      <td style={{ color: "var(--calv-slate-65)" }}>{c.hhType} · {c.hhSize}</td>
                      <td><Chip tone={st.tone}>{st.label}</Chip></td>
                      <td style={{ minWidth: 110 }}><Meter pct={c.completeness} /></td>
                      <td>{staffById(c.caseworker).name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <Panel title="Eligibility pipeline" sub="Applications for this program."
            right={<button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => go("eligibility")}>Open queue</button>}>
            {apps.length === 0 ? <div className="empty" style={{ padding: 18 }}>No pending applications.</div> :
              apps.map(a => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 2px", borderBottom: "1px solid var(--calv-slate-15)", fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{a.first} {a.last}</span>
                  <Chip tone={a.stage === "docs" ? "amber" : a.stage === "review" ? "teal" : "red"}>
                    {a.stage === "docs" ? "Documents" : a.stage === "review" ? "Review" : "Decision"}
                  </Chip>
                </div>
              ))}
          </Panel>
          <Panel title="Recent services" sub={svc.length + " logged this FY"}>
            {svc.length === 0 ? <div className="empty" style={{ padding: 18 }}>Nothing logged yet.</div> :
              svc.slice(0, 4).map(s => {
                const c = clientById(s.client);
                return (
                  <div key={s.id} style={{ padding: "8px 2px", borderBottom: "1px solid var(--calv-slate-15)" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>{c.first} {c.last}</span>
                      <CodeChip code={s.code} show={tweaks.showCodes} />
                      <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--calv-slate-65)" }}>{new Date(s.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--calv-slate-65)", marginTop: 2 }}>{s.note}</div>
                  </div>
                );
              })}
          </Panel>
        </div>
      </div>
    </div>
  );
}
window.ScreenProgram = ScreenProgram;
