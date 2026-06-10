"use client";
import { useTransition, type CSSProperties } from "react";
import { Chip, Panel } from "@/components/ui";
import { I } from "@/components/icons";
import { money } from "@/lib/format";
import { useToast } from "@/components/toast";
import { assignRequirement, completeMilestone } from "./actions";

export interface ProjectDTO {
  id: string;
  name: string;
  town: string;
  buyer: string;
  budget: number;
  spent: number;
  pct: number;
  milestones: { id: number; label: string; done: boolean; current: boolean }[];
  requirements: { id: number; label: string; status: string }[];
}

function circleStyle(m: { done: boolean; current: boolean }): CSSProperties {
  return {
    width: 18, height: 18, borderRadius: 99, flex: "none", display: "flex", alignItems: "center", justifyContent: "center",
    background: m.done ? "var(--calv-sage)" : m.current ? "var(--calv-amber)" : "var(--calv-slate-15)",
    color: m.done || m.current ? "#fff" : "var(--calv-slate-65)",
  };
}

export function ProjectsClient({ projects, programShort }: {
  projects: ProjectDTO[]; programShort: string;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const onComplete = (projectId: string, milestoneId: number) => {
    startTransition(async () => {
      const res = await completeMilestone(projectId, milestoneId);
      toast(res.message);
    });
  };

  const onAssign = (requirementId: number) => {
    startTransition(async () => {
      const res = await assignRequirement(requirementId);
      toast(res.message);
    });
  };

  return (
    <div data-screen-label="CA Homes projects">
      <div style={{ marginBottom: 12 }}>
        <a className="tlink" style={{ fontSize: 12.5, textDecoration: "none", cursor: "pointer" }} onClick={() => history.back()}>← Back</a>
      </div>
      <div className="page-head">
        <div>
          <h1 className="page-h1">{programShort} <span className="red">projects.</span></h1>
          <p className="lede">Affordable-homeownership construction — milestones, budgets, and the federal compliance paperwork each funding source demands.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
        {projects.map((p) => {
          const firstUndoneId = p.milestones.find((m) => !m.done)?.id;
          return (
            <Panel key={p.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div>
                  <h3 className="ptitle" style={{ fontSize: 17 }}>{p.name}</h3>
                  <p className="psub" style={{ margin: "2px 0 0" }}>{p.town} · {p.buyer}</p>
                </div>
                <Chip tone="sage">{p.pct}% complete</Chip>
              </div>

              <div style={{ display: "flex", gap: 14, alignItems: "baseline", margin: "12px 0 6px" }}>
                <span style={{ fontFamily: "var(--font-h1)", fontSize: 26 }}>{money(p.spent)}</span>
                <span style={{ fontSize: 12.5, color: "var(--calv-slate-65)" }}>of {money(p.budget)} budget</span>
              </div>
              <div className="meter" style={{ marginBottom: 18 }}><i style={{ width: (p.budget ? p.spent / p.budget * 100 : 0) + "%", background: "var(--calv-teal)" }}></i></div>

              <h4 className="calv-label" style={{ marginBottom: 8 }}>Milestones</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 18 }}>
                {p.milestones.map((m, i) => {
                  const clickable = !m.done && (m.current || m.id === firstUndoneId);
                  const inner = m.done
                    ? <I name="check" size={11} />
                    : <span style={{ fontFamily: "var(--font-h1)", fontSize: 10 }}>{i + 1}</span>;
                  return (
                    <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "5px 0", fontSize: 13 }}>
                      {clickable ? (
                        <button type="button" title="Mark milestone complete" disabled={pending}
                          onClick={() => onComplete(p.id, m.id)}
                          style={{ ...circleStyle(m), border: 0, padding: 0, cursor: "pointer" }}>{inner}</button>
                      ) : (
                        <span style={circleStyle(m)}>{inner}</span>
                      )}
                      <span style={{ color: m.done ? "var(--calv-slate)" : m.current ? "var(--calv-slate)" : "var(--calv-slate-65)", fontWeight: m.current ? 600 : 300 }}>
                        {m.label}{m.current ? " — in progress" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>

              <h4 className="calv-label" style={{ marginBottom: 8 }}>Compliance requirements</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {p.requirements.map((r) => (
                  <div key={r.id} style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", padding: "8px 12px", border: "1px solid var(--calv-slate-15)", borderRadius: 4, fontSize: 12.5 }}>
                    {r.label}
                    {r.status === "current" ? <Chip tone="sage">Current</Chip> :
                      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Chip tone="amber">Due</Chip>
                        <button className="calv-btn calv-btn--quiet calv-btn--sm" disabled={pending} onClick={() => onAssign(r.id)}>Assign</button>
                      </span>}
                  </div>
                ))}
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
