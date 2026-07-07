import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDollars, formatPercent } from '../money';
import { computeNer, DEFAULTS, type NerInput } from '../netEffectiveRent';

function ok(input: NerInput) {
  const result = computeNer(input);
  if (!result.ok) throw new Error(`expected ok result, got ${result.error}`);
  return result;
}

describe('ner.default — Worked example (SPEC.md §T4)', () => {
  const result = ok(DEFAULTS);

  it('scheduled 5-yr rent = $796,370', () => {
    expect(formatDollars(result.scheduledTotal)).toBe('$796,370');
  });

  it('free-rent value = $37,500', () => {
    expect(formatDollars(result.freeValue)).toBe('$37,500');
  });

  it('collected = $758,870', () => {
    expect(formatDollars(result.collected)).toBe('$758,870');
  });

  it('NER = $24.35/SF/yr', () => {
    expect(formatCurrency(result.nerStraight)).toBe('$24.35');
  });

  it('discount to face ≈ 18.8% (spec 1-dp; §6 2-dp shows 18.82%)', () => {
    expect(result.discountToFace).toBeCloseTo(0.1882, 4);
    expect(formatPercent(result.discountToFace)).toBe('18.82%');
  });

  it('is not flagged negative and has a 60-month timeline', () => {
    expect(result.negative).toBe(false);
    expect(result.timeline).toHaveLength(60);
    // First 3 months are free (paid 0), month 4 pays the year-1 rate.
    expect(result.timeline[0].paid).toBe(0);
    expect(result.timeline[3].paid).toBeCloseTo((30 / 12) * 5000, 6);
  });
});

describe('NPV mode (§T4)', () => {
  it('disc = 0 makes NPV-NER equal the straight-line NER', () => {
    const result = ok({ ...DEFAULTS, npv: true, disc: 0 });
    expect(result.nerNpv).not.toBeNull();
    expect(result.nerNpv as number).toBeCloseTo(result.nerStraight, 9);
  });

  it('disc > 0 produces a finite, positive NPV-NER that differs from straight-line', () => {
    const result = ok({ ...DEFAULTS, npv: true, disc: 8 });
    expect(result.nerNpv).not.toBeNull();
    const npvNer = result.nerNpv as number;
    expect(Number.isFinite(npvNer)).toBe(true);
    expect(npvNer).toBeGreaterThan(0);
    expect(npvNer).not.toBeCloseTo(result.nerStraight, 2);
    expect(result.npvValue).not.toBeNull();
  });

  it('discount to face tracks the active (NPV) NER when npv is on', () => {
    const result = ok({ ...DEFAULTS, npv: true, disc: 8 });
    const expected = (DEFAULTS.face - (result.nerNpv as number)) / DEFAULTS.face;
    expect(result.discountToFace).toBeCloseTo(expected, 9);
  });
});

describe('negative NER (§T4)', () => {
  it('flags negative when concessions exceed collected rent', () => {
    // tia $200/SF × 5,000 = $1,000,000 concession > ~$758,870 collected.
    const result = ok({ ...DEFAULTS, tia: 200 });
    expect(result.nerStraight).toBeLessThan(0);
    expect(result.negative).toBe(true);
  });
});

describe('guards (§T4)', () => {
  it('errors FREE_EXCEEDS_TERM when free rent covers the whole term', () => {
    expect(computeNer({ ...DEFAULTS, free: 60, term: 60 })).toEqual({ ok: false, error: 'FREE_EXCEEDS_TERM' });
  });

  it('returns INCOMPLETE rather than NaN when area is missing', () => {
    expect(computeNer({ ...DEFAULTS, sf: 0 })).toEqual({ ok: false, error: 'INCOMPLETE' });
  });
});
