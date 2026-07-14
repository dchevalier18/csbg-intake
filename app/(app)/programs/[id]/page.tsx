import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { getProgram, userCanSeeProgram , orgFY} from "@/lib/access";
import { getEnabledIntakeFields, getOrg, getStaff, openApplications } from "@/lib/data/core";
import { fplStatusFor } from "@/lib/fpl";
import { completenessPct } from "@/lib/completeness";
import { CAP_TOOLS, programType } from "@/lib/program-types";
import { shortDate } from "@/lib/format";
import { Chip, CodeChip, Kpi, Panel, Restricted } from "@/components/ui";
import { I } from "@/components/icons";
import { MembersTable, type MemberRow } from "./program-client";

/* Program start page — per-program dashboard housing that program's tools. */

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const p = await getProgram(id);
  if (!p || !p.active) {
    return <div className="empty">Program not found — it may have been removed in Settings.</div>;
  }
  if (!await userCanSeeProgram(user, p.id)) return <Restricted what={p.name} />;

  const type = programType(p.type);
  const org = await getOrg();
  const fields = await getEnabledIntakeFields();
  const fy = await orgFY();

  // enrolled clients on this program (access already verified above)
  const memberIds = (await db.select().from(t.clientPrograms)
    .where(eq(t.clientPrograms.programId, p.id))).map((m) => m.clientId);
  const members = memberIds.length
    ? (await db.select().from(t.clients).where(inArray(t.clients.id, memberIds)))
        .filter((c) => c.status === "active")
    : [];

  // open eligibility applications for this program (newest first)
  const apps = await openApplications([p.id]);

  // services logged for this program this FY (latest first)
  const svc = (await db.select().from(t.serviceLog).where(eq(t.serviceLog.programId, p.id)))
    .filter((s) => s.date >= fy.start && s.date <= fy.end)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  const avgReady = members.length
    ? Math.round(members.reduce((s, c) => s + completenessPct(c, fields), 0) / members.length)
    : 100;

  const tools = type.caps.map((cap) => ({ cap, ...CAP_TOOLS[cap] }));

  const staffMap = new Map((await getStaff()).map((u) => [u.id, u]));
  const memberRows: MemberRow[] = await Promise.all(members.map(async (c) => {
    const st = await fplStatusFor(c.income, c.hhSize, c.fplYear, p.fplCeiling ?? org.csbgCeiling);
    return {
      id: c.id,
      name: c.first + " " + c.last,
      hh: (c.hhType ?? "—") + " · " + c.hhSize,
      fplLabel: st.label,
      fplTone: st.tone,
      pct: completenessPct(c, fields),
      worker: staffMap.get(c.caseworkerId ?? "")?.name ?? "—",
    };
  }));

  // client names for the recent-services feed
  const svcClientIds = [...new Set(svc.slice(0, 4).map((s) => s.clientId))];
  const svcClients = svcClientIds.length
    ? await db.select().from(t.clients).where(inArray(t.clients.id, svcClientIds))
    : [];
  const clientName = (cid: string) => {
    const c = svcClients.find((x) => x.id === cid);
    return c ? c.first + " " + c.last : cid;
  };

  return (
    <div data-screen-label={"Program · " + p.name}>
      <div className="page-head">
        <div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 4 }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: p.color, flex: "none" }}></span>
            <h1 className="page-h1" style={{ fontSize: 34 }}>{p.name}<span className="red">.</span></h1>
          </div>
          <p className="lede">{type.name} program · {members.length} enrolled · {apps.length} in eligibility pipeline{p.sources.length ? " · syncs with " + p.sources.join(", ") : ""}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/intake" className="calv-btn calv-btn--primary calv-btn--sm" style={{ textDecoration: "none" }}><I name="plus" size={13} /> New intake</Link>
          <Link href="/services" className="calv-btn calv-btn--quiet calv-btn--sm" style={{ textDecoration: "none" }}><I name="hand" size={13} /> Log service</Link>
        </div>
      </div>

      <div className="kpis">
        <Kpi kick="Enrolled clients" value={members.length} accent={p.color} />
        <Kpi kick="Eligibility pipeline" value={apps.length} foot={apps.filter((a) => a.stage === "docs").length + " waiting on documents"} accent="var(--calv-amber)" />
        <Kpi kick="Services this FY" value={svc.length} foot="logged in this workspace" accent="var(--calv-teal)" />
        <Kpi kick="Report-ready records" value={avgReady + "%"} tone={avgReady >= 90 ? "good" : "bad"} accent="var(--calv-sage)" />
      </div>

      {tools.length ? (
        <Panel title="Program tools" sub={"Activated by the " + type.name + " program type."} style={{ marginBottom: 13 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(" + Math.min(tools.length, 3) + ",1fr)", gap: 10 }}>
            {tools.map((tool) => (
              <Link key={tool.cap} href={tool.route}
                style={{
                  display: "block", textAlign: "left", padding: "14px 16px", borderRadius: 4, cursor: "pointer",
                  background: "#fff", border: "1px solid var(--calv-slate-15)", fontFamily: "var(--font-body)",
                  textDecoration: "none",
                }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 5 }}>
                  <span className="pdot" style={{ background: tool.dot, width: 8, height: 8, borderRadius: 99 }}></span>
                  <span style={{ fontFamily: "var(--font-sub)", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: ".02em", color: "var(--calv-slate)" }}>{tool.label}</span>
                  <I name="arrow" size={13} style={{ marginLeft: "auto", color: "var(--calv-slate-35)" }} />
                </div>
                <div style={{ fontSize: 12, color: "var(--calv-slate-65)", lineHeight: 1.45 }}>{tool.desc}</div>
              </Link>
            ))}
          </div>
        </Panel>
      ) : null}

      <div className="row2">
        <Panel title="Enrolled clients" sub={members.length + " households on this program"}>
          {memberRows.length === 0
            ? <div className="empty">No enrollments yet — start with a new intake.</div>
            : <MembersTable rows={memberRows} />}
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <Panel title="Eligibility pipeline" sub="Applications for this program."
            right={<Link href="/eligibility" className="calv-btn calv-btn--quiet calv-btn--sm" style={{ textDecoration: "none" }}>Open queue</Link>}>
            {apps.length === 0 ? <div className="empty" style={{ padding: 18 }}>No pending applications.</div> :
              apps.map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 2px", borderBottom: "1px solid var(--calv-slate-15)", fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{a.first} {a.last}</span>
                  <Chip tone={a.stage === "docs" ? "amber" : a.stage === "review" ? "teal" : "red"}>
                    {a.stage === "docs" ? "Documents" : a.stage === "review" ? "Review" : "Decision"}
                  </Chip>
                </div>
              ))}
          </Panel>
          <Panel title="Recent services" sub={svc.length + " logged this FY"}>
            {svc.length === 0 ? <div className="empty" style={{ padding: 18 }}>Nothing logged yet.</div> :
              svc.slice(0, 4).map((s) => (
                <div key={s.id} style={{ padding: "8px 2px", borderBottom: "1px solid var(--calv-slate-15)" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{clientName(s.clientId)}</span>
                    <CodeChip code={s.code} />
                    <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--calv-slate-65)" }}>{shortDate(s.date)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--calv-slate-65)", marginTop: 2 }}>{s.note}</div>
                </div>
              ))}
          </Panel>
        </div>
      </div>
    </div>
  );
}
