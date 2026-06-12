// Loan servicing — activated by the "Community Loan Fund" program type
function ScreenLoans({ openClient, toast, tweaks }) {
  if (!userHasCap("loans")) return <Restricted what="loan servicing" />;
  const active = LOANS.filter(l => l.status !== "paid");
  const outstanding = LOANS.reduce((s, l) => s + l.balance, 0);
  const late = LOANS.filter(l => l.status === "late");
  const onTime = Math.round((active.length - late.length) / active.length * 100);
  const STATUS = {
    current: { tone: "sage", label: "Current" },
    late: { tone: "red", label: "Past due" },
    paid: { tone: "", label: "Paid off" },
  };

  return (
    <div data-screen-label="Loan servicing">
      <div className="page-head">
        <div>
          <h1 className="page-h1">Loan <span className="red">servicing.</span></h1>
          <p className="lede">Rising Tide micro-loan portfolio — each disbursement logs SRV 3b business & self-employment services for the borrower.</p>
        </div>
        <button className="calv-btn calv-btn--secondary calv-btn--sm" onClick={() => toast("New loan application opened (prototype).")}><I name="plus" size={14} /> New loan</button>
      </div>

      <div className="kpis">
        <Kpi kick="Active loans" value={active.length} accent="var(--calv-teal)" />
        <Kpi kick="Principal outstanding" value={money(outstanding)} accent="var(--calv-teal)" />
        <Kpi kick="On-time rate" value={onTime + "%"} foot={late.length + " past due"} tone={onTime >= 80 ? "good" : "bad"} accent="var(--calv-sage)" />
        <Kpi kick="Loans repaid this FY" value={LOANS.filter(l => l.status === "paid").length} foot="graduated to traditional credit" accent="var(--calv-sage)" />
      </div>

      <Panel title="Portfolio" sub="Click a borrower with a household record to open their client profile.">
        <table className="data">
          <thead><tr><th>Loan</th><th>Borrower</th><th>Purpose</th><th className="num">Principal</th><th className="num">Balance</th><th>Rate · term</th><th>Status</th><th>Next payment</th></tr></thead>
          <tbody>
            {LOANS.map(l => (
              <tr key={l.id}>
                <td className="cname">{l.id}</td>
                <td>{l.clientId ? <a className="tlink" style={{ textDecoration: "none", fontWeight: 600 }} onClick={() => openClient(l.clientId)}>{l.borrower}</a> : l.borrower}</td>
                <td style={{ color: "var(--calv-slate-65)", maxWidth: 260 }}>{l.purpose}</td>
                <td className="num">{money(l.principal)}</td>
                <td className="num">{l.balance ? money(l.balance) : "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>{l.rate} · {l.term}</td>
                <td><Chip tone={STATUS[l.status].tone}>{STATUS[l.status].label}</Chip></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {l.status === "late" ? <span style={{ color: "var(--calv-red)" }}>Overdue {new Date(l.next + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    : l.next === "—" ? "—" : new Date(l.next + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
window.ScreenLoans = ScreenLoans;
