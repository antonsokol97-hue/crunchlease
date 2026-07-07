/**
 * Load Factor Calculator — pure formula engine (SPEC.md §T5).
 *
 * Converts between usable (USF) and rentable (RSF) square feet, exposes both
 * the load-factor and loss-factor conventions, and prices a quoted $/RSF rate
 * per usable foot. No rounding here — the UI rounds at display (§6). Guard
 * clauses return typed error states, never NaN/Infinity (§5).
 *
 * Formulas (§T5):
 *   loadFactor = rsf/usf − 1        lossFactor = (rsf − usf)/rsf = LF/(1+LF)
 *   rsf = usf × (1 + lf/100)        usf = rsf / (1 + lf/100)
 *   effectivePerUSF = rent × (1 + lf/100) = rent × rsf/usf
 */

/** Which quantity the calculator solves for; the other two are inputs (§T5 `solve`). */
export type LoadFactorSolve = 'lf' | 'rsf' | 'usf';

export type LoadFactorInput = {
  solve: LoadFactorSolve;
  /** Usable SF — authoritative unless solving for it. */
  usf: number;
  /** Rentable SF — authoritative unless solving for it. */
  rsf: number;
  /** Load factor as a whole-number percent (15 = 15%) — authoritative unless solving for it. */
  lf: number;
  /** Quoted rent, $/RSF/yr. 0 hides the cost-impact output. */
  rent: number;
};

export type LoadFactorErrorCode = 'INCOMPLETE' | 'RSF_LESS_THAN_USF';
export type LoadFactorWarningCode = 'LF_ABOVE_35';

/** Verbatim UI strings (SPEC.md §T5 Edge cases — must be used exactly). */
export const LOAD_FACTOR_MESSAGES: Record<LoadFactorErrorCode | LoadFactorWarningCode, string> = {
  INCOMPLETE: 'Enter values to calculate.',
  RSF_LESS_THAN_USF: 'Rentable SF is always ≥ usable SF.',
  LF_ABOVE_35: 'Load factors above 35% are rare — verify the measurement standard (BOMA).',
};

export type LoadFactorResult =
  | {
      ok: true;
      usf: number;
      rsf: number;
      /** Load factor as a decimal (0.15 = 15%). */
      loadFactor: number;
      /** Loss factor as a decimal (0.1304… = 13.04%). */
      lossFactor: number;
      /** Effective $/USF/yr, or null when rent is 0 (cost impact hidden). */
      effectivePerUSF: number | null;
      /** Non-blocking warning code, or null. Results are still valid when set. */
      warning: LoadFactorWarningCode | null;
    }
  | { ok: false; error: LoadFactorErrorCode };

// TODO(SPEC.md §T5): the Inputs table lists `solve` default `lf`, but `rsf`'s
// default is "—" (computed) and the Worked example solves USF + LF → RSF —
// both of which describe `solve = 'rsf'`. Treating `rsf` as the default solve
// target so the default state is complete and reproduces the worked example.
export const DEFAULTS: LoadFactorInput = {
  solve: 'rsf',
  usf: 5000,
  rsf: 5750,
  lf: 15,
  rent: 30,
};

function isPositive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

export function computeLoadFactor(input: LoadFactorInput): LoadFactorResult {
  const { solve, usf, rsf, lf, rent } = input;

  // Resolve the canonical (usf, rsf) pair from the two authoritative inputs.
  let u: number;
  let r: number;

  switch (solve) {
    case 'rsf': {
      if (!isPositive(usf) || !Number.isFinite(lf) || lf < 0) return { ok: false, error: 'INCOMPLETE' };
      u = usf;
      r = usf * (1 + lf / 100);
      break;
    }
    case 'usf': {
      const factor = 1 + lf / 100;
      if (!isPositive(rsf) || !Number.isFinite(lf) || lf < 0 || factor <= 0) return { ok: false, error: 'INCOMPLETE' };
      r = rsf;
      u = rsf / factor;
      break;
    }
    case 'lf': {
      if (!isPositive(usf) || !isPositive(rsf)) return { ok: false, error: 'INCOMPLETE' };
      u = usf;
      r = rsf;
      break;
    }
  }

  if (r < u) return { ok: false, error: 'RSF_LESS_THAN_USF' };

  const loadFactor = r / u - 1;
  const lossFactor = (r - u) / r;
  const effectivePerUSF = isPositive(rent) ? rent * (r / u) : null;
  const warning: LoadFactorWarningCode | null = loadFactor > 0.35 ? 'LF_ABOVE_35' : null;

  return { ok: true, usf: u, rsf: r, loadFactor, lossFactor, effectivePerUSF, warning };
}
