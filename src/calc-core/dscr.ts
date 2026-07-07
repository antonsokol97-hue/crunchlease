/**
 * DSCR (Debt Service Coverage Ratio) Calculator — pure engine (SPEC.md §T8).
 * Computes DSCR from NOI and debt service, builds the payment from loan terms
 * (amortizing or interest-only), and solves the maximum loan a property
 * supports at a target DSCR — the differentiator. No rounding here; the UI
 * rounds at display (§6). Guards return typed error states, never NaN (§5).
 *
 * Formulas (§T8):
 *   r = rate/100/12   n = am × 12
 *   PMT = r === 0 ? loan/n : loan × r / (1 − (1+r)^−n)
 *   annualDS = io ? loan × rate/100 : PMT × 12
 *   DSCR = NOI / annualDS
 *   Max loan: maxDS = NOI / target
 *     amortizing: maxLoan = (maxDS/12) × (1 − (1+r)^−n) / r   (r=0 → maxDS/12 × n)
 *     IO:         maxLoan = maxDS / (rate/100)
 */

export type DscrDebtMode = 'build' | 'direct';
export type DscrBand = 'fail' | 'thin' | 'near-min' | 'bankable' | 'strong';

export type DscrInput = {
  noi: number;
  dmode: DscrDebtMode;
  ds: number;
  loan: number;
  rate: number;
  am: number;
  io: boolean;
  target: number;
};

export type DscrErrorCode = 'INCOMPLETE' | 'IO_ZERO_RATE';

/** Verbatim UI strings (SPEC.md §T8). */
export const DSCR_MESSAGES: Record<DscrErrorCode, string> = {
  INCOMPLETE: 'Enter values to calculate.',
  IO_ZERO_RATE: 'Interest-only at 0% has no debt service.',
};

/** Gauge band labels (SPEC.md §T8); the fail line is verbatim. */
export const DSCR_BAND_LABELS: Record<DscrBand, string> = {
  fail: "Property doesn't cover the debt",
  thin: 'Thin coverage',
  'near-min': 'Near the typical lender minimum',
  bankable: 'Bankable',
  strong: 'Strong coverage',
};

export type DscrResult =
  | {
      ok: true;
      monthlyDebtService: number;
      annualDebtService: number;
      /** null when NOI ≤ 0 (DSCR N/A). */
      dscr: number | null;
      band: DscrBand | null;
      maxLoan: number;
      /** maxLoan − entered loan (meaningful in build mode). */
      delta: number;
    }
  | { ok: false; error: DscrErrorCode };

export const DEFAULTS: DscrInput = {
  noi: 180000,
  dmode: 'build',
  ds: 124364,
  loan: 1500000,
  rate: 6.75,
  am: 25,
  io: false,
  target: 1.25,
};

function isPositive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

function isNonNegative(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}

function bandOf(dscr: number): DscrBand {
  if (dscr < 1) return 'fail';
  if (dscr < 1.2) return 'thin';
  if (dscr < 1.25) return 'near-min';
  if (dscr < 1.4) return 'bankable';
  return 'strong';
}

export function computeDscr(input: DscrInput): DscrResult {
  const { noi, dmode, ds, loan, rate, am, io, target } = input;

  if (!isNonNegative(noi) || !isNonNegative(rate) || !isPositive(am)) return { ok: false, error: 'INCOMPLETE' };
  if (io && rate === 0) return { ok: false, error: 'IO_ZERO_RATE' };

  const r = rate / 100 / 12;
  const n = Math.floor(am) * 12;

  // Annual debt service for the entered deal.
  let annualDebtService: number;
  if (dmode === 'direct') {
    if (!isPositive(ds)) return { ok: false, error: 'INCOMPLETE' };
    annualDebtService = ds;
  } else {
    if (!isPositive(loan)) return { ok: false, error: 'INCOMPLETE' };
    if (io) {
      annualDebtService = loan * (rate / 100);
    } else {
      const pmt = r === 0 ? loan / n : (loan * r) / (1 - (1 + r) ** -n);
      annualDebtService = pmt * 12;
    }
  }

  if (!isPositive(annualDebtService)) return { ok: false, error: 'INCOMPLETE' };

  const dscr = noi > 0 ? noi / annualDebtService : null;
  const band = dscr === null ? null : bandOf(dscr);

  // Max loan at the target DSCR.
  const maxDS = target > 0 ? noi / target : 0;
  let maxLoan: number;
  if (io) {
    maxLoan = rate > 0 ? maxDS / (rate / 100) : 0;
  } else {
    maxLoan = r === 0 ? (maxDS / 12) * n : (maxDS / 12) * ((1 - (1 + r) ** -n) / r);
  }

  return {
    ok: true,
    monthlyDebtService: annualDebtService / 12,
    annualDebtService,
    dscr,
    band,
    maxLoan,
    delta: maxLoan - loan,
  };
}
