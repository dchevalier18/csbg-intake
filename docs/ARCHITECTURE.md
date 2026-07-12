# CAP Trellis — Architecture

A single Next.js 15 (App Router) application backed by PostgreSQL. One deployment
serves one agency (single-tenant by design — see `docs/ROADMAP.md` §8).

## Layout

```
app/                    App Router
  (auth)/               login (public)
  (app)/                authenticated shell — dashboard, intake, eligibility,
                        clients, services, data, reports, programs, tools/*,
                        settings/*, denials
  p/[token]/            client portal (public, tokenized — no login)
  api/                  the few JSON/file endpoints that can't be server actions
src/
  db/                   schema.ts (Drizzle), ddl.ts (idempotent bootstrap DDL),
                        index.ts (connection + bootstrap gate), seed.ts
  lib/                  domain logic: csbg-catalog, fpl, access, auth,
                        completeness, program-types, import-templates,
                        spreadsheet, uploads, format, data/core
  components/           ui.tsx (server-safe atoms), ui-client.tsx, toast, icons,
                        shell/
  styles/               tokens.css + app.css (plain CSS design system)
deploy/                 Dockerfile, docker-compose.yml, Caddyfile,
                        examples/ (systemd/Apache reference deployment)
scripts/                smoke-pglite.ts (DDL + seed against in-memory PGlite)
tests/                  vitest unit suite
docs/                   ROADMAP, ARCHITECTURE, compliance/
```

## Request path

1. Every page under `app/(app)/` is a **server component** that starts with
   `requireUser()` (or `requireAdmin()`), loads data through the scoping helpers in
   `src/lib/access.ts`, and passes plain serializable props to a colocated
   `*-client.tsx` component for interactivity. Client components never import the DB.
2. **Mutations are server actions** (`actions.ts` beside the route). Every action
   re-checks auth + scope server-side, writes an audit row for significant changes,
   and calls `revalidatePath()`.
3. Access control is enforced **in queries** (program-scoped visibility), not in
   navigation. Out-of-scope records return the same "not found" as missing ones.

## Data layer

- **Drivers:** node-postgres (`pg`) in production; **PGlite** (embedded Postgres)
  when `DATABASE_URL` starts with `pglite://` — zero-install local/offline mode.
  Both sit behind the same Drizzle schema and query API.
- **Bootstrap:** `src/db/index.ts` exports a `db` proxy that gates every query behind
  a one-time bootstrap: run the idempotent DDL (`src/db/ddl.ts`), then auto-seed an
  empty database. Under `pg`, bootstrap serializes across processes with a Postgres
  advisory lock; under PGlite (single process) it runs directly.
- **Migrations policy (pre-1.0):** schema changes are **additive and idempotent** —
  `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` appended to `ddl.ts`,
  mirrored in `schema.ts`. The DDL re-runs on every boot, so upgrading = deploying
  new code. Destructive changes (drops, renames, type changes) are not allowed in a
  release that still reads the old shape; they land as expand-contract pairs across
  two releases. `npm run smoke` proves DDL + seed against a fresh embedded database.
- **Dates** are ISO strings in TEXT columns; booleans are 0/1 integers; arrays and
  documents are `jsonb`.

## Domain model (core tables)

- `organization` (single row) — white-label config + agency FPL ceiling.
- `users`, `user_programs`, `sessions` — auth + program assignment.
- `programs`, `doc_types`, `program_docs`, `program_services` — program config.
- `applications` (pre-enrollment, stage docs→review→decision, `portalToken`,
  pinned `fplYear`) and `application_docs` (checklist w/ verify + signed bypass).
- `clients` (enrolled; full Section C characteristics; pinned `fplYear`) and
  `client_programs` (multi-program enrollment — one person, one record).
- `services` + `service_log` (SRV/SDA taxonomy), `fnpi_progress` + `outcome_log`
  (Section B), `fpl_schedules` (versioned guidelines).
- `lists`/`list_values`, `intake_fields` — admin-configurable intake form.
- `audit_log`, `kv`, `import_jobs`, plus program-tool tables (classes/attendance,
  weatherization, pantry, seminars, projects, volunteers, loans).

## Compliance invariants (do not break)

1. **FPL point-in-time pinning** — existing records always compute against their
   stored `fplYear` (and jurisdiction); only new intakes use the active schedule.
   An active schedule is editable only while zero cases are pinned to it.
2. **Approval gating** — an application can be approved only when every required
   document is verified (or signed-bypassed) AND income is within the program's
   ceiling. Denials require a note. Both are re-checked server-side.
3. **Unduplicated counting** — report rollups count a person once per the rule of
   the section being produced (see `app/(app)/reports/rollup.ts`).
4. **Audit trail** — eligibility decisions, FPL publishes, settings changes, doc
   verifications/bypasses, imports, and exports write `audit_log` rows.

## Security

See `SECURITY.md`. In code: scrypt password hashing + timing-safe compare, DB-backed
sessions (httpOnly/SameSite=Lax/Secure), per-account + per-address login rate
limiting, security headers in `next.config.ts`, extension + magic-byte upload
validation (`src/lib/uploads.ts`), path-traversal-safe file storage outside the web
root, 256-bit portal tokens, `execFile` (never shell) for `pg_dump`.
