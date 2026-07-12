# CAP Intake — Open-Source Release Roadmap

**Prepared:** July 2026 · **Status:** DRAFT for review — no implementation has begun
**Scope:** Review of the csbg-intake prototype against (a) the software systems Community
Action Agencies use today and (b) the federal data requirements of the **CSBG Annual
Report 3.0** (OMB No. 0970-0492), Module 4 Section C, and the **HHS Federal Poverty
Guidelines** — followed by a phased plan to complete the project as an open-source
product ("CAP Intake") for Community Action Agencies nationwide.

---

## 1. Executive summary

The prototype is much further along than "prototype" implies: ~13,500 lines of strict
TypeScript, real server-enforced access control, point-in-time FPL pinning, a pervasive
audit log, the full CSBG 3.0 SRV/FNPI/characteristics taxonomy, nine program-type tool
modules, a client portal, and a live Annual Report rollup. Zero TODO markers, clean
conventions, no dead code.

Three findings drive this plan:

1. **The open-source niche is genuinely empty.** No maintained open-source CSBG/CAA
   system exists anywhere. The incumbents (CAP60, empowOR, CSG Engage, ClientTrack,
   Bonterra) are all closed, several are being rolled up by private equity with visible
   customer resentment over pricing, and small/rural agencies (3–10 staff) are priced
   out or under-served. An open-source entrant with real Module 4 automation has no
   direct competitor.
2. **Compliance is the moat, and the target moved.** FY26 data being collected *right
   now* (Oct 2025–Sep 2026) must be reported on **Annual Report 3.0**, mandatory for
   the FY26 submission (due March 31, 2027). AR 3.0 swaps Module 4 lettering
   (Section A = Services/SRV, Section B = FNPI, **Section C = All Characteristics**),
   renames two domains, forces the federal fiscal year on all modules, and revises
   the characteristics per HHS data standards. Our catalog was extracted from the 3.0
   form, so we are structurally aligned — but the report rollup only emits roughly half
   of Section C, and several 3.0-final details need verification against the OMB-approved
   instrument PDF.
3. **The gap to release is engineering hygiene and genericization, not features.**
   Feature-for-feature the prototype already matches or beats the mid-market incumbents
   on the intake→eligibility→service→report core. What blocks release: no LICENSE, no
   tests, no CI, no migration framework, no Docker, no i18n, thin accessibility,
   single-state FPL tables (no Alaska/Hawaii), incomplete Section C output, and
   CALV-specific hard-coding in seed/branding/deploy.

**Recommended path:** five phases, roughly ordered Foundations → Compliance core →
Genericization & packaging → CAA differentiators → Ecosystem & community. Phases 1–2
produce a credible v1.0 an agency could adopt; 3–4 make it competitive; 5 makes it a
project rather than a repo.

---

## 2. Where the prototype stands today

### 2.1 Strengths (keep and protect)

| Area | What exists |
|---|---|
| Data model | Clients + applications with the full Section C characteristic set; multi-program enrollment via `client_programs` (one person = one record, cross-enrollment never duplicates); per-program document checklists with verify/bypass sign-off |
| FPL engine | Versioned `fpl_schedules` with **point-in-time pinning** — every record computes against its stored `fplYear`; active-year edits blocked once cases are pinned; per-program ceiling overrides (`programs.fplCeiling`) over an agency default (`organization.csbgCeiling`, default 125) |
| Taxonomy | `src/lib/csbg-catalog.ts`: 8 domains, ~76 SRV/SDA codes, ~40 FNPI codes, Section C/D characteristics with official answer options, FPL bands |
| Eligibility workflow | docs → review → decision pipeline; approval server-gated on all-docs-verified AND income-eligible; denial requires note; denials reopenable; everything audited |
| Access control | Enforced in queries (`src/lib/access.ts`), not navigation; enumeration-safe errors; scoped duplicate detection with redaction |
| Security basics | scrypt + timing-safe compare, httpOnly sessions, path-traversal-safe file handling, upload allow-list, `execFile` (no shell) for backups, pervasive audit log |
| Configurability | Runtime-editable org branding, programs, users, FPL schedules, intake-question builder, answer lists, per-program service catalogs and doc requirements |
| Reporting | Live rollup: Section A services by domain, Section B FNPI targets vs actuals, partial Section C tallies with Unknown/Not-Reported rows; CSV + Markdown packet export |
| Extras few incumbents have | Tokenized no-login client portal with document upload; program tools (attendance, weatherization, pantry, seminars, projects, volunteers, loans); spreadsheet import with server-side re-validation |

### 2.2 Gaps (what the plan addresses)

**Hard blockers for open-sourcing**
- **No LICENSE file**, `"private": true`, no license metadata. Nothing else matters until this is resolved.
- **Zero automated tests.** Only `npm run typecheck` and a PGlite DDL/seed smoke script.
  For software that makes federal eligibility determinations, this is the top technical risk.
- **No CI/CD** (no `.github/`), no migration framework (manual dual-write to
  `schema.ts` + `ddl.ts`), no portable deployment (deploy tooling hard-codes one CALV
  staging box, a Windows workstation, and plain HTTP).
- **Stale README** (claims SQLite; app is PostgreSQL) and no admin/user/config docs.

**Federal-compliance gaps**
- **Section C rollup is incomplete**: `app/(app)/reports/rollup.ts` emits C1 Sex, C2 Age,
  C6 Race/Ethnicity, D9 Household Type, D11 Housing, D12 Income band — but **not**
  C3 Education, C4 Disconnected Youth, C5a Disability, C5b Health Insurance (+ source),
  C7 Military, C8 Work Status, D10 Household Size, D13 Income Sources, even though the
  data model captures them all.
- **No top-line unduplicated denominators** ("total individuals/households about whom
  one or more characteristics were obtained") or per-characteristic
  Σ(categories + unknown) = total validation, which is how OLDC/SmartForms audits the section.
- **FPL tables are single-jurisdiction**: `fpl_schedules` stores one `base` +
  `perAdditional` per year — no Alaska/Hawaii variants, which a national product must have.
- **Answer-list drift**: seed list values (e.g. race labels) differ slightly in wording
  from the catalog's canonical strings; the rollup tallies by exact string match, so
  drifted values silently fall into "Unknown."
- **No state-configurable income rules**: income definition, documentation, and lookback
  period (30/60/90-day or annualized) are state policies; the intake currently has a
  single free-form income figure.
- **Reporting period**: AR 3.0 mandates the federal fiscal year for all modules; FY
  handling should be pinned to Oct 1–Sep 30 for the federal report even though
  `organization.fyStart` is configurable for agency-internal views.

**Product/market gaps vs. incumbents**
- No submission-shaped export (SmartForm/XML/OLDC-aligned, or state-portal CSV) — the
  single most-marketed vendor feature.
- No i18n (Spanish is effectively mandatory for CAA client populations, especially the portal).
- Accessibility far from WCAG 2.1 AA / Section 508 (near-zero ARIA, untested keyboard/focus paths).
- No HMIS/CAP60/Head Start interop (integration cards are display-only).
- No ROMA-cycle artifacts (needs assessment → CAP plan goals → outcomes traceability for Org Standard 4.3).
- Single-tenant by construction (`organization` row id=1).
- Security hardening for public internet: no CSP/security headers, no login rate-limiting,
  16-hex-char non-expiring portal tokens, doc-bypass/undo not permission-tiered, PII in
  audit detail strings, plain-HTTP deploy path (`CSBG_ALLOW_HTTP=1`).

---

## 3. Market landscape — who we're up against

*(Full research citations in section 8.)*

### 3.1 The field

| System | Nature | CSBG Module 4 automation | Small-agency cost (indicative) | Notes |
|---|---|---|---|---|
| **CAP60** | CAA-native suite | Strong (Annual Report module w/ error checking) | ~$2.5k setup + ~$4.5k/yr | WellSky HMIS data bridge; LIHEAP + Head Start modules |
| **empowOR** (CSST) | CAA-native; statewide in MI, ME, NJ, NH + VA pilot | Strong; direct funder-submission plugins (CSBG, HUD 9902, PIR, LIHEAP) | ~$1.2k setup + $1.65–3k/yr | Built *by* a CAA — the origin story that resonates; cheapest credible option |
| **CSG Engage** | CAA-native + state eGov CSBG portals | Strong (prepackaged CSBG reports) | $490–675/user/yr | Client portal; HMIS add-on; markets against "25% of staff time on manual data entry" |
| **CaseWorthy / ClientTrack** | Enterprise HMIS-plus | Strong (canned CSBG reports; "2 weeks → 2 days" case study) | $4–10k+/mo + $20–150k implementation | For large multi-county agencies |
| **Bonterra Apricot/ETO** | Generic nonprofit case mgmt | Build-it-yourself | Mid 4–5 figures/yr | Loud public resentment over post-PE price hikes — a wedge |
| **Exponent Case Management** | Salesforce package | Via implementation | ~$240/user/yr + Salesforce + 5–6-figure implementation | Out of reach for small CAAs |
| **CharityTracker/Oasis** | Assistance-network tracking | Weak | $20–25/user/mo | Not a Module 4 engine |
| **Hancock / ServTraq** | Energy-side (WAP/LIHEAP) silos | N/A | Contract | The canonical double-entry problem; Hancock PE-acquired 2025 |
| **GoEngage** | Head Start + emerging CAP module | Emerging | $2k + $2k+/yr | HS↔CAP cross-referral is its pitch |
| **State systems** (NC CARDS, OH OCEAN, OR OPUS, empowOR states) | Mandated portals | N/A | — | We must *export to* whatever the state runs |
| **Open source** | — | **Nothing maintained exists** | — | CiviCRM/ArkCase/HSDS are adjacent, none ship CSBG logic |

### 3.2 What this means for positioning

- **Feature bar we already clear**: multi-program household record, FPL eligibility
  computation, document management, audit trail, client portal, per-program config,
  live NPI counting. That is the mid-market table-stakes set.
- **Feature bar we don't yet clear**: complete Section C output with validation,
  submission-shaped exports, HMIS/state interop, Spanish, accessibility, and a
  no-IT-staff deployment story.
- **Structural advantages to press**: $0 license cost against Bonterra-refugee pricing
  anxiety; agency-built provenance (like empowOR's origin story); one system spanning
  CSBG + energy + food + housing program tools where incumbents silo; transparency and
  auditability of the eligibility logic itself (open code = inspectable compliance).
- **The buyer reality**: CAAs have almost no IT staff. "Clone the repo" is a non-starter.
  Credibility requires one-command self-hosting (Docker), managed-hosting options, real
  docs, and eventually a sustaining organization. Boards and state monitors will ask
  about encryption, RBAC, audit logs, MFA, breach procedures, and US data residency —
  HIPAA-alignment language is the de facto benchmark even where HIPAA doesn't apply.
- **Naming note**: a zero-star PHP repo named `filmdc/capintake` ("open-source client
  intake for CAAs," created March 2026) already exists on GitHub. Before public launch
  we should pick and check a distinct name (e.g., "CAP Intake" as a brand with a
  distinct repo/package name) — flagged as an open decision in §8.

---

## 4. Core data requirements (the spec)

### 4.1 CSBG Annual Report 3.0 — status and structure

- OMB No. **0970-0492**, Annual Report **3.0** approved **Dec 17, 2024**, expires
  **Dec 31, 2027** (DCL-25-06).
- **FY25** report (submitted March 2026) was universally on **2.1** (AT-26-02).
  **FY26** (data Oct 1, 2025–Sep 30, 2026; submitted by March 31, 2027) is the first
  **mandatory 3.0** cycle. **FY26 data collected today must map to 3.0.**
- Module 4 = Individual and Family Level. **3.0 lettering: A = Services (SRV),
  B = FNPIs, C = All Characteristics** (2.1 had A=FNPI, B=SRV — the catalog and UI must
  use the 3.0 order).
- 3.0 domain renames: Education and Cognitive Development → **Education and Youth
  Development**; Health and Social/Behavioral Development → **Health and Nutrition**;
  Services Supporting Multiple Domains → **Transportation**. An "other" option was added
  to every service category and indicator; numerous SRVs/FNPIs were consolidated/reworded
  (disposition list = Attachment C).
- **All modules report on the federal fiscal year** (Oct 1–Sep 30) under 3.0.
- Submission: states file via **OLDC on GrantSolutions**, with Excel **SmartForms**
  generating XML for Modules 2 and 4; a Federal Quality Assurance Review (FQAR) process
  applies. Invalid characters/format in SmartForm fields is the most common failure —
  our exports must validate to the same rules.

### 4.2 Module 4 Section C — All Characteristics (core data requirements)

Scope: **all individuals and households served during the reporting period regardless of
funding source.** Two top-line unduplicated counts anchor the section: total
*individuals* and total *households* about whom one or more characteristics were
obtained. Every characteristic must tally categories + **Unknown/Not Reported** back to
the applicable top-line count — this sum rule is the section's validation contract.

Individual-level characteristics and response options (2.1 baseline, which 3.0
"clarified"; final 3.0 wording to be verified against the approved instrument — see §4.5):

| # | Characteristic | Response options |
|---|---|---|
| 1 | Gender | Male · Female · Other · Unknown/not reported *(verify 3.0 final options — see §4.5)* |
| 2 | Age | 0–5 · 6–13 · 14–17 · 18–24 · 25–44 · 45–54 · 55–59 · 60–64 · 65–74 · 75+ · Unknown |
| 3 | Education (ages 14+, split into 14–24 and 25+ bands) | Grades 0–8 · Grades 9–12/non-graduate · HS grad/equivalency · 12th grade + some post-secondary · 2- or 4-year college graduate · Graduate of other post-secondary school · Unknown |
| 4 | Disabling condition | Yes · No · Unknown |
| 5 | Health insurance | Yes · No · Unknown; if Yes, source: Medicaid · Medicare · State CHIP · State Health Insurance for Adults · Military Health Care · Direct Purchase · Employment Based · Unknown |
| 6 | Ethnicity | Hispanic, Latino or Spanish Origins · Not Hispanic/Latino/Spanish Origins · Unknown |
| 7 | Race | American Indian and Alaska Native · Asian · Black or African American · Native Hawaiian and Other Pacific Islander · White · Other · Multi-Race · Unknown |
| 8 | Military | Veteran · Active Military · Unknown *(verify exact 3.0 labels)* |

Household-level characteristics:

| # | Characteristic | Response options |
|---|---|---|
| 9 | Household type | Single person · Two adults no children · Single parent female · Single parent male · Two parent household · Non-related adults with children · Multigenerational household · Other · Unknown |
| 10 | Household size | 1 · 2 · 3 · 4 · 5 · 6 · 7 · 8+ · Unknown |
| 11 | Housing status | Own · Rent · Other permanent housing · Homeless · Other · Unknown |
| 12 | **Income level (% of HHS poverty guideline)** | Up to 50% · 51–75% · 76–100% · 101–125% · 126–150% · 151–175% · 176–200% · **201–225% · 226% and above** · Unknown |
| 13 | Income sources | Structure: employment only · employment + other · other only · no income · unknown; plus all-that-apply list: TANF · SSI · SSDI · Social Security (retirement/survivors) · Pension · Unemployment Insurance · EITC · Other *(verify exact 3.0 row labels)* |

Data-model implications:
- Per-characteristic **Unknown bucket** and Σ-validation are first-class report features,
  not afterthoughts.
- Education requires **age-banded reporting** (14–24 vs 25+), i.e. the rollup must join
  education level with computed age at reporting.
- Health insurance is a **two-level question** (yes/no, then source).
- Income sources are **multi-select** with a derived employment/other/none structure.
- Race/ethnicity must remain **separate questions** for 3.0 — but model them so a future
  **OMB SPD-15** migration (combined question, select-all, MENA category) is possible
  without a schema rewrite (see §4.5).

### 4.3 Federal Poverty Guidelines (eligibility engine requirements)

**2026 HHS Poverty Guidelines** (published Jan 15, 2026, 91 FR 1797; effective Jan 13, 2026):

| HH size | 48 states + DC | Alaska | Hawaii |
|---|---|---|---|
| 1 | $15,960 | $19,950 | $18,360 |
| 2 | $21,640 | $27,050 | $24,890 |
| 3 | $27,320 | $34,150 | $31,420 |
| 4 | $33,000 | $41,250 | $37,950 |
| 5 | $38,680 | $48,350 | $44,480 |
| 6 | $44,360 | $55,450 | $51,010 |
| 7 | $50,040 | $62,550 | $57,540 |
| 8 | $55,720 | $69,650 | $64,070 |
| each add'l | +$5,680 | +$7,100 | +$6,530 |

**2025 guidelines** (90 FR 5917, effective Jan 15, 2025): contiguous base $15,650
+$5,500/person; Alaska $19,550 +$6,880; Hawaii $17,990 +$6,325.

*(Sizes 2–8 for AK/HI and 6–8 for the contiguous table are computed from the verified
base + verified constant increment; reconcile against the ASPE detailed table before
shipping — see §4.5.)*

**Eligibility rules the engine must encode:**
- **Statutory ceiling**: CSBG Act §673(2) (42 U.S.C. §9902(2)) — states may set the
  poverty line up to **125%** of the official guideline.
- **200% authority** comes from annual **appropriations law**, not the CSBG Act, and its
  window moves with each appropriation/CR (FY26 CR confirmed 200% through at least
  Jan 30, 2026; later FY26 coverage to be verified). ⇒ the ceiling must be a
  **configurable, dated policy value** (100/125/150/200%), never a constant — which the
  current `csbgCeiling` + per-program override design already supports.
- **Income definition, documentation, and lookback are state policies** (commonly 30/60/90-day
  lookback annualized, sometimes up to 12 months; CAPLAW guidance). ⇒ the system needs a
  configurable income worksheet: included/excluded source types, lookback window,
  annualization method — with the computed determination stored immutably (extending the
  existing `fplYear` pinning to "pin the whole determination": year, jurisdiction table,
  ceiling %, income figure, worksheet inputs).
- **Jurisdiction**: FPL schedules must carry the 48-state/AK/HI variant; agency
  configuration selects which applies.

### 4.4 Sections A and B (for report cross-checking)

Section A (SRV) and Section B (FNPI) organize by the renamed 3.0 domains, with "other"
rows per category, unduplicated-person counting, and target-vs-actual FNPI reporting.
Our existing rollup already models served/target/actual with on-pace flags; work needed
is a **code-by-code reconciliation of `csbg-catalog.ts` against the OMB-approved 3.0
instrument and Attachment C disposition report** (removals, consolidations, rewordings,
"other" rows, renumbering within renamed domains).

### 4.5 Flagged federal verification items (do before hard-coding)

These must be checked against the primary PDFs from an unrestricted network (the research
sandbox could not fetch acf.gov/aspe.hhs.gov directly):

1. **Exact 3.0 Section C response options** — especially Gender (post-EO 14168 changes
   during 2025 affected many federal collections; unverified whether OCS altered the
   CSBG gender options) and Military/income-source row labels.
   Source: CSBG Annual Report 3.0 OMB-approved instrument + Attachment A (corrected) on acf.gov.
2. **3.0 SRV/FNPI final code list** — Attachment C "Indicator Disposition Report."
3. **2026 FPL computed rows** (sizes 6–8 contiguous; 2–8 AK/HI) vs the ASPE detailed table
   (rounding can occasionally freeze a size at prior-year value).
4. **200% FPL window for the remainder of FY26** — ACF "CSBG Quarters 2 and 3 Funding
   Release FY26" (Apr 23, 2026).

---

## 5. Gap analysis — prototype vs. requirements vs. market

| Requirement | Prototype status | Work |
|---|---|---|
| Module 4 Section C full characteristic capture | ✅ Data model complete | — |
| Section C full report output + Unknown buckets + Σ-validation + top-line denominators | ⚠️ ~6 of 13 characteristics emitted; no denominators/validation | Phase 2 |
| 3.0 lettering/domains/codes | ⚠️ Catalog extracted from 3.0 form; needs code-by-code reconciliation vs approved instrument | Phase 2 |
| Federal-FY reporting period | ⚠️ Configurable `fyStart`; federal report must pin Oct–Sep | Phase 2 |
| FPL 2025/2026 tables, AK/HI variants | ⚠️ Versioned + pinned, but single-jurisdiction, seed data only | Phase 2 |
| Configurable eligibility ceiling (125/200%) | ✅ Agency default + per-program override | Verify policy dates only |
| State-configurable income worksheet / lookback | ❌ Single income figure | Phase 2 |
| Full determination pinning (year + table + ceiling + inputs) | ⚠️ Year pinned; rest recomputed | Phase 2 |
| Submission-shaped export (SmartForm/XML-aligned, state CSV) | ❌ Generic CSV/Markdown only | Phase 4 |
| Unduplicated counting | ✅ client×program×FY logic exists | Extend to Section C denominators (Phase 2) |
| Multi-program household model | ✅ | — |
| Client portal w/ doc upload | ✅ (portal upload doesn't store file; token weak) | Phase 3 hardening |
| LICENSE / tests / CI / migrations / Docker | ❌ | Phase 1 |
| De-CALV white-label + setup wizard | ⚠️ Runtime-configurable but CALV seed/fonts/deploy | Phase 3 |
| Spanish / i18n | ❌ | Phase 4 |
| WCAG 2.1 AA / Section 508 | ❌ | Phase 4 |
| ROMA cycle artifacts (Org Standard 4.3) | ❌ (FNPI targets only) | Phase 4 |
| HMIS / CAP60 / migration importers | ❌ (display-only cards) | Phase 5 |
| Security hardening for public internet | ⚠️ Strong basics; missing CSP, rate-limit, MFA, token TTL, permission tiers | Phases 1–3 |
| Multi-tenancy | ❌ Single-tenant | Documented stance: one deployment per agency (Phase 3 decision) |

---

## 6. Development plan

### Phase 1 — Open-source foundations (blockers) · ~2–3 weeks of work

1. **License**: adopt one (recommendation: **AGPL-3.0** to keep hosted forks open, or
   **Apache-2.0** for maximum adoption — decision §8). Add LICENSE, `package.json`
   license field, copyright headers policy, and a `NOTICE` for the SheetJS (Apache-2.0)
   dependency; move `xlsx` off the CDN tarball to a pinned, verifiable source.
2. **Truthful docs**: fix README (PostgreSQL, not SQLite), add ARCHITECTURE.md,
   CONTRIBUTING.md, SECURITY.md (vuln reporting), data dictionary generated from the schema.
3. **Test suite (vitest) + CI (GitHub Actions)**: typecheck + PGlite smoke + unit/integration
   tests + build on every PR. Priority test targets, in order:
   FPL math & pinning (`src/lib/fpl.ts`), approval gating and stage transitions
   (`eligibility/actions.ts`), access scoping (`src/lib/access.ts`), rollup math
   (`reports/rollup.ts`), import validation, duplicate detection.
4. **Real migrations**: adopt drizzle-kit; freeze current DDL as migration 0001; retire
   the manual dual-write discipline; keep the advisory-lock bootstrap for first-run UX.
5. **Portable deployment**: Dockerfile + docker-compose (app + Postgres + TLS via Caddy
   or documented reverse proxy); keep the systemd/Apache path as a documented alternative;
   remove `CSBG_ALLOW_HTTP` from any recommended path; move CALV-specific deploy scripts
   to a `deploy/examples/` folder or out of the repo.
6. **Quick security wins**: security headers/CSP in `next.config.ts`, login rate-limiting,
   upload magic-byte sniffing, portal tokens → 32 bytes with optional TTL.
7. **Repo hygiene**: remove `design_handoff_doc_verification/` (move to a private design
   repo); its unimplemented recommendation — permission-tiering doc bypass/undo — moves
   into Phase 3.

### Phase 2 — Federal compliance core (the moat) · ~3–5 weeks

1. **Verify the four flagged items** (§4.5) against the primary instruments; record the
   verified taxonomy in a versioned spec file (`docs/compliance/ar-3.0.md`).
2. **Catalog reconciliation**: audit `csbg-catalog.ts` code-by-code against the approved
   3.0 instrument + Attachment C; add "other" rows; confirm domain names and Section
   A/B/C lettering everywhere in UI and exports; version the catalog
   (`CATALOG_VERSION = "AR-3.0"`) so future federal revisions (SPD-15-driven 4.0, etc.)
   become data migrations, not rewrites.
3. **Complete Section C**: extend `reports/rollup.ts` to emit all 13 characteristic
   blocks (add C3 education with 14–24/25+ age bands, C4, C5a/C5b + insurance source,
   C7, C8, D10, D13 multi-select income sources), plus the two top-line unduplicated
   denominators and per-characteristic Σ(categories + unknown) = total **validation
   panel** — surfacing failures year-round, not at submission time (this is the
   "error-checking dashboard" feature every serious vendor sells).
4. **Answer-list integrity**: reconcile seed/list values with canonical catalog strings;
   store characteristic values as **stable codes** (not display strings) with
   display labels in lists — eliminating the string-drift → "Unknown" failure class.
5. **FPL engine, national**: add jurisdiction (48-state/AK/HI) to `fpl_schedules`; ship
   verified 2025 + 2026 schedules as seed data; agency setting selects jurisdiction;
   annual-update process documented (and a maintained data file in the repo so agencies
   just upgrade).
6. **Income worksheet**: structured income entry (source type × amount × period),
   configurable lookback/annualization per agency (state policy), computed gross vs
   guideline; **freeze the full determination** (guideline year + jurisdiction +
   ceiling % + inputs + computed %) on the application record.
7. **Federal reporting period**: reports pin to federal FY (Oct 1–Sep 30) regardless of
   `fyStart`; `fyStart` remains for agency-internal dashboards.

**Exit criterion:** a seeded agency can produce a complete, internally-validated Module 4
Section A/B/C rollup for FY26 whose every number is traceable to client/service records.

### Phase 3 — Genericization, hardening, first-run experience · ~3–4 weeks

1. **De-CALV**: neutral default theme + fonts (CALV becomes an optional theme package);
   generic demo seed; `logoMode` default `wordmark`.
2. **First-run setup wizard**: org profile, jurisdiction, first admin (forced password
   set), FPL confirmation, ceiling policy, program creation from templates — replacing
   "edit the seed" as the bootstrap path.
3. **Program types as data**: migrate the static `program-types.ts` catalog into the DB
   so agencies can define program shapes without forking (tool capabilities remain a
   code-level registry the types compose).
4. **AuthZ hardening**: permission-tier document bypass/undo (Program Manager+),
   optional TOTP MFA for admin roles, session management UI, PII-minimized audit detail
   + documented retention policy.
5. **Backups & portability**: scheduled `pg_dump` guidance in compose, full-data export
   (all tables → CSV/JSON bundle), client-record export (data-subject requests).
6. **Multi-tenancy stance (decision)**: recommend **documented one-deployment-per-agency**
   for v1 (matches the container model, keeps the audit story simple); revisit true
   multi-tenancy only if a hosted offering (Phase 5) demands it.

**Exit criterion = v1.0 release**: a stranger agency can `docker compose up`, complete
the wizard, and run intake→eligibility→services→report without touching code.

### Phase 4 — CAA differentiators · ~4–6 weeks

1. **Submission-shaped exports**: Module 4 export matching SmartForm layout (Excel via
   SheetJS) with OLDC-style validation (character/format rules); generic state-portal
   CSV mapping layer (configurable column maps for CARDS-style systems).
2. **i18n**: extract copy to message catalogs (next-intl); ship **Spanish** for the
   client portal and intake wizard first, then the staff app.
3. **Accessibility**: WCAG 2.1 AA pass — focus traps and ARIA on Modal/Seg, keyboard
   paths through wizard/queue/tables, contrast audit of the token palette, axe checks in CI.
4. **ROMA support** (Org Standard 4.3 evidence): agency goals linked to FNPI targets;
   needs-assessment notes; board-ready outcome dashboard/exports covering the
   assessment → plan → implementation → results → evaluation cycle.
5. **Household-centric view**: strengthen household as a first-class aggregate across
   members (whole-family view — the direction ROMA NG and state pilots are moving).

### Phase 5 — Ecosystem & community (ongoing)

1. **Migration importers**: CSV importers shaped for CAP60/empowOR/Apricot exports —
   switching cost is the #1 adoption barrier.
2. **Interop**: HMIS CSV (HUD data standards) export; HSDS for service directories;
   read API (scoped tokens) for data warehouses.
3. **Community infrastructure**: public repo, issue templates, discussion forum,
   versioned release notes tracking ACF DCLs (the "compliance maintenance cadence" is a
   feature — publish a compliance changelog per federal revision).
4. **Sustainability model** (decision §8): options — (a) CALV/CACLV stewards the project
   and offers paid implementation; (b) agency co-op governance (the empowOR origin
   pattern); (c) fiscal sponsor + hosted SaaS at empowOR-ish pricing (~$1.5–3k/yr) to
   fund maintenance. Conference presence (NCAP, NASCSP, state associations) is how this
   market discovers software.
5. **Trust roadmap for bigger deals**: SOC 2 readiness documentation, security
   whitepaper, penetration test — needed for statewide contracts, not for v1.

### Sequencing summary

```
Phase 1  Foundations        LICENSE · tests · CI · migrations · Docker · quick security
Phase 2  Compliance core    AR 3.0 verify+reconcile · full Section C · FPL national · income worksheet
Phase 3  v1.0               de-CALV · setup wizard · authz hardening · backups    ⇒ RELEASE
Phase 4  Differentiators    SmartForm export · Spanish · WCAG AA · ROMA
Phase 5  Ecosystem          importers · HMIS/HSDS · community · sustainability
```

Phases 1 and 2 can run partly in parallel (different files); Phase 3 depends on both.

---

## 7. Design for low-IT-capacity agencies (deploy & manage without an IT department)

Most CAAs have no dedicated IT staff — a program manager or data admin doubles as the
"system administrator." The design rule that follows from this: **every operational task
must be doable from the web UI or happen automatically; any task that requires SSH,
editing a config file, or reading a stack trace is a design defect.** This section
defines the concrete design choices, in dependency order, and maps each to a phase.

### 7.1 Three deployment tiers (agency picks by capacity)

| Tier | Who it's for | What it looks like |
|---|---|---|
| **Hosted** | Most small/rural agencies (3–10 staff) | Someone else runs it — a sustaining org, a state association, or a commodity "one-click app" host. The agency only ever sees the web UI. This is the long-term answer (§8 governance decision) and the reason the app must stay a boring, stateless, single-container deployment. |
| **One-command self-host** | Agencies with "the person who set up the Wi-Fi" | `docker compose up -d` on a $6–12/mo VPS or an existing agency VM. One `.env` file created by an interactive `./install.sh` that asks only: domain name, admin email, where to store backups. Compose bundles the app, PostgreSQL, and **Caddy for automatic HTTPS** (Let's Encrypt — no certificate task ever). Only ports 80/443 exposed. |
| **IT-managed** | State offices, large agencies, county IT | The documented systemd/Postgres/reverse-proxy path (today's `deploy/`), plus Helm/K8s notes if demand appears. Never required for the first two tiers. |

Design consequences: **no Redis, no queue, no S3, no email server required** for core
function (uploads on a mounted volume; SMTP optional and only for nicities); no
build-time configuration (everything runtime, in Settings); the existing self-bootstrapping
DB (advisory-lock DDL + auto-seed) is exactly right and must be preserved.

### 7.2 Nothing to install locally, nothing to configure by hand

- **Browser-only administration** — already largely true (org, programs, users, FPL,
  forms, service catalogs all live in Settings). The Phase 3 **first-run setup wizard**
  closes the last gap: no one edits a seed file to onboard an agency.
- **Guided annual FPL update**: each January the project publishes the new HHS
  guidelines as signed data in a release; the app shows a banner ("2027 poverty
  guidelines are available — review and publish") and the admin publishes them from
  Settings in two clicks, with the existing pinning rules protecting prior
  determinations. No CSV wrangling, no math.
- **Program templates**: new programs are created from named templates (utility
  assistance, weatherization, food pantry, housing counseling, Head Start-adjacent…)
  that pre-fill type, doc checklist, service mappings, and FPL ceiling, so configuration
  is recognition, not construction.

### 7.3 Updates that cannot strand an agency

- **In-app update banner**: the app checks the release feed (opt-out) and shows
  "v1.4 available — release notes" to admins. Updating is `docker compose pull && docker
  compose up -d` (documented as the one command to run, or push-button on hosted/managed
  tiers).
- **Migrations run automatically on boot**, expand-contract style (never destructive in
  the same release that stops writing a column), with an **automatic pre-migration
  backup** taken before any schema change. A failed migration rolls back and the app
  boots the old version rather than a white screen.
- **Compliance releases are labeled**: when ACF revises the Annual Report, the release
  notes say what changed in plain language ("Annual Report 3.1: two new income-source
  rows; your reports update automatically"). The versioned catalog (Phase 2 §6.2)
  makes this a data migration, not a manual re-mapping task.

### 7.4 Backups an auditor would accept, run by no one

- **Automatic scheduled backups** ship enabled in the default compose (nightly
  `pg_dump` + uploads snapshot, 30-day retention on the backup volume) — not a task the
  agency sets up.
- **Settings → Backups UI**: last-backup age (with a red banner when stale), one-click
  download, one-click **restore** with typed confirmation, and optional encrypted
  offsite copy (S3-compatible bucket) configured with two fields.
- Documented **disaster-recovery drill**: a single command restores a fresh server from
  a backup file; the admin guide walks through rehearsing it annually (this doubles as
  the state-monitor/audit answer for data safety).

### 7.5 When something goes wrong, the app explains itself

- **Health dashboard** in Settings: database reachable, disk space, backup age, TLS
  expiry, version — each with a green/amber/red state and a "what to do" sentence.
- **Friendly failure pages**: known failure modes (database down, disk full, misconfigured
  domain) render instructions a non-technical person can follow — not stack traces.
- **Admin log viewer**: filtered application events in the UI, so "check the logs" never
  means SSH.
- **One-click support bundle**: exports redacted logs + config + version for attaching
  to a forum post or support email — the difference between a fixable report and
  "it's broken."

### 7.6 Secure by default, with zero security decisions delegated to the operator

TLS automatic (Caddy), security headers and login rate-limiting always on, forced strong
admin password at setup, optional TOTP for admin roles, sessions and audit retention
with sane defaults, backups encrypted at rest when offsite. The operator is never asked
a question they'd need a security background to answer. (Hardening items from Phases 1
and 3 are what make this claim true.)

### 7.7 Documentation and support written for the actual operator

- **Task-oriented admin guide** ("Add a staff member," "Publish the new poverty
  guidelines," "Run the year-end report," "Restore from a backup") with screenshots —
  organized by task, not by feature.
- **In-app contextual help** on every Settings page, using CSBG vocabulary
  (a glossary maps app terms to Annual Report terms).
- **Quick-start that fits on two pages** and is validated by the acceptance test below.
- Community forum + published office hours; paid implementation partners listed
  neutrally (the empowOR/CiviCRM pattern) for agencies that want hands.

### 7.8 The acceptance test that keeps us honest

Before v1.0 ships: **a non-technical CAA staff member, given only the quick-start guide
and a fresh VPS login, must reach a working system — installed, wizard completed, one
intake processed, one report exported — without contacting a developer.** Repeat the
drill for "apply an update" and "restore a backup." If any step fails, the step (not the
tester) is the bug.

### Phase mapping

| Design choice | Phase |
|---|---|
| Compose + Caddy auto-TLS, `install.sh`, no-extra-services rule | 1 |
| Secure defaults (headers, rate limit, strong passwords) | 1 & 3 |
| Setup wizard, program templates, backup/restore UI, health dashboard, update banner, auto pre-migration backup | 3 |
| Guided FPL annual update flow | 2 (data) + 3 (UI) |
| Friendly failure pages, log viewer, support bundle | 3 |
| Task-oriented admin guide, contextual help, quick-start + acceptance test | 3 (release gate) |
| One-click hosts / marketplace packaging (Cloudron, PikaPods, DO Marketplace), forum, partners | 5 |
| Hosted tier | 5 (governance decision §8) |

---

## 8. Open decisions (need your call before implementation)

1. **License**: AGPL-3.0 (protects against closed hosted forks; some agencies/vendors
   shy away) vs Apache-2.0/MIT (maximum adoption; a vendor could commercialize a closed
   fork). Recommendation: **AGPL-3.0** for the app — the buyer is agencies, not
   library users, and AGPL preserves the open ecosystem that is the project's reason to exist.
2. **Name**: "capintake" collides with an existing (inactive) GitHub repo; "CAP Intake"
   as brand with a distinct repo/org name (e.g., `cap-intake`, `capworks`, `opencap`)
   needs a trademark-and-collision check.
3. **Multi-tenancy**: recommend documented single-tenant-per-deployment for v1 (§6 Phase 3).
4. **Governance/sustainability** model (§6 Phase 5) — who stewards, who hosts, what's paid.
5. **Scope of Phase 4 ROMA work** — minimal Org-Standard-4.3 evidence vs a fuller
   planning module (recommend minimal first).

---

## 9. Research sources

**Federal requirements**: ACF-OCS DCL-25-06 (AR 3.0 update), DCL-24-09 (3.0 revisions),
AT-26-02 (FY25 submission on 2.1), DCL-25-02 (FQAR); CSBG Annual Report 3.0 OMB-approved
instrument + Attachments A/C/D (acf.gov); FY23/FY24 Module 4 national data (acf.gov);
2026 FPL: 91 FR 1797 (Jan 15, 2026); 2025 FPL: 90 FR 5917; ASPE poverty-guidelines pages;
CSBG Act §673(2), 42 U.S.C. §9902(2); FY24–FY26 appropriations/CR 200% provisions
(P.L. 118-47, 119-4, 119-37); CAPLAW "CSBG Guide to Client Eligibility" (2021);
OMB SPD-15 revision (89 FR 22182) + 2025–26 deadline extensions; NASCSP annual-report
resources; NCAP Org Standard 4.3 toolkit.

**Market**: cap60.com; empoworbycsst.com (+ Housing Action Illinois CMS Guide 3.0
profiles/pricing for empowOR, CSG Engage, GoEngage CAP, Outcome Tracker, CaseWorthy);
communitysoftwaregroup.com; bonterratech.com + Capterra/GetApp reviews; Exponent
Case Management (AppExchange); Simon Solutions (CharityTracker/Oasis); caseworthy.com
+ Eccovia CSBG help + CAP Lancaster case study; hancocksoftware.com + Banyan
acquisition (2025); servtraq.com; neighborlysoftware.com; goengage.app; NC CARDS
(NCDHHS), OH OCEAN, OR OPUS; WellSky–CAP60 bridge press release; NCAP Data Hub;
NASCSP ROMA Next Generation; CiviCRM / ArkCase / Open Referral (adjacent OSS).

**Codebase**: full review of this repository at commit `49e534d` (July 2026) — findings
embedded in §2 and §5 with file references.
