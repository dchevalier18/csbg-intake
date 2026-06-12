import { requireUser } from "@/lib/auth";
import { visiblePrograms } from "@/lib/access";
import { getDocTypes, getEnabledIntakeFields, getListsWithValues, getOrg, requiredDocKeys } from "@/lib/data/core";
import { getActiveFpl } from "@/lib/fpl";
import { Restricted } from "@/components/ui";
import { IntakeClient } from "./intake-client";

export default async function IntakePage({ searchParams }: {
  searchParams: Promise<{ first?: string; last?: string; seminarAttendeeId?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  // intake enrolls into a program — without an assignment there is nothing to enroll into
  const programs = await visiblePrograms(user);
  if (programs.length === 0) return <Restricted what="intake" />;

  const org = await getOrg();
  const fpl = await getActiveFpl(); // new intakes always use the ACTIVE schedule
  const lists = Object.fromEntries((await getListsWithValues()).map((l) => [l.key, l.values]));
  const fields = (await getEnabledIntakeFields()).map((f) => ({
    id: f.id, label: f.label, code: f.code, type: f.type, listKey: f.listKey, optionsText: f.optionsText,
  }));
  const requiredDocs = Object.fromEntries(
    await Promise.all(programs.map(async (p) => [p.id, await requiredDocKeys(p.id)] as const)),
  );

  return (
    <IntakeClient
      lists={lists}
      fields={fields}
      programs={programs.map((p) => ({ id: p.id, name: p.name, ceiling: p.fplCeiling ?? org.csbgCeiling }))}
      requiredDocs={requiredDocs}
      docTypes={await getDocTypes()}
      fpl={{ year: fpl.year, base: fpl.base, perAdditional: fpl.perAdditional }}
      ceiling={org.csbgCeiling}
      user={{ id: user.id, name: user.name }}
      prefill={{ first: sp.first ?? "", last: sp.last ?? "", seminarAttendeeId: sp.seminarAttendeeId ?? "" }}
    />
  );
}
