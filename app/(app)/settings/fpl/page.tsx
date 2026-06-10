import { requireAdmin } from "@/lib/auth";
import { db, t } from "@/db";
import { getOrg } from "@/lib/data/core";
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

  // Cases pinned per guideline year — clients + applications store fplYear forever.
  const clientYears = db.select({ fplYear: t.clients.fplYear }).from(t.clients).all();
  const appYears = db.select({ fplYear: t.applications.fplYear }).from(t.applications).all();
  const pinned: Record<number, number> = {};
  for (const r of [...clientYears, ...appYears]) pinned[r.fplYear] = (pinned[r.fplYear] ?? 0) + 1;

  return <FplClient history={history} ceiling={org.csbgCeiling} pinned={pinned} />;
}
