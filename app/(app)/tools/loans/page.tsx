import { requireUser } from "@/lib/auth";
import { Restricted } from "@/components/ui";
import { userHasCap, visibleClients, visibleProgramIds, visiblePrograms } from "@/lib/access";
import { programType } from "@/lib/program-types";
import { db, t } from "@/db";
import LoansClient, { type LoanRow } from "./loans-client";

export default async function LoansPage() {
  const user = await requireUser();
  if (!userHasCap(user, "loans")) return <Restricted what="loan servicing" />;

  const owning = visiblePrograms(user).find((p) => programType(p.type).caps.includes("loans"));
  if (!owning) return <Restricted what="loan servicing" />;

  const ids = visibleProgramIds(user);
  const clients = visibleClients(user)
    .map((c) => ({ id: c.id, name: c.first + " " + c.last }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const clientIds = new Set(clients.map((c) => c.id));

  const rows: LoanRow[] = db.select().from(t.loans).all()
    .filter((l) => ids.has(l.programId))
    .map((l) => ({
      id: l.id,
      borrower: l.borrower,
      clientId: l.clientId,
      clientHref: l.clientId && clientIds.has(l.clientId) ? `/clients/${l.clientId}` : null,
      purpose: l.purpose,
      principal: l.principal,
      balance: l.balance,
      rate: l.rate,
      term: l.term,
      status: l.status,
      nextDue: l.nextDue,
    }));

  return <LoansClient progShort={owning.short} loans={rows} clients={clients} />;
}
