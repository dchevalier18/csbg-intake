import { requireUser } from "@/lib/auth";
import { visiblePrograms } from "@/lib/access";
import { getOrg, openApplications, applicationDocList, staffById } from "@/lib/data/core";
import { fplStatusFor } from "@/lib/fpl";
import { Restricted } from "@/components/ui";
import EligibilityClient, { type AppRow } from "./eligibility-client";

export default async function EligibilityPage() {
  const user = await requireUser();
  const programs = visiblePrograms(user);
  if (programs.length === 0) return <Restricted what="the eligibility queue" />;

  const org = getOrg();
  const byId = new Map(programs.map((p) => [p.id, p]));
  const apps = openApplications(programs.map((p) => p.id));

  const rows: AppRow[] = apps.map((a) => {
    const p = byId.get(a.programId);
    const st = fplStatusFor(a.income, a.hhSize, a.fplYear, org.csbgCeiling);
    return {
      id: a.id,
      first: a.first,
      last: a.last,
      hhSize: a.hhSize,
      county: a.county ?? "—",
      income: a.income,
      applied: a.applied,
      stage: a.stage,
      notes: a.notes,
      programColor: p?.color ?? "var(--calv-slate-35)",
      programShort: p?.short ?? a.programId,
      caseworker: staffById(a.caseworkerId)?.name ?? "—",
      fpl: { pct: st.pct, label: st.label, tone: st.tone, eligible: st.eligible, year: st.year },
      docs: applicationDocList(a).map((d) => ({ key: d.key, label: d.label, status: d.status })),
    };
  });

  return <EligibilityClient rows={rows} ceiling={org.csbgCeiling} />;
}
