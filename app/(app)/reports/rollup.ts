import "server-only";
import { gt, or } from "drizzle-orm";
import { db, t } from "@/db";
import { getOrg, getEnabledIntakeFields, listValuesFor, kvGet } from "@/lib/data/core";
import { fplStatusFor } from "@/lib/fpl";
import { completenessPct } from "@/lib/completeness";
import { ageFromDob, currentFY, todayIso } from "@/lib/format";
import { FPL_BANDS, domainById } from "@/lib/csbg-catalog";
import type { MiniRow, MiniTableData, ReportRollup } from "./types";

/* ============================================================
   Live CSBG Annual Report 3.0 rollup (Module 3 Sections A/B/C).
   Agency-wide by design — reports cover ALL enrolled clients,
   not the caller's program scope. Used by the Reports page and
   the /reports/export download route.
   ============================================================ */

const UNKNOWN = "Unknown / Not Reported";

/** Tally values into fixed categories. Null / unmatched answers roll into an
    "Unknown / Not Reported" row (that's exactly how they land on the federal form). */
function tally(values: Array<string | null | undefined>, cats: string[], filterZero = true): MiniRow[] {
  const m = new Map<string, number>(cats.map((c) => [c, 0]));
  let unknown = 0;
  for (const v of values) {
    if (v && m.has(v)) m.set(v, (m.get(v) ?? 0) + 1);
    else unknown++;
  }
  const rows = cats.map((c) => ({ label: c, n: m.get(c) ?? 0 })).filter((r) => !filterZero || r.n > 0);
  if (unknown > 0) rows.push({ label: UNKNOWN, n: unknown });
  return rows;
}

const AGE_BANDS = ["0-4", "5-17", "18-24", "25-34", "35-44", "45-64", "65-84", "85+"];

function ageBandOf(dob: string): string {
  const a = ageFromDob(dob);
  return a <= 4 ? "0-4" : a <= 17 ? "5-17" : a <= 24 ? "18-24" : a <= 34 ? "25-34"
    : a <= 44 ? "35-44" : a <= 64 ? "45-64" : a <= 84 ? "65-84" : "85+";
}

/** Trim a service label to its headline form ("Utility payment assistance (including …)" → "utility payment assistance"). */
function shortServiceLabel(label: string): string {
  const base = label.replace(/\s*\(.*\)\s*$/, "").trim();
  return base.charAt(0).toLowerCase() + base.slice(1);
}

export function buildRollup(): ReportRollup {
  const fy = currentFY();
  const org = getOrg();
  const fields = getEnabledIntakeFields();
  const clients = db.select().from(t.clients).all().filter((c) => c.status === "active");
  const n = clients.length;

  const agency = kvGet<{ individualsServed: number; householdsServed: number; newThisFY: number }>(
    "agency", { individualsServed: 0, householdsServed: 0, newThisFY: 0 },
  );

  // Records report-ready — % of enrolled records with every report field captured (computed live).
  const readyPct = n === 0 ? 100
    : Math.round((clients.filter((c) => completenessPct(c, fields) === 100).length / n) * 100);

  // ---------- Section C — All Characteristics Report (tallied live) ----------
  const characteristics: MiniTableData[] = [
    { title: "C1 · Sex", code: "Sec. C1", total: n,
      rows: tally(clients.map((c) => c.sex), listValuesFor("sex"), false) },
    { title: "C2 · Age", code: "Sec. C2", total: n,
      rows: tally(clients.map((c) => ageBandOf(c.dob)), AGE_BANDS) },
    { title: "C6 · Race & ethnicity", code: "Sec. C6", total: n,
      rows: tally(clients.map((c) => c.race), listValuesFor("race")) },
    { title: "D9 · Household type", code: "Sec. D9", total: n,
      rows: tally(clients.map((c) => c.hhType), listValuesFor("hhType")) },
    { title: "D11 · Housing", code: "Sec. D11", total: n,
      rows: tally(clients.map((c) => c.housing), listValuesFor("housing")) },
    // D12 — % FPL band computed with each client's PINNED guideline year (point-in-time integrity).
    { title: "D12 · Income level (% FPL)", code: "Sec. D12", total: n,
      rows: tally(clients.map((c) => fplStatusFor(c.income, c.hhSize, c.fplYear, org.csbgCeiling).band), [...FPL_BANDS]) },
  ];

  // ---------- Section A — services by domain ----------
  const srvByDomain = kvGet<Array<{ domain: string; count: number }>>("srvByDomain", [])
    .flatMap((d) => {
      const dom = domainById(d.domain);
      return dom ? [{ domain: d.domain, code: dom.code, name: dom.name, count: d.count }] : [];
    });

  const serviceLabels = new Map(db.select().from(t.services).all().map((s) => [s.code, s.label]));
  const topServices = kvGet<Array<{ code: string; count: number }>>("topServices", [])
    .map((s) => ({ code: s.code, label: shortServiceLabel(serviceLabels.get(s.code) ?? s.code), count: s.count }));

  // ---------- Section B — Individual & Family NPIs ----------
  const fnpi = db.select().from(t.fnpiProgress)
    .where(or(gt(t.fnpiProgress.served, 0), gt(t.fnpiProgress.target, 0)))
    .all()
    .sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }))
    .map((f) => ({ code: f.code, label: f.label, served: f.served, target: f.target, actual: f.actual }));

  return {
    fy: { label: fy.label, short: fy.short, range: fy.range, pctElapsed: fy.pctElapsed },
    orgName: org.name,
    generated: todayIso(),
    agency,
    clientCount: n,
    readyPct,
    characteristics,
    srvByDomain,
    topServices,
    fnpi,
  };
}
