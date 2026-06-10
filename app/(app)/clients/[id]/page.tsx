import { eq, desc } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { visibleClient, getPrograms } from "@/lib/access";
import { getOrg, getEnabledIntakeFields, listValuesFor } from "@/lib/data/core";
import { fplStatusFor } from "@/lib/fpl";
import { completenessItems } from "@/lib/completeness";
import { serviceByCode } from "@/lib/csbg-catalog";
import { ageFromDob, currentFY, longDate, money, shortDate, todayIso } from "@/lib/format";
import { Restricted } from "@/components/ui";
import { ClientProfile, type GapField } from "./profile-client";

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const raw = db.select().from(t.clients).where(eq(t.clients.id, id)).get();
  if (!raw) return <div className="empty">Client not found.</div>;
  const c = visibleClient(user, id);
  if (!c) return <Restricted what="this client record" />;

  const org = getOrg();
  const fy = currentFY();
  const st = fplStatusFor(c.income, c.hhSize, c.fplYear, org.csbgCeiling);
  const fields = getEnabledIntakeFields();
  const items = completenessItems(c, fields);
  const filled = items.filter((i) => i.filled).length;
  const completeness = items.length === 0 ? 100 : Math.round((filled / items.length) * 100);

  const allPrograms = new Map(getPrograms().map((p) => [p.id, p]));
  const programs = c.programIds.map((pid) => {
    const p = allPrograms.get(pid);
    return { color: p?.color ?? "var(--calv-slate-35)", short: p?.short ?? pid };
  });

  const characteristics: Array<[string, string]> = [
    ["Sex", c.sex ?? "—"],
    ["Age", `${ageFromDob(c.dob)} (${c.dob})`],
    ["Race / ethnicity", c.race ?? "—"],
    ["Education level", c.edu ?? "—"],
    ["Work status", c.work ?? "—"],
    ["Military status", c.military ?? "—"],
    ["Disability", c.disability == null ? "—" : c.disability ? "Yes" : "No"],
    ["Health insurance", c.insurance ?? "—"],
    ["Household type", c.hhType ?? "—"],
    ["Household size", String(c.hhSize)],
    ["Housing", c.housing ?? "—"],
    ["Income sources", c.incomeSrc ?? "—"],
    ["Annual income", money(c.income)],
    ["FPL band (D12)", st.band],
    ["Assessed under", `${st.year} FPL guidelines`],
  ];

  // Unfilled report fields → capture-now form specs (proper input per field config)
  const CORE_INPUT: Record<string, { type: string; listKey?: string }> = {
    dob: { type: "date" },
    hhType: { type: "list", listKey: "hhType" },
    hhSize: { type: "number" },
    housing: { type: "list", listKey: "housing" },
    income: { type: "number" },
    incomeSrc: { type: "list", listKey: "incomeSrc" },
  };
  const gaps: GapField[] = items.filter((i) => !i.filled).map((i) => {
    const f = fields.find((x) => x.id === i.id);
    if (f) {
      const options =
        f.type === "list" && f.listKey ? listValuesFor(f.listKey)
        : f.type === "choice" ? (f.optionsText ?? "").split(",").map((o) => o.trim()).filter(Boolean)
        : undefined;
      return { id: i.id, label: i.label, type: f.type, options };
    }
    const core = CORE_INPUT[i.id] ?? { type: "text" };
    return {
      id: i.id,
      label: i.label,
      type: core.type,
      options: core.listKey ? listValuesFor(core.listKey) : undefined,
    };
  });

  const services = db.select().from(t.serviceLog)
    .where(eq(t.serviceLog.clientId, c.id))
    .orderBy(desc(t.serviceLog.date), desc(t.serviceLog.id))
    .all()
    .filter((s) => s.date >= fy.start && s.date <= fy.end)
    .map((s) => ({
      id: s.id,
      code: s.code,
      label: serviceByCode(s.code)?.label ?? s.code,
      date: shortDate(s.date),
      note: s.note,
    }));

  return (
    <ClientProfile
      client={{
        id: c.id,
        first: c.first,
        last: c.last,
        enrolledLong: longDate(c.enrolled),
        address: c.address ?? "—",
        phone: c.phone,
      }}
      status={{
        tone: st.tone,
        label: st.label,
        eligible: st.eligible,
        guidelines: `${st.year} guidelines`,
      }}
      programs={programs}
      completeness={completeness}
      characteristics={characteristics}
      gaps={gaps}
      services={services}
      followUp={{
        dueSub: c.nextFollowUp ? `Due ${longDate(c.nextFollowUp)}` : undefined,
        body: c.flags[0] || "Quarterly case-plan review — verify outcome progress and update FNPI actuals.",
        defaultDate: c.nextFollowUp ?? todayIso(),
      }}
    />
  );
}
