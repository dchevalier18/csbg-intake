# HMIS API Integration Profile

Working profile for the HMIS (CaseWorthy / ClientTrack) → csbg-intake client
synchronization. This is the reference for vendor/product-specialist questions
and the build spec once API documentation for our instance arrives.

**Status:** MOU signed and delivered to the HMIS Lead (July 2026). Waiting on the
CaseWorthy/ClientTrack product specialist for API next steps. No credentials
issued yet; no integration code built yet.

## Purpose & direction

- **One-way, inbound only:** HMIS → csbg-intake. We never write back to HMIS.
- **Purpose:** synchronize client identity + demographics to eliminate double
  entry at intake. No case notes, assessments, or service transactions beyond
  the service elements the MOU names.

## Data elements (per signed MOU)

| MOU element | csbg-intake destination |
|---|---|
| First name / Last name | `clients.first` / `clients.last` |
| Date of birth | `clients.dob` |
| Email | (tiebreaker signal; storage TBD — no email column today) |
| Telephone | `clients.phone` |
| **Client ID** | `client_external_ids` (system = `hmis`) — durable link key |
| Services | `service_log` (mapping to AR 3.0 codes TBD with vendor docs) |
| Gender and Sex | `clients.sex` (canonicalized via C1) |
| Race / Ethnicity | `clients.race` (canonicalized via C6) |
| Veteran status | `clients.military` |
| Health insurance type | `clients.insurance` |
| Source of income | `clients.incomeSrc` |
| Non-cash benefits | TBD — likely `clients.custom` until modeled |
| Family members (first/last/DOB) | TBD — household members are not individual records today (`hhSize`/`hhType` only). Decide: ingest as clients vs. validate household size. |

**No SSN in any form.** The MOU excludes it; the system stores none.

## Matching & de-duplication policy

1. **Linked records (every sync after the first):** exact match on stored HMIS
   Client ID in `client_external_ids`. Unambiguous; no fuzzy logic.
2. **First-time linkage:** name + DOB against existing clients
   (shared engine in `src/lib/matching.ts`).
   - Exact name+DOB match → link candidate.
   - Near matches → **held in the match-review queue** (`match_reviews`) for
     human resolution. Nothing merges silently.
   - Email / telephone are **tiebreakers only**, never primary keys.
3. **Human review:** Data & Integrations → review queue. Resolutions: use
   existing record / create new record / dismiss. Every resolution is audited.

## Sync design (to confirm with vendor)

- **Method:** scheduled batch pull, nightly. Prefer incremental/delta
  (records changed since last sync cursor) over full snapshot.
- **Volume:** full initial backfill, then daily deltas.
- **Auth:** whatever the platform issues (OAuth2 client-credentials preferred,
  issued API key acceptable). Credentials encrypted at rest, never in source,
  rotatable.
- **Environments:** sandbox first, production after validation.

## Security posture

- TLS in transit; PostgreSQL encrypted at rest.
- Integration surface is admin-only (`requireAdmin`) — same gate as the rest
  of Data & Integrations.
- All sync runs, imports, and match resolutions write `audit_log` rows.
- Data used for intake/eligibility only; not redisclosed.

## Open questions for the product specialist

1. Which API (REST/SOAP, version) is provisioned for our instance, and where
   are the docs?
2. OAuth2 client-credentials or issued API key?
3. Delta/incremental query support (modified-since cursor)?
4. Rate limits / page sizes for the initial backfill?
5. Sandbox instance availability?
6. How "Services" are coded on their side (so we can map to AR 3.0 codes)?
7. Static-IP allowlisting requirements, if any?

## Related

- HMIS-aligned CSV **export** (manual, one-way out, admin-only):
  `app/(app)/clients/export-hmis/route.ts` — an alignment aid, unrelated to
  this inbound sync.
- AR 3.0 scope notes: `docs/compliance/ar-3.0.md`.
