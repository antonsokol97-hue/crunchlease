/**
 * Tenant Improvement (TI) Allowance & Amortization Calculator — pure engine
 * (SPEC.md §T3). Two linked calculations:
 *   Tab A — allowance vs buildout cost → the gap to finance.
 *   Tab B — amortize that gap into monthly rent (standard loan amortization).
 * No rounding here — the UI rounds at display (§6). Guards return typed error
 * states, never NaN/Infinity (§5).
 *
 * Formulas (§T3):
 *   totalTIA = sf × tia   totalCost = sf × cost   gap = max(0, totalCost − totalTIA)
 *   r = rate/100/12
 *   PMT = r === 0 ? p/n : p × r / (1 − (1 + r)^−n)
 *   rentAddPSFyr = PMT × 12 / sf
 *   schedule: interest(m) = balance(m−1) × r; principal(m) = PMT − interest(m)
 */

export type TiSpaceType = 'office-2g' | 'office-wb' | 'medical' | 'retail' | 'restaurant' | 'industrial';

export type TiInput = {
  // Tab A
  sf: number;
  tia: number;
  cost: number;
  type: TiSpaceType;
  // Tab B
  p: number;
  rate: number;
  n: number;
  lease: number;
};

export type TiMessageCode = 'INCOMPLETE' | 'GAP_COVERED' | 'AMORT_EXCEEDS_LEASE';

/** Verbatim UI strings (SPEC.md §T3 Edge cases — must be used exactly). */
export const TI_MESSAGES: Record<TiMessageCode, string> = {
  INCOMPLETE: 'Enter values to calculate.',
  GAP_COVERED: 'Your allowance covers the buildout — nothing to amortize.',
  AMORT_EXCEEDS_LEASE: 'Amortization longer than the lease term is rare — landlords typically match them.',
};

export type TiAllowanceResult =
  | {
      ok: true;
      totalTIA: number;
      totalCost: number;
      gap: number;
      gapPerSf: number;
      /** True when the allowance covers the buildout (gap = 0) — Tab A success state. */
      coversBuildout: boolean;
    }
  | { ok: false; error: 'INCOMPLETE' };

export type TiScheduleRow = {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
};

export type TiAmortResult =
  | {
      ok: true;
      monthlyPayment: number;
      rentAddPerSfYr: number;
      totalRepaid: number;
      totalInterest: number;
      schedule: TiScheduleRow[];
      /** Non-blocking warning code, or null. Results are still valid when set. */
      warning: 'AMORT_EXCEEDS_LEASE' | null;
    }
  | { ok: false; error: 'INCOMPLETE' };

export const DEFAULTS: TiInput = {
  sf: 3000,
  tia: 30,
  cost: 45,
  type: 'office-2g',
  p: 45000, // auto = gap from Tab A defaults (135,000 − 90,000)
  rate: 8,
  n: 60,
  lease: 60,
};

function isPositive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

function isNonNegative(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}

/** Tab A — allowance vs buildout cost. */
export function computeAllowance(input: Pick<TiInput, 'sf' | 'tia' | 'cost'>): TiAllowanceResult {
  const { sf, tia, cost } = input;
  if (!isPositive(sf) || !isNonNegative(tia) || !isNonNegative(cost)) return { ok: false, error: 'INCOMPLETE' };

  const totalTIA = sf * tia;
  const totalCost = sf * cost;
  const gap = Math.max(0, totalCost - totalTIA);
  return {
    ok: true,
    totalTIA,
    totalCost,
    gap,
    gapPerSf: gap / sf,
    coversBuildout: gap === 0,
  };
}

/** Tab B — amortize an amount `p` into monthly rent over `n` months. */
export function computeAmortization(input: Pick<TiInput, 'p' | 'rate' | 'n' | 'sf' | 'lease'>): TiAmortResult {
  const { p, rate, n, sf, lease } = input;
  if (!isPositive(sf) || !isNonNegative(p) || !isNonNegative(rate)) return { ok: false, error: 'INCOMPLETE' };
  if (!Number.isFinite(n) || n < 1) return { ok: false, error: 'INCOMPLETE' };

  const months = Math.floor(n);
  const r = rate / 100 / 12;
  const monthlyPayment = r === 0 ? p / months : (p * r) / (1 - (1 + r) ** -months);

  const schedule: TiScheduleRow[] = [];
  let balance = p;
  for (let m = 1; m <= months; m += 1) {
    const interest = balance * r;
    const principal = monthlyPayment - interest;
    balance -= principal;
    schedule.push({ month: m, payment: monthlyPayment, interest, principal, balance });
  }

  const totalRepaid = monthlyPayment * months;
  const totalInterest = totalRepaid - p;
  const rentAddPerSfYr = (monthlyPayment * 12) / sf;
  const warning = Number.isFinite(lease) && lease > 0 && months > lease ? 'AMORT_EXCEEDS_LEASE' : null;

  return { ok: true, monthlyPayment, rentAddPerSfYr, totalRepaid, totalInterest, schedule, warning };
}
