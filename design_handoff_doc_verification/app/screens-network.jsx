// Second Harvest pantry network + cross-program volunteer tracking
function ScreenShfb({ toast, tweaks }) {
  if (!userHasCap("pantry")) return <Restricted what="the pantry network" />;
  const [agencies, setAgencies] = useState(PANTRY_AGENCIES);
  const received = SHFB_STATS.reportsThisMonth.received;
  const missing = SHFB_STATS.reportsThisMonth.missing;

  function remindAll() {
    toast("Reminder sent to " + agencies.filter(a => a.mayReport === "missing").length + " agencies with missing May reports.");
  }
  function enterFor(a) {
    setAgencies(prev => prev.map(x => x.id === a.id ? { ...x, mayReport: "received", households: 240, lbs: 9800 } : x));
    toast("Aggregate report entered for " + a.name + " — rolls into SRV 5r totals.");
  }

  return (
    <div data-screen-label="Second Harvest pantry network">
      <div className="page-head">
        <div>
          <h1 className="page-h1">Pantry <span className="red">network.</span></h1>
          <p className="lede">Second Harvest member agencies across 6 counties — monthly aggregate reports roll into the CSBG food-distribution totals.</p>
        </div>
        <button className="calv-btn calv-btn--secondary calv-btn--sm" onClick={remindAll}><I name="bell" size={14} /> Remind missing</button>
      </div>

      <div className="kpis">
        <Kpi kick="Member agencies" value={SHFB_STATS.agencies} foot={SHFB_STATS.countiesServed + " counties"} accent="#8A6410" />
        <Kpi kick="May reports received" value={received + " / " + (received + missing)} foot={missing + " outstanding — due Jun 15"} tone={missing > 0 ? "bad" : "good"} accent="var(--calv-amber)" />
        <Kpi kick="Pounds distributed YTD" value="14.6M" accent="var(--calv-teal)" />
        <Kpi kick="Meals YTD" value="8.1M" foot="feeds FNPI 5j food security" accent="var(--calv-sage)" />
      </div>

      <Panel title="Member agencies · May reporting" sub="Sample of the network — aggregate household counts and pounds reported by each pantry. Missing reports leave holes in the federal rollup.">
        <table className="data">
          <thead><tr><th>Agency</th><th>Location</th><th>Contact</th><th>May report</th><th className="num">Households</th><th className="num">Pounds</th><th>Compliance</th><th></th></tr></thead>
          <tbody>
            {agencies.map(a => (
              <tr key={a.id}>
                <td className="cname">{a.name}<div style={{ fontFamily: "var(--font-body)", fontWeight: 300, fontSize: 11.5, color: "var(--calv-slate-65)", textTransform: "none" }}>{a.id}</div></td>
                <td>{a.town}<div style={{ fontSize: 11.5, color: "var(--calv-slate-65)" }}>{a.county} Co.</div></td>
                <td style={{ whiteSpace: "nowrap" }}>{a.contact}<div style={{ fontSize: 11.5, color: "var(--calv-slate-65)" }}>{a.phone}</div></td>
                <td>{a.mayReport === "received" ? <Chip tone="sage">Received</Chip> : <Chip tone="red">Missing</Chip>}</td>
                <td className="num">{a.households != null ? fmt(a.households) : "—"}</td>
                <td className="num">{a.lbs != null ? fmt(a.lbs) : "—"}</td>
                <td>{a.compliance === "current" ? <Chip>Current</Chip> : <Chip tone="amber">Site visit due</Chip>}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {a.mayReport === "missing" ? <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => enterFor(a)}>Enter report</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

// ---------- Volunteers (Module 2, B.1) ----------
function ScreenVolunteers({ openClient, toast, tweaks }) {
  if (!userHasCap("volunteers")) return <Restricted what="volunteer tracking" />;
  const pctLow = Math.round(VOL_STATS.lowIncomeHoursFY / VOL_STATS.totalHoursFY * 100);
  return (
    <div data-screen-label="Volunteer tracking">
      <div className="page-head">
        <div>
          <h1 className="page-h1">Volunteers<span className="red">.</span></h1>
          <p className="lede">Hours roll straight into Module 2, Section B.1 — including the federally-required split for hours donated by people with low incomes.</p>
        </div>
        <button className="calv-btn calv-btn--primary calv-btn--sm" onClick={() => toast("Shift logged — hours added to the Module 2 rollup (prototype).")}><I name="plus" size={14} /> Log shift</button>
      </div>

      <div className="kpis">
        <Kpi kick="Active volunteers" value={fmt(VOL_STATS.activeVolunteers)} accent="var(--calv-teal)" />
        <Kpi kick="Hours donated this FY" value={fmt(VOL_STATS.totalHoursFY)} foot="Module 2 · B.1a" accent="var(--calv-teal)" />
        <Kpi kick="Hours by people with low incomes" value={fmt(VOL_STATS.lowIncomeHoursFY)} foot={"B.1a.1 · " + pctLow + "% of all hours"} accent="var(--calv-sage)" />
        <Kpi kick="Value of volunteer time" value="$397K" foot="@ $33.49/hr Independent Sector rate" accent="var(--calv-amber)" />
      </div>

      <Panel title="Volunteer roster" sub="Volunteers who are also enrolled clients link to their household record — their hours count toward B.1a.1 automatically.">
        <table className="data">
          <thead><tr><th>Volunteer</th><th>Role</th><th>Programs</th><th className="num">Hours FY26</th><th>Low-income hours?</th><th>Last shift</th></tr></thead>
          <tbody>
            {VOLUNTEERS.map(v => (
              <tr key={v.id}>
                <td className="cname">{v.name}
                  {v.clientId ? <div style={{ fontFamily: "var(--font-body)", fontWeight: 300, fontSize: 11, textTransform: "none" }}><a className="tlink" onClick={() => openClient(v.clientId)}>client record {v.clientId}</a></div> : null}
                </td>
                <td>{v.role}</td>
                <td><div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{v.programs.map(p => <ProgramDot key={p} id={p} short />)}</div></td>
                <td className="num">{v.hoursFY}</td>
                <td>{v.lowIncome ? <Chip tone="sage">Yes — counts in B.1a.1</Chip> : <Chip>No</Chip>}</td>
                <td>{new Date(v.lastShift + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
Object.assign(window, { ScreenShfb, ScreenVolunteers });
