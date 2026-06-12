import { asc, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { userHasCap, visiblePrograms } from "@/lib/access";
import { programType } from "@/lib/program-types";
import { todayIso } from "@/lib/format";
import { Restricted } from "@/components/ui";
import { SeminarsClient, type SeminarDTO, type SrvOption } from "./seminars-client";

/* Common picks first, then the rest of the Income (SRV 3) / Housing (SRV 4) menus. */
const COMMON_CODES = ["SRV 3a", "SRV 4d", "SRV 2q"];

export default async function SeminarsPage() {
  const user = await requireUser();
  if (!await userHasCap(user, "seminars")) return <Restricted what="seminar tools" />;

  // server-side scoping: only seminars owned by a visible, seminars-capable program
  const seminarPrograms = (await visiblePrograms(user))
    .filter((p) => programType(p.type).caps.includes("seminars"));
  const programIds = seminarPrograms.map((p) => p.id);

  const seminars = programIds.length
    ? await db.select().from(t.seminars)
        .where(inArray(t.seminars.programId, programIds))
        .orderBy(asc(t.seminars.date))
        
    : [];

  const attendees = seminars.length
    ? await db.select().from(t.seminarAttendees)
        .where(inArray(t.seminarAttendees.seminarId, seminars.map((s) => s.id)))
        
    : [];

  const data: SeminarDTO[] = seminars.map((s) => ({
    id: s.id,
    title: s.title,
    date: s.date,
    time: s.time,
    site: s.site,
    capacity: s.capacity,
    registered: s.registered,
    srvCode: s.srvCode,
    attendees: attendees
      .filter((a) => a.seminarId === s.id)
      .map((a) => ({
        id: a.id,
        name: a.name,
        clientId: a.clientId,
        applicationId: a.applicationId,
        intakeStatus: a.intakeStatus,
      })),
  }));

  // SRV-code menu: the three usual seminar codes + free pick from Income/Housing services
  const activeServices = await db.select().from(t.services)
    .where(eq(t.services.active, 1))
    .orderBy(asc(t.services.sort))
    ;
  const shortLabel = (l: string) => l.split(" (e.g.")[0];
  const srvOptions: SrvOption[] = [
    ...COMMON_CODES
      .map((c) => activeServices.find((s) => s.code === c))
      .filter((s): s is NonNullable<typeof s> => Boolean(s)),
    ...activeServices.filter(
      (s) => (s.domain === "inc" || s.domain === "hou") && !COMMON_CODES.includes(s.code),
    ),
  ].map((s) => ({ code: s.code, label: shortLabel(s.label) }));

  return <SeminarsClient seminars={data} srvOptions={srvOptions} today={todayIso()} />;
}
