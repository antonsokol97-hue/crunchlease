import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDollars, formatPercent } from '../money';
import { computeEscalation, DEFAULTS, type EscInput } from '../rentEscalation';

function ok(input: EscInput) {
  const result = computeEscalation(input);
  if (!result.ok) throw new Error(`expected ok result, got ${result.error}`);
  return result;
}

describe('esc.default — Worked example (SPEC.md §T6), pct type', () => {
  // $28 start, 3%/yr, 10 yrs, 4,000 SF → year-10 rate $36.53/SF, total $1,283,954.
  const result = ok(DEFAULTS);

  it('year-10 rate = $36.53/SF', () => {
    expect(formatCurrency(result.finalRate)).toBe('$36.53');
    expect(formatCurrency(result.schedule[9].rate)).toBe('$36.53');
  });

  it('total obligation = $1,283,954', () => {
    expect(formatDollars(result.totalObligation)).toBe('$1,283,954');
  });

  it('year-over-year increase is a steady 3.00%', () => {
    expect(formatPercent(result.schedule[1].deltaPct)).toBe('3.00%');
    expect(result.schedule[0].deltaPct).toBe(0);
  });

  it('has a 10-row schedule and no cap savings', () => {
    expect(result.schedule).toHaveLength(10);
    expect(result.capSavings).toBeCloseTo(0, 6);
  });
});

describe('clause types (§T6)', () => {
  it('step: rate(y) = start + step × k', () => {
    const result = ok({ ...DEFAULTS, type: 'step', start: 28, step: 0.5, term: 10 });
    expect(result.schedule[9].rate).toBeCloseTo(28 + 0.5 * 9, 6); // $32.50
  });

  it('cpi: clamps the assumed CPI to [floor, cap]', () => {
    // cpi 6 clamps to cap 4 → year-3 rate = 28 × 1.04^2.
    const result = ok({ ...DEFAULTS, type: 'cpi', cpi: 6, floor: 2, cap: 4, term: 3 });
    expect(result.schedule[2].rate).toBeCloseTo(28 * 1.04 ** 2, 6);
  });

  it('cpi: floors the assumed CPI to the floor', () => {
    // cpi 1 floors to 2 → year-2 rate = 28 × 1.02.
    const result = ok({ ...DEFAULTS, type: 'cpi', cpi: 1, floor: 2, cap: 4, term: 2 });
    expect(result.schedule[1].rate).toBeCloseTo(28 * 1.02, 6);
  });

  it('custom: uses the per-year schedule verbatim', () => {
    const result = ok({ ...DEFAULTS, type: 'custom', term: 4, sched: [28, 30, 31, 33] });
    expect(result.schedule.map((r) => r.rate)).toEqual([28, 30, 31, 33]);
  });

  it('every-N-years frequency holds the rate flat between steps', () => {
    // freq 2: k = 0,0,1,1,2… so years 1–2 share the start rate.
    const result = ok({ ...DEFAULTS, type: 'pct', pct: 3, freq: 2, term: 5 });
    expect(result.schedule[0].rate).toBeCloseTo(28, 6);
    expect(result.schedule[1].rate).toBeCloseTo(28, 6);
    expect(result.schedule[2].rate).toBeCloseTo(28 * 1.03, 6);
  });
});

// The relocated v1.1 differentiator: cumulative vs non-cumulative rent cap.
// This is where it's finally real — a custom (variable) schedule that dips
// below the ceiling one year and jumps the next makes the two bases diverge.
describe('rent cap — cumulative vs non-cumulative diverge on a variable schedule (§T6 v1.1)', () => {
  // capMax 5%. Uncapped custom: [28, 28.2, 40, 45].
  const base = { ...DEFAULTS, type: 'custom' as const, term: 4, sf: 1000, capMax: 5, sched: [28, 28.2, 40, 45] };
  const nonCum = ok({ ...base, capMode: 'non-cumulative' });
  const cum = ok({ ...base, capMode: 'cumulative' });

  it('non-cumulative ceilings off the prior CAPPED rate', () => {
    // 28 · 28.2 · min(40,28.2×1.05=29.61)=29.61 · min(45,29.61×1.05=31.0905)
    expect(nonCum.schedule[2].rate).toBeCloseTo(29.61, 6);
    expect(nonCum.schedule[3].rate).toBeCloseTo(31.0905, 6);
  });

  it('cumulative ceilings off YEAR 1 on a fixed path', () => {
    // 28 · 28.2 · min(40,28×1.05^2=30.87)=30.87 · min(45,28×1.05^3=32.4135)
    expect(cum.schedule[2].rate).toBeCloseTo(30.87, 6);
    expect(cum.schedule[3].rate).toBeCloseTo(32.4135, 6);
  });

  it('the two bases produce different year-N rates', () => {
    expect(nonCum.schedule[2].rate).not.toBeCloseTo(cum.schedule[2].rate, 4);
    expect(cum.schedule[3].rate).toBeGreaterThan(nonCum.schedule[3].rate);
    expect(cum.capSavings).toBeLessThan(nonCum.capSavings); // cum allows more → saves less
  });

  it('coincide under a deterministic pct schedule (monotonic — nothing to bank)', () => {
    const pctNon = ok({ ...DEFAULTS, type: 'pct', pct: 10, term: 5, capMode: 'non-cumulative', capMax: 5 });
    const pctCum = ok({ ...DEFAULTS, type: 'pct', pct: 10, term: 5, capMode: 'cumulative', capMax: 5 });
    expect(pctNon.schedule[4].rate).toBeCloseTo(pctCum.schedule[4].rate, 6);
  });
});

describe('guards (§T6)', () => {
  it('errors CAP_BELOW_FLOOR when the CPI cap is below the floor', () => {
    expect(computeEscalation({ ...DEFAULTS, type: 'cpi', cap: 1, floor: 3 })).toEqual({
      ok: false,
      error: 'CAP_BELOW_FLOOR',
    });
  });

  it('returns INCOMPLETE when a custom row is blank', () => {
    expect(computeEscalation({ ...DEFAULTS, type: 'custom', term: 3, sched: [28, 29] })).toEqual({
      ok: false,
      error: 'INCOMPLETE',
    });
  });
});
