import { requireUser, isAdmin } from "@/lib/auth";
import { FNPIS } from "@/lib/csbg-catalog";
import { buildRollup } from "./rollup";
import { ReportsClient } from "./reports-client";

/* Reports & CSBG rollup — agency-wide (all enrolled clients), per the Annual
   Report's unduplicated-count rules. Auth still required; no program scoping. */

export default async function ReportsPage() {
  const user = await requireUser();
  const data = await buildRollup();
  return (
    <ReportsClient
      data={data}
      canManageGoals={isAdmin(user)}
      fnpiOptions={FNPIS.map((f) => ({ code: f.code, label: f.label }))}
    />
  );
}
