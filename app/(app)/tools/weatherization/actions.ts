"use server";
/* Weatherization server actions — every mutation re-checks auth + program scoping. */
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit, userCanSeeProgram, userHasCap } from "@/lib/access";
import { kvGet, kvSet } from "@/lib/data/core";
import { currentFY, todayIso } from "@/lib/format";

interface Result { ok: boolean; message: string }

const STAGES = ["audit", "install", "qc", "complete"];
const STAGE_LABEL: Record<string, string> = {
  audit: "Energy audit",
  install: "Installation",
  qc: "QC inspection",
  complete: "Complete",
};

/** Advance a job one stage (audit → install → qc → complete).
    Completion with a linked household logs an SRV 4g service entry. */
export async function advanceJob(jobId: string): Promise<Result> {
  const user = await requireUser();
  if (!await userHasCap(user, "contractors")) return { ok: false, message: "No access to weatherization tools." };
  const job = (await db.select().from(t.wxJobs).where(eq(t.wxJobs.id, jobId)))[0];
  if (!job || !await userCanSeeProgram(user, job.programId)) return { ok: false, message: "Job not found." };
  const idx = STAGES.indexOf(job.stage);
  if (idx < 0 || job.stage === "complete") return { ok: false, message: `${jobId} is already complete.` };
  const next = STAGES[idx + 1];

  await db.update(t.wxJobs).set({ stage: next }).where(eq(t.wxJobs.id, jobId));

  let message = `${job.id} advanced to ${STAGE_LABEL[next]}.`;
  if (next === "complete") {
    const wxStats = await kvGet<{ unitsCompletedFY: number; avgDaysAuditToQc: number }>("wxStats", { unitsCompletedFY: 0, avgDaysAuditToQc: 0 });
    await kvSet("wxStats", { ...wxStats, unitsCompletedFY: wxStats.unitsCompletedFY + 1 });
    revalidatePath("/reports");
    if (job.clientId) {
      const today = todayIso();
      await db.insert(t.serviceLog).values({
        date: today,
        clientId: job.clientId,
        code: "SRV 4g",
        programId: job.programId,
        staffId: user.id,
        note: `Weatherization job ${job.id} complete — ${job.measures}`,
      });
      // the completed unit is a client-level FNPI 4f outcome (households improved
      // energy efficiency) — upsert within the FY so the household counts once
      const fy = currentFY();
      const existing = (await db.select().from(t.outcomeLog)
        .where(and(eq(t.outcomeLog.clientId, job.clientId), eq(t.outcomeLog.code, "FNPI 4f"), eq(t.outcomeLog.programId, job.programId))))
        .find((o) => o.date >= fy.start && o.date <= fy.end);
      const note = `Weatherization job ${job.id} complete — ${job.measures}`;
      if (existing) {
        await db.update(t.outcomeLog)
          .set({ status: "achieved", date: today, programId: job.programId, staffId: user.id, note })
          .where(eq(t.outcomeLog.id, existing.id));
      } else {
        await db.insert(t.outcomeLog).values({
          date: today,
          clientId: job.clientId,
          code: "FNPI 4f",
          programId: job.programId,
          staffId: user.id,
          status: "achieved",
          note,
        });
      }
      revalidatePath("/services");
      revalidatePath(`/clients/${job.clientId}`);
      message = `${job.id} complete — SRV 4g logged for ${job.clientName}, FNPI 4f outcome recorded.`;
    } else {
      message = `${job.id} complete — link a client record to count the unit under FNPI 4f.`;
    }
  }
  await audit(user.id, "wx.job.advance", "wx_job", jobId, `${STAGE_LABEL[job.stage]} → ${STAGE_LABEL[next]}`);
  revalidatePath("/tools/weatherization");
  return { ok: true, message };
}

/** Send (audit) a credential-renewal reminder to a contractor. */
export async function remindContractor(contractorId: string): Promise<Result> {
  const user = await requireUser();
  if (!await userHasCap(user, "contractors")) return { ok: false, message: "No access to weatherization tools." };
  const contractor = (await db.select().from(t.contractors).where(eq(t.contractors.id, contractorId)))[0];
  if (!contractor || !await userCanSeeProgram(user, contractor.programId)) return { ok: false, message: "Contractor not found." };
  await audit(user.id, "contractor.remind", "contractor", contractorId, `Renewal reminder — ${contractor.name}`);
  return { ok: true, message: `Renewal reminder sent to ${contractor.name}.` };
}
