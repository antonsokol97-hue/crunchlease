/**
 * Cap Rate Calculator — pure engine (SPEC.md §T7). Solves any side of the cap
 * rate identity, builds NOI from income and expenses, and stress-tests value
 * with a cap × NOI sensitivity matrix. No rounding here — the UI rounds at
 * display (§6). Guards return typed error states, never NaN (§5).
 *
 * Formulas (§T7):
 *   cap = NOI/value × 100   value = NOI/(cap/100)   NOI = value × cap/100
 *   Builder: EGI = gpr × (1 − vac/100) + oi; mgmt$ = EGI × mgmt/100
 *            NOI = EGI − (tx + insx + ut + rep + res) − mgmt$
 */

export type CapSolve = 'cap' | 'value' | 'noi';

export type CapInput = {
  solve: CapSolve;
  noi: number;
  value: number;
  cap: number;
  /** When true (and not solving for NOI), NOI comes from the builder fields. */
  useBuilder: boolean;
  gpr: number;
  oi: number;
  vac: number;
  tx: number;
  insx: number;
  ut: number;
  rep: number;
  res: number;
  mgmt: number;
};

export type CapErrorCode = 'INCOMPLETE' | 'VALUE_NONPOSITIVE';

/** Verbatim UI strings (SPEC.md §T7 Edge cases). */
export const CAP_MESSAGES: Record<CapErrorCode | 'CAP_UNUSUAL' | 'NEGATIVE_NOI', string> = {
  INCOMPLETE: 'Enter values to calculate.',
  // TODO(SPEC.md §T7): the spec says "value ≤ 0 → error" but gives no verbatim
  // string; this is a placeholder.
  VALUE_NONPOSITIVE: 'Enter a property value greater than $0.',
  CAP_UNUSUAL: 'Cap rates outside 2–15% are unusual — check inputs.',
  NEGATIVE_NOI: 'Negative NOI: the property loses money before debt service.',
};

export type NoiBuilderResult = { egi: number; mgmtDollars: number; noi: number };

export type CapResult =
  | {
      ok: true;
      cap: number;
      value: number;
      noi: number;
      negativeNoi: boolean;
      capUnusual: boolean;
    }
  | { ok: false; error: CapErrorCode };

export type SensitivityMatrix = {
  caps: number[];
  noiFactors: number[];
  noiValues: number[];
  /** cells[capIndex][noiIndex] = implied value. */
  cells: number[][];
  baseNoi: number;
};

export const DEFAULTS: CapInput = {
  solve: 'cap',
  noi: 150000,
  value: 2000000,
  cap: 7.5,
  useBuilder: false,
  gpr: 200000,
  oi: 5000,
  vac: 5,
  tx: 22000,
  insx: 6000,
  ut: 9000,
  rep: 8000,
  res: 3000,
  mgmt: 4,
};

/** Rows and columns of the sensitivity matrix (SPEC.md §T7). */
export const SENS_CAPS = [4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0];
export const SENS_FACTORS = [-0.1, -0.05, 0, 0.05, 0.1];

function isFiniteNum(n: number): boolean {
  return Number.isFinite(n);
}

/** Build NOI from the income/expense fields (SPEC.md §T7 builder). */
export function computeNoiBuilder(input: Pick<CapInput, 'gpr' | 'oi' | 'vac' | 'tx' | 'insx' | 'ut' | 'rep' | 'res' | 'mgmt'>): NoiBuilderResult {
  const { gpr, oi, vac, tx, insx, ut, rep, res, mgmt } = input;
  const egi = gpr * (1 - vac / 100) + oi;
  const mgmtDollars = egi * (mgmt / 100);
  const noi = egi - (tx + insx + ut + rep + res) - mgmtDollars;
  return { egi, mgmtDollars, noi };
}

export function computeCapRate(input: CapInput): CapResult {
  const { solve, value, cap, useBuilder } = input;

  // Resolve the NOI that feeds cap/value solving (builder or manual).
  const resolvedNoiInput = useBuilder ? computeNoiBuilder(input).noi : input.noi;

  let outCap = cap;
  let outValue = value;
  let outNoi = resolvedNoiInput;

  switch (solve) {
    case 'cap': {
      if (!isFiniteNum(resolvedNoiInput)) return { ok: false, error: 'INCOMPLETE' };
      if (!isFiniteNum(value)) return { ok: false, error: 'INCOMPLETE' };
      if (value <= 0) return { ok: false, error: 'VALUE_NONPOSITIVE' };
      outNoi = resolvedNoiInput;
      outValue = value;
      outCap = (outNoi / value) * 100;
      break;
    }
    case 'value': {
      if (!isFiniteNum(resolvedNoiInput)) return { ok: false, error: 'INCOMPLETE' };
      if (!isFiniteNum(cap) || cap <= 0) return { ok: false, error: 'INCOMPLETE' };
      outNoi = resolvedNoiInput;
      outCap = cap;
      outValue = outNoi / (cap / 100);
      break;
    }
    case 'noi': {
      if (!isFiniteNum(cap) || cap <= 0) return { ok: false, error: 'INCOMPLETE' };
      if (!isFiniteNum(value)) return { ok: false, error: 'INCOMPLETE' };
      if (value <= 0) return { ok: false, error: 'VALUE_NONPOSITIVE' };
      outValue = value;
      outCap = cap;
      outNoi = (value * cap) / 100;
      break;
    }
  }

  return {
    ok: true,
    cap: outCap,
    value: outValue,
    noi: outNoi,
    negativeNoi: outNoi < 0,
    capUnusual: outCap < 2 || outCap > 15,
  };
}

/** Cap × NOI sensitivity matrix of implied values (SPEC.md §T7 differentiator). */
export function buildSensitivity(baseNoi: number): SensitivityMatrix {
  const noiValues = SENS_FACTORS.map((f) => baseNoi * (1 + f));
  const cells = SENS_CAPS.map((c) => noiValues.map((noi) => noi / (c / 100)));
  return { caps: SENS_CAPS, noiFactors: SENS_FACTORS, noiValues, cells, baseNoi };
}
