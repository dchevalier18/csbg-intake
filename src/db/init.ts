import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as t from "./schema";
import * as schema from "./schema";
import { SERVICES, FNPIS, characteristicByCode } from "@/lib/csbg-catalog";
import { OFFICIAL_FPL, LATEST_OFFICIAL_FPL_YEAR } from "@/lib/fpl-data";

type DB = NodePgDatabase<typeof schema>;

/* ============================================================
   Minimal production init — the non-demo bootstrap path.
   Seeds ONLY what the app needs to function: a placeholder
   organization, the official FPL schedules, the AR 3.0 service
   taxonomy + FNPI targets, canonical answer lists, the intake
   question set, and a generic document catalog. NO users are
   created — the first sign-in happens through /setup, which
   creates the first administrator and completes the org profile.
   Demo data stays available via CSBG_DEMO_SEED=1 or `npm run seed`.
   ============================================================ */

const optionsOf = (code: string): string[] => characteristicByCode(code)?.options ?? [];

export async function runInit(db: DB): Promise<void> {
  // ---------- Organization placeholder (completed by /setup) ----------
  await db.insert(t.organization).values({
    id: 1,
    name: "New Community Action Agency",
    short: "CAA",
    tagline: "",
    region: "",
    accent: "#006269",
    logoMode: "wordmark",
    fyStart: "October",
    csbgCeiling: 125,
    jurisdiction: "contiguous48",
    incomeLookbackDays: 90,
  });

  // ---------- Official FPL schedules (latest year active) ----------
  await db.insert(t.fplSchedules).values(
    Object.entries(OFFICIAL_FPL).map(([year, tables]) => ({
      year: Number(year),
      base: tables.contiguous48.base,
      perAdditional: tables.contiguous48.perAdditional,
      effective: tables.contiguous48.effective,
      status: Number(year) === LATEST_OFFICIAL_FPL_YEAR ? "active" : "archived",
      jurisdiction: "contiguous48",
    })),
  );

  // ---------- AR 3.0 taxonomy ----------
  await db.insert(t.services).values(SERVICES.map((s, i) => ({
    code: s.code, domain: s.domain, label: s.label, active: 1, sort: i,
  })));
  await db.insert(t.fnpiProgress).values(FNPIS.map((f) => ({
    code: f.code, label: f.label, served: 0, target: 0, actual: 0,
  })));

  // ---------- Canonical answer lists (instrument-exact strings) ----------
  const listDefs: Array<{ key: string; label: string; values: string[] }> = [
    { key: "sex", label: "Gender identity (C1)", values: optionsOf("C1") },
    { key: "race", label: "Race & ethnicity (C6)", values: optionsOf("C6") },
    { key: "edu", label: "Education (C3)", values: optionsOf("C3") },
    { key: "work", label: "Work status (C8)", values: optionsOf("C8") },
    { key: "insurance", label: "Health insurance (C5)", values: [...optionsOf("C5b-source"), "None"] },
    { key: "military", label: "Military status (C7)", values: optionsOf("C7") },
    { key: "hhType", label: "Household type (D9)", values: optionsOf("D9") },
    { key: "housing", label: "Housing situation (D11)", values: optionsOf("D11") },
    { key: "incomeSrc", label: "Income sources (D13)", values: optionsOf("D13") },
    { key: "county", label: "County / service area", values: ["Other"] },
  ];
  await db.insert(t.lists).values(listDefs.map(({ key, label }) => ({ key, label })));
  await db.insert(t.listValues).values(
    listDefs.flatMap(({ key, values }) => values.map((value, sort) => ({ listKey: key, value, sort }))),
  );

  // ---------- Intake question set (Section C characteristics step) ----------
  await db.insert(t.intakeFields).values([
    { id: "sex",        label: "Gender identity",  code: "C1", type: "list",  listKey: "sex",       enabled: 1, builtin: 1, sort: 0 },
    { id: "race",       label: "Race / ethnicity", code: "C6", type: "list",  listKey: "race",      enabled: 1, builtin: 1, sort: 1 },
    { id: "edu",        label: "Education",        code: "C3", type: "list",  listKey: "edu",       enabled: 1, builtin: 1, sort: 2 },
    { id: "work",       label: "Work status",      code: "C8", type: "list",  listKey: "work",      enabled: 1, builtin: 1, sort: 3 },
    { id: "insurance",  label: "Health insurance", code: "C5", type: "list",  listKey: "insurance", enabled: 1, builtin: 1, sort: 4 },
    { id: "military",   label: "Military status",  code: "C7", type: "list",  listKey: "military",  enabled: 1, builtin: 1, sort: 5 },
    { id: "disability", label: "Disability",       code: "C5", type: "yesno", listKey: null,        enabled: 1, builtin: 1, sort: 6 },
    { id: "disconnectedYouth", label: "Disconnected youth (14-24, not working or in school)",
      code: "C4", type: "yesno", listKey: null, enabled: 1, builtin: 0, sort: 7 },
  ]);

  // ---------- Generic document catalog ----------
  await db.insert(t.docTypes).values([
    { key: "photo-id", label: "Photo ID" },
    { key: "income", label: "Income verification" },
    { key: "ssn", label: "Social Security card" },
    { key: "residence", label: "Proof of residence" },
    { key: "utility", label: "Utility bill" },
  ]);

  // ---------- Integration status cards ----------
  await db.insert(t.integrations).values([
    { id: "sheets", name: "Spreadsheet import", kind: "CSV / XLSX", status: "ready", detail: "Pantry, seminar, and volunteer templates" },
  ]);
}
