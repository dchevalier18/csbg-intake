# CAP Trellis

**Open-source client intake, eligibility, case & service management, and federal
reporting for Community Action Agencies.**

CAP Trellis is built around the data requirements of the **CSBG Annual Report 3.0**
(OMB No. 0970-0492) — Module 4 Section A services, Section B National Performance
Indicators, and the Section C All Characteristics Report — with a versioned
**Federal Poverty Guidelines** eligibility engine. It began at Community Action
Lehigh Valley (CALV) and is configurable for any CAA.

A trellis is a structure that supports growth. So is this.

- **License:** Apache-2.0 (see `LICENSE` / `NOTICE`)
- **Status:** pre-1.0 — under active development toward the roadmap in `docs/ROADMAP.md`

## Stack

- **Next.js 15** (App Router) · React 19 · TypeScript (strict)
- **PostgreSQL** via node-postgres + Drizzle ORM — the schema bootstraps and seeds
  itself on first run (`src/db/ddl.ts`); an **embedded database mode** (PGlite) runs
  with zero database setup for local/offline installs
- Plain-CSS design system (`src/styles/tokens.css`, `src/styles/app.css`) — no Tailwind
- Session auth (scrypt + httpOnly cookie), server-enforced role & program-based access
  control, login rate limiting, pervasive audit log

## Quick start

```bash
npm install
npm run dev        # http://localhost:3100
```

With no `DATABASE_URL` set, the app expects PostgreSQL at
`postgres://csbg:csbg@localhost:5432/csbg_intake`. To run with **zero database
setup** (embedded PGlite, data stored under `data/`):

```bash
DATABASE_URL=pglite://./data/pglite npm run dev
```

The database schema bootstraps automatically, and an empty database seeds itself
with realistic fictional demo data.

**Demo accounts** (password `demo1234`):

| Username | Role | Access |
|---|---|---|
| `dana`, `marcus`, `luz` | Case Worker | assigned programs |
| `robin` | Front Desk | 2 programs |
| `joan` | Program Manager | all programs + admin |
| `terrence` | Data Admin | all programs + admin |

**Client portal demo:** open `/p/demo-rosa`, or use *Client portal preview* in the
sidebar. Documents uploaded there appear in the eligibility queue in real time.

```bash
npm run seed       # reset the database to fresh demo data
npm run typecheck  # strict TypeScript check
npm test           # vitest unit suite
npm run smoke      # DDL + seed against in-memory PGlite
npm run build      # production build
```

## Docker

```bash
cp .env.example .env   # set CSBG_DOMAIN + secrets
docker compose up -d   # app + PostgreSQL + Caddy (automatic HTTPS)
```

See `deploy/README.md` for the compose file, TLS notes, and the example
systemd/Apache deployment under `deploy/examples/`.

## What's inside

- **Dashboard** — caseload, follow-ups/outcome check-ins, eligibility-queue snapshot,
  data-quality gaps
- **Eligibility queue** — pre-enrollment pipeline: per-program document checklists
  (mark submitted → verify, or signed bypass), income vs the configurable FPL ceiling,
  approve-and-enroll (locked until all documents verify and income qualifies) or
  deny-with-required-note; every determination is audit-logged
- **Intake wizard** — 6 steps with live duplicate detection, automatic FPL calculation,
  and a report-readiness meter across the All-Characteristics fields
- **Clients** — scoped directory + 360° profile with every CSBG characteristic, service
  history, capture-now gap filling, and follow-up scheduling
- **Service log** — 3-field quick entry mapped to the full official SRV/SDA taxonomy
- **Reports** — live Annual Report rollup: Module 4 Section A services, Section B FNPI
  targets-vs-actuals, Section C All Characteristics; CSV export
- **Program tools** — attendance, weatherization pipeline, pantry network, seminars,
  construction projects, volunteers, loan servicing
- **Client portal** — tokenized, no-login mobile page: status steps, document upload,
  appointment, caseworker contact
- **Settings** — white-label organization, programs-by-type, users + program
  assignments, versioned FPL guidelines with point-in-time pinning, intake-question
  builder, answer lists, per-program service catalogs, database health + backup

## Compliance notes

- **FPL pinning:** every client/application stores the guideline year it was assessed
  under. Publishing a new year never recalculates a prior determination.
- **Access control:** program assignment gates client records, applications, services,
  tools, and search — enforced in queries, not just navigation.
- **Audit log:** sign-ins, eligibility decisions, FPL publishes, settings changes, and
  portal uploads write to `audit_log`.
- **Taxonomy:** `src/lib/csbg-catalog.ts`, extracted from the CSBG Annual Report 3.0
  instrument. Federal-instrument verification status is tracked in
  `docs/compliance/ar-3.0.md`.

## Documentation

- `docs/ROADMAP.md` — market review, federal data-requirements spec, phased plan
- `docs/ARCHITECTURE.md` — how the app is put together
- `CONVENTIONS.md` — implementation conventions for contributors
- `CONTRIBUTING.md` / `SECURITY.md`

All seeded people, addresses, and records are fictional.
