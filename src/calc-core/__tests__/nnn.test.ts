import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDollars, formatPercent } from '../money';
import { computeNnn, DEFAULTS, type NnnInput } from '../nnn';

function ok(input: NnnInput) {
  const result = computeNnn(input);
  if (!result.ok) throw new Error(`expected ok result, got error ${result.error}`);
  return result;
}

describe('nnn.default — Worked example (SPEC.md §T1), psf mode', () => {
  // Defaults → NNN $8.70/SF/yr, gross $32.70/SF/yr, $8,175/mo, $98,100/yr;
  // 5-yr obligation (base + NNN both escalating 3%) = $520,826.
  const result = ok(DEFAULTS);

  it('year-1 NNN charges = $8.70/SF/yr', () => {
    expect(formatCurrency(result.nnnPerSf)).toBe('$8.70');
  });

  it('year-1 gross rent = $32.70/SF/yr', () => {
    expect(formatCurrency(result.grossPerSf)).toBe('$32.70');
  });

  it('year-1 monthly total = $8,175', () => {
    expect(formatDollars(result.monthlyTotal)).toBe('$8,175');
  });

  it('year-1 annual total = $98,100', () => {
    expect(formatDollars(result.annualTotal)).toBe('$98,100');
  });

  it('5-year total obligation = $520,826', () => {
    expect(formatDollars(result.totalObligation)).toBe('$520,826');
  });

  it('has no pro-rata share in psf mode and no admin warning', () => {
    expect(result.proRata).toBeNull();
    expect(result.warning).toBeNull();
    expect(result.schedule).toHaveLength(5);
  });
});

describe('totals mode — pro-rata path (SPEC.md §T1)', () => {
  const result = ok({ ...DEFAULTS, mode: 'totals' });

  it('computes pro-rata share = 30.00%', () => {
    expect(result.proRata).not.toBeNull();
    expect(formatPercent(result.proRata as number)).toBe('30.00%');
  });

  it('reproduces the same $8.70 NNN / $32.70 gross as psf defaults', () => {
    expect(formatCurrency(result.nnnPerSf)).toBe('$8.70');
    expect(formatCurrency(result.grossPerSf)).toBe('$32.70');
  });

  it('reproduces the same $98,100/yr and $520,826 obligation', () => {
    expect(formatDollars(result.annualTotal)).toBe('$98,100');
    expect(formatDollars(result.totalObligation)).toBe('$520,826');
  });

  it('applies the CAM admin fee inside the totals pro-rata formula', () => {
    // (35,000 + 12,000 + 40,000×1.10 + 0) × 0.30 / 3,000 = 9.10/SF/yr
    const withAdmin = ok({ ...DEFAULTS, mode: 'totals', admin: 10 });
    expect(formatCurrency(withAdmin.nnnPerSf)).toBe('$9.10');
  });
});

describe('admin fee on CAM (§T1)', () => {
  it('psf: adds camAdmin correctly (3.50 + 1.20 + 4.00×1.15 = 9.30) with no warning at exactly 15%', () => {
    const result = ok({ ...DEFAULTS, admin: 15 });
    expect(formatCurrency(result.nnnPerSf)).toBe('$9.30');
    expect(result.warning).toBeNull();
  });

  it('warns (non-blocking) when admin exceeds 15%', () => {
    const result = ok({ ...DEFAULTS, admin: 20 });
    expect(result.warning).toBe('ADMIN_HIGH');
    expect(formatCurrency(result.nnnPerSf)).toBe('$9.50'); // 3.50 + 1.20 + 4.00×1.20
  });
});

describe('independent base vs NNN escalation (§T1)', () => {
  it('escalates base and NNN by their own rates', () => {
    const result = ok({ ...DEFAULTS, esc: 3, nnng: 5 });
    const y2 = result.schedule[1];
    expect(y2.basePerSf).toBeCloseTo(24 * 1.03, 6); // 24.72
    expect(y2.nnnPerSf).toBeCloseTo(8.7 * 1.05, 6); // 9.135
  });
});

describe('guard clauses (§T1)', () => {
  it('errors LEASED_EXCEEDS_BUILDING when sf > bldg in totals mode', () => {
    const result = computeNnn({ ...DEFAULTS, mode: 'totals', sf: 12000, bldg: 10000 });
    expect(result).toEqual({ ok: false, error: 'LEASED_EXCEEDS_BUILDING' });
  });

  it('does not apply the building check in psf mode (bldg unused)', () => {
    const result = computeNnn({ ...DEFAULTS, mode: 'psf', sf: 12000, bldg: 10000 });
    expect(result.ok).toBe(true);
  });

  it('returns INCOMPLETE rather than NaN when leased area is missing', () => {
    const result = computeNnn({ ...DEFAULTS, sf: 0 });
    expect(result).toEqual({ ok: false, error: 'INCOMPLETE' });
  });
});
