import { requireUser, isAdmin } from "@/lib/auth";
import { visibleClients, visiblePrograms, getPrograms } from "@/lib/access";
import { getOrg, getStaff, getEnabledIntakeFields } from "@/lib/data/core";
import { fplStatusFor } from "@/lib/fpl";
import { completenessPct } from "@/lib/completeness";
import { fmt, shortDate } from "@/lib/format";
import { ClientsDirectory, type ClientRow } from "./clients-client";

export default async function ClientsPage() {
  const user = await requireUser();
  const org = await getOrg();
  const base = await visibleClients(user);
  const myPrograms = await visiblePrograms(user);
  const allPrograms = new Map((await getPrograms()).map((p) => [p.id, p]));
  const fields = await getEnabledIntakeFields();
  const staff = await getStaff();
  const caseworkers = staff.filter((s) => s.role === "Case Worker");

  const rows: ClientRow[] = await Promise.all(base.map(async (c) => {
    const st = await fplStatusFor(c.income, c.hhSize, c.fplYear, org.csbgCeiling);
    return {
      id: c.id,
      name: `${c.first} ${c.last}`,
      sub: `${c.id} · ${(c.address ?? "").split(",").slice(1, 2).join("").trim()}`,
      hhType: c.hhType ?? "—",
      hhSub: `${c.hhSize} member${c.hhSize > 1 ? "s" : ""} · ${c.housing ?? "—"}`,
      fplTone: st.tone,
      fplLabel: st.label,
      programIds: c.programIds,
      programs: c.programIds.map((pid) => {
        const p = allPrograms.get(pid);
        return { color: p?.color ?? "var(--calv-slate-35)", short: p?.short ?? pid };
      }),
      completeness: completenessPct(c, fields),
      caseworkerId: c.caseworkerId ?? "",
      caseworker: staff.find((s) => s.id === c.caseworkerId)?.name ?? "—",
      nextFollowUp: c.nextFollowUp ? shortDate(c.nextFollowUp) : "—",
    };
  }));

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-h1">Clients<span className="red">.</span></h1>
          <p className="lede">{fmt(base.length)} enrolled households on your view · scoped to your assigned programs</p>
        </div>
      </div>
      <ClientsDirectory
        rows={rows}
        programs={myPrograms.map((p) => ({ id: p.id, name: p.name }))}
        caseworkers={caseworkers.map((s) => ({ id: s.id, name: s.name }))}
        canExport={isAdmin(user)}
      />
    </div>
  );
}
