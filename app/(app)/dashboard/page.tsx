import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { visibleClients, visibleProgramIds, getPrograms } from "@/lib/access";
import { openApplications, applicationDocList, kvGet, getEnabledIntakeFields } from "@/lib/data/core";
import { completenessItems, completenessPct } from "@/lib/completeness";
import { DOMAINS } from "@/lib/csbg-catalog";
import { fmt, shortDate, todayIso, currentFY } from "@/lib/format";
import { Kpi, Panel, Chip, CodeChip, Meter, PageHead } from "@/components/ui";
import { I } from "@/components/icons";
import { FollowupsTable, type FollowupRow } from "./dashboard-client";

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const fy = currentFY();
  const today = todayIso();

  const programs = await getPrograms();
  const programById = new Map(programs.map((p) => [p.id, p]));
  const vis = await visibleClients(user);
  const vApps = await openApplications([...await visibleProgramIds(user)]);
  const mine = vis.filter((c) => c.caseworkerId === user.id);

  // live completeness (never stored)
  const fields = await getEnabledIntakeFields();
  const pctOf = new Map(vis.map((c) => [c.id, completenessPct(c, fields)]));
  const avgComplete = vis.length
    ? Math.round(vis.reduce((s, c) => s + (pctOf.get(c.id) ?? 100), 0) / vis.length)
    : 100;
  const issues = vis.filter((c) => (pctOf.get(c.id) ?? 100) < 100);

  const appDocLists = await Promise.all(vApps.map((a) => applicationDocList(a)));
  const docsBlocked = vApps.filter((_, i) => appDocLists[i].some((d) => d.status !== "verified"));
  const readyReview = vApps.filter((a) => a.stage === "review" || a.stage === "decision");
  const oldest = [...vApps].sort((a, b) => a.applied.localeCompare(b.applied))[0];

  // follow-ups
  type FollowClient = (typeof vis)[number] & { nextFollowUp: string };
  const withFollowUp = vis.filter((c): c is FollowClient => !!c.nextFollowUp);
  const followups = [...withFollowUp].sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp)).slice(0, 5);
  const weekEnd = addDaysIso(today, 6);
  const dueThisWeek = withFollowUp.filter((c) => c.nextFollowUp <= weekEnd);
  const dueToday = withFollowUp.filter((c) => c.nextFollowUp <= today);

  const followupRows: FollowupRow[] = followups.map((c) => {
    const p = programById.get(c.programIds[0]);
    return {
      id: c.id,
      name: `${c.first} ${c.last}`,
      programColor: p?.color ?? "var(--calv-slate-35)",
      programShort: p?.short ?? c.programIds[0],
      dueToday: c.nextFollowUp <= today,
      dueLabel: shortDate(c.nextFollowUp),
      what: c.flags[0] || "Quarterly case-plan review",
    };
  });

  // agency pulse aggregates (history predating this system)
  const agency = await kvGet<{ individualsServed: number }>("agency", { individualsServed: 0 });
  const srvByDomain = await kvGet<Array<{ domain: string; count: number }>>("srvByDomain", []);
  const maxSrv = srvByDomain.length ? Math.max(...srvByDomain.map((d) => d.count)) : 1;

  const todayLong = new Date(today + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div data-screen-label="Dashboard">
      <PageHead
        title="Good morning,"
        titleAccent={user.name.split(" ")[0] + "."}
        lede={`${todayLong} · ${mine.length} active case${mine.length === 1 ? "" : "s"} · ${readyReview.length} application${readyReview.length === 1 ? "" : "s"} awaiting decisions`}
        right={
          <Link className="calv-btn calv-btn--ghost calv-btn--sm" href="/reports" style={{ textDecoration: "none" }}>
            {fy.short} rollup preview <I name="arrow" size={14} />
          </Link>
        }
      />

      <div className="kpis">
        <Kpi kick="My active caseload" value={mine.length} foot={"across " + new Set(mine.flatMap((c) => c.programIds)).size + " programs"} />
        <Kpi kick="Pending applications" value={vApps.length} foot={docsBlocked.length + " waiting on documents"} tone="bad" accent="var(--calv-amber)" />
        <Kpi kick="Follow-ups due this week" value={dueThisWeek.length} foot={dueToday.length + " due today"} accent="var(--calv-teal)" />
        <Kpi kick="CSBG data completeness" value={avgComplete + "%"} foot={issues.length + " records missing characteristics"} tone={avgComplete >= 90 ? "good" : "bad"} accent="var(--calv-sage)" />
      </div>

      <div className="row2">
        <Panel title="Follow-ups & outcome check-ins" sub="Scheduled FNPI outcome verifications and case-plan reviews, soonest first.">
          <FollowupsTable rows={followupRows} />
        </Panel>

        <Panel title="Eligibility queue" sub="Applications by stage — clear documents to keep enrollments moving."
          right={<Link className="calv-btn calv-btn--quiet calv-btn--sm" href="/eligibility" style={{ textDecoration: "none" }}>Open queue</Link>}>
          {[
            { label: "Waiting on documents", n: vApps.filter((a) => a.stage === "docs").length, tone: "amber" },
            { label: "Ready for review", n: vApps.filter((a) => a.stage === "review").length, tone: "teal" },
            { label: "Awaiting decision", n: vApps.filter((a) => a.stage === "decision").length, tone: "red" },
          ].map((s) => (
            <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 2px", borderBottom: "1px solid var(--calv-slate-15)" }}>
              <span style={{ fontSize: 13 }}>{s.label}</span>
              <Chip tone={s.tone}>{s.n}</Chip>
            </div>
          ))}
          <div style={{ marginTop: 14, fontSize: 12, color: "var(--calv-slate-65)", lineHeight: 1.5 }}>
            {oldest ? (
              <span>
                <strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>Oldest:</strong>{" "}
                {oldest.first} {oldest.last} — applied {new Date(oldest.applied + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}, {programById.get(oldest.programId)?.short ?? oldest.programId}.
              </span>
            ) : "Queue is clear for your programs."}
          </div>
        </Panel>
      </div>

      <div className="row2">
        <Panel title="Agency pulse · services this FY" sub={"Unduplicated service counts by CSBG domain · " + fmt(agency.individualsServed) + " individuals served"}>
          <div className="bars-h">
            {srvByDomain.map((d) => {
              const dom = DOMAINS.find((x) => x.id === d.domain);
              if (!dom) return null;
              return (
                <div className="bar-h" key={d.domain}>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>{dom.name} <CodeChip code={dom.code} /></span>
                  <div className="track"><i style={{ width: (d.count / maxSrv * 100) + "%" }}></i></div>
                  <span className="v">{fmt(d.count)}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Data quality" sub="Records missing All Characteristics Report fields (Module 3, Sec. C).">
          {issues.slice(0, 4).map((c) => {
            const missing = completenessItems(c, fields).filter((i) => !i.filled).map((i) => i.label).join(" · ");
            return (
              <div key={c.id} style={{ padding: "9px 2px", borderBottom: "1px solid var(--calv-slate-15)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <Link className="tlink" style={{ fontSize: 13, fontWeight: 600, textDecoration: "none" }} href={`/clients/${c.id}`}>{c.first} {c.last}</Link>
                  <span style={{ fontSize: 11.5, color: "var(--calv-slate-65)" }}>{missing || "Partial demographics"}</span>
                </div>
                <Meter pct={pctOf.get(c.id) ?? 100} />
              </div>
            );
          })}
          <div style={{ marginTop: 12 }}>
            <Link className="tlink" style={{ fontSize: 12.5 }} href="/reports">See how this affects the {fy.short} Annual Report →</Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
