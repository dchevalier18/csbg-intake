"use server";
/* Weatherization server actions — every mutation re-checks auth + program scoping. */
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { isAdmin, requireUser } from "@/lib/auth";
import { audit, userCanSeeProgram, userHasCap, visibleClient, visiblePrograms , orgFY} from "@/lib/access";
import { programType } from "@/lib/program-types";
import { kvGet, kvSet } from "@/lib/data/core";
import { money, todayIso } from "@/lib/format";

interface Result { ok: boolean; message: string }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function owningProgram(user: Awaited<ReturnType<typeof requireUser>>) {
  return (await visiblePrograms(user)).find((p) => (programType(p.type).caps as string[]).includes("contractors"));
}

async function nextId(prefix: string, ids: string[], first: number): Promise<string> {
  let max = 0;
  for (const id of ids) {
    if (!id.startsWith(prefix)) continue;
    const n = Number(id.slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  const n = max === 0 ? first : max + 1;
  return prefix + (prefix === "W-" ? String(n).padStart(2, "0") : String(n));
}

/** Credential standing: any expiration on or before today blocks new assignments. */
function expiredCredentials(c: { insuranceExp: string; bpiExp: string; epaRrpExp: string }, today: string): string[] {
  const out: string[] = [];
  if (c.insuranceExp <= today) out.push("insurance");
  if (c.bpiExp <= today) out.push("BPI certification");
  if (c.epaRrpExp <= today) out.push("EPA RRP");
  return out;
}

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
      const fy = await orgFY();
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

export interface NewJobInput {
  clientId: string | null;
  clientName: string;       // used when no household record is linked
  address: string;
  funding: string;
  measures: string;
  contractorId: string | null;
}

/** Open a job at the Energy audit stage. Contractors with an expired
    credential can't take new assignments (DOE monitoring finding). */
export async function createJob(input: NewJobInput): Promise<Result> {
  const user = await requireUser();
  if (!await userHasCap(user, "contractors")) return { ok: false, message: "No access to weatherization tools." };
  const prog = await owningProgram(user);
  if (!prog) return { ok: false, message: "No access to weatherization tools." };

  let clientId: string | null = null;
  let clientName = input.clientName.trim();
  if (input.clientId) {
    const c = await visibleClient(user, input.clientId);
    if (!c) return { ok: false, message: "Client record not found." };
    clientId = c.id;
    clientName = `${c.first} ${c.last}`;
  }
  if (!clientName) return { ok: false, message: "Enter the household's name or link a client record." };

  let contractorId: string | null = null;
  if (input.contractorId) {
    const c = (await db.select().from(t.contractors).where(eq(t.contractors.id, input.contractorId)))[0];
    if (!c || !await userCanSeeProgram(user, c.programId)) return { ok: false, message: "Contractor not found." };
    const expired = expiredCredentials(c, todayIso());
    if (expired.length) {
      return { ok: false, message: `${c.name} can't take new jobs — expired ${expired.join(", ")}. Update the credential first.` };
    }
    contractorId = c.id;
  }

  const jobs = await db.select({ id: t.wxJobs.id }).from(t.wxJobs);
  const id = await nextId("WX-", jobs.map((j) => j.id), 1001);
  await db.insert(t.wxJobs).values({
    id,
    programId: prog.id,
    clientName,
    clientId,
    address: input.address.trim(),
    stage: "audit",
    contractorId,
    funding: input.funding.trim(),
    measures: input.measures.trim(),
    started: todayIso(),
  });

  await audit(user.id, "wx.job.create", "wx_job", id,
    `${clientName} — ${input.address.trim() || "no address"}${contractorId ? " · " + contractorId : ""}`);
  revalidatePath("/tools/weatherization");
  return { ok: true, message: `${id} opened at the Energy audit stage${contractorId ? "" : " — assign a contractor before installation"}.` };
}

export interface NewContractorInput {
  name: string;
  trade: string;
  crews: number;
  phone: string;
  insuranceExp: string;
  bpiExp: string;
  epaRrpExp: string;
}

/** Add a contractor with the credential expirations DOE monitors ask for. */
export async function createContractor(input: NewContractorInput): Promise<Result> {
  const user = await requireUser();
  if (!await userHasCap(user, "contractors")) return { ok: false, message: "No access to weatherization tools." };
  const prog = await owningProgram(user);
  if (!prog) return { ok: false, message: "No access to weatherization tools." };

  const name = input.name.trim();
  if (!name) return { ok: false, message: "Enter the contractor's name." };
  for (const [label, v] of [["insurance", input.insuranceExp], ["BPI certification", input.bpiExp], ["EPA RRP", input.epaRrpExp]] as const) {
    if (!ISO_DATE.test(v)) return { ok: false, message: `Enter the ${label} expiration date.` };
  }
  const crews = Number.isFinite(input.crews) && input.crews >= 1 ? Math.round(input.crews) : 1;

  const existing = await db.select({ id: t.contractors.id }).from(t.contractors);
  const id = await nextId("W-", existing.map((c) => c.id), 1);
  await db.insert(t.contractors).values({
    id,
    programId: prog.id,
    name,
    trade: input.trade.trim(),
    crews,
    phone: input.phone.trim(),
    insuranceExp: input.insuranceExp,
    bpiExp: input.bpiExp,
    epaRrpExp: input.epaRrpExp,
    qcPass: 100,
  });

  await audit(user.id, "contractor.create", "contractor", id, `${name}${input.trade.trim() ? " — " + input.trade.trim() : ""}`);
  revalidatePath("/tools/weatherization");
  return { ok: true, message: `${name} added as ${id} — credential expirations are tracked on the Contractors tab.` };
}

export interface NewVoucherInput {
  contractorId: string;
  jobId: string | null;
  amount: number;
  date: string;
  memo: string;
}

/** Create an expense voucher for a contractor's charges (optionally tied to a job).
    Vouchers move submitted → approved → paid; approval is an admin decision. */
export async function createVoucher(input: NewVoucherInput): Promise<Result> {
  const user = await requireUser();
  if (!await userHasCap(user, "contractors")) return { ok: false, message: "No access to weatherization tools." };

  const contractor = (await db.select().from(t.contractors).where(eq(t.contractors.id, input.contractorId)))[0];
  if (!contractor || !await userCanSeeProgram(user, contractor.programId)) return { ok: false, message: "Contractor not found." };
  if (!Number.isFinite(input.amount) || input.amount <= 0) return { ok: false, message: "Enter the voucher amount." };
  const today = todayIso();
  const date = input.date.trim() || today;
  if (!ISO_DATE.test(date) || date > today) return { ok: false, message: "Enter the invoice date (today or earlier)." };

  let jobId: string | null = null;
  if (input.jobId) {
    const job = (await db.select().from(t.wxJobs).where(eq(t.wxJobs.id, input.jobId)))[0];
    if (!job || !await userCanSeeProgram(user, job.programId)) return { ok: false, message: "Job not found." };
    if (job.contractorId !== contractor.id) {
      return { ok: false, message: `${job.id} is assigned to a different contractor — pick one of ${contractor.name}'s jobs.` };
    }
    jobId = job.id;
  }

  const existing = await db.select({ id: t.wxVouchers.id }).from(t.wxVouchers);
  const id = await nextId("WXV-", existing.map((v) => v.id), 101);
  const amount = Math.round(input.amount);
  await db.insert(t.wxVouchers).values({
    id,
    programId: contractor.programId,
    contractorId: contractor.id,
    jobId,
    date,
    amount,
    memo: input.memo.trim(),
    status: "submitted",
    createdBy: user.id,
  });

  await audit(user.id, "wx.voucher.create", "wx_voucher", id,
    `${contractor.name} — ${money(amount)}${jobId ? " · " + jobId : ""}`);
  revalidatePath("/tools/weatherization");
  return { ok: true, message: `Voucher ${id} submitted — ${money(amount)} to ${contractor.name}, awaiting approval.` };
}

/** Advance a voucher: submitted → approved → paid. Admin-only (it moves money). */
export async function advanceVoucher(voucherId: string): Promise<Result> {
  const user = await requireUser();
  if (!await userHasCap(user, "contractors")) return { ok: false, message: "No access to weatherization tools." };
  if (!isAdmin(user)) return { ok: false, message: "Approving and paying vouchers needs a Program Manager or Data Admin." };

  const voucher = (await db.select().from(t.wxVouchers).where(eq(t.wxVouchers.id, voucherId)))[0];
  if (!voucher || !await userCanSeeProgram(user, voucher.programId)) return { ok: false, message: "Voucher not found." };

  if (voucher.status === "submitted") {
    await db.update(t.wxVouchers).set({ status: "approved", decidedBy: user.id }).where(eq(t.wxVouchers.id, voucherId));
    await audit(user.id, "wx.voucher.approve", "wx_voucher", voucherId, `${money(voucher.amount)} approved`);
    revalidatePath("/tools/weatherization");
    return { ok: true, message: `${voucherId} approved — mark it paid once the check clears.` };
  }
  if (voucher.status === "approved") {
    const today = todayIso();
    await db.update(t.wxVouchers).set({ status: "paid", paidAt: today }).where(eq(t.wxVouchers.id, voucherId));
    await audit(user.id, "wx.voucher.pay", "wx_voucher", voucherId, `${money(voucher.amount)} paid ${today}`);
    revalidatePath("/tools/weatherization");
    return { ok: true, message: `${voucherId} marked paid.` };
  }
  return { ok: false, message: `${voucherId} is already paid.` };
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
