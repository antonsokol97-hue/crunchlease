import { describe, expect, it } from 'vitest';
import { formatCurrency, formatNumber, formatPercent } from '../money';
import { computeLoadFactor, DEFAULTS, type LoadFactorInput } from '../loadFactor';

/** Narrowing helper so the success-shape fields are accessible in assertions. */
function ok(input: LoadFactorInput) {
  const result = computeLoadFactor(input);
  if (!result.ok) throw new Error(`expected ok result, got error ${result.error}`);
  return result;
}

describe('lf.default — Worked example (SPEC.md §T5)', () => {
  // USF 5,000 @ 15% LF → RSF 5,750, loss factor 13.04%; $30/RSF → effective $34.50/USF/yr.
  const result = ok(DEFAULTS);

  it('derives RSF = 5,750 from USF 5,000 @ 15% load factor', () => {
    expect(result.rsf).toBe(5750);
  });

  it('reports load factor 15.00%', () => {
    expect(formatPercent(result.loadFactor)).toBe('15.00%');
  });

  it('reports loss factor 13.04%', () => {
    expect(formatPercent(result.lossFactor)).toBe('13.04%');
  });

  it('prices effective rent at $34.50/USF/yr', () => {
    expect(result.effectivePerUSF).not.toBeNull();
    expect(formatCurrency(result.effectivePerUSF as number)).toBe('$34.50');
  });

  it('raises no warning at a 15% load factor', () => {
    expect(result.warning).toBeNull();
  });
});

describe('three-way solver', () => {
  it("solve='lf' derives the load factor from USF + RSF", () => {
    const result = ok({ solve: 'lf', usf: 5000, rsf: 5750, lf: 0, rent: 30 });
    expect(formatNumber(result.loadFactor * 100)).toBe('15.00');
    expect(result.rsf).toBe(5750);
  });

  it("solve='usf' derives usable SF from RSF + load factor", () => {
    const result = ok({ solve: 'usf', usf: 0, rsf: 5750, lf: 15, rent: 30 });
    expect(result.usf).toBeCloseTo(5000, 6);
  });

  it('all three modes agree on the same triangle', () => {
    const byRsf = ok({ ...DEFAULTS, solve: 'rsf' });
    const byUsf = ok({ ...DEFAULTS, solve: 'usf' });
    const byLf = ok({ ...DEFAULTS, solve: 'lf' });
    expect(formatPercent(byRsf.lossFactor)).toBe(formatPercent(byUsf.lossFactor));
    expect(formatPercent(byUsf.lossFactor)).toBe(formatPercent(byLf.lossFactor));
  });
});

describe('cost impact', () => {
  it('is hidden (null) when rent is 0', () => {
    const result = ok({ ...DEFAULTS, rent: 0 });
    expect(result.effectivePerUSF).toBeNull();
  });
});

describe('guard clauses', () => {
  it("errors RSF_LESS_THAN_USF when rentable < usable (solve='lf')", () => {
    const result = computeLoadFactor({ solve: 'lf', usf: 5000, rsf: 4000, lf: 0, rent: 30 });
    expect(result).toEqual({ ok: false, error: 'RSF_LESS_THAN_USF' });
  });

  it('returns INCOMPLETE rather than NaN when a required input is missing', () => {
    const result = computeLoadFactor({ solve: 'lf', usf: 0, rsf: 5750, lf: 15, rent: 30 });
    expect(result).toEqual({ ok: false, error: 'INCOMPLETE' });
  });

  it('warns (non-blocking) when the load factor exceeds 35%', () => {
    const result = ok({ solve: 'rsf', usf: 5000, rsf: 0, lf: 40, rent: 30 });
    expect(result.warning).toBe('LF_ABOVE_35');
    expect(result.rsf).toBe(7000);
  });
});
