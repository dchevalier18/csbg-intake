/* ============================================================
   Loan amortization math — pure functions, no I/O.

   The portfolio stores whole-dollar principals/balances (matching
   the rest of the app); schedule rows are computed in CENTS so a
   48-month projection doesn't drift from rounding, and the caller
   formats cents for display. Ledger allocation works in the same
   whole-dollar world as the loans table.
   ============================================================ */

/** Periodic (monthly) rate from an annual rate in basis points (450 = 4.50% APR). */
export const monthlyRate = (rateBps: number): number => rateBps / 10_000 / 12;

/** Level monthly payment in CENTS for a whole-dollar principal. */
export function monthlyPaymentCents(principal: number, rateBps: number, termMonths: number): number {
  if (termMonths <= 0 || principal <= 0) return 0;
  const P = Math.round(principal * 100);
  if (rateBps <= 0) return Math.ceil(P / termMonths);
  const r = monthlyRate(rateBps);
  return Math.round((P * r) / (1 - Math.pow(1 + r, -termMonths)));
}

export interface ScheduleRow {
  n: number;          // installment number, 1-based
  due: string;        // ISO due date
  payment: number;    // cents
  interest: number;   // cents
  principal: number;  // cents
  balance: number;    // cents remaining after this installment
}

/** ISO date `months` months after `iso`, day-of-month clamped (Jan 31 + 1mo → Feb 28). */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = (m - 1) + months;
  const year = y + Math.floor(total / 12);
  const month = (total % 12) + 1;
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Full level-payment amortization schedule. First installment due one month
    after origination; the last installment absorbs the rounding remainder so
    the balance lands on exactly zero. */
export function amortizationSchedule(
  principal: number,
  rateBps: number,
  termMonths: number,
  originated: string,
): ScheduleRow[] {
  if (principal <= 0 || termMonths <= 0) return [];
  const payment = monthlyPaymentCents(principal, rateBps, termMonths);
  const r = rateBps > 0 ? monthlyRate(rateBps) : 0;
  const rows: ScheduleRow[] = [];
  let balance = Math.round(principal * 100);
  for (let n = 1; n <= termMonths && balance > 0; n++) {
    const interest = Math.round(balance * r);
    const isLast = n === termMonths || balance + interest <= payment;
    const principalPart = isLast ? balance : Math.min(balance, payment - interest);
    balance -= principalPart;
    rows.push({
      n,
      due: addMonthsIso(originated, n),
      payment: principalPart + interest,
      interest,
      principal: principalPart,
      balance,
    });
  }
  return rows;
}

export interface PaymentSplit { interest: number; principal: number }

/** Interest-first split of a whole-dollar payment against a whole-dollar balance.
    One month of interest accrues at the periodic rate; everything above it
    retires principal. Used when recording ledger rows. */
export function allocatePayment(balance: number, rateBps: number | null, amount: number): PaymentSplit {
  const paid = Math.max(0, Math.round(amount));
  const accrued = rateBps && rateBps > 0 ? Math.round(balance * monthlyRate(rateBps)) : 0;
  const interest = Math.min(paid, accrued);
  return { interest, principal: paid - interest };
}

/** "4.5%" / "4.50 %" / "450 bps" → basis points (or null). */
export function parseRateBps(text: string): number | null {
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*(%|bps)?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0) return null;
  const bps = m[2]?.toLowerCase() === "bps" ? Math.round(n) : Math.round(n * 100);
  return bps <= 10_000 ? bps : null; // >100% APR is a typo, not a CAA loan product
}

/** "48 mo" / "48 months" / "48" / "4 yr" → whole months (or null). */
export function parseTermMonths(text: string): number | null {
  const m = text.trim().match(/^(\d+)\s*(mo|mos|month|months|yr|yrs|year|years)?\.?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isInteger(n) || n <= 0) return null;
  const months = m[2]?.toLowerCase().startsWith("y") ? n * 12 : n;
  return months <= 600 ? months : null;
}

/** Cents → "$1,234.56" (schedule display; whole-dollar money() elsewhere). */
export const centsMoney = (cents: number): string =>
  (cents < 0 ? "-$" : "$") + (Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
