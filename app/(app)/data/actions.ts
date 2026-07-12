"use server";
/* Data & integrations — spreadsheet import. Parse runs server-side (CSV via the
   built-in RFC 4180 parser, XLSX via ExcelJS); commit re-validates every row
   against the live tables. Admin-only. */
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { readSheet } from "@/lib/spreadsheet";
import { db, t } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { audit, getPrograms } from "@/lib/access";
import { kvGet, kvSet } from "@/lib/data/core";
import { importTemplate } from "@/lib/import-templates";
import { fmt, shortDate, todayIso } from "@/lib/format";

const MAX_FILE_BYTES = 4 * 1024 * 1024; // keep in step with serverActions.bodySizeLimit
const MAX_ROWS = 2000;

export interface ParseResult {
  ok: boolean;
  message?: string;
  headers?: string[];
  rows?: string[][];
}

/** Read an uploaded CSV/XLSX (base64) into a header row + string grid. No writes. */
export async function parseImportFile(filename: string, base64: string): Promise<ParseResult> {
  await requireAdmin();

  const buf = Buffer.from(String(base64 ?? ""), "base64");
  if (buf.length === 0) return { ok: false, message: "That file looks empty — pick a CSV or XLSX export." };
  if (buf.length > MAX_FILE_BYTES) return { ok: false, message: "Files up to 4 MB are supported — split larger exports." };

  const sheet = await readSheet(buf);
  if (!sheet) return { ok: false, message: `“${filename}” doesn't look like a CSV or XLSX file.` };

  const { headers, rows } = sheet;
  if (headers.length === 0 || rows.length === 0) {
    return { ok: false, message: "The sheet needs a header row plus at least one data row." };
  }
  if (rows.length > MAX_ROWS) {
    return { ok: false, message: `That's ${fmt(rows.length)} rows — imports cap at ${fmt(MAX_ROWS)} per file. Split the export.` };
  }
  return { ok: true, headers, rows };
}

export interface ImportSummary {
  ok: boolean;
  message: string;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

const fail = (message: string): ImportSummary =>
  ({ ok: false, message, imported: 0, updated: 0, skipped: 0, errors: [] });

const num = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null; // blank cell is "no value", not zero — skip the row with a reason
  const n = Number(t.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "2026-05" | "2026-05-12" | "5/2026" | "5/12/2026" | "May 2026" → "2026-05" (or null). */
function parseMonth(s: string): string | null {
  const v = s.trim().toLowerCase();
  let m = v.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (m) return monthOf(m[1], m[2]);
  m = v.match(/^(\d{1,2})\/(?:\d{1,2}\/)?(\d{4})$/);
  if (m) return monthOf(m[2], m[1]);
  m = v.match(/^([a-z]{3,9})\.?,?\s+(\d{4})$/);
  if (m) {
    const idx = MONTH_NAMES.findIndex((n) => m![1].startsWith(n));
    if (idx !== -1) return monthOf(m[2], String(idx + 1));
  }
  return null;
}

function monthOf(year: string, month: string): string | null {
  const mo = Number(month);
  if (mo < 1 || mo > 12) return null;
  return `${year}-${String(mo).padStart(2, "0")}`;
}

/** "2026-06-08" | "6/8/2026" | "6/8/26" → ISO date (or null). */
function parseDateIso(s: string): string | null {
  const v = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  const [, mo, day, yr] = m;
  const year = yr.length === 2 ? `20${yr}` : yr;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(day) < 1 || Number(day) > 31) return null;
  return `${year}-${mo.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

const isYes = (s: string): boolean => ["yes", "y", "true", "1", "x"].includes(s.trim().toLowerCase());

/** Commit a parsed spreadsheet. Per-row validation — good rows land, bad rows skip with a reason. */
export async function commitImport(
  templateId: string,
  filename: string,
  mapping: Record<string, number>,
  rows: string[][],
): Promise<ImportSummary> {
  const user = await requireAdmin();

  const tpl = importTemplate(templateId);
  if (!tpl) return fail("Pick an import template first.");
  if (!Array.isArray(rows) || rows.length === 0) return fail("Nothing to import — the file had no data rows.");
  if (rows.length > MAX_ROWS) return fail(`Imports cap at ${fmt(MAX_ROWS)} rows per file.`);
  for (const f of tpl.fields) {
    if (f.required && !(Number.isInteger(mapping[f.key]) && mapping[f.key] >= 0)) {
      return fail(`Map a column to “${f.label}” before importing.`);
    }
  }

  const cell = (row: string[], key: string): string => {
    const idx = mapping[key];
    return Number.isInteger(idx) && idx >= 0 ? String(row[idx] ?? "").trim() : "";
  };

  let imported = 0;
  let updated = 0;
  const errors: string[] = [];
  const skip = (rowNo: number, why: string) => errors.push(`Row ${rowNo}: ${why}`);

  if (tpl.id === "pantry") {
    const agencies = await db.select().from(t.pantryAgencies);
    const byRef = new Map<string, (typeof agencies)[number]>();
    for (const a of agencies) {
      byRef.set(a.id.toLowerCase(), a);
      byRef.set(a.name.toLowerCase(), a);
    }
    for (const [i, row] of rows.entries()) {
      const rowNo = i + 2; // 1-based + header row
      const ref = cell(row, "agency");
      const agency = byRef.get(ref.toLowerCase());
      if (!agency) { skip(rowNo, ref ? `no member agency matches “${ref}”` : "missing agency"); continue; }
      const month = parseMonth(cell(row, "month"));
      if (!month) { skip(rowNo, `month “${cell(row, "month")}” — use a format like 2026-05`); continue; }
      const hh = num(cell(row, "households"));
      const lbs = num(cell(row, "lbs"));
      // mirror the manual enterReport contract: a received report has real positive figures
      if (hh === null || lbs === null) { skip(rowNo, "households and pounds must be numbers"); continue; }
      if (hh <= 0 || lbs <= 0) { skip(rowNo, "households and pounds must both be above zero"); continue; }
      const existing = (await db.select().from(t.pantryReports)
        .where(and(eq(t.pantryReports.agencyId, agency.id), eq(t.pantryReports.month, month))))[0];
      if (existing) {
        await db.update(t.pantryReports)
          .set({ status: "received", households: Math.round(hh), lbs: Math.round(lbs) })
          .where(eq(t.pantryReports.id, existing.id));
        updated++;
      } else {
        await db.insert(t.pantryReports)
          .values({ agencyId: agency.id, month, status: "received", households: Math.round(hh), lbs: Math.round(lbs) });
        imported++;
      }
    }
  } else if (tpl.id === "seminars") {
    const seminars = await db.select().from(t.seminars);
    const seminarById = new Map(seminars.map((s) => [s.id, s]));
    const byRef = new Map<string, (typeof seminars)[number]>();
    for (const s of seminars) {
      byRef.set(s.id.toLowerCase(), s);
      byRef.set(s.title.toLowerCase(), s);
    }
    const attendees = await db.select().from(t.seminarAttendees);
    const seen = new Set(attendees.map((a) => `${a.seminarId}|${a.name.toLowerCase()}`));
    // exact-unique name match against active clients — ambiguous names stay unlinked
    const clientsByName = new Map<string, string[]>();
    for (const c of await db.select().from(t.clients)) {
      if (c.status !== "active") continue;
      const key = `${c.first} ${c.last}`.toLowerCase();
      clientsByName.set(key, [...(clientsByName.get(key) ?? []), c.id]);
    }
    const touched = new Set<string>();
    let autoMatched = 0;

    for (const [i, row] of rows.entries()) {
      const rowNo = i + 2;
      const ref = cell(row, "seminar");
      const sem = byRef.get(ref.toLowerCase());
      if (!sem) { skip(rowNo, ref ? `no seminar matches “${ref}”` : "missing seminar"); continue; }
      const name = cell(row, "name");
      if (!name) { skip(rowNo, "missing attendee name"); continue; }
      const key = `${sem.id}|${name.toLowerCase()}`;
      if (seen.has(key)) { skip(rowNo, `${name} is already on the ${sem.id} list`); continue; }
      const matches = clientsByName.get(name.toLowerCase()) ?? [];
      const clientId = matches.length === 1 ? matches[0] : null;
      await db.insert(t.seminarAttendees).values({
        seminarId: sem.id,
        name,
        clientId,
        applicationId: null,
        intakeStatus: clientId ? "enrolled" : "not-started",
      });
      seen.add(key);
      touched.add(sem.id);
      if (clientId) autoMatched++;
      imported++;
    }

    // `registered` is the headcount, independent of attendee rows — a sign-in sheet of
    // already-registered people must not inflate it. Reconcile to the larger of the
    // existing count and the actual roster size instead of bumping per imported row.
    for (const semId of touched) {
      const roster = (await db.select().from(t.seminarAttendees).where(eq(t.seminarAttendees.seminarId, semId))).length;
      const current = seminarById.get(semId)?.registered ?? 0;
      if (roster > current) {
        await db.update(t.seminars).set({ registered: roster }).where(eq(t.seminars.id, semId));
      }
    }
    if (autoMatched > 0) {
      const m = await kvGet<{ auto: number; staff: number; awaiting: number; silent: number }>(
        "matching", { auto: 0, staff: 0, awaiting: 0, silent: 0 });
      await kvSet("matching", { ...m, auto: m.auto + autoMatched });
    }
  } else {
    // volunteers — hours accumulate on existing rows; new volunteers need a program
    const vols = await db.select().from(t.volunteers);
    const byName = new Map(vols.map((v) => [v.name.toLowerCase(), v]));
    const programs = await getPrograms();
    const programByRef = new Map<string, string>();
    for (const p of programs) {
      programByRef.set(p.id.toLowerCase(), p.id);
      programByRef.set(p.short.toLowerCase(), p.id);
      programByRef.set(p.name.toLowerCase(), p.id);
    }
    let nextVolNo = vols.reduce((m, v) => {
      const n = Number(v.id.replace("V-", ""));
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    const stats = await kvGet<{ totalHoursFY: number; lowIncomeHoursFY: number; activeVolunteers: number }>(
      "volStats", { totalHoursFY: 0, lowIncomeHoursFY: 0, activeVolunteers: 0 });

    for (const [i, row] of rows.entries()) {
      const rowNo = i + 2;
      const name = cell(row, "name");
      if (!name) { skip(rowNo, "missing volunteer name"); continue; }
      const hours = num(cell(row, "hours"));
      if (hours === null || hours <= 0) { skip(rowNo, "hours must be a number above zero"); continue; }
      const h = Math.round(hours);
      const rawDate = cell(row, "date");
      const dateIso = rawDate ? parseDateIso(rawDate) : null;
      if (rawDate && !dateIso) { skip(rowNo, `shift date “${rawDate}” — use a format like 2026-06-08`); continue; }

      const existing = byName.get(name.toLowerCase());
      if (existing) {
        existing.hoursFY += h;
        if (dateIso && (!existing.lastShift || dateIso > existing.lastShift)) existing.lastShift = dateIso;
        await db.update(t.volunteers)
          .set({ hoursFY: existing.hoursFY, lastShift: existing.lastShift })
          .where(eq(t.volunteers.id, existing.id));
        stats.totalHoursFY += h;
        if (existing.lowIncome === 1) stats.lowIncomeHoursFY += h;
        updated++;
      } else {
        const programRef = cell(row, "program");
        const programId = programByRef.get(programRef.toLowerCase());
        if (!programId) {
          skip(rowNo, programRef
            ? `no program matches “${programRef}” for new volunteer ${name}`
            : `new volunteer ${name} needs a program column`);
          continue;
        }
        const lowIncome = isYes(cell(row, "lowIncome")) ? 1 : 0;
        const id = `V-${++nextVolNo}`;
        const vol = { id, name, clientId: null, lowIncome, role: cell(row, "role"), hoursFY: h, lastShift: dateIso };
        await db.insert(t.volunteers).values(vol);
        await db.insert(t.volunteerPrograms).values({ volunteerId: id, programId });
        byName.set(name.toLowerCase(), vol);
        stats.activeVolunteers += 1;
        stats.totalHoursFY += h;
        if (lowIncome === 1) stats.lowIncomeHoursFY += h;
        imported++;
      }
    }
    await kvSet("volStats", stats);
  }

  const skipped = errors.length;
  await db.insert(t.importJobs).values({
    at: new Date().toISOString(),
    template: tpl.id,
    filename,
    imported,
    updated,
    skipped,
    staffId: user.id,
    detail: errors.slice(0, 12).join(" · "),
  });
  if (imported + updated > 0) {
    await db.update(t.integrations).set({ lastSync: shortDate(todayIso()) }).where(eq(t.integrations.id, "sheets"));
  }
  await audit(user.id, "data.import", "integration", "sheets",
    `${tpl.name} · ${filename} · ${imported} imported, ${updated} updated, ${skipped} skipped`);
  revalidatePath("/", "layout");

  const message = imported + updated > 0
    ? `Import complete — ${fmt(imported)} added and ${fmt(updated)} updated in ${tpl.target}${skipped ? `; ${fmt(skipped)} row${skipped === 1 ? "" : "s"} skipped` : ""}.`
    : `Nothing imported — all ${fmt(skipped)} row${skipped === 1 ? "" : "s"} were skipped. Check the row notes below.`;
  return { ok: true, message, imported, updated, skipped, errors };
}
