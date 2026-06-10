import { requireUser } from "@/lib/auth";
import { buildRollup } from "./rollup";
import { ReportsClient } from "./reports-client";

/* Reports & CSBG rollup — agency-wide (all enrolled clients), per the Annual
   Report's unduplicated-count rules. Auth still required; no program scoping. */

export default async function ReportsPage() {
  await requireUser();
  const data = buildRollup();
  return <ReportsClient data={data} />;
}
