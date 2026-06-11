import { requireAdmin } from "@/lib/auth";
import { db, t } from "@/db";
import { getOrg, OPEN_STAGES } from "@/lib/data/core";
import { getFplHistory } from "@/lib/fpl";
import { FplClient } from "./fpl-client";

export default async function FplSettingsPage() {
  await requireAdmin();
  const org = getOrg();
  const history = getFplHistory().map((s) => ({
    year: s.year,
    base: s.base,
    perAdditional: s.perAdditional,
    effective: s.effective,
    status: s.status,
  }));

  // Cases pinned per guideline year: enrolled clients + OPEN applications.
  // Decided applications are excluded — approved ones live on as the created
  // client (counting both would double-count), and this matches the basis
  // publishFpl uses for its "N cases stay pinned" message.
  const clientYears = db.select({ fplYear: t.clients.fplYear }).from(t.clients).all();
  const appYears = db.select({ fplYear: t.applications.fplYear, stage: t.applications.stage })
    .from(t.applications).all()
    .filter((a) => (OPEN_STAGES as readonly string[]).includes(a.stage));
  const pinned: Record<number, number> = {};
  for (const r of [...clientYears, ...appYears]) pinned[r.fplYear] = (pinned[r.fplYear] ?? 0) + 1;

  return <FplClient history={history} ceiling={org.csbgCeiling} pinned={pinned} />;
}
