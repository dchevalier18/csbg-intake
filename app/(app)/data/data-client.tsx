"use client";
/* Data & integrations — admin-only. Integration cards + matching stats; toasts only (no writes). */
import { Chip, PageHead, Panel } from "@/components/ui";
import { I } from "@/components/icons";
import { useToast } from "@/components/toast";
import { fmt } from "@/lib/format";

export interface IntegrationRow {
  id: string;
  name: string;
  kind: string;
  status: string;
  lastSync: string;
  records: string;
  detail: string;
}

export interface MatchingStats {
  auto: number;
  staff: number;
  awaiting: number;
  silent: number;
}

const tone: Record<string, string> = { connected: "sage", attention: "amber", ready: "teal" };
const label: Record<string, string> = { connected: "Connected", attention: "Needs attention", ready: "Ready" };

export function DataClient({ integrations, matching }: {
  integrations: IntegrationRow[];
  matching: MatchingStats;
}) {
  const toast = useToast();

  return (
    <div>
      <PageHead
        title="Data &"
        titleAccent="integrations."
        lede="One client record, many sources — sync from existing systems instead of double entry."
        right={
          <button className="calv-btn calv-btn--secondary calv-btn--sm"
            onClick={() => toast("Import wizard opened — select a template to map columns.")}>
            <I name="upload" size={14} /> Import spreadsheet
          </button>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 13, marginBottom: 13 }}>
        {integrations.map((x) => (
          <Panel key={x.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <h3 className="ptitle" style={{ fontSize: 17 }}>{x.name}</h3>
                <p className="psub" style={{ margin: "2px 0 0" }}>{x.detail}</p>
              </div>
              <Chip tone={tone[x.status] ?? ""}>{label[x.status] ?? x.status}</Chip>
            </div>
            <div style={{ display: "flex", gap: 18, fontSize: 12.5, color: "var(--calv-slate-65)", marginTop: 10, flexWrap: "wrap" }}>
              <span><strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>{x.kind}</strong></span>
              <span>Last sync: {x.lastSync}</span>
              <span>{x.records}</span>
            </div>
            {x.status === "attention" ? (
              <div style={{ marginTop: 12, background: "var(--calv-amber-15)", border: "1px solid var(--calv-amber-35)", borderRadius: 4, padding: "9px 12px", fontSize: 12.5, display: "flex", gap: 10, alignItems: "center" }}>
                <I name="alert" size={14} style={{ color: "#8A6410" }} />
                14 incoming HMIS records matched existing clients with conflicts.
                <button className="calv-btn calv-btn--quiet calv-btn--sm" style={{ marginLeft: "auto" }}
                  onClick={() => toast("De-duplication review queued — conflicts assigned to the data team.")}>Review matches</button>
              </div>
            ) : null}
          </Panel>
        ))}
        <Panel>
          <h3 className="ptitle" style={{ fontSize: 17 }}>Add a source</h3>
          <p className="psub">Connect another system over API, or map a recurring CSV/XLSX template.</p>
          <button className="calv-btn calv-btn--ghost calv-btn--sm"
            onClick={() => toast("Connection request sent to IT.")}>
            <I name="plus" size={13} /> Request connection
          </button>
        </Panel>
      </div>

      <Panel title="How matching works" sub="Incoming records are matched on name + DOB + last-4 SSN; conflicts queue for human review — nothing merges silently.">
        <div style={{ display: "flex", gap: 24, fontSize: 12.5, color: "var(--calv-slate-65)", flexWrap: "wrap" }}>
          <span><strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>{fmt(matching.auto)}</strong> records matched automatically this FY</span>
          <span><strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>{fmt(matching.staff)}</strong> resolved by staff review</span>
          <span><strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>{fmt(matching.awaiting)}</strong> awaiting review</span>
          <span><strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>{fmt(matching.silent)}</strong> silent merges — by design</span>
        </div>
      </Panel>
    </div>
  );
}
