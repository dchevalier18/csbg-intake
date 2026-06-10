"use server";
/* Weatherization server actions — every mutation re-checks auth + program scoping. */
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit, userCanSeeProgram, userHasCap } from "@/lib/access";
import { todayIso } from "@/lib/format";

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
  if (!userHasCap(user, "contractors")) return { ok: false, message: "No access to weatherization tools." };
  const job = db.select().from(t.wxJobs).where(eq(t.wxJobs.id, jobId)).get();
  if (!job || !userCanSeeProgram(user, job.programId)) return { ok: false, message: "Job not found." };
  const idx = STAGES.indexOf(job.stage);
  if (idx < 0 || job.stage === "complete") return { ok: false, message: `${jobId} is already complete.` };
  const next = STAGES[idx + 1];

  db.update(t.wxJobs).set({ stage: next }).where(eq(t.wxJobs.id, jobId)).run();

  let message = `${job.id} advanced to ${STAGE_LABEL[next]}.`;
  if (next === "complete") {
    if (job.clientId) {
      db.insert(t.serviceLog).values({
        date: todayIso(),
        clientId: job.clientId,
        code: "SRV 4g",
        programId: job.programId,
        staffId: user.id,
        note: `Weatherization job ${job.id} complete — ${job.measures}`,
      }).run();
      revalidatePath("/services");
      message = `${job.id} complete — SRV 4g logged for ${job.clientName}.`;
    } else {
      message = `${job.id} complete.`;
    }
  }
  audit(user.id, "wx.job.advance", "wx_job", jobId, `${STAGE_LABEL[job.stage]} → ${STAGE_LABEL[next]}`);
  revalidatePath("/tools/weatherization");
  return { ok: true, message };
}

/** Send (audit) a credential-renewal reminder to a contractor. */
export async function remindContractor(contractorId: string): Promise<Result> {
  const user = await requireUser();
  if (!userHasCap(user, "contractors")) return { ok: false, message: "No access to weatherization tools." };
  const contractor = db.select().from(t.contractors).where(eq(t.contractors.id, contractorId)).get();
  if (!contractor || !userCanSeeProgram(user, contractor.programId)) return { ok: false, message: "Contractor not found." };
  audit(user.id, "contractor.remind", "contractor", contractorId, `Renewal reminder — ${contractor.name}`);
  return { ok: true, message: `Renewal reminder sent to ${contractor.name}.` };
}
