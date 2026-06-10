"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit, userHasCap, visibleClient, visibleProgramIds, visiblePrograms } from "@/lib/access";
import { programType } from "@/lib/program-types";
import { money, todayIso } from "@/lib/format";

export interface ActionResult { ok: boolean; message: string }

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nextLoanId(): string {
  let max = 0;
  for (const r of db.select({ id: t.loans.id }).from(t.loans).all()) {
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
  rate: string;
  term: string;
}

/** New loan — disburses into the visible loan-fund program; logs SRV 3b when client-linked. */
export async function createLoan(input: NewLoanInput): Promise<ActionResult> {
  const user = await requireUser();
  if (!userHasCap(user, "loans")) return { ok: false, message: "No access to loan servicing." };
  const prog = visiblePrograms(user).find((p) => programType(p.type).caps.includes("loans"));
  if (!prog) return { ok: false, message: "No access to loan servicing." };

  const borrower = input.borrower.trim();
  if (!borrower) return { ok: false, message: "Enter the borrower's name." };
  if (!Number.isFinite(input.principal) || input.principal <= 0) {
    return { ok: false, message: "Enter the principal amount." };
  }

  let clientId: string | null = null;
  if (input.clientId) {
    const c = visibleClient(user, input.clientId);
    if (!c) return { ok: false, message: "Client record not found." };
    clientId = c.id;
  }

  const id = nextLoanId();
  const principal = Math.round(input.principal);
  const today = todayIso();
  db.insert(t.loans).values({
    id,
    programId: prog.id,
    borrower,
    clientId,
    purpose: input.purpose.trim(),
    principal,
    balance: principal,
    rate: input.rate.trim(),
    term: input.term.trim(),
    status: "current",
    nextDue: addDays(today, 30),
    srvCode: "SRV 3b",
  }).run();

  if (clientId) {
    db.insert(t.serviceLog).values({
      date: today,
      clientId,
      code: "SRV 3b",
      programId: prog.id,
      staffId: user.id,
      note: `Micro-loan ${id} disbursed — ${money(principal)} (${input.purpose.trim() || borrower})`,
    }).run();
  }

  audit(user.id, "loan.create", "loan", id,
    `${borrower} — ${money(principal)}${clientId ? " · SRV 3b logged for " + clientId : ""}`);
  revalidatePath("/tools/loans");
  return {
    ok: true,
    message: clientId
      ? `Loan ${id} disbursed to ${borrower} — SRV 3b business & self-employment service logged.`
      : `Loan ${id} disbursed to ${borrower} — ${money(principal)}.`,
  };
}

/** Record a payment — reduces the balance; at $0 the loan is paid off. */
export async function recordPayment(loanId: string, amount: number): Promise<ActionResult> {
  const user = await requireUser();
  if (!userHasCap(user, "loans")) return { ok: false, message: "No access to loan servicing." };

  const loan = db.select().from(t.loans).where(eq(t.loans.id, loanId)).get();
  if (!loan || !visibleProgramIds(user).has(loan.programId)) return { ok: false, message: "Loan not found." };
  if (loan.status === "paid") return { ok: false, message: "Loan is already paid off." };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "Enter a payment amount." };

  const paid = Math.round(amount);
  const newBalance = Math.max(0, loan.balance - paid);
  if (newBalance === 0) {
    db.update(t.loans).set({ balance: 0, status: "paid", nextDue: null }).where(eq(t.loans.id, loanId)).run();
  } else {
    db.update(t.loans)
      .set({ balance: newBalance, status: "current", nextDue: addDays(loan.nextDue ?? todayIso(), 30) })
      .where(eq(t.loans.id, loanId)).run();
  }

  audit(user.id, "loan.payment", "loan", loanId,
    `${money(paid)} payment — balance ${money(newBalance)}${newBalance === 0 ? " · paid off" : ""}`);
  revalidatePath("/tools/loans");
  return {
    ok: true,
    message: newBalance === 0
      ? `Payment of ${money(paid)} recorded — ${loanId} paid off.`
      : `Payment of ${money(paid)} recorded — ${loanId} balance now ${money(newBalance)}.`,
  };
}
