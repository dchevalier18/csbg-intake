/* ============================================================
   Official HHS Poverty Guidelines — published base (household
   of one) + per-additional-person increment, by year and
   jurisdiction. Used to prefill FPL publishes in Settings and
   to seed fresh installs. The HHS tables are constructed with a
   constant increment, so base + increment fully determines the
   published table for every household size.

   Sources:
     2025 — 90 FR 5917 (Jan 17, 2025)
     2026 — 91 FR 1797 (Jan 15, 2026; 2026-00755)
   NOTE (docs/compliance/ar-3.0.md item 3): reconcile against the
   ASPE detailed tables before relying on AK/HI rows — rounding
   can occasionally freeze one household size at the prior year.
   ============================================================ */

export type Jurisdiction = "contiguous48" | "alaska" | "hawaii";

export const JURISDICTIONS: Array<{ id: Jurisdiction; label: string }> = [
  { id: "contiguous48", label: "48 contiguous states & D.C." },
  { id: "alaska", label: "Alaska" },
  { id: "hawaii", label: "Hawaii" },
];

export const jurisdictionLabel = (id: string | null | undefined): string =>
  JURISDICTIONS.find((j) => j.id === id)?.label ?? JURISDICTIONS[0].label;

export interface OfficialFpl {
  base: number;
  perAdditional: number;
  effective: string; // ISO date the guidelines took effect
}

export const OFFICIAL_FPL: Record<number, Record<Jurisdiction, OfficialFpl>> = {
  2023: {
    contiguous48: { base: 14580, perAdditional: 5140, effective: "2023-01-19" },
    alaska: { base: 18210, perAdditional: 6430, effective: "2023-01-19" },
    hawaii: { base: 16770, perAdditional: 5910, effective: "2023-01-19" },
  },
  2024: {
    contiguous48: { base: 15060, perAdditional: 5380, effective: "2024-01-17" },
    alaska: { base: 18810, perAdditional: 6730, effective: "2024-01-17" },
    hawaii: { base: 17310, perAdditional: 6190, effective: "2024-01-17" },
  },
  2025: {
    contiguous48: { base: 15650, perAdditional: 5500, effective: "2025-01-15" },
    alaska: { base: 19550, perAdditional: 6880, effective: "2025-01-15" },
    hawaii: { base: 17990, perAdditional: 6325, effective: "2025-01-15" },
  },
  2026: {
    contiguous48: { base: 15960, perAdditional: 5680, effective: "2026-01-13" },
    alaska: { base: 19950, perAdditional: 7100, effective: "2026-01-13" },
    hawaii: { base: 18360, perAdditional: 6530, effective: "2026-01-13" },
  },
};

/** Latest year present in the official table. */
export const LATEST_OFFICIAL_FPL_YEAR = Math.max(...Object.keys(OFFICIAL_FPL).map(Number));

/** Official figures for a year + jurisdiction, or null when we don't carry them. */
export function officialFpl(year: number, jurisdiction: Jurisdiction): OfficialFpl | null {
  return OFFICIAL_FPL[year]?.[jurisdiction] ?? null;
}
