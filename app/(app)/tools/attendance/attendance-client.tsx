"use client";
/* Attendance — tap-to-cycle roster (Today column), post-day action, plus class
   management: create classes, enroll students, open today's session.
   Pure client interactivity over serializable props; every tap persists via setMark(). */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CodeChip, Empty, Field, Kpi, Panel } from "@/components/ui";
import { Modal } from "@/components/ui-client";
import { I } from "@/components/icons";
import { useToast } from "@/components/toast";
import { addStudent, createClass, postAttendance, setMark, startSession } from "./actions";

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

const emptyClass = { programId: "", name: "", site: "", schedule: "", srvCode: "SRV 2h" };
const emptyStudent = { name: "", grade: "", school: "", clientId: "" };

export function AttendanceClient({ programName, programs, classes, clients, cls, students, sessions, todaySessionId, marks, today }: {
  programName: string;
  programs: { id: string; name: string }[];
  classes: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  cls: { id: string; name: string; site: string; schedule: string; srvCode: string } | null;
  students: Student[];
  sessions: Session[];
  todaySessionId: string | null;
  marks: Record<string, Record<string, Mark>>;
  today: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [todayMarks, setTodayMarks] = useState<Record<string, Mark>>(() =>
    Object.fromEntries(students.map((s) => [s.id, todaySessionId ? (marks[s.id]?.[todaySessionId] ?? null) : null])));
  const [posting, setPosting] = useState(false);
  const [classModal, setClassModal] = useState(false);
  const [studentModal, setStudentModal] = useState(false);
  const [classForm, setClassForm] = useState(emptyClass);
  const [studentForm, setStudentForm] = useState(emptyStudent);
  const [busy, setBusy] = useState(false);

  const words = programName.split(" ");
  const lead = words.slice(0, -1).join(" ");
  const accentWord = words[words.length - 1];

  function markFor(studentId: string, sessionId: string): Mark {
    if (todaySessionId && sessionId === todaySessionId) return todayMarks[studentId] ?? null;
    return marks[studentId]?.[sessionId] ?? null;
  }

  // Term % is the student's whole-term attendance record (stored on the roster) —
  // NOT recomputed from the handful of sessions displayed here, which would
  // misreport the metric this tool exists to flag (students under the 85% target).
  function termFor(st: Student): number {
    return st.termPct;
  }

  function cycle(studentId: string) {
    if (!todaySessionId) return;
    const next = nextMark(todayMarks[studentId] ?? null);
    setTodayMarks((prev) => ({ ...prev, [studentId]: next }));
    setMark(todaySessionId, studentId, next).then((res) => { if (!res.ok) toast(res.message); });
  }

  const todayTaken = todaySessionId
    ? students.filter((s) => (todayMarks[s.id] ?? null) !== null).length
    : students.length;
  const canPost = !!todaySessionId && todayTaken === students.length && !posting;
  const terms = students.map((s) => termFor(s));
  const termAvg = students.length
    ? Math.round(terms.reduce((sum, v) => sum + v, 0) / students.length)
    : 0;
  const under85 = students.filter((_, i) => terms[i] < 85);
  const hasTodaySession = sessions.some((s) => s.date === today);

  async function submitToday() {
    if (!todaySessionId || !canPost) return;
    setPosting(true);
    const res = await postAttendance(todaySessionId);
    setPosting(false);
    toast(res.message);
  }

  async function submitStartSession() {
    if (!cls || busy) return;
    setBusy(true);
    const res = await startSession(cls.id);
    setBusy(false);
    toast(res.message);
  }

  function openNewClass() {
    setClassForm({ ...emptyClass, programId: programs[0]?.id ?? "" });
    setClassModal(true);
  }
  const canCreateClass = classForm.name.trim().length > 0 && Boolean(classForm.programId);
  async function submitClass() {
    if (!canCreateClass || busy) return;
    setBusy(true);
    const res = await createClass(classForm);
    setBusy(false);
    toast(res.message);
    if (res.ok) {
      setClassModal(false);
      if (res.id) router.push("/tools/attendance?class=" + res.id);
    }
  }

  function openAddStudent() {
    setStudentForm(emptyStudent);
    setStudentModal(true);
  }
  const canAddStudent = studentForm.name.trim().length > 0;
  async function submitStudent() {
    if (!cls || !canAddStudent || busy) return;
    setBusy(true);
    const res = await addStudent(cls.id, { ...studentForm, clientId: studentForm.clientId || null });
    setBusy(false);
    toast(res.message);
    if (res.ok) setStudentModal(false);
  }

  const classModalEl = classModal ? (
    <Modal title="New class" width={540} onClose={() => setClassModal(false)}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
        <div className="fgrid c2">
          <Field label="Class name" required>
            <input value={classForm.name} onChange={(e) => setClassForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Summer Bridge — Robotics & Life Skills" autoFocus />
          </Field>
          <Field label="Program" required>
            <select value={classForm.programId} onChange={(e) => setClassForm((f) => ({ ...f, programId: e.target.value }))}>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="fgrid c2">
          <Field label="Site">
            <input value={classForm.site} onChange={(e) => setClassForm((f) => ({ ...f, site: e.target.value }))} placeholder="e.g. Allentown YMCA, Room 204" />
          </Field>
          <Field label="Schedule">
            <input value={classForm.schedule} onChange={(e) => setClassForm((f) => ({ ...f, schedule: e.target.value }))} placeholder="e.g. Mon–Thu · 3:30–5:30 PM" />
          </Field>
        </div>
        <Field label="Service code" hint="Each posted session logs this code for present students with a household record.">
          <input value={classForm.srvCode} onChange={(e) => setClassForm((f) => ({ ...f, srvCode: e.target.value }))} placeholder="SRV 2h" />
        </Field>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setClassModal(false)}>Cancel</button>
        <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={!canCreateClass || busy} style={!canCreateClass || busy ? { opacity: 0.45, cursor: "not-allowed" } : undefined} onClick={submitClass}>
          <I name="check" size={14} /> Create class
        </button>
      </div>
    </Modal>
  ) : null;

  if (!cls) {
    return (
      <div data-screen-label="Attendance">
        <div style={{ marginBottom: 12 }}>
          <a className="tlink" style={{ fontSize: 12.5, textDecoration: "none", cursor: "pointer" }} onClick={() => history.back()}>← Back</a>
        </div>
        <div className="page-head">
          <div>
            <h1 className="page-h1">Attendance<span className="red">.</span></h1>
            <p className="lede">Rosters and session-by-session attendance for classroom programs.</p>
          </div>
          <button className="calv-btn calv-btn--primary calv-btn--sm" onClick={openNewClass}><I name="plus" size={14} /> New class</button>
        </div>
        <Panel>
          <Empty>No classes yet — create the first one, enroll students, then open a session to take attendance.</Empty>
        </Panel>
        {classModalEl}
      </div>
    );
  }

  return (
    <div data-screen-label="Attendance">
      <div style={{ marginBottom: 12 }}>
        <a className="tlink" style={{ fontSize: 12.5, textDecoration: "none", cursor: "pointer" }} onClick={() => history.back()}>← Back</a>
      </div>

      <div className="page-head">
        <div>
          <h1 className="page-h1">{lead ? lead + " " : ""}<span style={{ color: "#C7910F" }}>{accentWord}.</span></h1>
          <p className="lede">{cls.name}{cls.site ? " · " + cls.site : ""}{cls.schedule ? " · " + cls.schedule : ""}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {classes.length > 1 ? (
            <select value={cls.id} onChange={(e) => router.push("/tools/attendance?class=" + e.target.value)}
              style={{ maxWidth: 240 }} aria-label="Class">
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : null}
          <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={openNewClass}><I name="plus" size={14} /> New class</button>
          <button className="calv-btn calv-btn--secondary calv-btn--sm" onClick={openAddStudent}><I name="plus" size={14} /> Add student</button>
          {todaySessionId ? (
            <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={!canPost}
              style={!canPost ? { opacity: 0.45, cursor: "not-allowed" } : undefined} onClick={submitToday}>
              <I name="check" size={14} /> Post today&apos;s attendance
            </button>
          ) : (
            <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={busy || hasTodaySession || students.length === 0}
              style={busy || hasTodaySession || students.length === 0 ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
              title={hasTodaySession ? "Today's session is already posted" : students.length === 0 ? "Enroll students first" : undefined}
              onClick={submitStartSession}>
              <I name="plus" size={14} /> Start today&apos;s session
            </button>
          )}
        </div>
      </div>

      <div className="kpis">
        <Kpi kick="Enrolled students" value={students.length} accent="var(--calv-amber)" />
        <Kpi kick="Today marked" value={todayTaken + " / " + students.length}
          foot={todaySessionId ? (todayTaken < students.length ? "tap the Today column to mark" : "ready to post") : hasTodaySession ? "today's session is posted" : "start a session to take attendance"}
          accent="var(--calv-amber)" />
        <Kpi kick="Term attendance" value={termAvg + "%"}
          foot={termAvg >= 85 ? "target 85% — on track" : "target 85% — below target"}
          tone={termAvg >= 85 ? "good" : "bad"} accent="var(--calv-sage)" />
        <Kpi kick="Students under 85%" value={under85.length}
          foot={under85.length ? under85.map((s) => s.name).join(" · ") : "everyone at or above target"}
          tone={under85.length ? "bad" : "good"} accent="var(--calv-red)" />
      </div>

      <Panel title="Roster · recent sessions" sub={"Tap a cell in the Today column to cycle Present → Absent → Excused. Past sessions are read-only. Every posted session counts each student once under " + cls.srvCode + "."}>
        {students.length === 0 ? (
          <Empty>No students enrolled yet — add the first one above.</Empty>
        ) : (
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
                  <td style={{ color: "var(--calv-slate-65)" }}>{[st.grade, st.school].filter(Boolean).join(" · ") || "—"}</td>
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
        )}
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

      {classModalEl}

      {studentModal ? (
        <Modal title={"Add student — " + cls.name} width={520} onClose={() => setStudentModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
            <div className="fgrid c2">
              <Field label="Name" required>
                <input value={studentForm.name} onChange={(e) => setStudentForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Keily Rosario" autoFocus />
              </Field>
              <Field label="Household record" hint="Linking logs the class service code for posted sessions.">
                <select value={studentForm.clientId} onChange={(e) => setStudentForm((f) => ({ ...f, clientId: e.target.value }))}>
                  <option value="">Not linked</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.id}</option>)}
                </select>
              </Field>
            </div>
            <div className="fgrid c2">
              <Field label="Grade">
                <input value={studentForm.grade} onChange={(e) => setStudentForm((f) => ({ ...f, grade: e.target.value }))} placeholder="e.g. 10th" />
              </Field>
              <Field label="School">
                <input value={studentForm.school} onChange={(e) => setStudentForm((f) => ({ ...f, school: e.target.value }))} placeholder="e.g. Allen HS" />
              </Field>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setStudentModal(false)}>Cancel</button>
            <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={!canAddStudent || busy} style={!canAddStudent || busy ? { opacity: 0.45, cursor: "not-allowed" } : undefined} onClick={submitStudent}>
              <I name="check" size={14} /> Add student
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
