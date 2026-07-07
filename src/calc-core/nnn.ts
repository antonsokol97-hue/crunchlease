/**
 * Triple Net (NNN) Lease Calculator — pure formula engine (SPEC.md §T1).
 *
 * Builds a year-by-year occupancy schedule from either per-SF rates (`psf`)
 * or building totals + pro-rata (`totals`), escalating base rent and NNN
 * charges independently. No rounding here — the UI rounds at display (§6).
 * Guard clauses return typed error states, never NaN/Infinity (§5).
 *
 * Formulas (§T1):
 *   basePSF(y)   = base × (1 + esc/100)^(y−1)
 *   psf mode:    nnnPSF(1) = tax + ins + cam×(1 + admin/100) + other
 *   totals mode: proRata   = sf / bldg
 *                nnnPSF(1) = (taxT + insT + camT×(1 + admin/100) + otherT) × proRata / sf
 *   nnnPSF(y)    = nnnPSF(1) × (1 + nnng/100)^(y−1)
 *   grossPSF(y)  = basePSF(y) + nnnPSF(y)
 *   annual(y)    = grossPSF(y) × sf        monthly(y) = annual(y) / 12
 *   totalObligation = Σ annual(y), y = 1..term
 */

export type NnnMode = 'psf' | 'totals';

export type NnnInput = {
  mode: NnnMode;
  /** Leased area (SF). */
  sf: number;
  /** Base rent, $/SF/yr. */
  base: number;
  // psf mode — per-SF expense rates ($/SF/yr)
  tax: number;
  ins: number;
  cam: number;
  other: number;
  // totals mode — building area + annual expense totals ($)
  bldg: number;
  taxT: number;
  insT: number;
  camT: number;
  otherT: number;
  /** Admin/management fee on CAM (%). */
  admin: number;
  /** Base rent escalation (%/yr). */
  esc: number;
  /** NNN growth assumption (%/yr). */
  nnng: number;
  /** Lease term (whole years). */
  term: number;
};

export type NnnErrorCode = 'INCOMPLETE' | 'LEASED_EXCEEDS_BUILDING';
export type NnnWarningCode = 'ADMIN_HIGH';

/** Verbatim UI strings (SPEC.md §T1 Edge cases — must be used exactly). */
export const NNN_MESSAGES: Record<NnnErrorCode | NnnWarningCode, string> = {
  INCOMPLETE: 'Enter values to calculate.',
  LEASED_EXCEEDS_BUILDING: "Leased area can't exceed building area.",
  ADMIN_HIGH: 'Admin fees above 15% are unusual — double-check the lease.',
};

/** One row of the year-by-year schedule (all values full precision, $/SF or $). */
export type NnnYearRow = {
  year: number;
  basePerSf: number;
  nnnPerSf: number;
  grossPerSf: number;
  monthly: number;
  annual: number;
};

export type NnnResult =
  | {
      ok: true;
      /** Pro-rata share as a decimal (0.30 = 30%), or null in psf mode. */
      proRata: number | null;
      // Year-1 headline figures
      basePerSf: number;
      nnnPerSf: number;
      grossPerSf: number;
      annualBase: number;
      annualNnn: number;
      annualTotal: number;
      monthlyTotal: number;
      /** Year-by-year rows, length = term. */
      schedule: NnnYearRow[];
      totalObligation: number;
      /** Non-blocking warning code, or null. Results are still valid when set. */
      warning: NnnWarningCode | null;
    }
  | { ok: false; error: NnnErrorCode };

export const DEFAULTS: NnnInput = {
  mode: 'psf',
  sf: 3000,
  base: 24.0,
  tax: 3.5,
  ins: 1.2,
  cam: 4.0,
  other: 0,
  bldg: 10000,
  taxT: 35000,
  insT: 12000,
  camT: 40000,
  otherT: 0,
  admin: 0,
  esc: 3,
  nnng: 3,
  term: 5,
};

function isPositive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

function isNonNegative(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}

export function computeNnn(input: NnnInput): NnnResult {
  const { mode, sf, base, tax, ins, cam, other, bldg, taxT, insT, camT, otherT, admin, esc, nnng, term } = input;

  // Shared required inputs (empty/invalid → incomplete, never 0-substituted §T1).
  if (!isPositive(sf) || !isNonNegative(base)) return { ok: false, error: 'INCOMPLETE' };
  if (!Number.isFinite(esc) || !Number.isFinite(nnng) || !isNonNegative(admin)) return { ok: false, error: 'INCOMPLETE' };
  if (!Number.isFinite(term) || term < 1) return { ok: false, error: 'INCOMPLETE' };

  const adminFactor = 1 + admin / 100;

  let nnnPsf1: number;
  let proRata: number | null = null;

  if (mode === 'totals') {
    if (!isPositive(bldg)) return { ok: false, error: 'INCOMPLETE' };
    if (sf > bldg) return { ok: false, error: 'LEASED_EXCEEDS_BUILDING' };
    if (![taxT, insT, camT, otherT].every(isNonNegative)) return { ok: false, error: 'INCOMPLETE' };
    proRata = sf / bldg;
    nnnPsf1 = ((taxT + insT + camT * adminFactor + otherT) * proRata) / sf;
  } else {
    if (![tax, ins, cam, other].every(isNonNegative)) return { ok: false, error: 'INCOMPLETE' };
    nnnPsf1 = tax + ins + cam * adminFactor + other;
  }

  const years = Math.floor(term);
  const schedule: NnnYearRow[] = [];
  let totalObligation = 0;

  for (let y = 1; y <= years; y += 1) {
    const basePerSf = base * (1 + esc / 100) ** (y - 1);
    const nnnPerSf = nnnPsf1 * (1 + nnng / 100) ** (y - 1);
    const grossPerSf = basePerSf + nnnPerSf;
    const annual = grossPerSf * sf;
    const monthly = annual / 12;
    schedule.push({ year: y, basePerSf, nnnPerSf, grossPerSf, monthly, annual });
    totalObligation += annual;
  }

  const y1 = schedule[0];
  const warning: NnnWarningCode | null = admin > 15 ? 'ADMIN_HIGH' : null;

  return {
    ok: true,
    proRata,
    basePerSf: y1.basePerSf,
    nnnPerSf: y1.nnnPerSf,
    grossPerSf: y1.grossPerSf,
    annualBase: y1.basePerSf * sf,
    annualNnn: y1.nnnPerSf * sf,
    annualTotal: y1.annual,
    monthlyTotal: y1.monthly,
    schedule,
    totalObligation,
    warning,
  };
}
