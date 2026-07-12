# Contributing to CAP Trellis

Thanks for helping build open-source infrastructure for Community Action Agencies.

## Ground rules

- **License:** contributions are accepted under Apache-2.0 (inbound = outbound).
- **Compliance first:** anything touching eligibility math, FPL schedules, the CSBG
  catalog, or report rollups must cite its federal source (instrument PDF, Federal
  Register notice, ACF DCL) in the PR description, and update
  `docs/compliance/ar-3.0.md` when the instrument mapping changes.
- **No real client data** — ever. Seeds, tests, fixtures, screenshots, and issue
  reports must use fictional data only.

## Development

```bash
npm install
npm run dev          # http://localhost:3100 (see README for DATABASE_URL options)
```

Before pushing:

```bash
npm run typecheck    # strict TS must pass
npm test             # vitest unit suite must pass
npm run smoke        # DDL + seed against in-memory PGlite must pass
npm run build        # production build must pass
```

CI runs the same four checks on every PR.

## Conventions

Read `CONVENTIONS.md` first — it covers the stack, auth/access-control rules
(non-negotiable), server-action patterns, shared libraries, and the route map.
The short version:

- Pages are server components that call `requireUser()`/`requireAdmin()` and enforce
  scope before rendering; mutations are server actions that re-check both.
- Never trust client input for program/client visibility; use the helpers in
  `@/lib/access`.
- Significant actions write an audit row via `audit(...)`.
- Schema changes go in **both** `src/db/schema.ts` and the idempotent bootstrap DDL in
  `src/db/ddl.ts` (additive `ADD COLUMN IF NOT EXISTS` migrations append there), and
  must keep `npm run smoke` green.
- Don't duplicate shared logic — check `@/lib/*` before writing a helper.

## Pull requests

- Keep PRs focused; describe the user-visible behavior change.
- Update docs when behavior changes (README, ARCHITECTURE, admin-facing copy).
- Tests: new logic in `src/lib` gets unit tests; eligibility/report changes get
  regression tests.

## Reporting security issues

Do **not** open a public issue — see `SECURITY.md`.
