// Housing Counseling seminars + CA Homes construction projects
function ScreenSeminars({ toast, tweaks }) {
  if (!userHasCap("seminars")) return <Restricted what="seminar tools" />;
  const [open, setOpen] = useState(SEMINARS[0].id);
  const sem = SEMINARS.find(s => s.id === open);
  const INTAKE_CHIP = {
    "enrolled": <Chip tone="sage">Enrolled client</Chip>,
    "in-progress": <Chip tone="amber">Intake in progress</Chip>,
    "not-started": <Chip tone="red">Not started</Chip>,
  };
  return (
    <div data-screen-label="Housing Counseling seminars">
      <div className="page-head">
        <div>
          <h1 className="page-h1">Seminars<span className="red">.</span></h1>
          <p className="lede">Housing Counseling workshops — every attendee can flow into intake on the spot, so group services still produce client-level CSBG data.</p>
        </div>
        <button className="calv-btn calv-btn--secondary calv-btn--sm" onClick={() => toast("Seminar created (prototype).")}><I name="plus" size={14} /> New seminar</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "330px 1fr", gap: 13, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {SEMINARS.map(s => (
            <button key={s.id} onClick={() => setOpen(s.id)}
              style={{
                textAlign: "left", background: "#fff", borderRadius: 4, padding: "14px 16px", cursor: "pointer",
                border: s.id === open ? "1.5px solid var(--calv-red)" : "1px solid var(--calv-slate-15)",
                boxShadow: s.id === open ? "var(--shadow-md)" : "none", fontFamily: "var(--font-body)",
              }}>
              <div style={{ fontFamily: "var(--font-sub)", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: ".02em", color: "var(--calv-slate)", marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: "var(--calv-slate-65)", marginBottom: 8 }}>{new Date(s.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {s.time}<br />{s.site}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div className="meter" style={{ flex: 1 }}><i style={{ width: (s.registered / s.capacity * 100) + "%", background: "var(--calv-teal)" }}></i></div>
                <span style={{ fontFamily: "var(--font-h1)", fontSize: 12 }}>{s.registered}/{s.capacity}</span>
              </div>
            </button>
          ))}
        </div>

        <Panel title={sem.title} sub={new Date(sem.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) + " · " + sem.time + " · " + sem.site}
          right={<CodeChip code={sem.srv} show={tweaks.showCodes} />}>
          {sem.attendees.length === 0 ? (
            <div className="empty">Roster opens when registration closes — {sem.registered} registered so far.</div>
          ) : (
            <table className="data">
              <thead><tr><th>Attendee</th><th>Client status</th><th></th></tr></thead>
              <tbody>
                {sem.attendees.map(a => (
                  <tr key={a.name}>
                    <td className="cname">{a.name}</td>
                    <td>{INTAKE_CHIP[a.intake]}</td>
                    <td style={{ textAlign: "right" }}>
                      {a.intake === "not-started" ? <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => toast("Quick intake opened for " + a.name + " — pre-filled from registration.")}>Start intake</button> :
                        a.intake === "in-progress" ? <span style={{ fontSize: 12, color: "var(--calv-slate-65)" }}>In eligibility queue ({a.applicantId})</span> :
                          <span style={{ fontSize: 12, color: "var(--calv-slate-65)" }}>Attendance will post as {sem.srv}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ marginTop: 14, background: "var(--calv-sand-15)", border: "1px solid var(--calv-sand-35)", borderRadius: 4, padding: "10px 14px", fontSize: 12.5, lineHeight: 1.55 }}>
            After the session, mark attendance once — each attendee with a client record gets a {sem.srv} entry; the rest are prompted through quick intake or counted as anonymous outreach.
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ---------- CA Homes: construction project management ----------
function ScreenHomes({ toast, tweaks }) {
  if (!userHasCap("construction")) return <Restricted what="construction projects" />;
  return (
    <div data-screen-label="CA Homes projects">
      <div className="page-head">
        <div>
          <h1 className="page-h1">CA Homes <span className="red">projects.</span></h1>
          <p className="lede">Affordable-homeownership construction — milestones, budgets, and the federal compliance paperwork each funding source demands.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
        {HOMES_PROJECTS.map(p => (
          <Panel key={p.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div>
                <h3 className="ptitle" style={{ fontSize: 17 }}>{p.name}</h3>
                <p className="psub" style={{ margin: "2px 0 0" }}>{p.town} · {p.buyer}</p>
              </div>
              <Chip tone="sage">{p.pct}% complete</Chip>
            </div>

            <div style={{ display: "flex", gap: 14, alignItems: "baseline", margin: "12px 0 6px" }}>
              <span style={{ fontFamily: "var(--font-h1)", fontSize: 26 }}>{money(p.spent)}</span>
              <span style={{ fontSize: 12.5, color: "var(--calv-slate-65)" }}>of {money(p.budget)} budget</span>
            </div>
            <div className="meter" style={{ marginBottom: 18 }}><i style={{ width: (p.spent / p.budget * 100) + "%", background: "var(--calv-teal)" }}></i></div>

            <h4 className="calv-label" style={{ marginBottom: 8 }}>Milestones</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 18 }}>
              {p.milestones.map((m, i) => (
                <div key={m.label} style={{ display: "flex", gap: 10, alignItems: "center", padding: "5px 0", fontSize: 13 }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 99, flex: "none", display: "flex", alignItems: "center", justifyContent: "center",
                    background: m.done ? "var(--calv-sage)" : m.current ? "var(--calv-amber)" : "var(--calv-slate-15)",
                    color: m.done || m.current ? "#fff" : "var(--calv-slate-65)",
                  }}>{m.done ? <I name="check" size={11} /> : <span style={{ fontFamily: "var(--font-h1)", fontSize: 10 }}>{i + 1}</span>}</span>
                  <span style={{ color: m.done ? "var(--calv-slate)" : m.current ? "var(--calv-slate)" : "var(--calv-slate-65)", fontWeight: m.current ? 600 : 300 }}>
                    {m.label}{m.current ? " — in progress" : ""}
                  </span>
                </div>
              ))}
            </div>

            <h4 className="calv-label" style={{ marginBottom: 8 }}>Compliance requirements</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {p.requirements.map(r => (
                <div key={r.label} style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", padding: "8px 12px", border: "1px solid var(--calv-slate-15)", borderRadius: 4, fontSize: 12.5 }}>
                  {r.label}
                  {r.status === "current" ? <Chip tone="sage">Current</Chip> :
                    <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Chip tone="amber">Due</Chip>
                      <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => toast("Requirement task assigned (prototype).")}>Assign</button>
                    </span>}
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
Object.assign(window, { ScreenSeminars, ScreenHomes });
