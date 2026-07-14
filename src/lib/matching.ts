/* Shared client-matching engine — the ONE place identity resolution lives.
   Used by manual intake (live duplicate warning), spreadsheet imports (skip /
   hold-for-review), the approval guard, and future API syncs (HMIS, …).

   Policy (docs/compliance/hmis-api-integration-profile.md):
   - Linked external records match on stored external ID — not handled here.
   - First-time identity resolution: EXACT = normalized name + DOB.
     POSSIBLE = same last name + (same DOB or similar first name) — held for
     human review, never merged silently.
   - Phone/email are tiebreaker signals only, never primary keys. */

export interface IncomingPerson {
  first: string;
  last: string;
  dob: string;                    // ISO date
  phone?: string | null;
  email?: string | null;
}

export interface MatchCandidate {
  id: string;
  first: string;
  last: string;
  dob: string;
  phone?: string | null;
}

export interface PossibleMatch {
  client: MatchCandidate;
  /** human-readable signals, strongest first — shown in the review queue */
  reasons: string[];
}

export interface MatchResult {
  exact: MatchCandidate[];
  possible: PossibleMatch[];
}

/** trim + casefold + collapse inner whitespace */
export const normName = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, " ");

/** digits only; a leading US country code is dropped so 1-610… equals 610… */
export function normPhone(s: string | null | undefined): string {
  const d = String(s ?? "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

/** exact-identity key: normalized first|last|dob */
export const matchKey = (p: { first: string; last: string; dob: string }): string =>
  `${normName(p.first)}|${normName(p.last)}|${p.dob}`;

/** Classify an incoming person against existing clients.
    Exact and possible are disjoint; possible sorts strongest-signal first. */
export function classifyMatches(incoming: IncomingPerson, candidates: MatchCandidate[]): MatchResult {
  const first = normName(incoming.first);
  const last = normName(incoming.last);
  const firstPrefix = first.slice(0, 3);
  const phone = normPhone(incoming.phone);

  const exact: MatchCandidate[] = [];
  const possible: PossibleMatch[] = [];
  if (first.length < 2 || last.length < 2) return { exact, possible };

  for (const c of candidates) {
    const cFirst = normName(c.first);
    const cLast = normName(c.last);
    if (cFirst === first && cLast === last && c.dob === incoming.dob) {
      exact.push(c);
      continue;
    }
    if (cLast !== last) continue;
    const sameDob = c.dob === incoming.dob;
    const similarFirst = cFirst.startsWith(firstPrefix) || first.startsWith(cFirst.slice(0, 3));
    if (!sameDob && !similarFirst) continue;
    const reasons: string[] = [];
    if (sameDob) reasons.push("same last name and date of birth");
    if (similarFirst) reasons.push(sameDob ? "similar first name" : "same last name, similar first name");
    if (phone && normPhone(c.phone) === phone) reasons.unshift("same phone number");
    possible.push({ client: c, reasons });
  }
  // strongest first: phone tiebreak > same DOB > name similarity alone
  possible.sort((a, b) => score(b) - score(a));
  return { exact, possible };
}

const score = (m: PossibleMatch): number =>
  (m.reasons.some((r) => r.includes("phone")) ? 4 : 0) +
  (m.reasons.some((r) => r.includes("date of birth")) ? 2 : 0) +
  (m.reasons.some((r) => r.includes("first name")) ? 1 : 0);
