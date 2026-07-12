import { asc, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { userHasCap, visibleClients, visiblePrograms } from "@/lib/access";
import { programType } from "@/lib/program-types";
import { todayIso } from "@/lib/format";
import { Restricted } from "@/components/ui";
import { AttendanceClient, type Mark } from "./attendance-client";

export default async function AttendancePage({ searchParams }: {
  searchParams: Promise<{ class?: string }>;
}) {
  const user = await requireUser();
  if (!await userHasCap(user, "attendance")) return <Restricted what="attendance tools" />;

  const attendancePrograms = (await visiblePrograms(user))
    .filter((p) => (programType(p.type).caps as string[]).includes("attendance"));
  const attendanceProgramIds = attendancePrograms.map((p) => p.id);

  const classes = attendanceProgramIds.length
    ? await db.select().from(t.classes)
        .where(inArray(t.classes.programId, attendanceProgramIds))
        .orderBy(asc(t.classes.id))
    : [];

  const { class: requested } = await searchParams;
  const cls = classes.find((c) => c.id === requested) ?? classes[0];

  const clients = (await visibleClients(user))
    .map((c) => ({ id: c.id, name: c.first + " " + c.last }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const programOptions = attendancePrograms.map((p) => ({ id: p.id, name: p.name }));
  const classOptions = classes.map((c) => ({ id: c.id, name: c.name }));

  if (!cls) {
    return (
      <AttendanceClient
        programName=""
        programs={programOptions}
        classes={classOptions}
        clients={clients}
        cls={null}
        students={[]}
        sessions={[]}
        todaySessionId={null}
        marks={{}}
        today={todayIso()}
      />
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
      key={cls.id} // remount on class switch so the Today-column state resets
      programName={program?.name ?? cls.name}
      programs={programOptions}
      classes={classOptions}
      clients={clients}
      cls={{ id: cls.id, name: cls.name, site: cls.site, schedule: cls.schedule, srvCode: cls.srvCode }}
      students={students.map((s) => ({
        id: s.id, name: s.name, clientId: s.clientId ?? null,
        grade: s.grade, school: s.school, termPct: s.termPct,
      }))}
      sessions={sessions.map((s) => ({ id: s.id, date: s.date, label: s.label, posted: s.posted === 1 }))}
      todaySessionId={todaySession?.id ?? null}
      marks={marks}
      today={todayIso()}
    />
  );
}
