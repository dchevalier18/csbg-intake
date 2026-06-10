"use server";
/* Attendance server actions — every mutation re-checks auth + program scoping. */
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit, userCanSeeProgram, userHasCap } from "@/lib/access";

interface Result { ok: boolean; message: string }

function loadSession(sessionId: string) {
  const session = db.select().from(t.classSessions).where(eq(t.classSessions.id, sessionId)).get();
  if (!session) return null;
  const cls = db.select().from(t.classes).where(eq(t.classes.id, session.classId)).get();
  if (!cls) return null;
  return { session, cls };
}

/** Persist a single tap in the Today column ("·" → P → A → E → "·"). */
export async function setMark(sessionId: string, studentId: string, mark: "p" | "a" | "e" | null): Promise<Result> {
  const user = await requireUser();
  if (!userHasCap(user, "attendance")) return { ok: false, message: "No access to attendance tools." };
  const found = loadSession(sessionId);
  if (!found || !userCanSeeProgram(user, found.cls.programId)) return { ok: false, message: "Session not found." };
  if (found.session.posted === 1) return { ok: false, message: "This session is already posted." };
  if (mark !== null && mark !== "p" && mark !== "a" && mark !== "e") return { ok: false, message: "Invalid mark." };
  const student = db.select().from(t.students)
    .where(and(eq(t.students.id, studentId), eq(t.students.classId, found.cls.id))).get();
  if (!student) return { ok: false, message: "Student not found in this class." };

  const existing = db.select().from(t.attendanceMarks)
    .where(and(eq(t.attendanceMarks.sessionId, sessionId), eq(t.attendanceMarks.studentId, studentId))).get();
  if (existing) {
    db.update(t.attendanceMarks).set({ mark })
      .where(and(eq(t.attendanceMarks.sessionId, sessionId), eq(t.attendanceMarks.studentId, studentId))).run();
  } else {
    db.insert(t.attendanceMarks).values({ sessionId, studentId, mark }).run();
  }
  revalidatePath("/tools/attendance");
  return { ok: true, message: "Saved." };
}

/** Post the day: mark the session posted and log one SRV entry per present student with a household record. */
export async function postAttendance(sessionId: string): Promise<Result> {
  const user = await requireUser();
  if (!userHasCap(user, "attendance")) return { ok: false, message: "No access to attendance tools." };
  const found = loadSession(sessionId);
  if (!found || !userCanSeeProgram(user, found.cls.programId)) return { ok: false, message: "Session not found." };
  const { session, cls } = found;
  if (session.posted === 1) return { ok: false, message: "This session is already posted." };

  const students = db.select().from(t.students).where(eq(t.students.classId, cls.id)).all();
  const markRows = db.select().from(t.attendanceMarks).where(eq(t.attendanceMarks.sessionId, sessionId)).all();
  const byStudent = new Map(markRows.map((m) => [m.studentId, m.mark]));
  if (students.some((st) => !byStudent.get(st.id))) {
    return { ok: false, message: "Mark every student before posting." };
  }

  db.update(t.classSessions).set({ posted: 1 }).where(eq(t.classSessions.id, sessionId)).run();
  const present = students.filter((st) => byStudent.get(st.id) === "p");
  for (const st of present) {
    if (!st.clientId) continue;
    db.insert(t.serviceLog).values({
      date: session.date,
      clientId: st.clientId,
      code: cls.srvCode,
      programId: cls.programId,
      staffId: user.id,
      note: `${cls.name} — attendance posted.`,
    }).run();
  }
  audit(user.id, "attendance.post", "class_session", sessionId,
    `${cls.name} · ${session.date} — ${present.length} present of ${students.length} (${cls.srvCode})`);
  revalidatePath("/tools/attendance");
  revalidatePath("/services");
  return {
    ok: true,
    message: `Attendance posted — ${present.length} present logged as ${cls.srvCode} (before/after-school activities).`,
  };
}
