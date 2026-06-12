# Handoff: Eligibility Document Verification — Undo, Required Uploads & Signed Bypass

## Overview
This handoff covers an update to the **Eligibility queue** of the CSBG Client Intake System (Community Action Lehigh Valley). It hardens the document-verification workflow in the applicant review modal with three rules:

1. **Verifications are reversible.** A verified requirement can be undone if it was committed by mistake.
2. **A supporting document (scanned file) is required for every requirement** before it can be verified.
3. **A bypass exists, but it must be signed.** A user may verify without a document only through an acknowledgement prompt that records a reason and the user's sign-off into the applicant's eligibility determination record.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing the intended look and behavior. They are NOT production code to copy directly. The task is to **recreate this behavior in the target codebase's existing environment** (whatever framework, backend, and document-storage system the production intake system uses), following its established patterns. If no environment exists yet, choose the most appropriate stack and implement the designs there.

The prototype is fully runnable: open `CSBG Client Intake System.html`, navigate to **Eligibility** in the left nav, and click any applicant row to open the review modal.

## Fidelity
**High-fidelity.** Colors, typography, spacing, copy, and interaction states are final intent and follow the CALV design system. Recreate the UI faithfully using the codebase's existing component library mapped to these tokens.

## The Screen: Applicant Eligibility Review Modal
- **Where:** Eligibility queue → click an applicant row → modal (`max-width: 620px`).
- **Purpose:** A case worker or program manager reviews required documents, verifies each one, and approves/denies the application. **Approval is blocked until every required document is verified** and income is within the CSBG 125% FPL ceiling.

### Document requirement rows
Each required document (the set varies by program) renders as a bordered row card:

- Container: `border: 1px solid var(--calv-slate-15)`, `border-radius: 4px`, `padding: 10px 12px`, rows stacked with `gap: 8px`.
- Top line (flex, `gap: 12px`, vertically centered):
  - Document icon (16px line icon), colored by status: verified `var(--calv-sage)` `#6FA287`, submitted `#8A6410` (dark amber, AA-safe on white), missing `var(--calv-red)` `#D14124`.
  - Requirement label, 13px, flex-grows.
  - Status chip: `Verified` (sage), `Submitted — needs review` (amber), `Missing` (red).
  - Action buttons (quiet/small button style, in a flex row with `gap: 6px`) — see state machine below.
- Meta line (shown when there is anything to say): `margin-top: 7px`, `padding-left: 28px` (aligns under the label, past the icon), `font-size: 11.5px`, `color: var(--calv-slate-65)`, items in a wrapping flex row with `gap: 14px`:
  - **File on record:** small doc icon + `{filename} · uploaded {Mon D}`.
  - **Submitted but no file:** warning text in `#8A6410`: `No file on record — attach the scanned document to verify.`
  - **Verified:** `Verified by {Staff Name} · {Mon D}`.
  - **Bypassed:** alert-triangle icon + text in `#8A6410`: `No document retained — signed off by {Staff Name}: “{reason}”`.

### Per-document state machine

Statuses: `missing` → `submitted` → `verified` (and back).

| Status | File attached? | Actions shown |
|---|---|---|
| missing | no | **Attach** (opens file picker) · **Verify without doc…** (opens bypass prompt) |
| missing / submitted | yes | **Replace** (file picker) · **Verify** |
| submitted | no | **Attach** · **Verify without doc…** |
| verified | — | **Undo** |

Rules:
- **Attaching a file** sets status to `submitted` (a `verified` doc stays verified if a file is replaced) and records `{ name, by: currentUserId, when: today }`. Toast: `Document attached to the applicant file.` File picker accepts `.pdf,.jpg,.jpeg,.png,.heic,.tif,.tiff`.
- **Verify** is only available when a file is on record. It records a verification `{ by, when }`. Toast: `Marked verified.`
- **Verify without doc…** never verifies directly — it opens the bypass acknowledgement prompt (below).
- **Undo** removes the verification record AND any bypass record, then resets status to `submitted` if a file is on record, else `missing`. Toast: `Verification undone — status reset and the sign-off was removed.`

### Stage recomputation (both directions)
The application's pipeline stage chip must stay honest:
- When the last document becomes verified and stage is `Waiting on documents` → advance to `Ready for review`.
- When an undo means not-all-verified and stage is `Ready for review` → revert to `Waiting on documents`.
- An application already at `Awaiting decision` is not auto-moved, but **Approve & enroll stays disabled** unless all documents are verified.

### Bypass acknowledgement prompt
A second modal (`max-width: 480px`, titled `Verify without a supporting document`) layered over the review modal:

1. **Warning callout** — amber surface `var(--calv-amber-15)`, `1px solid var(--calv-amber-35)`, radius 4, alert icon in `#8A6410`, 12.5px text:
   > **{Requirement label}** has no scanned document attached. Verifying without one is an audited exception — your sign-off is written to {Applicant ID}'s eligibility determination record and is visible to program monitors.
2. **Reason field (required)** — label `Why is no document on file? *`, 3-row textarea, placeholder: `e.g., Original sighted in person — agency policy prohibits retaining a copy.`
3. **Acknowledgement checkbox** — 12.5px label:
   > I, **{Current User Full Name}**, acknowledge that I am verifying this requirement without a supporting document on file, and I accept responsibility for this determination.
4. **Footer buttons (right-aligned):** `Cancel` (ghost) · `Sign & verify` (primary red), **disabled until the checkbox is checked AND the trimmed reason is ≥ 8 characters** (disabled = 45% opacity, `cursor: not-allowed`).

On confirm: status → `verified`, a verification record AND a bypass record `{ by, when, reason }` are written, prompt closes, toast: `Verified without document — your sign-off was written to the determination record.`

## State Management / Data Model
Per applicant, keyed by document key:

```js
docs:          { [docKey]: "missing" | "submitted" | "verified" }
files:         { [docKey]: { name: string, by: staffId, when: ISODate } }   // supporting file metadata
verifications: { [docKey]: { by: staffId, when: ISODate } }                 // who verified, when
bypass:        { [docKey]: { by: staffId, when: ISODate, reason: string } } // signed exception
```

Production notes (beyond prototype scope):
- Store the uploaded file itself (the prototype keeps only the filename); virus-scan and apply the agency's retention policy.
- Verification, bypass sign-off, and **undo** events should all be written to an append-only audit log (the prototype removes the record on undo; production should retain the history).
- Consider a permission tier: whether bypass sign-off (or undo of another user's verification) requires a program-manager role.

## Interactions & Behavior summary
- All confirmations surface as the app's standard toast (bottom, check icon).
- Modal scrims close on background click; the bypass prompt closes without side effects on Cancel/scrim/X.
- Buttons: quiet buttons for row actions, primary red only for the commit actions (`Sign & verify`, `Approve & enroll`). Hover darkens ~7–10%; press translates 1px down. Transitions ≤ 250ms, ease `cubic-bezier(.2,.8,.2,1)`.

## Design Tokens (CALV design system)
- `--calv-red: #D14124` — primary buttons, missing-doc icon
- `--calv-slate: #54585A` (+ tints `-65/-35/-15`) — text, borders, muted meta text
- `--calv-sage: #6FA287` — verified
- `--calv-amber: #F1B434` (+ `-35/-15` tints) — warning surfaces; `#8A6410` for amber-toned text on white
- `--calv-teal: #006269` — links / secondary
- Radius: 4px (`--radius-sm`) everywhere; chips are the only pill
- Shadow: `0 4px 10px rgba(84,88,90,0.10)`
- Type: DIN Condensed Bold (headings/buttons, ALL CAPS +0.02em); Barlow 300/400/600 as DIN 2014 body substitute. Row label 13px; meta 11.5px; callouts 12.5px, line-height ≈1.55.
- Icons: Lucide-style line icons, 1.8px stroke, `currentColor`.

## Assets
No new imagery. Icons are inline SVG paths (`doc`, `upload`, `check`, `alert`, `x`) defined in `app/components.jsx`. CALV fonts/logos are under `calv/`.

## Files in this bundle
- `CSBG Client Intake System.html` — entry point; open in a browser to run the prototype.
- `app/screens-eligibility.jsx` — **the updated screen**: row state machine, `attachDoc` / `verifyDoc` / `undoVerify` / `recomputeStage` handlers, `ApplicantModal`, `BypassPrompt`.
- `app/data.js` — data model + seed logic (`APPLICANTS.forEach…`) showing how `files` / `verifications` / `bypass` are populated, incl. one seeded bypass example (applicant A-1174, SSN sighted in person).
- `app/components.jsx` — shared atoms (Modal, Chip, Field, icons, Toast).
- `app/app.css`, `calv/colors_and_type.css` — styles and design tokens.
- Remaining `app/screens-*.jsx` files — the rest of the prototype, included so it runs; not part of this change.
