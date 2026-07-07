import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDollars } from '../money';
import { computeAllowance, computeAmortization, DEFAULTS } from '../ti';

function allowanceOk(input: Parameters<typeof computeAllowance>[0]) {
  const result = computeAllowance(input);
  if (!result.ok) throw new Error(`expected ok allowance, got ${result.error}`);
  return result;
}

function amortOk(input: Parameters<typeof computeAmortization>[0]) {
  const result = computeAmortization(input);
  if (!result.ok) throw new Error(`expected ok amortization, got ${result.error}`);
  return result;
}

describe('ti.default — Tab A allowance vs cost (SPEC.md §T3)', () => {
  const result = allowanceOk(DEFAULTS);

  it('total allowance = $90,000', () => {
    expect(formatDollars(result.totalTIA)).toBe('$90,000');
  });

  it('total buildout cost = $135,000', () => {
    expect(formatDollars(result.totalCost)).toBe('$135,000');
  });

  it('gap = $45,000 ($15/SF)', () => {
    expect(formatDollars(result.gap)).toBe('$45,000');
    expect(formatCurrency(result.gapPerSf)).toBe('$15.00');
  });

  it('does not flag the buildout as covered', () => {
    expect(result.coversBuildout).toBe(false);
  });
});

describe('ti.default — Tab B amortization (SPEC.md §T3)', () => {
  const result = amortOk({ p: 45000, rate: 8, n: 60, sf: 3000, lease: 60 });

  it('monthly payment = $912.44', () => {
    expect(formatCurrency(result.monthlyPayment)).toBe('$912.44');
  });

  it('rent impact = $3.65/SF/yr', () => {
    expect(formatCurrency(result.rentAddPerSfYr)).toBe('$3.65');
  });

  it('total repaid = $54,746', () => {
    expect(formatDollars(result.totalRepaid)).toBe('$54,746');
  });

  it('total interest = $9,746', () => {
    expect(formatDollars(result.totalInterest)).toBe('$9,746');
  });

  it('builds a full 60-month schedule that amortizes to ~zero', () => {
    expect(result.schedule).toHaveLength(60);
    expect(result.schedule[59].balance).toBeCloseTo(0, 4);
    // First month interest = 45,000 × 0.08/12 = $300.00.
    expect(formatCurrency(result.schedule[0].interest)).toBe('$300.00');
  });

  it('raises no lease warning when n equals the lease term', () => {
    expect(result.warning).toBeNull();
  });
});

describe('rate = 0 straight-line branch (§T3)', () => {
  const result = amortOk({ p: 45000, rate: 0, n: 60, sf: 3000, lease: 60 });

  it('payment = principal / term with zero interest', () => {
    expect(formatCurrency(result.monthlyPayment)).toBe('$750.00'); // 45,000 / 60
    expect(formatDollars(result.totalInterest)).toBe('$0');
    expect(result.schedule[0].interest).toBe(0);
  });
});

describe('gap = 0 success state (§T3)', () => {
  it('flags coversBuildout when the allowance meets the cost', () => {
    const result = allowanceOk({ sf: 3000, tia: 45, cost: 45 });
    expect(result.gap).toBe(0);
    expect(result.coversBuildout).toBe(true);
  });

  it('never returns a negative gap when the allowance exceeds cost', () => {
    const result = allowanceOk({ sf: 3000, tia: 50, cost: 45 });
    expect(result.gap).toBe(0);
    expect(result.coversBuildout).toBe(true);
  });
});

describe('lease warning + guards (§T3)', () => {
  it('warns (non-blocking) when amortization runs past the lease term', () => {
    const result = amortOk({ p: 45000, rate: 8, n: 72, sf: 3000, lease: 60 });
    expect(result.warning).toBe('AMORT_EXCEEDS_LEASE');
  });

  it('returns INCOMPLETE rather than NaN when space is missing', () => {
    expect(computeAllowance({ sf: 0, tia: 30, cost: 45 })).toEqual({ ok: false, error: 'INCOMPLETE' });
    expect(computeAmortization({ p: 45000, rate: 8, n: 0, sf: 3000, lease: 60 })).toEqual({
      ok: false,
      error: 'INCOMPLETE',
    });
  });
});
