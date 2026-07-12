import ExcelJS from "exceljs";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/access";
import { fmt } from "@/lib/format";
import { CATALOG_VERSION } from "@/lib/csbg-catalog";
import { buildRollup } from "../rollup";
import { fnpiStats, type ReportRollup } from "../types";

/* ============================================================
   GET /reports/export          → CSV rollup (Module 3 A/B/C)
   GET /reports/export?packet=1 → Draft Annual Report packet (Markdown)
   GET /reports/export?xlsx=1   → Module 3 workbook (Excel), shaped like the
                                  OCS SmartForm sections for transcription
                                  into the state submission
   All stream real files generated from live data.
   ============================================================ */

export const dynamic = "force-dynamic";

// ---------- CSV helpers ----------
const esc = (v: string | number): string => {
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const row = (...cells: Array<string | number>): string => cells.map(esc).join(",");

function buildCsv(d: ReportRollup): string {
  const L: string[] = [];
  L.push(row(`CSBG Annual Report 3.0 (OMB 0970-0492) — ${d.fy.short} rollup`));
  L.push(row("Agency", d.orgName));
  L.push(row("Fiscal year", `${d.fy.label} (${d.fy.range})`));
  L.push(row("Generated", d.generated));
  L.push(row("Records report-ready", d.readyPct + "%"));
  L.push("");

  L.push(row("MODULE 3 SEC. C — SUMMARY"));
  L.push(row("Line", "Measure", "Value"));
  L.push(row("A", "Individuals served (unduplicated)", d.agency.individualsServed));
  L.push(row("B", "Households served (unduplicated)", d.agency.householdsServed));
  L.push(row("", "New enrollments this FY", d.agency.newThisFY));
  L.push(row("", "Individuals with 1+ characteristics obtained (live records)", d.sectionCTotals.individuals));
  L.push(row("", "Households with 1+ characteristics obtained (live records)", d.sectionCTotals.households));
  L.push("");

  const dq = d.dataQuality.filter((q) => q.unknown > 0 || q.drift.length > 0);
  if (dq.length > 0) {
    L.push(row("SEC. C VALIDATION — UNKNOWNS AND ANSWER-LIST DRIFT"));
    L.push(row("Characteristic", "Unknown / Not Reported", "Unmatched stored values"));
    for (const q of dq) {
      L.push(row(q.title, q.unknown > 0 ? `${q.unknown} of ${q.total}` : "",
        q.drift.map((x) => `${x.value} x${x.count}`).join(" · ")));
    }
    L.push("");
  }

  L.push(row("MODULE 3 SEC. C — ALL CHARACTERISTICS REPORT"));
  for (const m of d.characteristics) {
    L.push(row(m.code, m.title));
    L.push(row("Answer", "Count"));
    for (const r of m.rows) L.push(row(r.label, r.n));
    L.push(row("TOTAL", m.total));
    L.push("");
  }

  L.push(row("MODULE 3 SEC. A — SERVICES BY DOMAIN"));
  L.push(row("Code", "Domain", "Individuals served"));
  for (const s of d.srvByDomain) L.push(row(s.code, s.name, s.count));
  L.push("");
  L.push(row("TOP SINGLE SERVICES"));
  L.push(row("Code", "Service", "Count"));
  for (const s of d.topServices) L.push(row(s.code, s.label, s.count));
  L.push("");

  L.push(row("MODULE 3 SEC. B — INDIVIDUAL & FAMILY NPIs"));
  L.push(row("Code", "Indicator", "Served", "Target", "Actual", "% achieving", "Target accuracy", "Pace"));
  for (const f of d.fnpi) {
    const s = fnpiStats(f, d.fy.pctElapsed);
    L.push(row(f.code, f.label, f.served, f.target, f.actual, s.achieving + "%", s.accuracy + "%", s.onPace ? "On pace" : "Behind"));
  }
  L.push("");
  L.push(row(`${d.fy.pctElapsed}% of the FY has elapsed — indicators under ${d.fy.pctElapsed - 5}% of target are flagged.`));
  // UTF-8 BOM so Excel renders em dashes / accents correctly
  return "\uFEFF" + L.join("\r\n") + "\r\n";
}

// ---------- Draft Annual Report packet (Markdown) ----------
function buildPacket(d: ReportRollup): string {
  const md = (s: string | number): string => String(s).replace(/\|/g, "\\|");
  const out: string[] = [];
  out.push(`# CSBG Annual Report 3.0 — ${d.fy.short} Draft`);
  out.push("");
  out.push(`**OMB 0970-0492 · Module 3 Sections A, B & C** — drafted ${d.generated} from live records.`);
  out.push("");
  out.push(`- Agency: ${d.orgName}`);
  out.push(`- Fiscal year: ${d.fy.label} (${d.fy.range}) — ${d.fy.pctElapsed}% elapsed`);
  out.push(`- Records report-ready: ${d.readyPct}% (${100 - d.readyPct}% have Unknown / Not Reported fields)`);
  out.push("");

  out.push("## Module 3, Section C — Summary");
  out.push("");
  out.push("| Line | Measure | Value |");
  out.push("| --- | --- | ---: |");
  out.push(`| A | Individuals served (unduplicated) | ${fmt(d.agency.individualsServed)} |`);
  out.push(`| B | Households served (unduplicated) | ${fmt(d.agency.householdsServed)} |`);
  out.push(`|   | New enrollments this FY | ${fmt(d.agency.newThisFY)} |`);
  out.push(`|   | Individuals with 1+ characteristics obtained (live records) | ${fmt(d.sectionCTotals.individuals)} |`);
  out.push(`|   | Households with 1+ characteristics obtained (live records) | ${fmt(d.sectionCTotals.households)} |`);
  out.push("");
  const dq = d.dataQuality.filter((q) => q.unknown > 0 || q.drift.length > 0);
  if (dq.length > 0) {
    out.push("### Section C validation — unknowns and answer-list drift");
    out.push("");
    out.push("| Characteristic | Unknown / Not Reported | Unmatched stored values |");
    out.push("| --- | --- | --- |");
    for (const q of dq) {
      out.push(`| ${md(q.title)} | ${q.unknown > 0 ? `${q.unknown} of ${q.total}` : "—"} | ${md(q.drift.map((x) => `“${x.value}” ×${x.count}`).join(" · ")) || "—"} |`);
    }
    out.push("");
  }

  out.push("## Module 3, Section A — Services by domain");
  out.push("");
  out.push(`Unduplicated individuals served, ${d.fy.short} to date.`);
  out.push("");
  out.push("| Code | Domain | Individuals served |");
  out.push("| --- | --- | ---: |");
  for (const s of d.srvByDomain) out.push(`| ${md(s.code)} | ${md(s.name)} | ${fmt(s.count)} |`);
  out.push("");
  out.push(`Top single services: ${d.topServices.map((s) => `${s.code} ${s.label} (${fmt(s.count)})`).join(" · ")}.`);
  out.push("");

  out.push("## Module 3, Section B — Individual & Family NPIs");
  out.push("");
  out.push(`Actuals vs ${d.fy.short} targets. 'Achieving outcome' = actual ÷ number served; 'target accuracy' = actual ÷ target.`);
  out.push("");
  out.push("| Code | Indicator | Served | Target | Actual | % achieving | Target accuracy | Pace |");
  out.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |");
  for (const f of d.fnpi) {
    const s = fnpiStats(f, d.fy.pctElapsed);
    out.push(`| ${md(f.code)} | ${md(f.label)} | ${fmt(f.served)} | ${fmt(f.target)} | ${fmt(f.actual)} | ${s.achieving}% | ${s.accuracy}% | ${s.onPace ? "On pace" : "Behind"} |`);
  }
  out.push("");
  out.push(`${d.fy.pctElapsed}% of the FY has elapsed — indicators under ${d.fy.pctElapsed - 5}% of target are flagged so program managers can act before September 30, not after.`);
  out.push("");

  out.push("## Module 3, Section C — All Characteristics Report");
  out.push("");
  out.push(`Tallied live from the ${d.clientCount} enrolled client records. Blank answers report as "Unknown / Not Reported."`);
  for (const m of d.characteristics) {
    out.push("");
    out.push(`### ${m.title} (${m.code})`);
    out.push("");
    out.push("| Answer | Count |");
    out.push("| --- | ---: |");
    for (const r of m.rows) out.push(`| ${md(r.label)} | ${r.n} |`);
    out.push(`| **TOTAL** | **${m.total}** |`);
  }
  out.push("");
  return out.join("\n");
}

// ---------- Module 3 workbook (SmartForm-shaped Excel) ----------
/* The OCS submission pipeline (OLDC) rejects control characters and chokes on
   markup-significant text in SmartForm cells — scrub every string we emit. */
const cleanCell = (s: string): string =>
  // eslint-disable-next-line no-control-regex
  s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();

async function buildXlsx(d: ReportRollup): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CAP Trellis";
  const bold = { bold: true } as const;

  const cover = wb.addWorksheet("Cover");
  cover.columns = [{ width: 34 }, { width: 60 }];
  cover.addRows([
    ["CSBG Annual Report 3.0 — Module 3", ""],
    ["OMB No.", "0970-0492"],
    ["Catalog version", CATALOG_VERSION],
    ["Agency", cleanCell(d.orgName)],
    ["Reporting period", `${d.fy.label} (${d.fy.range})`],
    ["Generated", d.generated],
    ["", ""],
    ["How to use this workbook", "Values are shaped to the Module 3 sections for transcription into your state's SmartForm/portal. Every characteristic block totals back to its reportable universe, Unknown/Not Reported included."],
  ]);
  cover.getColumn(1).font = bold;

  const secA = wb.addWorksheet("Section A — Services");
  secA.columns = [{ width: 10 }, { width: 56 }, { width: 18 }];
  secA.addRow(["Code", "Domain", "Individuals served"]).font = bold;
  for (const s of d.srvByDomain) secA.addRow([s.code, cleanCell(s.name), s.count]);
  secA.addRow([]);
  secA.addRow(["Code", "Top single services", "Count"]).font = bold;
  for (const s of d.topServices) secA.addRow([s.code, cleanCell(s.label), s.count]);

  const secB = wb.addWorksheet("Section B — FNPIs");
  secB.columns = [{ width: 12 }, { width: 64 }, { width: 10 }, { width: 10 }, { width: 10 }];
  secB.addRow(["Code", "Indicator", "Served", "Target", "Actual"]).font = bold;
  for (const f of d.fnpi) secB.addRow([f.code, cleanCell(f.label), f.served, f.target, f.actual]);

  const secC = wb.addWorksheet("Section C — All Characteristics");
  secC.columns = [{ width: 58 }, { width: 14 }];
  secC.addRow(["Individuals about whom one or more characteristics were obtained (live records)", d.sectionCTotals.individuals]).font = bold;
  secC.addRow(["Households about whom one or more characteristics were obtained (live records)", d.sectionCTotals.households]).font = bold;
  for (const m of d.characteristics) {
    secC.addRow([]);
    const h = secC.addRow([cleanCell(`${m.title} (${m.code})`), ""]);
    h.font = bold;
    for (const r of m.rows) secC.addRow([cleanCell(r.label), r.n]);
    const t = secC.addRow(["TOTAL", m.total]);
    t.font = bold;
  }

  const dq = d.dataQuality.filter((q) => q.unknown > 0 || q.drift.length > 0);
  const val = wb.addWorksheet("Validation");
  val.columns = [{ width: 36 }, { width: 22 }, { width: 60 }];
  val.addRow(["Characteristic", "Unknown / Not Reported", "Stored values that don't match the instrument"]).font = bold;
  if (dq.length === 0) {
    val.addRow(["No validation gaps", "", ""]);
  } else {
    for (const q of dq) {
      val.addRow([
        cleanCell(q.title),
        q.unknown > 0 ? `${q.unknown} of ${q.total}` : "",
        cleanCell(q.drift.map((x) => `${x.value} ×${x.count}`).join(" · ")),
      ]);
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function GET(req: Request): Promise<Response> {
  const user = await requireUser();
  const params = new URL(req.url).searchParams;
  const packet = params.get("packet") === "1";
  const xlsx = params.get("xlsx") === "1";
  const d = await buildRollup();

  if (xlsx) {
    const body = await buildXlsx(d);
    await audit(user.id, "report.xlsx", "report", d.fy.short,
      "Module 3 workbook exported (SmartForm-shaped Excel, Sections A, B & C + validation)");
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="csbg-module4-${d.fy.short.toLowerCase()}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const body = packet ? buildPacket(d) : buildCsv(d);
  const filename = `csbg-annual-report-${d.fy.short.toLowerCase()}-${packet ? "packet.md" : "rollup.csv"}`;

  await audit(
    user.id,
    packet ? "report.packet" : "report.export",
    "report",
    d.fy.short,
    packet
      ? "Annual Report packet drafted — Module 3 Sections A, B & C"
      : "CSV rollup exported (Module 3 Sections A, B & C)",
  );

  return new Response(body, {
    headers: {
      "Content-Type": packet ? "text/markdown; charset=utf-8" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
