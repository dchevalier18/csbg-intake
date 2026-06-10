"use client";

import { useState } from "react";
import Link from "next/link";
import { Chip, Field, Kpi, Panel } from "@/components/ui";
import { Modal } from "@/components/ui-client";
import { useToast } from "@/components/toast";
import { I } from "@/components/icons";
import { money, shortDate } from "@/lib/format";
import { createLoan, recordPayment } from "./actions";

export interface LoanRow {
  id: string;
  borrower: string;
  clientId: string | null;
  clientHref: string | null;
  purpose: string;
  principal: number;
  balance: number;
  rate: string;
  term: string;
  status: string;              // 'current' | 'late' | 'paid'
  nextDue: string | null;
}

const STATUS: Record<string, { tone: string; label: string }> = {
  current: { tone: "sage", label: "Current" },
  late: { tone: "red", label: "Past due" },
  paid: { tone: "", label: "Paid off" },
};

export default function LoansClient({ progShort, loans, clients }: {
  progShort: string; loans: LoanRow[]; clients: { id: string; name: string }[];
}) {
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [borrower, setBorrower] = useState("");
  const [clientId, setClientId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [term, setTerm] = useState("");
  const [paying, setPaying] = useState<LoanRow | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const active = loans.filter((l) => l.status !== "paid");
  const outstanding = loans.reduce((s, l) => s + l.balance, 0);
  const late = loans.filter((l) => l.status === "late");
  const onTime = active.length > 0 ? Math.round((active.length - late.length) / active.length * 100) : 100;
  const repaid = loans.filter((l) => l.status === "paid").length;

  function openNew() {
    setBorrower(""); setClientId(""); setPurpose(""); setPrincipal(""); setRate(""); setTerm("");
    setCreating(true);
  }

  const canCreate = borrower.trim().length > 0 && Number(principal) > 0;

  async function submitLoan() {
    if (!canCreate || busy) return;
    setBusy(true);
    const res = await createLoan({
      borrower, clientId: clientId || null, purpose,
      principal: Number(principal), rate, term,
    });
    setBusy(false);
    toast(res.message);
    if (res.ok) setCreating(false);
  }

  function openPayment(l: LoanRow) {
    setAmount("");
    setPaying(l);
  }

  const canPay = Number(amount) > 0;

  async function submitPayment() {
    if (!paying || !canPay || busy) return;
    setBusy(true);
    const res = await recordPayment(paying.id, Number(amount));
    setBusy(false);
    toast(res.message);
    if (res.ok) setPaying(null);
  }

  return (
    <div data-screen-label="Loan servicing">
      <div style={{ marginBottom: 12 }}>
        <a className="tlink" style={{ fontSize: 12.5, textDecoration: "none", cursor: "pointer" }} onClick={() => history.back()}>← Back</a>
      </div>
      <div className="page-head">
        <div>
          <h1 className="page-h1">Loan <span className="red">servicing.</span></h1>
          <p className="lede">{progShort} micro-loan portfolio — each disbursement logs SRV 3b business &amp; self-employment services for the borrower.</p>
        </div>
        <button className="calv-btn calv-btn--secondary calv-btn--sm" onClick={openNew}><I name="plus" size={14} /> New loan</button>
      </div>

      <div className="kpis">
        <Kpi kick="Active loans" value={active.length} accent="var(--calv-teal)" />
        <Kpi kick="Principal outstanding" value={money(outstanding)} accent="var(--calv-teal)" />
        <Kpi kick="On-time rate" value={onTime + "%"} foot={late.length + " past due"} tone={onTime >= 80 ? "good" : "bad"} accent="var(--calv-sage)" />
        <Kpi kick="Loans repaid this FY" value={repaid} foot="graduated to traditional credit" accent="var(--calv-sage)" />
      </div>

      <Panel title="Portfolio" sub="Click a borrower with a household record to open their client profile.">
        <table className="data">
          <thead><tr><th>Loan</th><th>Borrower</th><th>Purpose</th><th className="num">Principal</th><th className="num">Balance</th><th>Rate · term</th><th>Status</th><th>Next payment</th><th></th></tr></thead>
          <tbody>
            {loans.map((l) => {
              const st = STATUS[l.status] ?? STATUS.current;
              return (
                <tr key={l.id}>
                  <td className="cname">{l.id}</td>
                  <td>{l.clientHref ? <Link className="tlink" style={{ textDecoration: "none", fontWeight: 600 }} href={l.clientHref}>{l.borrower}</Link> : l.borrower}</td>
                  <td style={{ color: "var(--calv-slate-65)", maxWidth: 260 }}>{l.purpose}</td>
                  <td className="num">{money(l.principal)}</td>
                  <td className="num">{l.balance ? money(l.balance) : "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{l.rate} · {l.term}</td>
                  <td><Chip tone={st.tone}>{st.label}</Chip></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {l.status === "late" && l.nextDue ? <span style={{ color: "var(--calv-red)" }}>Overdue {shortDate(l.nextDue)}</span>
                      : l.status === "paid" || !l.nextDue ? "—" : shortDate(l.nextDue)}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {l.status !== "paid" ? <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => openPayment(l)}>Record payment</button> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      {creating ? (
        <Modal title="New loan" onClose={() => setCreating(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
            <div className="fgrid c2">
              <Field label="Borrower" required>
                <input value={borrower} onChange={(e) => setBorrower(e.target.value)} placeholder="e.g. Hassan Farah" autoFocus />
              </Field>
              <Field label="Client record" hint="Linking logs an SRV 3b service for the borrower.">
                <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">Not linked</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.id}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Purpose">
              <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Food truck — equipment & buildout" />
            </Field>
            <div className="fgrid c3">
              <Field label="Principal ($)" required>
                <input type="number" min={0} value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="e.g. 12000" />
              </Field>
              <Field label="Rate">
                <input value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 4.5%" />
              </Field>
              <Field label="Term">
                <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. 48 mo" />
              </Field>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setCreating(false)}>Cancel</button>
            <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={!canCreate || busy} style={!canCreate || busy ? { opacity: 0.45, cursor: "not-allowed" } : undefined} onClick={submitLoan}>
              <I name="check" size={14} /> Create loan
            </button>
          </div>
        </Modal>
      ) : null}

      {paying ? (
        <Modal title={"Record payment — " + paying.id} width={380} onClose={() => setPaying(null)}>
          <div style={{ marginBottom: 18 }}>
            <Field label="Payment amount ($)" required hint={"Balance " + money(paying.balance) + " · " + paying.borrower}>
              <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 350" autoFocus />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setPaying(null)}>Cancel</button>
            <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={!canPay || busy} style={!canPay || busy ? { opacity: 0.45, cursor: "not-allowed" } : undefined} onClick={submitPayment}>
              <I name="check" size={14} /> Record payment
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
