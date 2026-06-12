import { asc, count } from "drizzle-orm";
import { db, t } from "@/db";
import { getPrograms } from "@/lib/access";
import { programServiceRestrictions } from "@/lib/data/core";
import { DOMAINS } from "@/lib/csbg-catalog";
import { ServicesSettingsClient } from "./services-client";

export default async function ServicesSettingsPage() {
  // admin gate lives in the settings layout
  const services = await db.select().from(t.services).orderBy(asc(t.services.sort));
  const programs = await getPrograms();
  const restrictions = await programServiceRestrictions();

  // how often each code has been logged — pg returns count(*) as a string
  const usageRows = await db.select({ code: t.serviceLog.code, n: count() })
    .from(t.serviceLog).groupBy(t.serviceLog.code);
  const usage = Object.fromEntries(usageRows.map((r) => [r.code, Number(r.n)]));

  return (
    <ServicesSettingsClient
      services={services.map((s) => ({ code: s.code, domain: s.domain, label: s.label, active: s.active === 1 }))}
      domains={DOMAINS.map((d) => ({ id: d.id, name: d.name }))}
      programs={programs.map((p) => ({ id: p.id, name: p.name, short: p.short, color: p.color }))}
      restrictions={restrictions}
      usage={usage}
    />
  );
}
