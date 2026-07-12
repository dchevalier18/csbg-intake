# Changelog

All notable changes to CAP Trellis. Compliance-relevant changes (anything that
tracks a federal instrument or guideline revision) are marked **[compliance]**
— agencies should read those lines before upgrading in a reporting season.

## Unreleased — 0.5.0 (roadmap Phases 1–5)

### Phase 1 — Foundations
- Apache-2.0 license, NOTICE, contributor/security docs, architecture doc
- Vitest suite + GitHub Actions CI (typecheck, tests, PGlite smoke, build)
- Docker packaging: multi-stage image, compose with PostgreSQL + Caddy
  automatic HTTPS + nightly backup sidecar
- Embedded database mode (`DATABASE_URL=pglite://<dir>`) — zero-setup
  local/offline installs
- Security: magic-byte upload validation, login rate limiting, security
  headers + CSP + HSTS, 256-bit portal tokens
- Replaced CDN-only SheetJS with exceljs + built-in CSV parser; cleared all
  npm audit findings (incl. drizzle-orm SQL-identifier advisory)

### Phase 2 — Compliance core
- **[compliance]** Section C (All Characteristics) rollup completed: all 13
  characteristic blocks with correct reportable universes (age-banded C3,
  adults-only C8, insured-only C5b sources), top-line unduplicated
  individuals/households denominators
- **[compliance]** Report output canonicalized to the AR 3.0 instrument's
  exact answer strings (`CATALOG_VERSION = AR-3.0`); data-quality panel
  surfaces Unknown counts and answer-list drift year-round
- **[compliance]** Official HHS FPL tables 2023–2026 for 48-contiguous/
  Alaska/Hawaii (91 FR 1797; 90 FR 5917); jurisdiction setting; publish
  prefill; 2026 active in fresh installs
- Income worksheet (structured entries, state-configurable lookback) and
  frozen eligibility determinations on approve/deny
- Module labeling corrected: Individual & Family Level = Module 4

### Phase 3 — Genericization
- First-run setup wizard (`/setup`) + production init (`CSBG_DEMO_SEED=0`):
  clean installs with canonical taxonomy, no demo records
- Permission tiers: document bypass and cross-user verification undo require
  Program Manager / Data Admin
- Full-data JSON export (driver-agnostic backup path)

### Phase 4 — Differentiators
- Module 4 Excel workbook export (SmartForm-shaped, control-character-scrubbed,
  with a validation sheet)
- ROMA goals linked to FNPI indicators (Org Standard 4.3 board view)
- Client portal EN/ES (from the prototype) with the contact line now an
  organization setting
- Accessibility: dialog semantics + focus trap, keyboard radiogroups, live-
  region toasts, skip link

### Phase 5 — Ecosystem
- Client migration import template (CAP60/empowOR/spreadsheet-shaped, with
  duplicate detection and characteristic canonicalization)
- HMIS-aligned client CSV export (HUD-shaped columns/coding) for CoC
  coordination
- Issue templates (bug / feature / compliance), this changelog
