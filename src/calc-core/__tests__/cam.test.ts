import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDollars, formatPercent } from '../money';
import {
  applyCap,
  computeEstimate,
  computeReconcile,
  ESTIMATE_DEFAULTS,
  RECONCILE_DEFAULTS,
} from '../cam';

function estimateOk(input: Parameters<typeof computeEstimate>[0]) {
  const result = computeEstimate(input);
  if (!result.ok) throw new Error(`expected ok estimate, got ${result.error}`);
  return result;
}

function reconcileOk(input: Parameters<typeof computeReconcile>[0]) {
  const result = computeReconcile(input);
  if (!result.ok) throw new Error(`expected ok reconcile, got ${result.error}`);
  return result;
}

describe('cam.default — estimate mode (SPEC.md §T2)', () => {
  const result = estimateOk(ESTIMATE_DEFAULTS);

  it('pro-rata share = 10.00%', () => {
    expect(formatPercent(result.proRata)).toBe('10.00%');
  });

  it('billed CAM = $13,750/yr', () => {
    expect(formatDollars(result.annual)).toBe('$13,750');
  });

  it('= $5.50/SF/yr', () => {
    expect(formatCurrency(result.perSf)).toBe('$5.50');
  });

  it('= $1,145.83/mo', () => {
    expect(formatCurrency(result.monthly)).toBe('$1,145.83');
  });

  it('with growth 4% < annual cap 5%, the cap never binds (no savings)', () => {
    const capped = estimateOk({ ...ESTIMATE_DEFAULTS, cap: 'annual' });
    expect(capped.capSavings).toBeCloseTo(0, 6);
  });
});

describe('cam.default — reconcile mode (SPEC.md §T2)', () => {
  const result = reconcileOk(RECONCILE_DEFAULTS);

  it('tenant share of actuals = $15,180 (138,000 × 1.10 × 0.10)', () => {
    expect(formatDollars(result.share)).toBe('$15,180');
  });

  it('total paid = $13,200 (1,100 × 12)', () => {
    expect(formatDollars(result.totalPaid)).toBe('$13,200');
  });

  it('balance due = +$1,980', () => {
    expect(result.balance).toBeCloseTo(1980, 6);
    expect(result.direction).toBe('due');
  });

  it('flips to a credit when payments exceed the share', () => {
    const result2 = reconcileOk({ ...RECONCILE_DEFAULTS, paid: 1400 });
    expect(result2.balance).toBeLessThan(0);
    expect(result2.direction).toBe('credit');
  });
});

// The two cap bases are the easy thing to get subtly wrong. §T2's UI uses only
// the single annual (non-cumulative) cap, but applyCap implements both bases
// for §T6 reuse (v1.1). Test applyCap directly on a crafted series where year
// 2's uncapped dips below the ceiling and later years exceed it, so the
// compounding base is unambiguous and the two curves visibly diverge.
describe('applyCap helper — non-cumulative vs cumulative (for §T6 reuse)', () => {
  // capPct 5%. Year-1 = 1000.
  const uncapped = [1000, 1010, 1200, 1300, 1400];

  const nonCumulative = applyCap(uncapped, 'non-cumulative', 5);
  const cumulative = applyCap(uncapped, 'cumulative', 5);

  it('non-cumulative grows off the PRIOR YEAR\'S CAPPED value', () => {
    // 1000 · min(1010,1050)=1010 · min(1200,1010×1.05=1060.5)=1060.5
    //      · 1060.5×1.05=1113.525 · 1113.525×1.05=1169.20125
    expect(nonCumulative[0]).toBeCloseTo(1000, 6);
    expect(nonCumulative[1]).toBeCloseTo(1010, 6);
    expect(nonCumulative[2]).toBeCloseTo(1060.5, 6);
    expect(nonCumulative[3]).toBeCloseTo(1113.525, 6);
    expect(nonCumulative[4]).toBeCloseTo(1169.20125, 6);
  });

  it('cumulative grows off YEAR 1 on a fixed 1.05^(y-1) path', () => {
    // 1000 · min(1010,1050)=1010 · min(1200,1000×1.05^2=1102.5)=1102.5
    //      · 1000×1.05^3=1157.625 · 1000×1.05^4=1215.50625
    expect(cumulative[0]).toBeCloseTo(1000, 6);
    expect(cumulative[1]).toBeCloseTo(1010, 6);
    expect(cumulative[2]).toBeCloseTo(1102.5, 6);
    expect(cumulative[3]).toBeCloseTo(1157.625, 6);
    expect(cumulative[4]).toBeCloseTo(1215.50625, 6);
  });

  it('the two produce different year-N numbers once the series dips then rises', () => {
    expect(nonCumulative[2]).not.toBeCloseTo(cumulative[2], 4); // 1060.5 vs 1102.5
    expect(nonCumulative[4]).not.toBeCloseTo(cumulative[4], 4); // 1169.20 vs 1215.51
    expect(cumulative[4]).toBeGreaterThan(nonCumulative[4]);
  });
});

describe('estimate single annual cap (§T2 v1.1)', () => {
  // billed(1) = 13,750; growth 10% > cap 5%, so the cap binds every year from y2.
  const result = estimateOk({ ...ESTIMATE_DEFAULTS, growth: 10, cap: 'annual', capPct: 5 });

  it('ceilings each year to prior year × (1 + capPct)', () => {
    expect(result.schedule[0].allowed).toBeCloseTo(13750, 6);
    expect(result.schedule[1].allowed).toBeCloseTo(13750 * 1.05, 6); // 14,437.50
    expect(result.schedule[4].allowed).toBeCloseTo(13750 * 1.05 ** 4, 6); // 16,713.21…
  });

  it('reports positive cumulative savings vs the uncapped path', () => {
    expect(result.capSavings).toBeGreaterThan(0);
    expect(result.schedule[4].allowed).toBeLessThan(result.schedule[4].uncapped);
  });

  it("cap 'none' leaves the uncapped series untouched", () => {
    const none = estimateOk({ ...ESTIMATE_DEFAULTS, growth: 10, cap: 'none' });
    expect(none.capSavings).toBeCloseTo(0, 6);
    expect(none.schedule[4].allowed).toBeCloseTo(none.schedule[4].uncapped, 6);
  });
});

describe('guards (§T2)', () => {
  it('errors TENANT_EXCEEDS_GLA when tenant area exceeds building GLA', () => {
    expect(computeEstimate({ ...ESTIMATE_DEFAULTS, sf: 30000, gla: 25000 })).toEqual({
      ok: false,
      error: 'TENANT_EXCEEDS_GLA',
    });
    expect(computeReconcile({ ...RECONCILE_DEFAULTS, sf: 30000, gla: 25000 })).toEqual({
      ok: false,
      error: 'TENANT_EXCEEDS_GLA',
    });
  });

  it('returns INCOMPLETE rather than NaN when GLA is missing', () => {
    expect(computeEstimate({ ...ESTIMATE_DEFAULTS, gla: 0 })).toEqual({ ok: false, error: 'INCOMPLETE' });
  });
});
