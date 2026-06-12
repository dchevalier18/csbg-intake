import { requireUser } from "@/lib/auth";
import { visiblePrograms } from "@/lib/access";
import { getOrg, getStaff, openApplications, applicationDocList } from "@/lib/data/core";
import { fplStatusFor } from "@/lib/fpl";
import { Restricted } from "@/components/ui";
import EligibilityClient, { type AppRow } from "./eligibility-client";

export default async function EligibilityPage() {
  const user = await requireUser();
  const programs = await visiblePrograms(user);
  if (programs.length === 0) return <Restricted what="the eligibility queue" />;

  const org = await getOrg();
  const byId = new Map(programs.map((p) => [p.id, p]));
  const apps = await openApplications(programs.map((p) => p.id));

  const staffName = new Map((await getStaff()).map((u) => [u.id, u.name]));
  const rows: AppRow[] = await Promise.all(apps.map(async (a) => {
    const p = byId.get(a.programId);
    const st = await fplStatusFor(a.income, a.hhSize, a.fplYear, org.csbgCeiling);
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
      caseworker: staffName.get(a.caseworkerId ?? "") ?? "—",
      fpl: { pct: st.pct, label: st.label, tone: st.tone, eligible: st.eligible, year: st.year },
      docs: (await applicationDocList(a)).map((d) => ({
        key: d.key,
        label: d.label,
        status: d.status,
        file: d.file ? { name: d.file.name, when: d.file.when } : null,
        verification: d.verification
          ? { byName: staffName.get(d.verification.by) ?? d.verification.by, when: d.verification.when }
          : null,
        bypass: d.bypass
          ? { byName: staffName.get(d.bypass.by) ?? d.bypass.by, when: d.bypass.when, reason: d.bypass.reason }
          : null,
      })),
    };
  }));

  return <EligibilityClient rows={rows} ceiling={org.csbgCeiling} currentUserName={user.name} />;
}
