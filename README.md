# CSBG Client Intake System

A configurable, white-label **client intake, eligibility, case- and service-management system
for Community Action Agencies**, built around the data requirements of the
**CSBG Annual Report 3.0** (OMB No. 0970-0492). Built for Community Action Lehigh Valley (CALV),
configurable for any CAA.

Implemented from the approved Claude Design prototype in
`../design/csbg-client-intake-system/` — pixel-faithful screens on a real stack.

## Stack

- **Next.js 15** (App Router) · React 19 · TypeScript (strict)
- **SQLite** (better-sqlite3 + Drizzle ORM) at `data/csbg.db` — schema bootstraps and seeds
  itself on first run
- **CALV design system** ported to plain CSS (`src/styles/tokens.css`, `src/styles/app.css`);
  DIN Condensed + Luster Brush local fonts, Barlow via Google Fonts
- Session auth (scrypt + httpOnly cookie), server-enforced role & program-based access control

## Quick start

```bash
npm install
npm run dev        # http://localhost:3100
```

The database seeds automatically with realistic fictional demo data.

**Demo accounts** (password `demo1234`):

| Username | Name | Role | Access |
|---|---|---|---|
| `dana` | Dana Rivera | Case Worker | 5 programs |
| `marcus` | Marcus Kelly | Case Worker | 4 programs |
| `luz` | Luz Santiago | Case Worker | 4 programs |
| `robin` | Robin Garcia | Front Desk | 2 programs |
| `joan` | Joan Bartos | Program Manager | all programs + admin |
| `terrence` | Terrence Webb | Data Admin | all programs + admin |

**Client portal demo:** open `/p/demo-rosa` (Rosa Mejía's application) — or use
*Client portal preview* in the sidebar. Documents uploaded there appear in the
eligibility queue in real time.

```bash
npm run seed       # reset the database to fresh demo data
npm run typecheck  # strict TypeScript check
npm run build      # production build
```

## What's inside

- **Dashboard** — caseload, follow-ups/outcome check-ins, eligibility-queue snapshot, data-quality gaps
- **Eligibility queue** — pre-enrollment pipeline: per-program document checklists
  (mark submitted → verify), income vs the configurable FPL ceiling, approve-and-enroll
  (locked until all documents verify and income qualifies) or deny-with-required-note;
  every determination is audit-logged
- **Intake wizard** — 6 steps with live duplicate detection, automatic FPL calculation,
  and a report-readiness meter across all All-Characteristics fields
- **Clients** — scoped directory + 360° profile with every CSBG characteristic, service
  history, capture-now gap filling, and follow-up scheduling
- **Service log** — 3-field quick entry mapped to the **full official SRV/SDA taxonomy**
  (76 services across 8 domains, extracted from the CSBG 3.0 form)
- **Reports** — live Annual Report rollup: Section C characteristic tallies, Section A
  services by domain, Section B FNPI targets-vs-actuals with on-pace flags; CSV export
- **Programs** — start page per program with KPIs and the tools its *type* activates
- **Program tools** — attendance (posts SRV 2h), weatherization pipeline + contractor
  credentials, pantry network aggregates (SRV 5r / FNPI 5j), seminars with
  attendee-to-intake flow, construction projects + federal compliance, volunteers with the
  Module 2 B.1a.1 low-income split, loan servicing (SRV 3b)
- **Client portal** — tokenized, no-login mobile page: status steps, document upload,
  appointment, caseworker contact
- **Settings** (Data Admin / Program Manager) — white-label organization (name, logo,
  brand accent re-skins the whole UI), programs-by-type, users + program assignments,
  **versioned FPL guidelines with point-in-time pinning**, intake-question builder and
  CSBG answer-list manager

## Compliance notes

- **FPL pinning:** every client/application stores the guideline year it was assessed
  under. Publishing a new year never recalculates a prior determination.
- **Access control:** program assignment gates client records, applications, services,
  tools, and search — enforced in queries, not just navigation.
- **Audit log:** sign-ins, eligibility decisions, FPL publishes, settings changes, and
  portal uploads write to `audit_log`.
- Taxonomy source: `src/lib/csbg-catalog.ts`, extracted from the official Annual Report 3.0
  form (`../CSBG 3.0.md`).

All seeded people, addresses, and records are fictional.
