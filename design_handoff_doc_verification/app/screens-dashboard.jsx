// Dashboard — case worker home + agency pulse
function ScreenDashboard({ go, openClient, tweaks }) {
  const vis = visibleClients();
  const vApps = APPLICANTS.filter(a => userCanSeeProgram(CURRENT_USER, a.program));
  const mine = vis.filter(c => c.caseworker === CURRENT_USER.id);
  const followups = [...vis].sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp)).slice(0, 5);
  const avgComplete = vis.length ? Math.round(vis.reduce((s, c) => s + c.completeness, 0) / vis.length) : 100;
  const docsBlocked = vApps.filter(a => Object.values(a.docs).some(v => v !== "verified"));
  const readyReview = vApps.filter(a => a.stage === "review" || a.stage === "decision");
  const issues = vis.filter(c => c.completeness < 100);
  const oldest = [...vApps].sort((a, b) => a.applied.localeCompare(b.applied))[0];
  const maxSrv = Math.max(...AGENCY.srvByDomain.map(d => d.count));

  return (
    <div data-screen-label="Dashboard">
      <div className="page-head">
        <div>
          <h1 className="page-h1">Good morning, <span className="red">{CURRENT_USER.name.split(" ")[0]}.</span></h1>
          <p className="lede">Tuesday, June 9, 2026 · {mine.length} active case{mine.length === 1 ? "" : "s"} · {readyReview.length} application{readyReview.length === 1 ? "" : "s"} awaiting decisions</p>
        </div>
        <button className="calv-btn calv-btn--ghost calv-btn--sm" onClick={() => go("reports")}>FY26 rollup preview <I name="arrow" size={14} /></button>
      </div>

      <div className="kpis">
        <Kpi kick="My active caseload" value={mine.length} foot={"across " + new Set(mine.flatMap(c => c.programs)).size + " programs"} />
        <Kpi kick="Pending applications" value={vApps.length} foot={docsBlocked.length + " waiting on documents"} tone="bad" accent="var(--calv-amber)" />
        <Kpi kick="Follow-ups due this week" value={4} foot="2 due today" accent="var(--calv-teal)" />
        <Kpi kick="CSBG data completeness" value={avgComplete + "%"} foot={issues.length + " records missing characteristics"} tone={avgComplete >= 90 ? "good" : "bad"} accent="var(--calv-sage)" />
      </div>

      <div className="row2">
        <Panel title="Follow-ups & outcome check-ins" sub="Scheduled FNPI outcome verifications and case-plan reviews, soonest first.">
          <table className="data">
            <thead><tr><th>Client</th><th>Program</th><th>Due</th><th>What</th><th></th></tr></thead>
            <tbody>
              {followups.map(c => {
                const overdue = c.nextFollowUp <= "2026-06-09";
                return (
                  <tr key={c.id} className="rowlink" onClick={() => openClient(c.id)}>
                    <td className="cname">{c.first} {c.last}</td>
                    <td><ProgramDot id={c.programs[0]} short /></td>
                    <td>{overdue ? <Chip tone="red">Due today</Chip> : new Date(c.nextFollowUp + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                    <td style={{ color: "var(--calv-slate-65)", maxWidth: 240 }}>{c.flags[0] || "Quarterly case-plan review"}</td>
                    <td style={{ textAlign: "right" }}><I name="arrow" size={14} style={{ color: "var(--calv-slate-35)" }} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <Panel title="Eligibility queue" sub="Applications by stage — clear documents to keep enrollments moving."
          right={<button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => go("eligibility")}>Open queue</button>}>
          {[
            { label: "Waiting on documents", n: vApps.filter(a => a.stage === "docs").length, tone: "amber" },
            { label: "Ready for review", n: vApps.filter(a => a.stage === "review").length, tone: "teal" },
            { label: "Awaiting decision", n: vApps.filter(a => a.stage === "decision").length, tone: "red" },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 2px", borderBottom: "1px solid var(--calv-slate-15)" }}>
              <span style={{ fontSize: 13 }}>{s.label}</span>
              <Chip tone={s.tone}>{s.n}</Chip>
            </div>
          ))}
          <div style={{ marginTop: 14, fontSize: 12, color: "var(--calv-slate-65)", lineHeight: 1.5 }}>
            {oldest ? <span><strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>Oldest:</strong> {oldest.first} {oldest.last} — applied {new Date(oldest.applied + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}, {programById(oldest.program).short}.</span> : "Queue is clear for your programs."}
          </div>
        </Panel>
      </div>

      <div className="row2">
        <Panel title="Agency pulse · services this FY" sub={"Unduplicated service counts by CSBG domain · " + fmt(AGENCY.individualsServed) + " individuals served"}>
          <div className="bars-h">
            {AGENCY.srvByDomain.map(d => {
              const dom = DOMAINS.find(x => x.id === d.domain);
              return (
                <div className="bar-h" key={d.domain}>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>{dom.name} <CodeChip code={dom.code} show={tweaks.showCodes} /></span>
                  <div className="track"><i style={{ width: (d.count / maxSrv * 100) + "%" }}></i></div>
                  <span className="v">{fmt(d.count)}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Data quality" sub="Records missing All Characteristics Report fields (Module 3, Sec. C).">
          {issues.slice(0, 4).map(c => (
            <div key={c.id} style={{ padding: "9px 2px", borderBottom: "1px solid var(--calv-slate-15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <a className="tlink" style={{ fontSize: 13, fontWeight: 600, textDecoration: "none" }} onClick={() => openClient(c.id)}>{c.first} {c.last}</a>
                <span style={{ fontSize: 11.5, color: "var(--calv-slate-65)" }}>{c.flags.filter(f => f.startsWith("Missing")).join(" · ") || "Partial demographics"}</span>
              </div>
              <Meter pct={c.completeness} />
            </div>
          ))}
          <div style={{ marginTop: 12 }}>
            <a className="tlink" style={{ fontSize: 12.5 }} onClick={() => go("reports")}>See how this affects the FY26 Annual Report →</a>
          </div>
        </Panel>
      </div>
    </div>
  );
}
window.ScreenDashboard = ScreenDashboard;
