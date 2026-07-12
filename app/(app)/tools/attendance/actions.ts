"use server";
/* Attendance server actions — every mutation re-checks auth + program scoping. */
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit, userCanSeeProgram, userHasCap, visibleClient } from "@/lib/access";
import { programType } from "@/lib/program-types";
import { shortDate, todayIso } from "@/lib/format";

interface Result { ok: boolean; message: string; id?: string }

async function nextId(prefix: string, ids: string[]): Promise<string> {
  let max = 0;
  for (const id of ids) {
    if (!id.startsWith(prefix)) continue;
    const n = Number(id.slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return prefix + (max === 0 ? 101 : max + 1); // first of a series reads better as 101
}

export interface NewClassInput {
  programId: string;
  name: string;
  site: string;
  schedule: string;
  srvCode: string;
}

/** Create a class under one of the user's attendance-capable programs. */
export async function createClass(input: NewClassInput): Promise<Result> {
  const user = await requireUser();
  if (!await userHasCap(user, "attendance")) return { ok: false, message: "No access to attendance tools." };
  const program = (await db.select().from(t.programs).where(eq(t.programs.id, input.programId)))[0];
  if (!program || !await userCanSeeProgram(user, input.programId)
    || !(programType(program.type).caps as string[]).includes("attendance")) {
    return { ok: false, message: "Pick one of your attendance programs." };
  }
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Enter the class name." };
  const srvCode = input.srvCode.trim() || "SRV 2h";

  const existing = await db.select({ id: t.classes.id }).from(t.classes);
  const id = await nextId("CL-", existing.map((c) => c.id));
  await db.insert(t.classes).values({
    id, programId: input.programId, name,
    site: input.site.trim(), schedule: input.schedule.trim(), srvCode,
  });

  await audit(user.id, "class.create", "class", id, `${name} — ${program.name} (${srvCode})`);
  revalidatePath("/tools/attendance");
  return { ok: true, message: `${name} created — enroll students, then start a session to take attendance.`, id };
}

export interface NewStudentInput {
  name: string;
  grade: string;
  school: string;
  clientId: string | null;
}

/** Enroll a student in a class (optionally linked to a household record so
    posted sessions log services against it). */
export async function addStudent(classId: string, input: NewStudentInput): Promise<Result> {
  const user = await requireUser();
  if (!await userHasCap(user, "attendance")) return { ok: false, message: "No access to attendance tools." };
  const cls = (await db.select().from(t.classes).where(eq(t.classes.id, classId)))[0];
  if (!cls || !await userCanSeeProgram(user, cls.programId)) return { ok: false, message: "Class not found." };
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Enter the student's name." };

  let clientId: string | null = null;
  if (input.clientId) {
    const c = await visibleClient(user, input.clientId);
    if (!c) return { ok: false, message: "Client record not found." };
    clientId = c.id;
  }

  const roster = await db.select().from(t.students).where(eq(t.students.classId, classId));
  if (roster.some((s) => s.name.trim().toLowerCase() === name.toLowerCase())) {
    return { ok: false, message: `${name} is already on this roster.` };
  }
  const all = await db.select({ id: t.students.id }).from(t.students);
  const id = await nextId("ST-", all.map((s) => s.id));
  await db.insert(t.students).values({
    id, classId, name, clientId,
    grade: input.grade.trim(), school: input.school.trim(), termPct: 100,
  });

  await audit(user.id, "class.student.add", "student", id,
    `${name} enrolled in ${cls.name}${clientId ? " · household " + clientId : ""}`);
  revalidatePath("/tools/attendance");
  return { ok: true, message: `${name} enrolled in ${cls.name}.` };
}

/** Open today's session for a class — it becomes the tappable Today column. */
export async function startSession(classId: string): Promise<Result> {
  const user = await requireUser();
  if (!await userHasCap(user, "attendance")) return { ok: false, message: "No access to attendance tools." };
  const cls = (await db.select().from(t.classes).where(eq(t.classes.id, classId)))[0];
  if (!cls || !await userCanSeeProgram(user, cls.programId)) return { ok: false, message: "Class not found." };

  const roster = await db.select().from(t.students).where(eq(t.students.classId, classId));
  if (roster.length === 0) return { ok: false, message: "Enroll at least one student before starting a session." };

  const today = todayIso();
  const sessions = await db.select().from(t.classSessions).where(eq(t.classSessions.classId, classId));
  if (sessions.some((s) => s.date === today)) return { ok: false, message: "Today's session already exists." };
  const open = sessions.find((s) => s.posted !== 1);
  if (open) return { ok: false, message: `Post the open ${open.label} session before starting a new one.` };

  const all = await db.select({ id: t.classSessions.id }).from(t.classSessions);
  const id = await nextId("SES-", all.map((s) => s.id));
  await db.insert(t.classSessions).values({ id, classId, date: today, label: shortDate(today), posted: 0 });

  await audit(user.id, "class.session.start", "class_session", id, `${cls.name} · ${today}`);
  revalidatePath("/tools/attendance");
  return { ok: true, message: `Session opened for ${shortDate(today)} — tap the Today column to mark attendance.` };
}

async function loadSession(sessionId: string) {
  const session = (await db.select().from(t.classSessions).where(eq(t.classSessions.id, sessionId)))[0];
  if (!session) return null;
  const cls = (await db.select().from(t.classes).where(eq(t.classes.id, session.classId)))[0];
  if (!cls) return null;
  return { session, cls };
}

/** Persist a single tap in the Today column ("·" → P → A → E → "·"). */
export async function setMark(sessionId: string, studentId: string, mark: "p" | "a" | "e" | null): Promise<Result> {
  const user = await requireUser();
  if (!await userHasCap(user, "attendance")) return { ok: false, message: "No access to attendance tools." };
  const found = await loadSession(sessionId);
  if (!found || !await userCanSeeProgram(user, found.cls.programId)) return { ok: false, message: "Session not found." };
  if (found.session.posted === 1) return { ok: false, message: "This session is already posted." };
  if (mark !== null && mark !== "p" && mark !== "a" && mark !== "e") return { ok: false, message: "Invalid mark." };
  const student = (await db.select().from(t.students)
    .where(and(eq(t.students.id, studentId), eq(t.students.classId, found.cls.id))))[0];
  if (!student) return { ok: false, message: "Student not found in this class." };

  const existing = (await db.select().from(t.attendanceMarks)
    .where(and(eq(t.attendanceMarks.sessionId, sessionId), eq(t.attendanceMarks.studentId, studentId))))[0];
  if (existing) {
    await db.update(t.attendanceMarks).set({ mark })
      .where(and(eq(t.attendanceMarks.sessionId, sessionId), eq(t.attendanceMarks.studentId, studentId)));
  } else {
    await db.insert(t.attendanceMarks).values({ sessionId, studentId, mark });
  }
  revalidatePath("/tools/attendance");
  return { ok: true, message: "Saved." };
}

/** Post the day: mark the session posted and log one SRV entry per present student with a household record. */
export async function postAttendance(sessionId: string): Promise<Result> {
  const user = await requireUser();
  if (!await userHasCap(user, "attendance")) return { ok: false, message: "No access to attendance tools." };
  const found = await loadSession(sessionId);
  if (!found || !await userCanSeeProgram(user, found.cls.programId)) return { ok: false, message: "Session not found." };
  const { session, cls } = found;
  if (session.posted === 1) return { ok: false, message: "This session is already posted." };

  const students = await db.select().from(t.students).where(eq(t.students.classId, cls.id));
  const markRows = await db.select().from(t.attendanceMarks).where(eq(t.attendanceMarks.sessionId, sessionId));
  const byStudent = new Map(markRows.map((m) => [m.studentId, m.mark]));
  if (students.some((st) => !byStudent.get(st.id))) {
    return { ok: false, message: "Mark every student before posting." };
  }

  await db.update(t.classSessions).set({ posted: 1 }).where(eq(t.classSessions.id, sessionId));
  const present = students.filter((st) => byStudent.get(st.id) === "p");
  for (const st of present) {
    if (!st.clientId) continue;
    await db.insert(t.serviceLog).values({
      date: session.date,
      clientId: st.clientId,
      code: cls.srvCode,
      programId: cls.programId,
      staffId: user.id,
      note: `${cls.name} — attendance posted.`,
    });
  }
  await audit(user.id, "attendance.post", "class_session", sessionId,
    `${cls.name} · ${session.date} — ${present.length} present of ${students.length} (${cls.srvCode})`);
  revalidatePath("/tools/attendance");
  revalidatePath("/services");
  return {
    ok: true,
    message: `Attendance posted — ${present.length} present logged as ${cls.srvCode} (before/after-school activities).`,
  };
}
