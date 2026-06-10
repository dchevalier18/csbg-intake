"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit, userCanSeeProgram, userHasCap, visiblePrograms } from "@/lib/access";
import { programType } from "@/lib/program-types";
import { todayIso } from "@/lib/format";

export interface ActionResult {
  ok: boolean;
  message: string;
  id?: string;
}

const COMMON_CODES = ["SRV 3a", "SRV 4d", "SRV 2q"];

export interface NewSeminarInput {
  title: string;
  date: string;
  time: string;
  site: string;
  capacity: number;
  srvCode: string;
}

export async function createSeminar(input: NewSeminarInput): Promise<ActionResult> {
  const user = await requireUser();
  if (!userHasCap(user, "seminars")) return { ok: false, message: "No access to seminar tools." };

  // the seminar belongs to the user's visible seminars-capable program
  const program = visiblePrograms(user).find((p) => programType(p.type).caps.includes("seminars"));
  if (!program) return { ok: false, message: "No seminar-capable program assigned." };

  const title = (input.title ?? "").trim();
  const date = (input.date ?? "").trim();
  const time = (input.time ?? "").trim();
  const site = (input.site ?? "").trim();
  const capacity = Math.floor(Number(input.capacity));
  const srvCode = (input.srvCode ?? "").trim();

  if (!title) return { ok: false, message: "A seminar title is required." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "A seminar date is required." };
  if (!Number.isFinite(capacity) || capacity < 1) return { ok: false, message: "Capacity must be at least 1." };

  // SRV code must be one of the common picks, or an active Income/Housing service
  const svc = db.select().from(t.services).where(eq(t.services.code, srvCode)).get();
  const allowed = svc && svc.active === 1 &&
    (COMMON_CODES.includes(svc.code) || svc.domain === "inc" || svc.domain === "hou");
  if (!allowed) return { ok: false, message: "Pick a valid service code for this seminar." };

  // next "SEM-N" id
  let max = 0;
  for (const r of db.select({ id: t.seminars.id }).from(t.seminars).all()) {
    const n = Number(r.id.replace("SEM-", ""));
    if (Number.isFinite(n) && n > max) max = n;
  }
  const id = `SEM-${max + 1}`;

  db.insert(t.seminars).values({
    id, programId: program.id, title, date, time, site, capacity, registered: 0, srvCode,
  }).run();

  audit(user.id, "seminar.create", "seminar", id, `${title} · ${date} · ${srvCode}`);
  revalidatePath("/tools/seminars");
  return { ok: true, message: `Seminar created — ${id} · ${title}.`, id };
}

export async function markAttendance(seminarId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!userHasCap(user, "seminars")) return { ok: false, message: "No access to seminar tools." };

  const sem = db.select().from(t.seminars).where(eq(t.seminars.id, seminarId)).get();
  if (!sem || !userCanSeeProgram(user, sem.programId)) return { ok: false, message: "Seminar not found." };
  if (sem.date > todayIso()) return { ok: false, message: "Attendance opens once the seminar has been held." };

  const attendees = db.select().from(t.seminarAttendees)
    .where(eq(t.seminarAttendees.seminarId, seminarId)).all();
  const withClient = attendees.filter((a) => a.clientId);
  if (withClient.length === 0) {
    return { ok: false, message: "No attendees with client records yet — run quick intake first." };
  }

  for (const a of withClient) {
    db.insert(t.serviceLog).values({
      date: sem.date,
      clientId: a.clientId!,
      code: sem.srvCode,
      programId: sem.programId,
      staffId: user.id,
      note: `${sem.title} — seminar attendance.`,
    }).run();
  }

  audit(user.id, "seminar.attendance.post", "seminar", seminarId,
    `${withClient.length} entries · ${sem.srvCode}`);
  revalidatePath("/tools/seminars");
  revalidatePath("/services");
  return { ok: true, message: `Attendance posted — ${withClient.length} entries logged as ${sem.srvCode}.` };
}
