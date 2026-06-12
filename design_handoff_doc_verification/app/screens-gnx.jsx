// Generation Next — classroom attendance (youth program: amber accent, H3 brush allowed)
function ScreenGnx({ openClient, toast, tweaks }) {
  if (!userHasCap("attendance")) return <Restricted what="attendance tools" />;
  const [marks, setMarks] = useState(() => Object.fromEntries(GNX_STUDENTS.map(s => [s.id, { ...s.marks }])));
  const CYCLE = { null: "p", p: "a", a: "e", e: null };
  const MARK = {
    p: { label: "P", title: "Present", bg: "var(--calv-sage-15)", fg: "#2F5A41", bd: "var(--calv-sage-35)" },
    a: { label: "A", title: "Absent", bg: "var(--calv-red-15)", fg: "var(--calv-red)", bd: "var(--calv-red-35)" },
    e: { label: "E", title: "Excused", bg: "var(--calv-amber-15)", fg: "#8A6410", bd: "var(--calv-amber-35)" },
  };
  function cycle(sid, sess) {
    setMarks(prev => ({ ...prev, [sid]: { ...prev[sid], [sess]: CYCLE[prev[sid][sess]] } }));
  }
  const todayTaken = GNX_STUDENTS.filter(s => marks[s.id].s5 !== null).length;
  const presentToday = GNX_STUDENTS.filter(s => marks[s.id].s5 === "p").length;

  function submitToday() {
    toast("Attendance posted — " + presentToday + " present logged as " + GNX_CLASS.srv + " (before/after-school activities).");
  }

  return (
    <div data-screen-label="Generation Next attendance">
      <div className="page-head">
        <div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <h1 className="page-h1">Generation <span style={{ color: "#C7910F" }}>Next.</span></h1>
            <span style={{ fontFamily: "var(--font-h3)", fontSize: 30, color: "var(--calv-slate-65)", letterSpacing: "-0.06em", transform: "rotate(-2deg)", display: "inline-block", marginTop: 4 }}>summer is just getting started.</span>
          </div>
          <p className="lede">{GNX_CLASS.name} · {GNX_CLASS.site} · {GNX_CLASS.schedule}</p>
        </div>
        <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={todayTaken < GNX_STUDENTS.length}
          style={todayTaken < GNX_STUDENTS.length ? { opacity: .45, cursor: "not-allowed" } : null} onClick={submitToday}>
          <I name="check" size={14} /> Post today's attendance
        </button>
      </div>

      <div className="kpis">
        <Kpi kick="Enrolled students" value={GNX_STUDENTS.length} accent="var(--calv-amber)" />
        <Kpi kick="Today marked" value={todayTaken + " / " + GNX_STUDENTS.length} foot={todayTaken < GNX_STUDENTS.length ? "tap the Today column to mark" : "ready to post"} accent="var(--calv-amber)" />
        <Kpi kick="Term attendance" value="91%" foot="target 85% — on track" tone="good" accent="var(--calv-sage)" />
        <Kpi kick="Students under 85%" value="1" foot="Marcus Boyd — outreach call logged 6/5" tone="bad" accent="var(--calv-red)" />
      </div>

      <Panel title="Roster · this week" sub="Tap a cell in the Today column to cycle Present → Absent → Excused. Past sessions are read-only. Every posted session counts each student once under SRV 2h.">
        <table className="data">
          <thead><tr>
            <th>Student</th><th>Grade · school</th>
            {GNX_SESSIONS.map(s => <th key={s.id} style={{ textAlign: "center", background: s.id === "s5" ? "var(--calv-amber-15)" : "transparent" }}>{s.label}</th>)}
            <th className="num">Term %</th>
          </tr></thead>
          <tbody>
            {GNX_STUDENTS.map(st => (
              <tr key={st.id}>
                <td className="cname">{st.name}
                  {st.clientId ? <div style={{ fontFamily: "var(--font-body)", fontWeight: 300, fontSize: 11, textTransform: "none" }}><a className="tlink" onClick={() => openClient(st.clientId)}>household record {st.clientId}</a></div> : null}
                </td>
                <td style={{ color: "var(--calv-slate-65)" }}>{st.grade} · {st.school}</td>
                {GNX_SESSIONS.map(sess => {
                  const v = marks[st.id][sess.id];
                  const isToday = sess.id === "s5";
                  const m = v ? MARK[v] : null;
                  return (
                    <td key={sess.id} style={{ textAlign: "center", background: isToday ? "var(--calv-amber-15)" : "transparent" }}>
                      {isToday ? (
                        <button onClick={() => cycle(st.id, sess.id)} title={m ? m.title : "Not marked — tap to mark"}
                          style={{
                            width: 34, height: 30, borderRadius: 4, cursor: "pointer",
                            fontFamily: "var(--font-h1)", fontSize: 14, letterSpacing: ".02em",
                            background: m ? m.bg : "#fff", color: m ? m.fg : "var(--calv-slate-35)",
                            border: "1.5px " + (m ? "solid " + m.bd : "dashed var(--calv-slate-35)"),
                          }}>{m ? m.label : "·"}</button>
                      ) : (
                        <span style={{
                          display: "inline-flex", width: 30, height: 26, alignItems: "center", justifyContent: "center",
                          borderRadius: 4, fontFamily: "var(--font-h1)", fontSize: 13,
                          background: m ? m.bg : "transparent", color: m ? m.fg : "var(--calv-slate-35)",
                        }}>{m ? m.label : "—"}</span>
                      )}
                    </td>
                  );
                })}
                <td className="num" style={{ color: st.term < 85 ? "var(--calv-red)" : "inherit" }}>{st.term}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 12, color: "var(--calv-slate-65)" }}>
          {Object.entries(MARK).map(([k, m]) => (
            <span key={k} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <span style={{ width: 20, height: 18, borderRadius: 3, background: m.bg, color: m.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-h1)", fontSize: 11 }}>{m.label}</span>
              {m.title}
            </span>
          ))}
          <span style={{ marginLeft: "auto" }}>Attendance posts to the service log as <span className="code-chip">{GNX_CLASS.srv}</span></span>
        </div>
      </Panel>
    </div>
  );
}
window.ScreenGnx = ScreenGnx;
