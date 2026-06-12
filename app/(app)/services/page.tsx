import { asc, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { visibleClients, visiblePrograms } from "@/lib/access";
import { DOMAINS, serviceByCode } from "@/lib/csbg-catalog";
import { PageHead, Restricted } from "@/components/ui";
import { ServicesClient, type EntryRow } from "./services-client";

export default async function ServicesPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const programs = await visiblePrograms(user);
  if (programs.length === 0) return <Restricted what="the service log" />;

  const sp = await searchParams;
  const clients = await visibleClients(user);

  // Preselect from ?client= only when that client is actually visible.
  const requested = typeof sp.client === "string" ? sp.client : "";
  const initialClient = clients.some((c) => c.id === requested) ? requested : "";

  // Service taxonomy from the services table (active, in sort order).
  const services = await db.select().from(t.services)
    .where(eq(t.services.active, 1))
    .orderBy(asc(t.services.sort))
    ;
  const serviceByCodeDb = new Map(services.map((s) => [s.code, s]));

  // Recent entries — scoped to visible programs, newest first, cap 50.
  const programIds = programs.map((p) => p.id);
  const raw = (await db.select().from(t.serviceLog)
    .where(inArray(t.serviceLog.programId, programIds)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    .slice(0, 50);

  // Lookup maps for display (names may include closed clients; entries are already program-scoped).
  const entryClientIds = [...new Set(raw.map((e) => e.clientId))];
  const entryClients = entryClientIds.length
    ? await db.select({ id: t.clients.id, first: t.clients.first, last: t.clients.last })
        .from(t.clients).where(inArray(t.clients.id, entryClientIds))
    : [];
  const clientName = new Map(entryClients.map((c) => [c.id, `${c.first} ${c.last}`]));
  const staffInitials = new Map(
    (await db.select({ id: t.users.id, initials: t.users.initials }).from(t.users)).map((u) => [u.id, u.initials]),
  );
  const programById = new Map(programs.map((p) => [p.id, p]));

  const entries: EntryRow[] = raw.map((e) => {
    const svc = serviceByCodeDb.get(e.code) ?? serviceByCode(e.code);
    const p = programById.get(e.programId);
    return {
      id: e.id,
      date: e.date,
      clientName: clientName.get(e.clientId) ?? e.clientId,
      code: e.code,
      label: svc?.label ?? e.code,
      domain: svc?.domain ?? "",
      programShort: p?.short ?? e.programId,
      programColor: p?.color ?? "var(--calv-slate-35)",
      staffInitials: staffInitials.get(e.staffId) ?? e.staffId.toUpperCase(),
      note: e.note,
    };
  });

  return (
    <div>
      <PageHead
        title="Service"
        titleAccent="log."
        lede="Every entry auto-maps to a CSBG service code and domain — the Annual Report tallies itself."
      />
      <ServicesClient
        clients={clients.map((c) => ({ id: c.id, first: c.first, last: c.last, programIds: c.programIds }))}
        services={services.map((s) => ({ code: s.code, domain: s.domain, label: s.label }))}
        domains={DOMAINS.map((d) => ({ id: d.id, name: d.name }))}
        programs={programs.map((p) => ({ id: p.id, short: p.short, color: p.color }))}
        visibleProgramIds={programIds}
        initialClient={initialClient}
        entries={entries}
      />
    </div>
  );
}
