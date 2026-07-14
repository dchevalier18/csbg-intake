"use client";
import { useEffect, useState } from "react";
import { Panel, Field, Chip } from "@/components/ui";
import { I } from "@/components/icons";
import { useToast } from "@/components/toast";
import { money, longDate } from "@/lib/format";
import { patchActiveFpl, setCsbgCeiling, publishFpl, makeFplActive, setJurisdiction, setFplEffective, officialFplFor } from "./actions";

interface Sched {
  year: number;
  base: number;
  perAdditional: number;
  effective: string;
  status: string;
  jurisdiction: string | null;
}

const histDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function FplClient({ history, ceiling: ceilingProp, pinned, jurisdiction: jurisdictionProp, jurisdictions }: {
  history: Sched[]; ceiling: number; pinned: Record<number, number>;
  jurisdiction: string; jurisdictions: Array<{ id: string; label: string }>;
}) {
  const toast = useToast();
  const sorted = [...history].sort((a, b) => b.year - a.year);
  const active = sorted.find((s) => s.status === "active") ?? sorted[0];

  const [base, setBase] = useState(String(active?.base ?? 0));
  const [per, setPer] = useState(String(active?.perAdditional ?? 0));
  const [ceiling, setCeiling] = useState(ceilingProp);
  const [jurisdiction, setJurisdictionState] = useState(jurisdictionProp);
  const [showPublish, setShowPublish] = useState(false);
  const [pYear, setPYear] = useState(String((active?.year ?? 2026) + 1));
  const [pBase, setPBase] = useState(String(active?.base ?? 0));
  const [pPer, setPPer] = useState(String(active?.perAdditional ?? 0));
  const [pEffective, setPEffective] = useState("");
  const [pActivate, setPActivate] = useState(true);
  const [prefillNote, setPrefillNote] = useState<string | null>(null);

  useEffect(() => {
    setBase(String(active?.base ?? 0));
    setPer(String(active?.perAdditional ?? 0));
    setPYear(String((active?.year ?? 2026) + 1));
    setPBase(String(active?.base ?? 0));
    setPPer(String(active?.perAdditional ?? 0));
  }, [active?.year, active?.base, active?.perAdditional]);
  useEffect(() => { setCeiling(ceilingProp); }, [ceilingProp]);
  useEffect(() => { setJurisdictionState(jurisdictionProp); }, [jurisdictionProp]);

  // Prefill "Publish new year" with the official HHS figures for the chosen
  // year + agency jurisdiction, when this build carries them.
  useEffect(() => {
    let cancelled = false;
    const y = Number(pYear);
    if (!Number.isFinite(y)) return;
    // A prior year is a history backfill — default to publishing it archived,
    // so the current schedule stays in force for new assessments.
    setPActivate(y > (active?.year ?? 0));
    officialFplFor(y).then((o) => {
      if (cancelled) return;
      if (o) {
        setPBase(String(o.base));
        setPPer(String(o.perAdditional));
        setPEffective(o.effective);
        setPrefillNote(`Prefilled from the published HHS ${y} table (${o.label}), effective ${longDate(o.effective)}.`);
      } else {
        setPEffective(y >= 2000 && y <= 2100 ? `${y}-01-01` : "");
        setPrefillNote(null);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pYear, jurisdiction, showPublish]);

  if (!active) return null;

  const b = Number(base) || 0;
  const p = Number(per) || 0;
  const annualOf = (size: number) => b + p * (size - 1);
  const sizes = [1, 2, 3, 4, 5, 6, 7, 8];
  const jurisdictionLabelOf = (id: string | null) => jurisdictions.find((j) => j.id === id)?.label;

  async function commitActive() {
    if (!active) return;
    const nb = Number(base) || 0;
    const np = Number(per) || 0;
    if (nb === active.base && np === active.perAdditional) return;
    const res = await patchActiveFpl(nb, np);
    if (!res.ok) {
      if (res.message) toast(res.message);
      // revert the rejected edit so the inputs show the real schedule
      setBase(String(active.base));
      setPer(String(active.perAdditional));
    }
  }

  async function onCeiling(v: number) {
    setCeiling(v);
    const res = await setCsbgCeiling(v);
    if (!res.ok && res.message) toast(res.message);
  }

  async function onJurisdiction(id: string) {
    setJurisdictionState(id);
    const res = await setJurisdiction(id);
    if (res.message) toast(res.message);
  }

  async function onPublish() {
    const res = await publishFpl(Number(pYear), Number(pBase), Number(pPer), { activate: pActivate, effective: pEffective });
    if (res.ok) setShowPublish(false);
    if (res.message) toast(res.message);
  }

  async function onEffective(year: number, effective: string) {
    const res = await setFplEffective(year, effective);
    if (res.message) toast(res.message);
  }

  async function onMakeActive(year: number) {
    const res = await makeFplActive(year);
    if (res.message) toast(res.message);
  }

  return (
    <div>
      <div className="row2" style={{ gridTemplateColumns: "1fr 1.15fr", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <Panel title={"Active schedule · FPL " + active.year} sub="Used for every NEW assessment from today forward. Once any case is assessed under this year its amounts lock — publish a corrected guideline year for changes, so prior determinations are never rewritten.">
            <div className="fgrid c2">
              <Field label="Household of 1 (annual $)"><input type="number" step="10" value={base} onChange={(e) => setBase(e.target.value)} onBlur={commitActive} /></Field>
              <Field label="Each additional person (+$)"><input type="number" step="10" value={per} onChange={(e) => setPer(e.target.value)} onBlur={commitActive} /></Field>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--calv-slate-65)", margin: "12px 0 0" }}>
              Effective {longDate(active.effective)}
              {jurisdictionLabelOf(active.jurisdiction) ? ` · ${jurisdictionLabelOf(active.jurisdiction)} table` : ""}.
            </p>
          </Panel>
          <Panel title="Guideline table (jurisdiction)" sub="HHS publishes separate tables for the 48 contiguous states & D.C., Alaska, and Hawaii. This choice prefills future publishes — years already published keep their stored dollars.">
            <div className="field" style={{ maxWidth: 280 }}>
              <select value={jurisdiction} onChange={(e) => onJurisdiction(e.target.value)}>
                {jurisdictions.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
              </select>
            </div>
          </Panel>
          <Panel title="CSBG income ceiling" sub="Your state's eligibility limit as a percentage of FPL. Applied at assessment time against the schedule in force.">
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div className="field" style={{ width: 150 }}>
                <select value={ceiling} onChange={(e) => onCeiling(Number(e.target.value))}>{[100, 125, 150, 175, 200].map((pc) => <option key={pc} value={pc}>{pc}% FPL</option>)}</select>
              </div>
              <span style={{ fontSize: 12.5, color: "var(--calv-slate-65)" }}>A household of 3 currently qualifies up to <strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>{money(annualOf(3) * ceiling / 100)}/yr</strong>.</span>
            </div>
          </Panel>
        </div>
        <Panel title={"Preview · FPL " + active.year} sub={"Annual guideline by household size, with your " + ceiling + "% ceiling applied."}>
          <table className="data">
            <thead><tr><th>Household size</th><th className="num">100% FPL (annual)</th><th className="num">Monthly</th><th className="num">{ceiling}% ceiling</th></tr></thead>
            <tbody>
              {sizes.map((s) => (
                <tr key={s}>
                  <td className="cname">{s}</td>
                  <td className="num">{money(annualOf(s))}</td>
                  <td className="num" style={{ color: "var(--calv-slate-65)" }}>{money(annualOf(s) / 12)}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{money(annualOf(s) * ceiling / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 11.5, color: "var(--calv-slate-65)", marginTop: 12 }}>For households over 8, add {money(p)} per additional person.</p>
        </Panel>
      </div>

      <Panel title="Guideline history" sub="Every schedule ever configured stays on record. Enrolled and closed cases keep the schedule they were assessed under — publishing a new year never rewrites a prior eligibility determination."
        right={<button className="calv-btn calv-btn--primary calv-btn--sm" onClick={() => setShowPublish((s) => !s)}><I name="plus" size={13} /> Add guideline year</button>}>
        {showPublish ? (
          <div style={{ margin: "4px 0 18px", padding: "14px 16px", background: "var(--calv-sand-15)", border: "1px solid var(--calv-sand-35)", borderRadius: 4 }}>
            <div className="calv-label" style={{ marginBottom: 10 }}>Publish a guideline year</div>
            <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr 160px", gap: 12, alignItems: "end" }}>
              <Field label="Year"><input type="number" value={pYear} onChange={(e) => setPYear(e.target.value)} /></Field>
              <Field label="Household of 1 (annual $)"><input type="number" step="10" value={pBase} onChange={(e) => setPBase(e.target.value)} /></Field>
              <Field label="Each additional person (+$)"><input type="number" step="10" value={pPer} onChange={(e) => setPPer(e.target.value)} /></Field>
              <Field label="Effective date"><input type="date" value={pEffective} onChange={(e) => setPEffective(e.target.value)} /></Field>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
                <input type="checkbox" checked={pActivate} onChange={(e) => setPActivate(e.target.checked)} />
                Make it the active schedule for new assessments
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setShowPublish(false)}>Cancel</button>
                <button className="calv-btn calv-btn--primary calv-btn--sm" onClick={onPublish}>
                  <I name="check" size={13} /> {pActivate ? "Publish & activate" : "Publish to history"}
                </button>
              </div>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--calv-slate-65)", margin: "10px 0 0" }}>
              {prefillNote ?? "No published HHS table for that year ships with this build — enter the Federal Register figures."}{" "}
              {pActivate
                ? "The current schedule is archived automatically. New intakes assess against the new year; nothing already assessed is recalculated."
                : `FPL ${active.year} stays active — the year lands in the history for prior-year cases and date-based imports. You can activate it later from the table below.`}
            </p>
          </div>
        ) : null}
        <table className="data">
          <thead><tr><th>Guideline year</th><th className="num">Household of 1</th><th className="num">Each additional</th><th>Effective</th><th>Table</th><th>Status</th><th className="num">Cases pinned</th><th></th></tr></thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.year}>
                <td className="cname">FPL {s.year}</td>
                <td className="num">{money(s.base)}</td>
                <td className="num">{money(s.perAdditional)}</td>
                <td>
                  <input
                    type="date"
                    defaultValue={s.effective}
                    onBlur={(e) => { if (e.target.value && e.target.value !== s.effective) void onEffective(s.year, e.target.value); }}
                    aria-label={"Effective date for FPL " + s.year}
                    style={{ border: "1px solid transparent", background: "transparent", font: "inherit", padding: "2px 4px", borderRadius: 4, width: 140 }}
                    onFocus={(e) => { e.target.style.border = "1px solid var(--calv-slate-35)"; e.target.style.background = "#fff"; }}
                  />
                </td>
                <td style={{ fontSize: 12, color: "var(--calv-slate-65)" }}>{jurisdictionLabelOf(s.jurisdiction) ?? "—"}</td>
                <td>{s.status === "active" ? <Chip tone="sage">Active</Chip> : <Chip>Archived</Chip>}</td>
                <td className="num">{pinned[s.year] || "—"}</td>
                <td style={{ textAlign: "right" }}>{s.status !== "active" ? <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => onMakeActive(s.year)}>Make active</button> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--calv-slate-65)", marginTop: 14, lineHeight: 1.55 }}>
          <strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>How pinning works:</strong> every intake and eligibility determination stores the guideline year it was assessed against. Client profiles, the eligibility queue, and the D12 income-level report all calculate from the pinned schedule — so a case enrolled under FPL {active.year - 1} keeps its original determination even after FPL {active.year} goes live.
        </p>
      </Panel>
    </div>
  );
}
