"use client";
/* Loan detail — payment ledger + projected amortization schedule. */
import { useState } from "react";
import Link from "next/link";
import { Chip, Empty, Field, Kpi, Notice, Panel } from "@/components/ui";
import { Modal } from "@/components/ui-client";
import { useToast } from "@/components/toast";
import { I } from "@/components/icons";
import { money, shortDate } from "@/lib/format";
import { centsMoney, type ScheduleRow } from "@/lib/loan-math";
import { recordPayment } from "../actions";

export interface LoanDetail {
  id: string;
  borrower: string;
  clientId: string | null;
  clientHref: string | null;
  purpose: string;
  principal: number;
  balance: number;
  rate: string;
  term: string;
  status: string;
  nextDue: string | null;
  originated: string | null;
}

export interface LedgerRow {
  id: number;
  date: string;
  amount: number;
  interest: number;
  principal: number;
  balanceAfter: number;
  staff: string;
  note: string;
}

export type ScheduleDisplayRow = ScheduleRow;

const STATUS: Record<string, { tone: string; label: string }> = {
  current: { tone: "sage", label: "Current" },
  late: { tone: "red", label: "Past due" },
  paid: { tone: "", label: "Paid off" },
};

export function LoanDetailClient({ loan, payments, schedule, today }: {
  loan: LoanDetail; payments: LedgerRow[]; schedule: ScheduleDisplayRow[]; today: string;
}) {
  const toast = useToast();
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const st = STATUS[loan.status] ?? STATUS.current;
  const paidToDate = payments.reduce((s, p) => s + p.amount, 0);
  const interestToDate = payments.reduce((s, p) => s + p.interest, 0);
  const monthlyPayment = schedule.length > 1 ? schedule[0].payment : null;
  // the next projected installment (calendar-wise); pure projection — actual
  // standing comes from the ledger and the loan's status chip
  const nextIdx = loan.status === "paid" ? -1 : schedule.findIndex((r) => r.due >= today);

  function openPay() {
    setAmount(""); setDate(today); setNote("");
    setPaying(true);
  }

  const canPay = Number(amount) > 0 && Boolean(date);

  async function submitPayment() {
    if (!canPay || busy) return;
    setBusy(true);
    const res = await recordPayment(loan.id, Number(amount), date, note);
    setBusy(false);
    toast(res.message);
    if (res.ok) setPaying(false);
  }

  return (
    <div data-screen-label="Loan detail">
      <div style={{ marginBottom: 12 }}>
        <Link className="tlink" style={{ fontSize: 12.5, textDecoration: "none" }} href="/tools/loans">← Loan portfolio</Link>
      </div>
      <div className="page-head">
        <div>
          <h1 className="page-h1">{loan.id}<span className="red">.</span></h1>
          <p className="lede">
            {loan.clientHref ? <Link className="tlink" href={loan.clientHref}>{loan.borrower}</Link> : loan.borrower}
            {loan.purpose ? <> — {loan.purpose}</> : null} · {loan.rate} · {loan.term}
            {loan.originated ? <> · disbursed {shortDate(loan.originated)}</> : null}
          </p>
        </div>
        {loan.status !== "paid" ? (
          <button className="calv-btn calv-btn--primary calv-btn--sm" onClick={openPay}>
            <I name="plus" size={14} /> Record payment
          </button>
        ) : null}
      </div>

      <div className="kpis">
        <Kpi kick="Balance" value={money(loan.balance)} foot={"of " + money(loan.principal) + " principal"} accent="var(--calv-teal)" />
        <Kpi kick="Scheduled payment" value={monthlyPayment !== null ? centsMoney(monthlyPayment) : "—"} foot={monthlyPayment !== null ? "level monthly installment" : "no schedule on file"} accent="var(--calv-teal)" />
        <Kpi kick="Next payment" value={loan.nextDue ? shortDate(loan.nextDue) : "—"} foot={st.label} tone={loan.status === "late" ? "bad" : loan.status === "paid" ? "good" : undefined} accent="var(--calv-amber)" />
        <Kpi kick="Paid to date" value={money(paidToDate)} foot={money(interestToDate) + " of it interest"} accent="var(--calv-sage)" />
      </div>

      <Panel title="Payment ledger" sub="Every payment recorded against this loan, split interest-first at one month of the note rate on the open balance.">
        {payments.length === 0 ? (
          <Empty>No payments recorded yet — the first one starts the ledger.</Empty>
        ) : (
          <table className="data">
            <thead><tr><th>Date</th><th className="num">Payment</th><th className="num">Interest</th><th className="num">Principal</th><th className="num">Balance after</th><th>By</th><th>Note</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{shortDate(p.date)}</td>
                  <td className="num">{money(p.amount)}</td>
                  <td className="num" style={{ color: "var(--calv-slate-65)" }}>{money(p.interest)}</td>
                  <td className="num">{money(p.principal)}</td>
                  <td className="num">{money(p.balanceAfter)}</td>
                  <td>{p.staff}</td>
                  <td style={{ color: "var(--calv-slate-65)", maxWidth: 240 }}>{p.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <div style={{ height: 13 }} />

      <Panel title="Amortization schedule" sub={"Projected level-payment schedule at " + loan.rate + " over " + loan.term + " — actual payoff shifts with what the ledger records."}>
        {schedule.length === 0 ? (
          <Notice tone="warn">
            This loan predates structured terms (numeric rate, term, and disbursement date), so a schedule can&apos;t be projected. New loans generate one automatically.
          </Notice>
        ) : (
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            <table className="data">
              <thead><tr><th className="num">#</th><th>Due</th><th className="num">Payment</th><th className="num">Interest</th><th className="num">Principal</th><th className="num">Balance</th></tr></thead>
              <tbody>
                {schedule.map((r, i) => {
                  const isNext = i === nextIdx;
                  const past = r.due < today;
                  return (
                    <tr key={r.n} style={{
                      background: isNext ? "var(--calv-amber-15)" : "transparent",
                      opacity: past && !isNext ? 0.55 : 1,
                    }}>
                      <td className="num">{r.n}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{shortDate(r.due)}{isNext ? <span style={{ marginLeft: 8 }}><Chip tone="amber">Next</Chip></span> : null}</td>
                      <td className="num">{centsMoney(r.payment)}</td>
                      <td className="num" style={{ color: "var(--calv-slate-65)" }}>{centsMoney(r.interest)}</td>
                      <td className="num">{centsMoney(r.principal)}</td>
                      <td className="num">{centsMoney(r.balance)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {paying ? (
        <Modal title={"Record payment — " + loan.id} width={420} onClose={() => setPaying(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
            <div className="fgrid c2">
              <Field label="Payment amount ($)" required hint={"Balance " + money(loan.balance)}>
                <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 350" autoFocus />
              </Field>
              <Field label="Payment date" required>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={today} />
              </Field>
            </div>
            <Field label="Note" hint="Optional — check number, money order, adjustment reason.">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. check #1044" />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setPaying(false)}>Cancel</button>
            <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={!canPay || busy} style={!canPay || busy ? { opacity: 0.45, cursor: "not-allowed" } : undefined} onClick={submitPayment}>
              <I name="check" size={14} /> Record payment
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
