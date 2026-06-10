"use client";
/* Generation Next attendance — tap-to-cycle roster (Today column), post-day action.
   Pure client interactivity over serializable props; every tap persists via setMark(). */
import { useState } from "react";
import Link from "next/link";
import { CodeChip, Kpi, Panel } from "@/components/ui";
import { I } from "@/components/icons";
import { useToast } from "@/components/toast";
import { postAttendance, setMark } from "./actions";

export type Mark = "p" | "a" | "e" | null;

interface Student {
  id: string; name: string; clientId: string | null;
  grade: string; school: string; termPct: number;
}
interface Session { id: string; date: string; label: string; posted: boolean }

const MARK: Record<"p" | "a" | "e", { label: string; title: string; bg: string; fg: string; bd: string }> = {
  p: { label: "P", title: "Present", bg: "var(--calv-sage-15)", fg: "#2F5A41", bd: "var(--calv-sage-35)" },
  a: { label: "A", title: "Absent", bg: "var(--calv-red-15)", fg: "var(--calv-red)", bd: "var(--calv-red-35)" },
  e: { label: "E", title: "Excused", bg: "var(--calv-amber-15)", fg: "#8A6410", bd: "var(--calv-amber-35)" },
};

const nextMark = (v: Mark): Mark => (v === null ? "p" : v === "p" ? "a" : v === "a" ? "e" : null);

export function AttendanceClient({ programName, cls, students, sessions, todaySessionId, marks }: {
  programName: string;
  cls: { id: string; name: string; site: string; schedule: string; srvCode: string };
  students: Student[];
  sessions: Session[];
  todaySessionId: string | null;
  marks: Record<string, Record<string, Mark>>;
}) {
  const toast = useToast();
  const [today, setToday] = useState<Record<string, Mark>>(() =>
    Object.fromEntries(students.map((s) => [s.id, todaySessionId ? (marks[s.id]?.[todaySessionId] ?? null) : null])));
  const [posting, setPosting] = useState(false);

  const words = programName.split(" ");
  const lead = words.slice(0, -1).join(" ");
  const accentWord = words[words.length - 1];

  function markFor(studentId: string, sessionId: string): Mark {
    if (todaySessionId && sessionId === todaySessionId) return today[studentId] ?? null;
    return marks[studentId]?.[sessionId] ?? null;
  }

  // Term % = present / (present + absent) — excused and unmarked count nothing;
  // falls back to the stored term percentage when a student has no P/A data yet.
  function termFor(st: Student): number {
    let p = 0, a = 0;
    for (const sess of sessions) {
      const v = markFor(st.id, sess.id);
      if (v === "p") p++;
      else if (v === "a") a++;
    }
    return p + a > 0 ? Math.round((100 * p) / (p + a)) : st.termPct;
  }

  function cycle(studentId: string) {
    if (!todaySessionId) return;
    const next = nextMark(today[studentId] ?? null);
    setToday((prev) => ({ ...prev, [studentId]: next }));
    setMark(todaySessionId, studentId, next).then((res) => { if (!res.ok) toast(res.message); });
  }

  const todayTaken = todaySessionId
    ? students.filter((s) => (today[s.id] ?? null) !== null).length
    : students.length;
  const canPost = !!todaySessionId && todayTaken === students.length && !posting;
  const terms = students.map((s) => termFor(s));
  const termAvg = students.length
    ? Math.round(terms.reduce((sum, v) => sum + v, 0) / students.length)
    : 0;
  const under85 = students.filter((_, i) => terms[i] < 85);

  async function submitToday() {
    if (!todaySessionId || !canPost) return;
    setPosting(true);
    const res = await postAttendance(todaySessionId);
    setPosting(false);
    toast(res.message);
  }

  return (
    <div data-screen-label="Generation Next attendance">
      <div style={{ marginBottom: 12 }}>
        <a className="tlink" style={{ fontSize: 12.5, textDecoration: "none", cursor: "pointer" }} onClick={() => history.back()}>← Back</a>
      </div>

      <div className="page-head">
        <div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <h1 className="page-h1">{lead ? lead + " " : ""}<span style={{ color: "#C7910F" }}>{accentWord}.</span></h1>
            <span style={{ fontFamily: "var(--font-h3)", fontSize: 30, color: "var(--calv-slate-65)", letterSpacing: "-0.06em", transform: "rotate(-2deg)", display: "inline-block", marginTop: 4 }}>summer is just getting started.</span>
          </div>
          <p className="lede">{cls.name} · {cls.site} · {cls.schedule}</p>
        </div>
        <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={!canPost}
          style={!canPost ? { opacity: 0.45, cursor: "not-allowed" } : undefined} onClick={submitToday}>
          <I name="check" size={14} /> Post today&apos;s attendance
        </button>
      </div>

      <div className="kpis">
        <Kpi kick="Enrolled students" value={students.length} accent="var(--calv-amber)" />
        <Kpi kick="Today marked" value={todayTaken + " / " + students.length}
          foot={todaySessionId ? (todayTaken < students.length ? "tap the Today column to mark" : "ready to post") : "all recent sessions posted"}
          accent="var(--calv-amber)" />
        <Kpi kick="Term attendance" value={termAvg + "%"}
          foot={termAvg >= 85 ? "target 85% — on track" : "target 85% — below target"}
          tone={termAvg >= 85 ? "good" : "bad"} accent="var(--calv-sage)" />
        <Kpi kick="Students under 85%" value={under85.length}
          foot={under85.length ? under85.map((s) => s.name).join(" · ") : "everyone at or above target"}
          tone={under85.length ? "bad" : "good"} accent="var(--calv-red)" />
      </div>

      <Panel title="Roster · this week" sub={"Tap a cell in the Today column to cycle Present → Absent → Excused. Past sessions are read-only. Every posted session counts each student once under " + cls.srvCode + "."}>
        <table className="data">
          <thead><tr>
            <th>Student</th><th>Grade · school</th>
            {sessions.map((s) => (
              <th key={s.id} style={{ textAlign: "center", background: s.id === todaySessionId ? "var(--calv-amber-15)" : "transparent" }}>
                {s.id === todaySessionId ? "Today" : s.label}
              </th>
            ))}
            <th className="num">Term %</th>
          </tr></thead>
          <tbody>
            {students.map((st, i) => (
              <tr key={st.id}>
                <td className="cname">{st.name}
                  {st.clientId ? <div style={{ fontFamily: "var(--font-body)", fontWeight: 300, fontSize: 11, textTransform: "none" }}><Link className="tlink" href={"/clients/" + st.clientId}>household record {st.clientId}</Link></div> : null}
                </td>
                <td style={{ color: "var(--calv-slate-65)" }}>{st.grade} · {st.school}</td>
                {sessions.map((sess) => {
                  const v = markFor(st.id, sess.id);
                  const isToday = sess.id === todaySessionId;
                  const m = v ? MARK[v] : null;
                  return (
                    <td key={sess.id} style={{ textAlign: "center", background: isToday ? "var(--calv-amber-15)" : "transparent" }}>
                      {isToday ? (
                        <button onClick={() => cycle(st.id)} title={m ? m.title : "Not marked — tap to mark"}
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
                <td className="num" style={{ color: terms[i] < 85 ? "var(--calv-red)" : "inherit" }}>{terms[i]}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 12, color: "var(--calv-slate-65)" }}>
          {(Object.keys(MARK) as Array<"p" | "a" | "e">).map((k) => {
            const m = MARK[k];
            return (
              <span key={k} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <span style={{ width: 20, height: 18, borderRadius: 3, background: m.bg, color: m.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-h1)", fontSize: 11 }}>{m.label}</span>
                {m.title}
              </span>
            );
          })}
          <span style={{ marginLeft: "auto" }}>Attendance posts to the service log as <CodeChip code={cls.srvCode} /></span>
        </div>
      </Panel>
    </div>
  );
}
