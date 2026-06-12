import { asc, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { userHasCap, visiblePrograms } from "@/lib/access";
import { programType } from "@/lib/program-types";
import { Empty, Restricted } from "@/components/ui";
import { AttendanceClient, type Mark } from "./attendance-client";

export default async function AttendancePage() {
  const user = await requireUser();
  if (!await userHasCap(user, "attendance")) return <Restricted what="attendance tools" />;

  // First class belonging to a visible attendance-capable program.
  const attendanceProgramIds = (await visiblePrograms(user))
    .filter((p) => (programType(p.type).caps as string[]).includes("attendance"))
    .map((p) => p.id);
  const cls = attendanceProgramIds.length
    ? (await db.select().from(t.classes)
        .where(inArray(t.classes.programId, attendanceProgramIds))
        .orderBy(asc(t.classes.id)))[0]
    : undefined;
  if (!cls) {
    return (
      <div className="panel">
        <Empty>No classes are configured for your attendance programs yet.</Empty>
      </div>
    );
  }

  const program = (await db.select().from(t.programs).where(eq(t.programs.id, cls.programId)))[0];
  const students = await db.select().from(t.students)
    .where(eq(t.students.classId, cls.id)).orderBy(asc(t.students.id));

  // 5 most recent sessions by date, displayed oldest → newest.
  const sessions = (await db.select().from(t.classSessions)
    .where(eq(t.classSessions.classId, cls.id)))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .reverse();

  const sessionIds = sessions.map((s) => s.id);
  const markRows = sessionIds.length
    ? await db.select().from(t.attendanceMarks).where(inArray(t.attendanceMarks.sessionId, sessionIds))
    : [];
  const marks: Record<string, Record<string, Mark>> = {};
  for (const st of students) marks[st.id] = {};
  for (const m of markRows) {
    if (!marks[m.studentId]) continue;
    marks[m.studentId][m.sessionId] = m.mark === "p" || m.mark === "a" || m.mark === "e" ? m.mark : null;
  }

  // The "Today" column = latest unposted session.
  const todaySession = [...sessions].reverse().find((s) => s.posted !== 1);

  return (
    <AttendanceClient
      programName={program?.name ?? cls.name}
      cls={{ id: cls.id, name: cls.name, site: cls.site, schedule: cls.schedule, srvCode: cls.srvCode }}
      students={students.map((s) => ({
        id: s.id, name: s.name, clientId: s.clientId ?? null,
        grade: s.grade, school: s.school, termPct: s.termPct,
      }))}
      sessions={sessions.map((s) => ({ id: s.id, date: s.date, label: s.label, posted: s.posted === 1 }))}
      todaySessionId={todaySession?.id ?? null}
      marks={marks}
    />
  );
}
