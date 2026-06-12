// Weatherization — contractor records + job pipeline
function ScreenWx({ openClient, toast, tweaks }) {
  if (!userHasCap("contractors")) return <Restricted what="weatherization tools" />;
  const [tab, setTab] = useState("Jobs");
  const stageIdx = (s) => WX_STAGES.findIndex(x => x.id === s);

  return (
    <div data-screen-label="Weatherization">
      <div className="page-head">
        <div>
          <h1 className="page-h1">Weatherization<span className="red">.</span></h1>
          <p className="lede">Job pipeline from audit to QC, plus the contractor records that keep DOE monitors happy.</p>
        </div>
        <Seg options={["Jobs", "Contractors"]} value={tab} onChange={setTab} />
      </div>

      <div className="kpis">
        <Kpi kick="Active jobs" value={WX_JOBS.filter(j => j.stage !== "complete").length} accent="var(--calv-sage)" />
        <Kpi kick="Units completed this FY" value="96" foot="FNPI 4f — households improved energy efficiency" accent="var(--calv-sage)" />
        <Kpi kick="Avg days audit → QC" value="38" foot="DOE target 45 — ahead" tone="good" accent="var(--calv-teal)" />
        <Kpi kick="Credentials expiring ≤ 60 days" value="2" foot="Lehigh HVAC insurance · Valley Window BPI" tone="bad" accent="var(--calv-amber)" />
      </div>

      {tab === "Jobs" ? (
        <Panel title="Job pipeline" sub="Each completed job posts SRV 4g for the household and rolls into FNPI 4f outcomes.">
          <table className="data">
            <thead><tr><th>Job</th><th>Household</th><th>Stage</th><th style={{ minWidth: 170 }}>Progress</th><th>Contractor</th><th>Funding</th><th>Measures</th></tr></thead>
            <tbody>
              {WX_JOBS.map(j => {
                const idx = stageIdx(j.stage);
                const ctr = WX_CONTRACTORS.find(c => c.id === j.contractor);
                return (
                  <tr key={j.id}>
                    <td className="cname">{j.id}</td>
                    <td>{j.clientId ? <a className="tlink" style={{ textDecoration: "none", fontWeight: 600 }} onClick={() => openClient(j.clientId)}>{j.client}</a> : j.client}
                      <div style={{ fontSize: 11.5, color: "var(--calv-slate-65)" }}>{j.address}</div></td>
                    <td><Chip tone={j.stage === "complete" ? "sage" : j.stage === "qc" ? "teal" : j.stage === "install" ? "amber" : ""}>{WX_STAGES[idx].label}</Chip></td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        {WX_STAGES.map((s, i) => (
                          <span key={s.id} title={s.label} style={{ flex: 1, height: 6, borderRadius: 99, background: i <= idx ? "var(--calv-sage)" : "var(--calv-slate-15)" }}></span>
                        ))}
                      </div>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{ctr ? ctr.name : "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{j.funding}</td>
                    <td style={{ color: "var(--calv-slate-65)", maxWidth: 250 }}>{j.measures}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      ) : (
        <Panel title="Contractor records" sub="Insurance, BPI certification, and EPA RRP (lead-safe) expirations tracked per contractor — expiring credentials block new job assignments.">
          <table className="data">
            <thead><tr><th>Contractor</th><th>Trade</th><th className="num">Crews</th><th className="num">Active jobs</th><th>Insurance exp.</th><th>BPI cert exp.</th><th>EPA RRP exp.</th><th className="num">QC pass rate</th><th></th></tr></thead>
            <tbody>
              {WX_CONTRACTORS.map(c => {
                const expSoon = (d) => d <= "2026-08-09";
                const DateCell = ({ d }) => (
                  <td style={{ whiteSpace: "nowrap" }}>
                    {expSoon(d) ? <Chip tone="amber">{new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}</Chip>
                      : new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                  </td>
                );
                return (
                  <tr key={c.id}>
                    <td className="cname">{c.name}<div style={{ fontFamily: "var(--font-body)", fontWeight: 300, fontSize: 11.5, color: "var(--calv-slate-65)", textTransform: "none" }}>{c.phone}</div></td>
                    <td>{c.trade}</td>
                    <td className="num">{c.crews}</td>
                    <td className="num">{c.activeJobs}</td>
                    <DateCell d={c.insurance} />
                    <DateCell d={c.bpi} />
                    <DateCell d={c.epaRrp} />
                    <td className="num" style={{ color: c.qcPass >= 95 ? "#2F5A41" : "inherit" }}>{c.qcPass}%</td>
                    <td><button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => toast("Renewal reminder sent to " + c.name + " (prototype).")}>Remind</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
window.ScreenWx = ScreenWx;
