import { requireUser } from "@/lib/auth";
import { visiblePrograms } from "@/lib/access";
import { getEnabledIntakeFields, getListsWithValues, getOrg, getStaff, deniedApplications, applicationDocList } from "@/lib/data/core";
import { fplStatusFor } from "@/lib/fpl";
import { currentFY, localDateOf } from "@/lib/format";
import { Restricted } from "@/components/ui";
import DenialsClient, { type DenialRow } from "./denials-client";

/* Past denials review — every denied application visible to this user, with the
   live "would they qualify today?" re-check. Intake corrections and the reopen
   (re-enrollment) flow happen in the detail modal; the original determination
   stays on the audit record. */
export default async function DenialsPage() {
  const user = await requireUser();
  const programs = await visiblePrograms(user);
  if (programs.length === 0) return <Restricted what="denied applications" />;

  const org = await getOrg();
  const byId = new Map(programs.map((p) => [p.id, p]));
  const apps = await deniedApplications(programs.map((p) => p.id));

  const staffName = new Map((await getStaff()).map((u) => [u.id, u.name]));
  const ceilingOf = (programId: string) => byId.get(programId)?.fplCeiling ?? org.csbgCeiling;

  // intake form vocabulary — drives the editable "Intake details" view
  const lists = Object.fromEntries((await getListsWithValues()).map((l) => [l.key, l.values]));
  const fields = (await getEnabledIntakeFields()).map((f) => ({
    id: f.id, label: f.label, code: f.code, type: f.type, listKey: f.listKey, optionsText: f.optionsText, builtin: f.builtin,
  }));

  const rows: DenialRow[] = await Promise.all(apps.map(async (a) => {
    const p = byId.get(a.programId);
    // re-checked under the ACTIVE schedule (year null → active) and the program's
    // CURRENT ceiling — "would this household qualify if reopened today?" The
    // determination they were denied under is preserved in the audit log.
    const st = await fplStatusFor(a.income, a.hhSize, null, ceilingOf(a.programId));
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
      notes: a.notes,
      programColor: p?.color ?? "var(--calv-slate-35)",
      programShort: p?.short ?? a.programId,
      programName: p?.name ?? a.programId,
      ceiling: ceilingOf(a.programId),
      caseworker: staffName.get(a.caseworkerId ?? "") ?? "—",
      denied: {
        on: a.decidedAt ? localDateOf(a.decidedAt) : a.applied,
        byName: staffName.get(a.decidedBy ?? "") ?? "—",
        note: a.decisionNote ?? "",
      },
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

  const fy = currentFY(new Date(), org.fyStart);
  return (
    <DenialsClient
      rows={rows}
      lists={lists}
      fields={fields}
      programs={programs.map((p) => ({ id: p.id, name: p.name, ceiling: p.fplCeiling ?? org.csbgCeiling }))}
      fy={{ label: fy.label, start: fy.start }}
    />
  );
}
