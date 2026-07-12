import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { userHasCap, visibleClients, visibleProgramIds } from "@/lib/access";
import { getStaff } from "@/lib/data/core";
import { amortizationSchedule } from "@/lib/loan-math";
import { todayIso } from "@/lib/format";
import { Panel, Restricted } from "@/components/ui";
import { LoanDetailClient, type LedgerRow, type LoanDetail, type ScheduleDisplayRow } from "./loan-detail-client";

export default async function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!await userHasCap(user, "loans")) return <Restricted what="loan servicing" />;

  const { id } = await params;
  const loan = (await db.select().from(t.loans).where(eq(t.loans.id, id)))[0];
  if (!loan || !(await visibleProgramIds(user)).has(loan.programId)) {
    return (
      <Panel title="Loan not found">
        <p style={{ fontSize: 13.5, color: "var(--calv-slate-65)" }}>
          This loan doesn&apos;t exist or isn&apos;t in your programs. <Link className="tlink" href="/tools/loans">Back to the portfolio</Link>.
        </p>
      </Panel>
    );
  }

  const staff = await getStaff();
  const staffInitials = new Map(staff.map((s) => [s.id, s.initials]));
  const payments: LedgerRow[] = (await db.select().from(t.loanPayments)
    .where(eq(t.loanPayments.loanId, loan.id))
    .orderBy(asc(t.loanPayments.date), asc(t.loanPayments.id)))
    .map((p) => ({
      id: p.id,
      date: p.date,
      amount: p.amount,
      interest: p.interest,
      principal: p.principal,
      balanceAfter: p.balanceAfter,
      staff: staffInitials.get(p.staffId) ?? p.staffId,
      note: p.note,
    }));

  const hasTerms = loan.rateBps !== null && loan.termMonths !== null && Boolean(loan.originated);
  const schedule: ScheduleDisplayRow[] = hasTerms
    ? amortizationSchedule(loan.principal, loan.rateBps!, loan.termMonths!, loan.originated!)
    : [];

  const clientIds = new Set((await visibleClients(user)).map((c) => c.id));
  const detail: LoanDetail = {
    id: loan.id,
    borrower: loan.borrower,
    clientId: loan.clientId,
    clientHref: loan.clientId && clientIds.has(loan.clientId) ? `/clients/${loan.clientId}` : null,
    purpose: loan.purpose,
    principal: loan.principal,
    balance: loan.balance,
    rate: loan.rate,
    term: loan.term,
    status: loan.status,
    nextDue: loan.nextDue,
    originated: loan.originated,
  };

  return <LoanDetailClient loan={detail} payments={payments} schedule={schedule} today={todayIso()} />;
}
