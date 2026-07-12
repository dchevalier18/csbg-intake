# CSBG Annual Report 3.0 — instrument mapping & verification status

**Catalog version:** `AR-3.0.1` (`CATALOG_VERSION` in `src/lib/csbg-catalog.ts`)
**Instrument:** CSBG Annual Report 3.0, OMB No. 0970-0492 (expires Dec 31, 2027).
FY26 (Oct 1, 2025 – Sep 30, 2026) is the first mandatory 3.0 reporting year;
reports are due to states and then OLDC by March 31, 2027.

## Verification record

**July 2026 — verified against the OMB-approved instrument PDF** (provided by
the project owner). Results:

### Module structure (corrected)

The approved 3.0 numbering is:

| Module | Content |
|---|---|
| 1 | State and Territory Administration |
| 2 | Eligible Entity Administration |
| **3** | **Individual and Family Level** — A: Services (SRV/SDA) · B: FNPIs · C: All Characteristics Report |
| 4 | Community Level (Community Initiative Status, Community NPIs, Strategies List) |

Web reconstructions placing Individual & Family at "Module 4" are wrong for
3.0. All app labels say **Module 3**.

### Section C — verified element by element

| Item | Result |
|---|---|
| Top lines A/B (unduplicated individuals/households with 1+ characteristics) | ✅ matches app |
| C1 | ✳ corrected — instrument title is **"Gender Identity"** with options Male · Female · **Transgender, non-binary, or another gender** · Unknown (catalog updated in AR-3.0.1) |
| C2 age bands | ✅ 0-4 · 5-17 · 18-24 · 25-34 · 35-44 · 45-64 · 65-84 · 85 and older |
| C3 education (ages 5-24 / 25+) | ✅ options and age bands match |
| C4 disconnected youth | ✅ collected as yes/no in intake; the form reports the single count of "youth 14-24 neither working or in school" — our tally's "Yes" row |
| C5 | ✅ disability is a count line; health insurance is Yes/No/Unknown + sources b.1–b.7 (Medicaid, Medicare, State CHIP, State Health Insurance for Adults, Military Health Care, Direct-Purchase, Employment-Based) |
| C6 race & ethnicity | ✅ combined question incl. **Middle Eastern or North African** and "Multiracial or Multiethnic (two or more of the above)" |
| C7 military | ✅ Veteran · Active Military · Never Served in the Military |
| C8 work status (18+) | ✳ corrected — option c is **"Migrant or Seasonal Farm Worker"** (catalog updated; old short value aliased) |
| D9 household type | ✳ corrected — instrument includes **"Single Parent Non-Binary, Transgender, or Another Gender"** (added) |
| D10 household size | ✅ Single Person · Two · Three · Four · Five · Six or more |
| D11 housing | ✅ Own · Rent · Other permanent housing · Homeless · Other |
| D12 income bands | ✅ …176-200% · **201-250% · 251% and over** (confirms the extraction over the 2.1-style reconstruction) |
| D13 income sources | ✅ all eight rows incl. the non-cash-benefit combinations |

### Sections A and B — verified

Every SRV/SDA code in the instrument's Module 3 Section A and every FNPI code
in Section B matches `src/lib/csbg-catalog.ts` exactly (diffed programmatically
against the PDF text; zero additions, zero removals either direction).

## Remaining open items

1. ☐ **2026 FPL computed rows** (sizes 6–8 contiguous; 2–8 AK/HI) vs the ASPE
   detailed table — rounding can freeze a size at the prior-year value
   (`src/lib/fpl-data.ts`).
2. ☐ **The 200%-FPL eligibility window for the remainder of FY26** — ACF "CSBG
   Quarters 2 and 3 Funding Release FY26" (Apr 23, 2026).

## How the app maps to Module 3

| Instrument | In the app |
|---|---|
| Section A — Services (SRV/SDA) | `services` catalog + `service_log`; rollup groups by domain |
| Section B — FNPIs | `fnpi_progress` (targets) + `outcome_log` (live, unduplicated per client×indicator×FY) |
| Section C — All Characteristics | `clients` columns (+ `custom` for admin-added questions); rollup tallies **canonical instrument labels** via `canonicalCharacteristic()` so display-list edits can't skew the federal output |
| Unknown/Not Reported | every tally buckets null/unmatched values explicitly |
| Denominators | top-line unduplicated individuals/households, plus per-characteristic reportable universes (C3 age-banded 5–24/25+, C8 adults 18+, C5b-source insured-only) |
| Reporting period | federal fiscal year (Oct 1 – Sep 30) — `currentFY()`; the agency-facing `fyStart` setting affects internal dashboards only |

## Eligibility (FPL) rules encoded

- Guideline schedules are versioned per year with **point-in-time pinning**
  (`fpl_schedules`, `fplYear` on clients/applications). Publishing a new year
  never recalculates a prior determination.
- Jurisdiction (48 contiguous + DC / Alaska / Hawaii) is an agency setting;
  published dollars are stored on the schedule row, so a jurisdiction change
  never rewrites history.
- The CSBG ceiling is configurable (statutory 125%; appropriations acts have
  authorized 200% — confirm the current window per open item 2) with
  per-program overrides.
- Income definition/lookback are state policies: the intake income worksheet
  annualizes entries over a configurable lookback and freezes the full
  determination (year, jurisdiction dollars, ceiling, inputs, computed %) on
  the application.

## Change log

- **AR-3.0.1** (July 2026): instrument-verified. C1 → "Gender Identity" +
  third option; C8 → "Migrant or Seasonal Farm Worker" (alias kept for the old
  short value); D9 → added "Single Parent Non-Binary, Transgender, or Another
  Gender"; module labels corrected to Module 3 (Individual & Family).
- **AR-3.0** (July 2026): initial extraction-based catalog.
