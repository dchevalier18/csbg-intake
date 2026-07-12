/* ============================================================
   Sign-in rate limiting — in-memory sliding window, keyed by
   account and by caller address. Single-process by design (the
   app runs as one Node server per agency); a restart clearing
   the counters is acceptable for this threat model.
   ============================================================ */

interface Window {
  count: number;
  first: number; // epoch ms of the first failure in the window
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_ACCOUNT = 10;  // failures per account per window
const MAX_PER_ADDRESS = 30;  // failures per caller address per window

const failures = new Map<string, Window>();

function bump(key: string, now: number): number {
  const w = failures.get(key);
  if (!w || now - w.first > WINDOW_MS) {
    failures.set(key, { count: 1, first: now });
    return 1;
  }
  w.count += 1;
  return w.count;
}

function count(key: string, now: number): number {
  const w = failures.get(key);
  return !w || now - w.first > WINDOW_MS ? 0 : w.count;
}

// keep the map from growing unboundedly under scanning traffic
function prune(now: number): void {
  if (failures.size < 10_000) return;
  for (const [k, w] of failures) if (now - w.first > WINDOW_MS) failures.delete(k);
}

/** True when this account or address has exhausted its failure budget. */
export function signInBlocked(username: string, address: string, now = Date.now()): boolean {
  return count(`u:${username}`, now) >= MAX_PER_ACCOUNT || count(`a:${address}`, now) >= MAX_PER_ADDRESS;
}

/** Record a failed attempt against both keys. */
export function recordSignInFailure(username: string, address: string, now = Date.now()): void {
  prune(now);
  bump(`u:${username}`, now);
  bump(`a:${address}`, now);
}

/** Clear the account's counter after a successful sign-in. */
export function clearSignInFailures(username: string): void {
  failures.delete(`u:${username}`);
}

/** Test hook. */
export function resetRateLimiter(): void {
  failures.clear();
}
