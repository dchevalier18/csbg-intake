# CSBG Client Intake System — Implementation Conventions

Production Next.js port of the Claude Design prototype at
`C:\Users\admin\Projects\CSBG Client Intake System\design\csbg-client-intake-system\project\`.
**Goal: pixel-faithful recreation of each design screen, backed by a real SQLite database,
real auth, and server-enforced access control.**

## Stack
- Next.js 15 App Router, TypeScript strict, React 19. **No Tailwind** — the design's CSS is
  ported to `src/styles/tokens.css` + `src/styles/app.css`; reuse those class names
  (`panel`, `chip`, `kpi`, `meter`, `field`, `fgrid c2`, `table.data`, `page-head`,
  `calv-btn calv-btn--primary` …). Inline `style={{}}` for one-off layout, exactly like the prototype.
- SQLite via better-sqlite3 + Drizzle (synchronous). `import { db, t } from "@/db"` —
  `t` is the schema namespace. Query style: `db.select().from(t.clients).where(eq(...)).all() / .get()`,
  `db.insert(t.x).values({...}).run()`, `db.update(t.x).set({...}).where(...).run()`.
- Path aliases: `@/*` → `src/*`. App routes live in `app/`.

## Auth & access control (NON-NEGOTIABLE)
- Every server component page in `app/(app)/` starts with
  `const user = await requireUser()` (`@/lib/auth`). Admin-only pages use `requireAdmin()`.
- Every server action re-checks: `requireUser()` + the relevant scoping check. Never trust
  client input for program/client visibility.
- Scoping helpers in `@/lib/access`:
  `visiblePrograms(user)`, `visibleProgramIds(user)`, `userCanSeeProgram(user, pid)`,
  `visibleClients(user)`, `visibleClient(user, id)`, `userHasCap(user, cap)`,
  `audit(userId, action, entity, entityId, detail?)`.
- If access fails on a page: render `<Restricted what="…" />` from `@/components/ui`.
  Tool pages gate with `userHasCap(user, "<cap>")`.
- Admin = `isAdmin(user)` (Data Admin | Program Manager) from `@/lib/auth`.

## Mutations
- Use **server actions** in an `actions.ts` colocated with the route
  (`"use server"` at top). After writes call `revalidatePath()` for affected routes.
- Significant actions (eligibility decisions, FPL publishes, settings changes,
  enrollment) must write an audit row via `audit(...)`.
- Server actions either `redirect()` or return a small `{ ok, message }`-style object the
  client component shows via `useToast()` from `@/components/toast`.

## Shared libraries (DO NOT duplicate)
- `@/lib/csbg-catalog` — DOMAINS, SERVICES, FNPIS, CHARACTERISTICS, FPL_BANDS, fplBand,
  serviceByCode, domainById (full official CSBG 3.0 taxonomy).
- `@/lib/fpl` — getFplHistory, getActiveFpl, fplSchedule(year), fplAnnualFor(size, year),
  fplPctFor(income, size, year), fplStatusFor(income, size, year, ceiling) → {pct,label,tone,eligible,band,year}.
  **Point-in-time pinning: existing records ALWAYS compute with their stored `fplYear`;
  only new intakes use the active schedule.**
- `@/lib/format` — fmt, money, shortDate, longDate, todayIso, ageFromDob, initialsOf, currentFY().
- `@/lib/completeness` — CSBG_CORE, completenessItems(rec, fields), completenessPct(rec, fields).
  Compute completeness live; nothing stores a completeness number.
- `@/lib/data/core` — getOrg, getStaff, staffById, getAllIntakeFields, getEnabledIntakeFields,
  getListsWithValues, listValuesFor, getDocTypes, requiredDocKeys, applicationDocList,
  applicationDocsVerified, DOC_STATUS_LABEL, OPEN_STAGES, openApplications, nextClientId,
  nextApplicationId, kvGet.
- `@/lib/program-types` — PROGRAM_TYPES, programType(id), CAP_TOOLS, capLabel, ACCENTS,
  PROGRAM_COLORS, DATA_SOURCES, ROLES. CAP_TOOLS maps capability → `/tools/...` route.
- UI: `@/components/ui` (Chip, CodeChip, ProgramDot, Meter, Kpi, Panel, Field, PageHead,
  Notice, Empty, Restricted, Avatar — server-safe), `@/components/ui-client` (Seg, Modal),
  `@/components/toast` (ToastProvider/useToast), `@/components/icons` (I, ICONS).

## Patterns
- Pages are **server components** that load data + enforce access, then render either
  server markup directly (read-only tables) or pass plain serializable props into a
  colocated `*-client.tsx` client component for interactivity. Keep client components free
  of DB imports.
- ProgramDot: look up the program row, render `<ProgramDot color={p.color} label={p.short} />`.
- Dates in DB are ISO strings. Display with shortDate/longDate. "Today" = `todayIso()`.
- Application stages: 'docs' → 'review' → 'decision'; terminal 'approved' | 'denied'.
  Open queue = OPEN_STAGES only. Approval requires: all docs verified AND income within
  ceiling (`fplStatusFor(...).eligible`). Denial requires a note (≥ 8 chars).
  Approval creates the client (nextClientId), copies characteristics from the application,
  pins `fplYear` from the application, links `clientId`, logs an `SDA 1a` service entry,
  and writes an audit row.
- The CSBG-code chips (`<CodeChip code="SRV 4e" />`) are always shown (the prototype's
  "tweaks" toggle is not ported).
- Density/empty states/copy: match the design files verbatim wherever feasible —
  including ledes, panel subtitles, helper text, and toast messages.

## Route map (ownership boundaries — do not edit routes you don't own)
| Route | Source design file |
|---|---|
| /dashboard | screens-dashboard.jsx |
| /eligibility | screens-eligibility.jsx |
| /clients, /clients/[id] | screens-clients.jsx |
| /intake | screens-intake.jsx |
| /services | screens-services.jsx (ScreenServices) |
| /data | screens-services.jsx (ScreenData) |
| /reports | screens-reports.jsx |
| /programs/[id] | screens-program.jsx |
| /settings (+ tabs) | screens-settings.jsx |
| /tools/attendance | screens-gnx.jsx |
| /tools/weatherization | screens-wx.jsx |
| /tools/pantry, /tools/volunteers | screens-network.jsx |
| /tools/seminars, /tools/projects | screens-housing.jsx |
| /tools/loans | screens-loans.jsx |
| /p/[token] (client portal), /portal-preview | screens-portal.jsx |

## Verification
`npm run typecheck` must pass. Do not run `npm run dev`/`build` (the orchestrator does).
