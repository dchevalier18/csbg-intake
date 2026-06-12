"use client";
/* Settings → Services — catalog editor + per-program availability. */
import { useState } from "react";
import { Chip, CodeChip, Field, Panel, ProgramDot } from "@/components/ui";
import { Modal, Seg } from "@/components/ui-client";
import { I } from "@/components/icons";
import { useToast } from "@/components/toast";
import { createService, updateService, setProgramServices } from "./actions";

export interface ServiceRow {
  code: string;
  domain: string;
  label: string;
  active: boolean;
}

export interface DomainOption {
  id: string;
  name: string;
}

export interface ProgramRow {
  id: string;
  name: string;
  short: string;
  color: string;
}

const AVAILABILITY_MODES = ["Full catalog", "Limited list"];

export function ServicesSettingsClient({ services, domains, programs, restrictions, usage }: {
  services: ServiceRow[];
  domains: DomainOption[];
  programs: ProgramRow[];
  restrictions: Record<string, string[]>;
  usage: Record<string, number>;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<ServiceRow | "new" | null>(null);
  const [showRetired, setShowRetired] = useState(false);

  const activeCount = services.filter((s) => s.active).length;
  const retiredCount = services.length - activeCount;
  const shown = showRetired ? services : services.filter((s) => s.active);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      <Panel
        title="Service catalog"
        sub={`${activeCount} active service${activeCount === 1 ? "" : "s"}${retiredCount ? ` · ${retiredCount} retired` : ""} — labels and codes feed the Annual Report rollup, so retire services instead of deleting them.`}
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {retiredCount > 0 ? (
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "var(--calv-slate-65)", cursor: "pointer" }}>
                <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} style={{ accentColor: "var(--brand)" }} />
                Show retired
              </label>
            ) : null}
            <button type="button" className="calv-btn calv-btn--primary calv-btn--sm" onClick={() => setEditing("new")}>
              <I name="plus" size={14} /> Add service
            </button>
          </div>
        }
      >
        {domains.map((d) => {
          const group = shown.filter((s) => s.domain === d.id);
          if (group.length === 0) return null;
          return (
            <div key={d.id} style={{ marginBottom: 14 }}>
              <div style={{
                fontFamily: "var(--font-sub)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em",
                textTransform: "uppercase", color: "var(--calv-slate-65)", padding: "6px 0", borderBottom: "1px solid var(--calv-slate-15)",
              }}>{d.name}</div>
              {group.map((s) => (
                <div key={s.code} style={{ display: "flex", gap: 9, alignItems: "center", padding: "8px 2px", borderBottom: "1px solid var(--calv-slate-15)", opacity: s.active ? 1 : 0.55 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{s.label}</span>
                  <CodeChip code={s.code} />
                  {!s.active ? <Chip tone="amber">Retired</Chip> : null}
                  <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--calv-slate-65)", whiteSpace: "nowrap" }}>
                    {usage[s.code] ? `${usage[s.code]} logged` : "never logged"}
                  </span>
                  <button type="button" className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setEditing(s)} title={`Edit ${s.code}`}>
                    <I name="edit" size={13} />
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </Panel>

      <ProgramAvailability services={services.filter((s) => s.active)} domains={domains} programs={programs} restrictions={restrictions} toast={toast} />

      {editing ? (
        <ServiceEditor service={editing === "new" ? null : editing} domains={domains} onClose={() => setEditing(null)} toast={toast} />
      ) : null}
    </div>
  );
}

function ServiceEditor({ service, domains, onClose, toast }: {
  service: ServiceRow | null;
  domains: DomainOption[];
  onClose: () => void;
  toast: (msg: string) => void;
}) {
  const isNew = !service;
  const [code, setCode] = useState(service ? service.code : "");
  const [label, setLabel] = useState(service ? service.label : "");
  const [domain, setDomain] = useState(service ? service.domain : domains[0].id);
  const [active, setActive] = useState(service ? service.active : true);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    const res = isNew
      ? await createService({ code, domain, label })
      : await updateService(service!.code, { domain, label, active });
    setBusy(false);
    toast(res.message);
    if (res.ok) onClose();
  }

  return (
    <Modal title={isNew ? "Add a service" : `Edit ${service!.code}`} width={520} onClose={onClose}>
      <div className="fgrid">
        {isNew ? (
          <Field label="Service code" required hint="The CSBG report code (e.g. “SRV 4i”) or an agency code (e.g. “CALV 1”). Codes can't change later — entries reference them.">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="SRV 4i" autoFocus />
          </Field>
        ) : null}
        <Field label="Label" required>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What staff see in the picker" autoFocus={!isNew} />
        </Field>
        <Field label="Reporting domain" required hint="Where this service tallies in Module 3, Section A.">
          <select value={domain} onChange={(e) => setDomain(e.target.value)}>
            {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        {!isNew ? (
          <Field label="Status" hint={active ? "Active — offered in pickers (subject to program availability)." : "Retired — hidden from every picker; logged history keeps reporting."}>
            <Seg options={["Active", "Retired"]} value={active ? "Active" : "Retired"} onChange={(v) => setActive(v === "Active")} />
          </Field>
        ) : null}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <button type="button" className="calv-btn calv-btn--quiet calv-btn--sm" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="calv-btn calv-btn--primary calv-btn--sm"
          disabled={!label.trim() || (isNew && !code.trim()) || busy}
          style={!label.trim() || (isNew && !code.trim()) || busy ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
          onClick={() => void submit()}
        >
          <I name="check" size={14} /> {isNew ? "Add service" : "Save changes"}
        </button>
      </div>
    </Modal>
  );
}

function ProgramAvailability({ services, domains, programs, restrictions, toast }: {
  services: ServiceRow[];
  domains: DomainOption[];
  programs: ProgramRow[];
  restrictions: Record<string, string[]>;
  toast: (msg: string) => void;
}) {
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const [mode, setMode] = useState(() => restrictions[programs[0]?.id ?? ""] ? AVAILABILITY_MODES[1] : AVAILABILITY_MODES[0]);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(restrictions[programs[0]?.id ?? ""] ?? []));
  const [busy, setBusy] = useState(false);

  const program = programs.find((p) => p.id === programId);
  const limited = mode === AVAILABILITY_MODES[1];

  function pickProgram(id: string) {
    setProgramId(id);
    setMode(restrictions[id] ? AVAILABILITY_MODES[1] : AVAILABILITY_MODES[0]);
    setChecked(new Set(restrictions[id] ?? []));
  }
  function toggle(code: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }
  function setDomainAll(domainId: string, on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const s of services) if (s.domain === domainId) { if (on) next.add(s.code); else next.delete(s.code); }
      return next;
    });
  }

  async function save() {
    if (!programId || busy) return;
    setBusy(true);
    const res = await setProgramServices(programId, limited ? [...checked] : null);
    setBusy(false);
    toast(res.message);
  }

  if (programs.length === 0) return null;

  return (
    <Panel
      title="Program availability"
      sub="Not every program offers every service — a limited list keeps that program's pickers (service log, client profiles) to what applies."
      right={
        <div className="field" style={{ width: 250 }}>
          <select value={programId} onChange={(e) => pickProgram(e.target.value)}>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      }
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        {program ? <ProgramDot color={program.color} label={program.short} /> : null}
        <Seg options={AVAILABILITY_MODES} value={mode} onChange={setMode} />
        <span style={{ fontSize: 12.5, color: "var(--calv-slate-65)" }}>
          {limited
            ? `${checked.size} of ${services.length} services selected`
            : `All ${services.length} active services offered (default).`}
        </span>
        <button
          type="button"
          className="calv-btn calv-btn--primary calv-btn--sm"
          style={{ marginLeft: "auto", ...(busy || (limited && checked.size === 0) ? { opacity: 0.45, cursor: "not-allowed" } : {}) }}
          disabled={busy || (limited && checked.size === 0)}
          onClick={() => void save()}
        >
          <I name="check" size={13} /> Save availability
        </button>
      </div>

      {limited ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px", alignItems: "start" }}>
          {domains.map((d) => {
            const group = services.filter((s) => s.domain === d.id);
            if (group.length === 0) return null;
            const onCount = group.filter((s) => checked.has(s.code)).length;
            return (
              <div key={d.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid var(--calv-slate-15)" }}>
                  <span style={{
                    fontFamily: "var(--font-sub)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em",
                    textTransform: "uppercase", color: "var(--calv-slate-65)",
                  }}>{d.name}</span>
                  <span style={{ fontSize: 11, color: "var(--calv-slate-35)" }}>{onCount}/{group.length}</span>
                  <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <button type="button" className="tlink" style={{ fontSize: 11.5 }} onClick={() => setDomainAll(d.id, true)}>All</button>
                    <button type="button" className="tlink" style={{ fontSize: 11.5 }} onClick={() => setDomainAll(d.id, false)}>None</button>
                  </span>
                </div>
                {group.map((s) => (
                  <label key={s.code} style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 2px", fontSize: 12.5, cursor: "pointer" }}>
                    <input type="checkbox" checked={checked.has(s.code)} onChange={() => toggle(s.code)} style={{ accentColor: "var(--brand)", flex: "none" }} />
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.label}>{s.label}</span>
                    <span className="code-chip" style={{ marginLeft: "auto", flex: "none" }}>{s.code}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      ) : null}
    </Panel>
  );
}
