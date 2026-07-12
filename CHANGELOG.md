# Changelog

All notable changes to CAP Trellis. Compliance-relevant changes (anything that
tracks a federal instrument or guideline revision) are marked **[compliance]**
— agencies should read those lines before upgrading in a reporting season.

## Unreleased — 0.5.0 (roadmap Phases 1–5)

### Program tools become manageable (post-Phase 5)
Every program-type tool can now create and manage its own records instead of
only displaying seeded data:

- **Pantry network**: add and edit member agencies in the tool; new
  "Pantry member agencies" spreadsheet import template builds or refreshes
  the roster from Primarius 2.0's agency export (or any CSV/XLSX) — matched
  by agency ID or name, so re-imports update instead of duplicate. The
  reporting cycle is no longer pinned to a demo month: it's always the
  calendar month that just closed, and network KPIs compute live from the
  tables on real installs.
- **Volunteers**: add volunteers (name, role, program, low-income flag,
  optional client link) and edit them in the tool; the existing "Volunteer
  hours" import is now linked from the roster.
- **Loan servicing**: loans carry structured terms (APR in basis points,
  term in months, disbursement date) behind the display strings; each loan
  has a detail page with a **full amortization schedule** (level-payment,
  cent-accurate, last installment absorbs rounding) and a **payment ledger**
  — every payment recorded splits interest-first at one month of the note
  rate on the open balance, with date, split, running balance, staff, and
  note. New-loan form takes numeric rate/term so the schedule generates.
- **Attendance**: multiple classes per agency with a class picker; create
  classes (site, schedule, service code), enroll students (with optional
  household-record link), and open today's session on demand — the tap-to-
  cycle Today column and post-day service logging are unchanged.
- **Weatherization**: open jobs (household link or name, address, funding,
  measures) and add contractors (trade, crews, credential expirations) in
  the tool; contractors with an **expired** credential are blocked from new
  job assignments. New **Vouchers** tab records contractor expense charges
  (optionally tied to a job) with a submitted → approved → paid pipeline —
  approval/payment is admin-only and every step is audited.
- Housing construction projects intentionally untouched — build-out on hold
  pending review of the existing production system's implementation.

### Windows local install (deferred item — §7 local tier, first cut)
- deploy/windows: dependency-free PowerShell installer (Node check, build,
  embedded database, /setup wizard, start-at-sign-in task) + a console
  server manager with the §7.2 contract — status, start/stop/restart,
  change port, office-LAN toggle with managed firewall rule, open app,
  recent logs. Data (embedded DB + uploads + log) lives in one backupable
  folder. Standalone build output is now Docker-only so `next start` works
  on this tier.

### Spanish (staff app) — foundation + first screens (deferred item)
- Per-user UI language (English / Español) with a toggle in the user menu;
  LangProvider lifts the portal's colocated EN/ES dictionary pattern app-wide
- Translated: sidebar, top bar (search, user menu), and the full intake
  wizard (all six steps, worksheet, FPL panel, duplicate warnings, review)
- Note: characteristic question labels come from Settings → Forms (data, not
  code) — agencies can bilingualize those directly; translations pending a
  native-speaker review pass

### Security: two-step verification + device management (deferred item)
- TOTP MFA (RFC 6238, no new dependencies): per-account enrollment with
  manual-entry key + otpauth link, 8 single-use recovery codes (hashed at
  rest, shown once), two-step sign-in with short-lived pending sessions and
  token rotation, rate-limited verification, operator lockout reset
  (`npm run mfa:reset -- <username>`, audited, revokes all sessions)
- /security page for every staff account: manage two-step verification and
  see/revoke signed-in devices (created, browser/OS, expiry) + sign out
  everywhere else; raw session tokens never reach the client (fingerprints)

### Instrument verification (post-Phase 5)
- **[compliance]** Verified the catalog against the OMB-approved Annual Report
  3.0 instrument PDF (`CATALOG_VERSION` → `AR-3.0.1`):
  - Module numbering corrected: Individual & Family Level is **Module 3**
    (Community is Module 4) — labels updated app-wide
  - C1 is "Gender Identity" with a third option (Transgender, non-binary, or
    another gender)
  - C8 option is "Migrant or Seasonal Farm Worker" (old short value aliased)
  - D9 adds "Single Parent Non-Binary, Transgender, or Another Gender"
  - Sections A (SRV/SDA) and B (FNPI) code lists diffed against the PDF:
    exact match, no changes needed
  - Full record in docs/compliance/ar-3.0.md

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
- Module labeling pass (superseded by the instrument verification above)

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
