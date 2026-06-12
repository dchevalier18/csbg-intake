// Reports — CSBG Annual Report rollup preview (Module 3)
function tally(list, keyFn, cats) {
  const m = Object.fromEntries(cats.map(c => [c, 0]));
  list.forEach(x => { const k = keyFn(x); if (m[k] !== undefined) m[k]++; else if (m["Other"] !== undefined) m["Other"]++; });
  return cats.map(c => ({ label: c, n: m[c] }));
}

function MiniTable({ title, code, rows, total, tweaks }) {
  const max = Math.max(1, ...rows.map(r => r.n));
  return (
    <Panel>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <h3 className="ptitle" style={{ fontSize: 15 }}>{title}</h3>
        <CodeChip code={code} show={tweaks.showCodes} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: "grid", gridTemplateColumns: "1fr 60px 32px", gap: 10, alignItems: "center", fontSize: 12.5 }}>
            <span style={{ color: "var(--calv-slate-65)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
            <div className="track" style={{ height: 10, background: "var(--calv-sand-15)", borderRadius: 2, overflow: "hidden" }}>
              <i style={{ display: "block", height: "100%", width: (r.n / max * 100) + "%", background: "var(--calv-teal)" }}></i>
            </div>
            <span style={{ fontFamily: "var(--font-h1)", fontSize: 13, textAlign: "right" }}>{r.n}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--calv-slate-15)", paddingTop: 7, marginTop: 3, fontSize: 12 }}>
          <span style={{ color: "var(--calv-slate-65)" }}>TOTAL</span>
          <span style={{ fontFamily: "var(--font-h1)", fontSize: 13 }}>{total}</span>
        </div>
      </div>
    </Panel>
  );
}

function ScreenReports({ toast, tweaks }) {
  const [tab, setTab] = useState("Characteristics");
  const n = CLIENTS.length;

  const ageCats = ["0-4", "5-17", "18-24", "25-34", "35-44", "45-64", "65-84", "85+"];
  const ageOf = (c) => { const a = c.age; return a <= 4 ? "0-4" : a <= 17 ? "5-17" : a <= 24 ? "18-24" : a <= 34 ? "25-34" : a <= 44 ? "35-44" : a <= 64 ? "45-64" : a <= 84 ? "65-84" : "85+"; };
  const maxSrv = Math.max(...AGENCY.srvByDomain.map(d => d.count));

  return (
    <div data-screen-label="Reports & CSBG rollup">
      <div className="page-head">
        <div>
          <h1 className="page-h1">The report writes <span className="red">itself.</span></h1>
          <p className="lede">Live FY26 rollup in CSBG Annual Report 3.0 format (OMB 0970-0492) — exactly what gets submitted to DCED each fall.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => toast("CSV export generated (prototype).")}>Export CSV</button>
          <button className="calv-btn calv-btn--primary calv-btn--sm" onClick={() => toast("Annual Report packet drafted — Module 3 Sections A, B & C (prototype).")}><I name="doc" size={13} /> Draft Annual Report</button>
        </div>
      </div>

      <div className="kpis">
        <Kpi kick="Individuals served (unduplicated)" value={fmt(AGENCY.individualsServed)} foot="Module 3 Sec. C, line A" />
        <Kpi kick="Households served (unduplicated)" value={fmt(AGENCY.householdsServed)} foot="Module 3 Sec. C, line B" accent="var(--calv-teal)" />
        <Kpi kick="New enrollments this FY" value={fmt(AGENCY.newThisFY)} accent="var(--calv-sage)" />
        <Kpi kick="Records report-ready" value="94%" foot="6% have Unknown / Not Reported fields" tone="bad" accent="var(--calv-amber)" />
      </div>

      <div className="toolbar">
        <Seg options={["Characteristics", "Services", "Outcomes (FNPI)"]} value={tab} onChange={setTab} />
        <span className="kbd-hint" style={{ marginLeft: "auto" }}>
          {tab === "Characteristics" ? "Sec. C — tallied live from the " + n + " records in this prototype" :
            tab === "Services" ? "Sec. A — unduplicated counts by service code" : "Sec. B — Individual & Family National Performance Indicators"}
        </span>
      </div>

      {tab === "Characteristics" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 13 }}>
          <MiniTable title="C1 · Sex" code="Sec. C1" tweaks={tweaks} total={n}
            rows={tally(CLIENTS, c => c.sex, ["Female", "Male"])} />
          <MiniTable title="C2 · Age" code="Sec. C2" tweaks={tweaks} total={n}
            rows={tally(CLIENTS, ageOf, ageCats).filter(r => r.n > 0)} />
          <MiniTable title="C6 · Race & ethnicity" code="Sec. C6" tweaks={tweaks} total={n}
            rows={tally(CLIENTS, c => c.race, ["Asian", "Black or African American", "Hispanic or Latino", "White", "Multiracial or Multiethnic"]).filter(r => r.n > 0)} />
          <MiniTable title="D9 · Household type" code="Sec. D9" tweaks={tweaks} total={n}
            rows={tally(CLIENTS, c => c.hhType, ["Single Person", "Two Adults no children", "Single Parent Female", "Two Parent Household"]).filter(r => r.n > 0)} />
          <MiniTable title="D11 · Housing" code="Sec. D11" tweaks={tweaks} total={n}
            rows={tally(CLIENTS, c => c.housing, ["Own", "Rent", "Homeless"]).filter(r => r.n > 0)} />
          <MiniTable title="D12 · Income level (% FPL)" code="Sec. D12" tweaks={tweaks} total={n}
            rows={tally(CLIENTS, c => FPL_BANDS[fplBand(fplPctFor(c.income, c.hhSize, c.fplYear))], FPL_BANDS).filter(r => r.n > 0)} />
        </div>
      ) : null}

      {tab === "Services" ? (
        <Panel title="Module 3, Section A — services by domain" sub="Unduplicated individuals served, FY26 to date. Click a domain in the full product to drill to service-code level.">
          <div className="bars-h" style={{ maxWidth: 760 }}>
            {AGENCY.srvByDomain.map(d => {
              const dom = DOMAINS.find(x => x.id === d.domain);
              return (
                <div className="bar-h" key={d.domain} style={{ gridTemplateColumns: "220px 1fr 70px" }}>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>{dom.name} <CodeChip code={dom.code} show={tweaks.showCodes} /></span>
                  <div className="track" style={{ height: 18 }}><i style={{ width: (d.count / maxSrv * 100) + "%" }}></i></div>
                  <span className="v">{fmt(d.count)}</span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: "var(--calv-slate-65)", marginTop: 16 }}>
            Top single services: SRV 5r food distribution packages ({fmt(8410)}) · SRV 4e utility payment assistance ({fmt(1890)}) · SDA 1c case management ({fmt(1620)}).
          </p>
        </Panel>
      ) : null}

      {tab === "Outcomes (FNPI)" ? (
        <Panel title="Module 3, Section B — Individual & Family NPIs" sub="Actuals vs FY26 targets. 'Achieving outcome' = actual ÷ number served; 'target accuracy' = actual ÷ target.">
          <table className="data">
            <thead><tr><th>Indicator</th><th className="num">Served</th><th className="num">Target</th><th className="num">Actual</th><th className="num">% achieving</th><th style={{ width: 170 }}>Target accuracy</th><th>Pace</th></tr></thead>
            <tbody>
              {FNPI.map(f => {
                const achieving = Math.round(f.actual / f.served * 100);
                const acc = Math.round(f.actual / f.target * 100);
                const onPace = acc >= FY.pctElapsed - 5;
                return (
                  <tr key={f.code}>
                    <td><div style={{ display: "flex", gap: 8, alignItems: "center" }}><CodeChip code={f.code} show={tweaks.showCodes} /><span style={{ maxWidth: 330, display: "inline-block" }}>{f.label}</span></div></td>
                    <td className="num">{fmt(f.served)}</td>
                    <td className="num" style={{ color: "var(--calv-slate-65)" }}>{fmt(f.target)}</td>
                    <td className="num">{fmt(f.actual)}</td>
                    <td className="num">{achieving}%</td>
                    <td><Meter pct={Math.min(acc, 100)} tone={onPace ? "" : "warn"} /></td>
                    <td>{onPace ? <Chip tone="sage">On pace</Chip> : <Chip tone="amber">Behind</Chip>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: "var(--calv-slate-65)", marginTop: 14 }}>
            {FY.pctElapsed}% of the FY has elapsed — indicators under {FY.pctElapsed - 5}% of target are flagged so program managers can act before September 30, not after.
          </p>
        </Panel>
      ) : null}
    </div>
  );
}
window.ScreenReports = ScreenReports;
