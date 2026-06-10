import { asc, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { userHasCap, visiblePrograms } from "@/lib/access";
import { programType } from "@/lib/program-types";
import { kvGet } from "@/lib/data/core";
import { todayIso } from "@/lib/format";
import { Restricted } from "@/components/ui";
import { WxClient } from "./wx-client";

interface WxStats { unitsCompletedFY: number; avgDaysAuditToQc: number }

export default async function WeatherizationPage() {
  const user = await requireUser();
  if (!userHasCap(user, "contractors")) return <Restricted what="weatherization tools" />;

  const wxProgramIds = visiblePrograms(user)
    .filter((p) => (programType(p.type).caps as string[]).includes("contractors"))
    .map((p) => p.id);
  const jobs = wxProgramIds.length
    ? db.select().from(t.wxJobs).where(inArray(t.wxJobs.programId, wxProgramIds)).orderBy(asc(t.wxJobs.id)).all()
    : [];
  const contractors = wxProgramIds.length
    ? db.select().from(t.contractors).where(inArray(t.contractors.programId, wxProgramIds)).orderBy(asc(t.contractors.id)).all()
    : [];
  const stats = kvGet<WxStats>("wxStats", { unitsCompletedFY: 0, avgDaysAuditToQc: 0 });

  // Credentials expiring within 60 days of today.
  const cutoffDate = new Date(todayIso() + "T12:00:00");
  cutoffDate.setDate(cutoffDate.getDate() + 60);
  const cutoff = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, "0")}-${String(cutoffDate.getDate()).padStart(2, "0")}`;

  const CREDS = [
    { key: "insuranceExp", label: "insurance" },
    { key: "bpiExp", label: "BPI" },
    { key: "epaRrpExp", label: "EPA RRP" },
  ] as const;
  const expiring: string[] = [];
  for (const c of contractors) {
    for (const cred of CREDS) {
      if (c[cred.key] <= cutoff) expiring.push(`${c.name.split(" ").slice(0, 2).join(" ")} ${cred.label}`);
    }
  }

  return (
    <WxClient
      kpis={{
        activeJobs: jobs.filter((j) => j.stage !== "complete").length,
        unitsFY: stats.unitsCompletedFY,
        avgDays: stats.avgDaysAuditToQc,
        expiringCount: expiring.length,
        expiringFoot: expiring.join(" · "),
      }}
      jobs={jobs.map((j) => ({
        id: j.id,
        client: j.clientName,
        clientId: j.clientId ?? null,
        address: j.address,
        stage: j.stage,
        contractor: contractors.find((c) => c.id === j.contractorId)?.name ?? null,
        funding: j.funding,
        measures: j.measures,
      }))}
      contractors={contractors.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        trade: c.trade,
        crews: c.crews,
        activeJobs: jobs.filter((j) => j.contractorId === c.id && j.stage !== "complete").length,
        insurance: c.insuranceExp,
        bpi: c.bpiExp,
        epaRrp: c.epaRrpExp,
        qcPass: c.qcPass,
      }))}
      cutoff={cutoff}
    />
  );
}
