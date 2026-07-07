import { describe, expect, it } from 'vitest';
import { formatDollars, formatPercent } from '../money';
import {
  buildSensitivity,
  computeCapRate,
  computeNoiBuilder,
  DEFAULTS,
  SENS_CAPS,
  SENS_FACTORS,
  type CapInput,
} from '../capRate';

function ok(input: CapInput) {
  const result = computeCapRate(input);
  if (!result.ok) throw new Error(`expected ok result, got ${result.error}`);
  return result;
}

describe('cap.default — three-way solver (SPEC.md §T7)', () => {
  it("solve='cap': 150,000 / 2,000,000 = 7.50%", () => {
    const result = ok({ ...DEFAULTS, solve: 'cap' });
    expect(formatPercent(result.cap / 100)).toBe('7.50%');
    expect(result.capUnusual).toBe(false);
    expect(result.negativeNoi).toBe(false);
  });

  it("solve='value': NOI 150,000 at 7.5% → $2,000,000", () => {
    const result = ok({ ...DEFAULTS, solve: 'value' });
    expect(formatDollars(result.value)).toBe('$2,000,000');
  });

  it("solve='noi': value 2,000,000 at 7.5% → $150,000", () => {
    const result = ok({ ...DEFAULTS, solve: 'noi' });
    expect(formatDollars(result.noi)).toBe('$150,000');
  });
});

describe('NOI builder (SPEC.md §T7)', () => {
  const builder = computeNoiBuilder(DEFAULTS);

  it('EGI = $195,000 (200,000 × 0.95 + 5,000)', () => {
    expect(formatDollars(builder.egi)).toBe('$195,000');
  });

  it('management fee = $7,800 (195,000 × 4%)', () => {
    expect(formatDollars(builder.mgmtDollars)).toBe('$7,800');
  });

  it('NOI = $139,200', () => {
    expect(formatDollars(builder.noi)).toBe('$139,200');
  });

  it('feeds the solver when useBuilder is on', () => {
    // Builder NOI 139,200 at value 2,000,000 → cap 6.96%.
    const result = ok({ ...DEFAULTS, solve: 'cap', useBuilder: true });
    expect(result.noi).toBeCloseTo(139200, 6);
    expect(formatPercent(result.cap / 100)).toBe('6.96%');
  });
});

describe('warnings and guards (SPEC.md §T7)', () => {
  it('flags cap rates outside 2–15% as unusual', () => {
    expect(ok({ ...DEFAULTS, solve: 'value', cap: 1 }).capUnusual).toBe(true);
    expect(ok({ ...DEFAULTS, solve: 'value', cap: 16 }).capUnusual).toBe(true);
    expect(ok({ ...DEFAULTS, solve: 'value', cap: 7.5 }).capUnusual).toBe(false);
  });

  it('flags negative NOI (results still shown)', () => {
    const result = ok({ ...DEFAULTS, solve: 'cap', noi: -50000 });
    expect(result.negativeNoi).toBe(true);
    expect(result.cap).toBeLessThan(0);
  });

  it('errors VALUE_NONPOSITIVE when value ≤ 0 and value is an input', () => {
    expect(computeCapRate({ ...DEFAULTS, solve: 'cap', value: 0 })).toEqual({
      ok: false,
      error: 'VALUE_NONPOSITIVE',
    });
  });

  it('errors INCOMPLETE rather than dividing by zero when cap is 0 in value mode', () => {
    expect(computeCapRate({ ...DEFAULTS, solve: 'value', cap: 0 })).toEqual({ ok: false, error: 'INCOMPLETE' });
  });
});

describe('sensitivity matrix (SPEC.md §T7 differentiator)', () => {
  const matrix = buildSensitivity(150000);

  it('has 10 cap rows (4.5–9.0) and 5 NOI columns', () => {
    expect(matrix.caps).toEqual(SENS_CAPS);
    expect(matrix.noiFactors).toEqual(SENS_FACTORS);
    expect(matrix.caps).toHaveLength(10);
    expect(matrix.cells).toHaveLength(10);
    expect(matrix.cells[0]).toHaveLength(5);
  });

  it('base cell (cap 7.5, base NOI) = $2,000,000', () => {
    const capIdx = SENS_CAPS.indexOf(7.5); // 6
    const noiIdx = SENS_FACTORS.indexOf(0); // 2
    expect(matrix.cells[capIdx][noiIdx]).toBeCloseTo(2000000, 4);
  });

  it('lower cap → higher value; +10% NOI raises the implied value', () => {
    expect(matrix.cells[SENS_CAPS.indexOf(5.0)][2]).toBeCloseTo(3000000, 4); // 150,000 / 0.05
    expect(matrix.cells[SENS_CAPS.indexOf(7.5)][SENS_FACTORS.indexOf(0.1)]).toBeCloseTo(2200000, 4); // 165,000 / 0.075
  });
});
