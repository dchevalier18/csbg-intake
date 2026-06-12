import { requireUser } from "@/lib/auth";
import { visiblePrograms } from "@/lib/access";
import { getEnabledIntakeFields, getListsWithValues, getOrg, getStaff, openApplications, applicationDocList } from "@/lib/data/core";
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
  // eligibility is judged against each application's PROGRAM ceiling (program
  // override when set, agency-wide CSBG ceiling otherwise)
  const ceilingOf = (programId: string) => byId.get(programId)?.fplCeiling ?? org.csbgCeiling;

  // intake form vocabulary — drives the editable "Intake details" view
  const lists = Object.fromEntries((await getListsWithValues()).map((l) => [l.key, l.values]));
  const fields = (await getEnabledIntakeFields()).map((f) => ({
    id: f.id, label: f.label, code: f.code, type: f.type, listKey: f.listKey, optionsText: f.optionsText, builtin: f.builtin,
  }));

  const rows: AppRow[] = await Promise.all(apps.map(async (a) => {
    const p = byId.get(a.programId);
    const st = await fplStatusFor(a.income, a.hhSize, a.fplYear, ceilingOf(a.programId));
    // builtin characteristics live in columns; custom answers in the JSON blob
    const builtinVal: Record<string, string | null> = {
      sex: a.sex, race: a.race, edu: a.edu, work: a.work, insurance: a.insurance, military: a.military,
      disability: a.disability == null ? null : a.disability === 1 ? "Yes" : "No",
    };
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
      ceiling: ceilingOf(a.programId),
      caseworker: staffName.get(a.caseworkerId ?? "") ?? "—",
      fpl: { pct: st.pct, label: st.label, tone: st.tone, eligible: st.eligible, year: st.year },
      intake: {
        first: a.first, last: a.last, dob: a.dob, phone: a.phone ?? "", address: a.address ?? "",
        county: a.county ?? "", hhType: a.hhType ?? "", hhSize: a.hhSize, housing: a.housing ?? "",
        income: a.income, incomeSrc: a.incomeSrc ?? "",
        characteristics: Object.fromEntries(fields.map((f) => [
          f.id,
          f.builtin === 1 ? (builtinVal[f.id] ?? "") : (a.custom[f.id] ?? ""),
        ])),
        programId: a.programId,
      },
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

  return (
    <EligibilityClient
      rows={rows}
      currentUserName={user.name}
      lists={lists}
      fields={fields}
      programs={programs.map((p) => ({ id: p.id, name: p.name, ceiling: p.fplCeiling ?? org.csbgCeiling }))}
    />
  );
}
