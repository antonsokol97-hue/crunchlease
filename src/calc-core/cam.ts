/**
 * CAM (Common Area Maintenance) Charges Calculator — pure engine (SPEC.md §T2).
 *   estimate  — pro-rata CAM, projected over N years with an optional cap.
 *   reconcile — tenant's share of actual costs vs what was paid.
 * No rounding here — the UI rounds at display (§6). Guards return typed error
 * states, never NaN/Infinity (§5).
 *
 * Formulas (§T2):
 *   proRata     = sf / gla
 *   billed(1)   = camT × (1 + admin/100) × proRata
 *   uncapped(y) = billed(1) × (1 + growth/100)^(y−1)
 *   annual cap: allowed(1)=uncapped(1); allowed(y)=min(uncapped(y), allowed(y−1) × (1+capPct/100))
 *   reconcile:  share = actual × (1 + admin/100) × proRata; balance = share − paid × months
 *
 * v1.1: §T2 uses a single annual cap — under one constant `growth` rate the
 * cumulative and non-cumulative bases are identical (see the TODO in
 * computeEstimate). The two-basis `applyCap` helper is retained here for §T6
 * Rent Escalation, whose variable per-year schedules make them diverge.
 */

/** Compounding basis for a cap ceiling (used by §T6; §T2 uses non-cumulative). */
export type CamCapBasis = 'non-cumulative' | 'cumulative';

/** §T2 cap model: off, or a single annual cap on each year's increase. */
export type CamCap = 'none' | 'annual';

export type CamEstimateInput = {
  sf: number;
  gla: number;
  camT: number;
  admin: number;
  growth: number;
  years: number;
  cap: CamCap;
  capPct: number;
};

export type CamReconcileInput = {
  sf: number;
  gla: number;
  admin: number;
  actual: number;
  paid: number;
  months: number;
};

export type CamMessageCode = 'INCOMPLETE' | 'TENANT_EXCEEDS_GLA' | 'CAP_SCOPE_DISCLOSURE';

/** Verbatim UI strings (SPEC.md §T2 Edge cases — must be used exactly). */
export const CAM_MESSAGES: Record<CamMessageCode, string> = {
  INCOMPLETE: 'Enter values to calculate.',
  TENANT_EXCEEDS_GLA: "Tenant area can't exceed building GLA.",
  CAP_SCOPE_DISCLOSURE:
    'Caps usually apply to controllable CAM only (excludes taxes, insurance, snow, utilities). v1 applies the cap to the full CAM figure — read your lease.',
};

export type CamYearRow = {
  year: number;
  uncapped: number;
  allowed: number;
};

export type CamEstimateResult =
  | {
      ok: true;
      proRata: number;
      /** Year-1 billed CAM (annual). */
      annual: number;
      perSf: number;
      monthly: number;
      schedule: CamYearRow[];
      /** Σ (uncapped − allowed) over the projection — cumulative savings from the cap. */
      capSavings: number;
    }
  | { ok: false; error: 'INCOMPLETE' | 'TENANT_EXCEEDS_GLA' };

export type CamReconcileResult =
  | {
      ok: true;
      proRata: number;
      share: number;
      totalPaid: number;
      /** > 0 tenant owes, < 0 credit due, 0 even. */
      balance: number;
      direction: 'due' | 'credit' | 'even';
    }
  | { ok: false; error: 'INCOMPLETE' | 'TENANT_EXCEEDS_GLA' };

export const ESTIMATE_DEFAULTS: CamEstimateInput = {
  sf: 2500,
  gla: 25000,
  camT: 125000,
  admin: 10,
  growth: 4,
  years: 5,
  cap: 'none',
  capPct: 5,
};

export const RECONCILE_DEFAULTS: CamReconcileInput = {
  sf: 2500,
  gla: 25000,
  admin: 10,
  actual: 138000,
  paid: 1100,
  months: 12,
};

function isPositive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

function isNonNegative(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}

/**
 * Apply a CAM cap to a per-year uncapped series (SPEC.md §T2). Pure and
 * independent of how `uncapped` was produced, so the two compounding bases
 * are unambiguous and separately testable:
 *   non-cumulative — ceiling grows off the PRIOR YEAR'S CAPPED value.
 *   cumulative     — ceiling grows off YEAR 1's value on a fixed path.
 * The two only diverge when the uncapped series dips below the ceiling in a
 * year and then rises — cumulative "banks" the unused headroom, non-cumulative
 * does not. With a single constant growth rate they coincide (see TODO below).
 */
export function applyCap(uncapped: number[], capType: CamCapBasis, capPct: number): number[] {
  const factor = 1 + capPct / 100;
  const allowed: number[] = [];
  uncapped.forEach((value, i) => {
    if (i === 0) {
      allowed.push(value);
      return;
    }
    const ceiling = capType === 'non-cumulative' ? allowed[i - 1] * factor : allowed[0] * factor ** i;
    allowed.push(Math.min(value, ceiling));
  });
  return allowed;
}

export function computeEstimate(input: CamEstimateInput): CamEstimateResult {
  const { sf, gla, camT, admin, growth, years, cap, capPct } = input;
  if (!isPositive(sf) || !isPositive(gla)) return { ok: false, error: 'INCOMPLETE' };
  if (sf > gla) return { ok: false, error: 'TENANT_EXCEEDS_GLA' };
  if (!isNonNegative(camT) || !isNonNegative(admin) || !isNonNegative(growth)) return { ok: false, error: 'INCOMPLETE' };
  if (!Number.isFinite(years) || years < 1 || !isNonNegative(capPct)) return { ok: false, error: 'INCOMPLETE' };

  const proRata = sf / gla;
  const billed1 = camT * (1 + admin / 100) * proRata;
  const n = Math.floor(years);

  const uncapped: number[] = [];
  for (let y = 1; y <= n; y += 1) uncapped.push(billed1 * (1 + growth / 100) ** (y - 1));

  // v1.1: §T2 applies a single annual cap (ceilings each year's increase off
  // the prior year — the non-cumulative basis). Under one constant `growth`,
  // non-cumulative and cumulative are identical anyway, so exposing both would
  // be a control that does nothing; the two-basis distinction lives in §T6
  // where variable schedules make it diverge. See applyCap + §T6.
  const allowed = cap === 'annual' ? applyCap(uncapped, 'non-cumulative', capPct) : uncapped;

  const schedule: CamYearRow[] = uncapped.map((u, i) => ({ year: i + 1, uncapped: u, allowed: allowed[i] }));
  const capSavings = schedule.reduce((sum, row) => sum + (row.uncapped - row.allowed), 0);

  return {
    ok: true,
    proRata,
    annual: billed1,
    perSf: billed1 / sf,
    monthly: billed1 / 12,
    schedule,
    capSavings,
  };
}

export function computeReconcile(input: CamReconcileInput): CamReconcileResult {
  const { sf, gla, admin, actual, paid, months } = input;
  if (!isPositive(sf) || !isPositive(gla)) return { ok: false, error: 'INCOMPLETE' };
  if (sf > gla) return { ok: false, error: 'TENANT_EXCEEDS_GLA' };
  if (!isNonNegative(admin) || !isNonNegative(actual) || !isNonNegative(paid)) return { ok: false, error: 'INCOMPLETE' };
  if (!Number.isFinite(months) || months < 1) return { ok: false, error: 'INCOMPLETE' };

  const proRata = sf / gla;
  const share = actual * (1 + admin / 100) * proRata;
  const totalPaid = paid * months;
  const balance = share - totalPaid;
  const direction: 'due' | 'credit' | 'even' = balance > 0 ? 'due' : balance < 0 ? 'credit' : 'even';

  return { ok: true, proRata, share, totalPaid, balance, direction };
}
