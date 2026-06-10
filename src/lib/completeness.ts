import type { Client, Application, IntakeField } from "@/db/schema";

/* ============================================================
   Report readiness — % of All Characteristics Report fields
   captured on a record. Blanks become "Unknown / Not Reported"
   in the federal report, so completeness is a data-quality KPI.
   Core fields always count; admin-configured intake fields
   (Settings → Forms) extend the meter.
   ============================================================ */

// core fields that always feed the All Characteristics Report
export const CSBG_CORE: Array<[string, string]> = [
  ["dob", "C2 Age"],
  ["hhType", "D9 Household type"],
  ["hhSize", "D10 Household size"],
  ["housing", "D11 Housing"],
  ["income", "D12 Income level"],
  ["incomeSrc", "D13 Income sources"],
];

type Record_ = Client | Application;

function fieldValue(rec: Record_, fieldId: string): string {
  const builtin = rec as unknown as Record<string, unknown>;
  if (fieldId in builtin && fieldId !== "custom") {
    const v = builtin[fieldId];
    if (v === null || v === undefined) return "";
    return String(v);
  }
  return rec.custom?.[fieldId] ?? "";
}

export interface CompletenessItem {
  id: string;
  label: string;
  filled: boolean;
}

/** Per-field breakdown for the readiness meter. `fields` = enabled intake fields. */
export function completenessItems(rec: Record_, fields: IntakeField[]): CompletenessItem[] {
  const items: CompletenessItem[] = CSBG_CORE.map(([id, label]) => ({
    id,
    label,
    filled: fieldValue(rec, id).trim() !== "" && !(id === "income" && fieldValue(rec, id) === "" ),
  }));
  for (const f of fields) {
    items.push({
      id: f.id,
      label: (f.code ? f.code + " " : "") + f.label,
      filled: fieldValue(rec, f.id).trim() !== "",
    });
  }
  return items;
}

/** 0–100 completeness for a record. */
export function completenessPct(rec: Record_, fields: IntakeField[]): number {
  const items = completenessItems(rec, fields);
  if (items.length === 0) return 100;
  return Math.round((items.filter((i) => i.filled).length / items.length) * 100);
}
