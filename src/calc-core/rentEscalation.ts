/**
 * Rent Escalation Calculator — pure engine (SPEC.md §T6). Builds a year-by-year
 * rent schedule for four clause types (fixed %, fixed step, CPI, custom), with
 * an every-N-years frequency and an optional rent-growth cap (v1.1, relocated
 * from §T2) in cumulative or non-cumulative form. No rounding here — the UI
 * rounds at display (§6). Guards return typed error states, never NaN (§5).
 *
 * Formulas (§T6):
 *   k = floor((y−1)/freq)
 *   pct:    rate(y) = start × (1 + pct/100)^k
 *   step:   rate(y) = start + step × k        (clamped at 0)
 *   cpi:    g = clamp(cpi, floor, cap); rate(y) = start × (1 + g/100)^k
 *   custom: rate(y) = sched[y]
 *   rent cap (applied to the rate series): see applyCap in ./cam
 *   annual(y) = rate(y) × sf   total = Σ annual(y)   avgRate = total / term / sf
 */
import { applyCap } from './cam';

export type EscType = 'pct' | 'step' | 'cpi' | 'custom';
export type EscCapMode = 'none' | 'cumulative' | 'non-cumulative';

export type EscInput = {
  type: EscType;
  start: number;
  sf: number;
  term: number;
  pct: number;
  step: number;
  cpi: number;
  /** CPI rate ceiling (%). Distinct from the rent-growth cap below. */
  cap: number;
  /** CPI rate floor (%). */
  floor: number;
  freq: number;
  /** Custom per-year $/SF rates; index y−1. */
  sched: number[];
  /** v1.1 rent-growth cap basis. */
  capMode: EscCapMode;
  /** v1.1 rent-growth cap (%/yr). */
  capMax: number;
};

export type EscErrorCode = 'INCOMPLETE' | 'CAP_BELOW_FLOOR';
export type EscWarningCode = 'STEP_BELOW_ZERO';

/** Verbatim UI strings (SPEC.md §T6 Edge cases). */
export const ESC_MESSAGES: Record<EscErrorCode | EscWarningCode, string> = {
  INCOMPLETE: 'Enter values to calculate.',
  CAP_BELOW_FLOOR: 'CPI cap must be ≥ the floor.',
  // TODO(SPEC.md §T6): the spec says "clamp with warning" for a step that drives
  // rent below $0 but gives no verbatim string; this is a placeholder. (Also
  // unreachable while `step` is range-limited to ≥ 0 and `start` ≥ 0.)
  STEP_BELOW_ZERO: 'A fixed step drops rent below $0; the schedule is clamped at $0.',
};

export type EscYearRow = {
  year: number;
  rate: number;
  /** Year-over-year change as a decimal (0.03 = 3%); 0 for year 1. */
  deltaPct: number;
  monthly: number;
  annual: number;
};

export type EscResult =
  | {
      ok: true;
      schedule: EscYearRow[];
      finalRate: number;
      totalObligation: number;
      avgRate: number;
      /** (finalRate − start) / start. */
      cumIncrease: number;
      /** Total $ saved by the cap over the term (0 when capMode = none). */
      capSavings: number;
      warning: EscWarningCode | null;
    }
  | { ok: false; error: EscErrorCode };

export const DEFAULTS: EscInput = {
  type: 'pct',
  start: 28,
  sf: 4000,
  term: 10,
  pct: 3,
  step: 0.5,
  cpi: 2.5,
  cap: 4,
  floor: 2,
  freq: 1,
  sched: [],
  capMode: 'none',
  capMax: 5,
};

function isPositive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

function isNonNegative(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}

export function computeEscalation(input: EscInput): EscResult {
  const { type, start, sf, term, pct, step, cpi, cap, floor, freq, sched, capMode, capMax } = input;

  if (!isNonNegative(start) || !isPositive(sf)) return { ok: false, error: 'INCOMPLETE' };
  if (!Number.isFinite(term) || term < 1 || !Number.isFinite(freq) || freq < 1) return { ok: false, error: 'INCOMPLETE' };

  const years = Math.floor(term);
  const period = Math.floor(freq);

  if (type === 'cpi') {
    if (!Number.isFinite(cap) || !Number.isFinite(floor)) return { ok: false, error: 'INCOMPLETE' };
    if (cap < floor) return { ok: false, error: 'CAP_BELOW_FLOOR' };
  }
  if (type === 'custom') {
    for (let y = 1; y <= years; y += 1) {
      if (!isNonNegative(sched[y - 1])) return { ok: false, error: 'INCOMPLETE' };
    }
  }

  let warning: EscWarningCode | null = null;
  const uncapped: number[] = [];
  for (let y = 1; y <= years; y += 1) {
    const k = Math.floor((y - 1) / period);
    let rate: number;
    switch (type) {
      case 'pct':
        rate = start * (1 + pct / 100) ** k;
        break;
      case 'step': {
        rate = start + step * k;
        if (rate < 0) {
          rate = 0;
          warning = 'STEP_BELOW_ZERO';
        }
        break;
      }
      case 'cpi': {
        const g = Math.min(Math.max(cpi, floor), cap);
        rate = start * (1 + g / 100) ** k;
        break;
      }
      case 'custom':
        rate = sched[y - 1];
        break;
    }
    uncapped.push(rate);
  }

  const rates = capMode === 'none' ? uncapped : applyCap(uncapped, capMode, capMax);

  const schedule: EscYearRow[] = rates.map((rate, i) => {
    const annual = rate * sf;
    return {
      year: i + 1,
      rate,
      deltaPct: i === 0 ? 0 : rates[i - 1] === 0 ? 0 : (rate - rates[i - 1]) / rates[i - 1],
      monthly: annual / 12,
      annual,
    };
  });

  const totalObligation = schedule.reduce((sum, r) => sum + r.annual, 0);
  const finalRate = rates[rates.length - 1];
  const capSavings = uncapped.reduce((sum, u, i) => sum + (u - rates[i]) * sf, 0);

  return {
    ok: true,
    schedule,
    finalRate,
    totalObligation,
    avgRate: totalObligation / years / sf,
    cumIncrease: start === 0 ? 0 : (finalRate - start) / start,
    capSavings,
    warning,
  };
}
