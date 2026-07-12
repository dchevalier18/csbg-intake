"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit, userHasCap, visibleClient, visibleProgramIds, visiblePrograms } from "@/lib/access";
import { programType } from "@/lib/program-types";
import { money, todayIso } from "@/lib/format";
import { addMonthsIso, allocatePayment } from "@/lib/loan-math";

export interface ActionResult { ok: boolean; message: string }

async function nextLoanId(): Promise<string> {
  let max = 0;
  for (const r of await db.select({ id: t.loans.id }).from(t.loans)) {
    const n = Number(r.id.replace("L-", ""));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return "L-" + (max + 1);
}

export interface NewLoanInput {
  borrower: string;
  clientId: string | null;
  purpose: string;
  principal: number;
  aprPct: number;      // annual rate as a percent (4.5 = 4.50% APR)
  termMonths: number;
}

/** New loan — disburses into the visible loan-fund program; logs SRV 3b when client-linked. */
export async function createLoan(input: NewLoanInput): Promise<ActionResult> {
  const user = await requireUser();
  if (!await userHasCap(user, "loans")) return { ok: false, message: "No access to loan servicing." };
  const prog = (await visiblePrograms(user)).find((p) => programType(p.type).caps.includes("loans"));
  if (!prog) return { ok: false, message: "No access to loan servicing." };

  const borrower = input.borrower.trim();
  if (!borrower) return { ok: false, message: "Enter the borrower's name." };
  if (!Number.isFinite(input.principal) || input.principal <= 0) {
    return { ok: false, message: "Enter the principal amount." };
  }
  if (!Number.isFinite(input.aprPct) || input.aprPct < 0 || input.aprPct > 100) {
    return { ok: false, message: "Enter the annual rate as a percent (0 for interest-free)." };
  }
  if (!Number.isInteger(input.termMonths) || input.termMonths <= 0 || input.termMonths > 600) {
    return { ok: false, message: "Enter the term in months." };
  }

  let clientId: string | null = null;
  if (input.clientId) {
    const c = await visibleClient(user, input.clientId);
    if (!c) return { ok: false, message: "Client record not found." };
    clientId = c.id;
  }

  const id = await nextLoanId();
  const principal = Math.round(input.principal);
  const rateBps = Math.round(input.aprPct * 100);
  const today = todayIso();
  await db.insert(t.loans).values({
    id,
    programId: prog.id,
    borrower,
    clientId,
    purpose: input.purpose.trim(),
    principal,
    balance: principal,
    rate: `${(rateBps / 100).toFixed(rateBps % 100 === 0 ? 0 : 1)}%`,
    term: `${input.termMonths} mo`,
    rateBps,
    termMonths: input.termMonths,
    originated: today,
    status: "current",
    nextDue: addMonthsIso(today, 1),
    srvCode: "SRV 3b",
  });

  if (clientId) {
    await db.insert(t.serviceLog).values({
      date: today,
      clientId,
      code: "SRV 3b",
      programId: prog.id,
      staffId: user.id,
      note: `Micro-loan ${id} disbursed — ${money(principal)} (${input.purpose.trim() || borrower})`,
    });
  }

  await audit(user.id, "loan.create", "loan", id,
    `${borrower} — ${money(principal)}${clientId ? " · SRV 3b logged for " + clientId : ""}`);
  revalidatePath("/tools/loans");
  return {
    ok: true,
    message: clientId
      ? `Loan ${id} disbursed to ${borrower} — SRV 3b business & self-employment service logged.`
      : `Loan ${id} disbursed to ${borrower} — ${money(principal)}.`,
  };
}

/** Record a payment — writes a ledger row with the interest/principal split
    (interest first, at one month of the loan's rate on the open balance) and
    reduces the balance; at $0 principal remaining the loan is paid off. */
export async function recordPayment(loanId: string, amount: number, date?: string, note?: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!await userHasCap(user, "loans")) return { ok: false, message: "No access to loan servicing." };

  const loan = (await db.select().from(t.loans).where(eq(t.loans.id, loanId)))[0];
  if (!loan || !(await visibleProgramIds(user)).has(loan.programId)) return { ok: false, message: "Loan not found." };
  if (loan.status === "paid") return { ok: false, message: "Loan is already paid off." };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "Enter a payment amount." };
  const today = todayIso();
  const paidOn = date?.trim() ? date.trim() : today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn) || paidOn > today) {
    return { ok: false, message: "Enter the payment date (today or earlier)." };
  }

  const paid = Math.round(amount);
  // interest accrues on the balance; the payment can't retire more principal than is open
  const { interest, principal } = allocatePayment(loan.balance, loan.rateBps, paid);
  const applied = Math.min(principal, loan.balance);
  const newBalance = loan.balance - applied;
  await db.insert(t.loanPayments).values({
    loanId,
    date: paidOn,
    amount: paid,
    interest,
    principal: applied,
    balanceAfter: newBalance,
    staffId: user.id,
    note: note?.trim() ?? "",
  });
  if (newBalance === 0) {
    await db.update(t.loans).set({ balance: 0, status: "paid", nextDue: null }).where(eq(t.loans.id, loanId));
  } else {
    await db.update(t.loans)
      .set({ balance: newBalance, status: "current", nextDue: addMonthsIso(loan.nextDue ?? today, 1) })
      .where(eq(t.loans.id, loanId));
  }

  await audit(user.id, "loan.payment", "loan", loanId,
    `${money(paid)} payment (${money(interest)} interest · ${money(applied)} principal) — balance ${money(newBalance)}${newBalance === 0 ? " · paid off" : ""}`);
  revalidatePath("/tools/loans");
  revalidatePath(`/tools/loans/${loanId}`);
  return {
    ok: true,
    message: newBalance === 0
      ? `Payment of ${money(paid)} recorded — ${loanId} paid off.`
      : `Payment of ${money(paid)} recorded — ${loanId} balance now ${money(newBalance)}.`,
  };
}
