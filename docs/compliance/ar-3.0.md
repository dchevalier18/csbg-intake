# CSBG Annual Report 3.0 — instrument mapping & verification status

**Catalog version:** `AR-3.0` (`CATALOG_VERSION` in `src/lib/csbg-catalog.ts`)
**Instrument:** CSBG Annual Report 3.0, OMB No. 0970-0492 (approved Dec 17, 2024;
expires Dec 31, 2027). FY26 (Oct 1, 2025 – Sep 30, 2026) is the first mandatory
3.0 reporting year; reports are due to states and then OLDC by March 31, 2027.

## Source of truth

`src/lib/csbg-catalog.ts` was extracted from the agency's copy of the official
Annual Report 3.0 instrument. Where web reconstructions of the instrument
disagree with that extraction, **the extraction wins** until re-verified against
the OMB-approved PDF:

- `https://acf.gov/sites/default/files/documents/ocs/CSBG-Annual-Report-3.0-OMB-Approved.pdf`
- Attachment A (corrected, Oct 2024) and Attachment C (Indicator Disposition
  Report) under `acf.gov/ocs`.

Notable extraction-vs-reconstruction differences (extraction retained):

| Item | Extraction (shipped) | Older/2.1-style reconstruction |
|---|---|---|
| C6 race/ethnicity | **Combined** question incl. **Middle Eastern or North African** (SPD-15-aligned) | Separate ethnicity + race questions, no MENA |
| C1 | "Sex": Male, Female | "Gender" incl. Other |
| C7 military | Veteran, Active Military, **Never Served in the Military** | Veteran/Active/Unknown |
| D12 top bands | **201% to 250%, 251% and over** | 201–225%, 226%+ |
| D13 | Employment/other-source/**non-cash-benefit** combinations | Simpler source rows |

## Verification checklist (open items)

Do these against the primary PDFs from an unrestricted network; record the
result here and bump `CATALOG_VERSION` on any change:

1. ☐ Section C response options, character-for-character (esp. C1 labels, C7
   labels, D12 band boundaries, D13 row wording).
2. ☐ Section A SRV / Section B FNPI code lists vs Attachment C (removals,
   consolidations, "other" rows, renumbering inside the renamed domains).
3. ☐ 2026 FPL computed rows (sizes 6–8 contiguous; 2–8 AK/HI) vs the ASPE
   detailed table — rounding can freeze a size at the prior-year value
   (`src/lib/fpl-data.ts` marks these rows).
4. ☐ The 200%-FPL eligibility window for the remainder of FY26 (ACF "CSBG
   Quarters 2 and 3 Funding Release FY26", Apr 23, 2026).

## How the app maps to Module 4

| Instrument | In the app |
|---|---|
| Section A — Services (SRV/SDA) | `services` catalog + `service_log`; rollup groups by domain |
| Section B — FNPIs | `fnpi_progress` (targets) + `outcome_log` (live, unduplicated per client×indicator×FY) |
| Section C — All Characteristics | `clients` columns (+ `custom` for admin-added questions); rollup tallies **canonical instrument labels** via `canonicalCharacteristic()` so display-list edits can't skew the federal output |
| Unknown/Not Reported | every tally buckets null/unmatched values explicitly |
| Denominators | top-line unduplicated individuals/households "about whom one or more characteristics were obtained", plus per-characteristic reportable universes (C3 age-banded 5–24/25+, C8 adults 18+, C5b-source insured-only) |
| Reporting period | federal fiscal year (Oct 1 – Sep 30) — `currentFY()`; the agency-facing `fyStart` setting affects internal dashboards only |

## Eligibility (FPL) rules encoded

- Guideline schedules are versioned per year with **point-in-time pinning**
  (`fpl_schedules`, `fplYear` on clients/applications). Publishing a new year
  never recalculates a prior determination.
- Jurisdiction (48 contiguous + DC / Alaska / Hawaii) is an agency setting;
  published dollars are stored on the schedule row, so a jurisdiction change
  never rewrites history.
- The CSBG ceiling is configurable (statutory 125%; appropriations acts have
  authorized 200% — confirm the current window per item 4 above) with
  per-program overrides.
- Income definition/lookback are state policies: the intake income worksheet
  annualizes entries over a configurable lookback and freezes the full
  determination (year, jurisdiction dollars, ceiling, inputs, computed %) on
  the application.
