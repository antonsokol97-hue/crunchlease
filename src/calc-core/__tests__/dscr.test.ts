import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDollars, formatNumber } from '../money';
import { computeDscr, DEFAULTS, type DscrInput } from '../dscr';

function ok(input: DscrInput) {
  const result = computeDscr(input);
  if (!result.ok) throw new Error(`expected ok result, got ${result.error}`);
  return result;
}

const dscrX = (n: number) => `${formatNumber(n, 2)}x`;

describe('dscr.default — build mode (SPEC.md §T8)', () => {
  // Loan $1.5M @ 6.75%, 25-yr am → PMT $10,363.67/mo, annual DS $124,364, DSCR 1.45x.
  const result = ok(DEFAULTS);

  it('monthly payment = $10,363.67', () => {
    expect(formatCurrency(result.monthlyDebtService)).toBe('$10,363.67');
  });

  it('annual debt service = $124,364', () => {
    expect(formatDollars(result.annualDebtService)).toBe('$124,364');
  });

  it('DSCR = 1.45x (strong band)', () => {
    expect(result.dscr).not.toBeNull();
    expect(dscrX(result.dscr as number)).toBe('1.45x');
    expect(result.band).toBe('strong');
  });

  it('max loan at 1.25x target = $1,736,836', () => {
    expect(formatDollars(result.maxLoan)).toBe('$1,736,836');
  });

  it('delta = max loan − entered loan', () => {
    expect(result.delta).toBeCloseTo(result.maxLoan - DEFAULTS.loan, 4);
  });
});

describe('direct debt mode (SPEC.md §T8)', () => {
  it('uses the entered annual debt service directly', () => {
    const result = ok({ ...DEFAULTS, dmode: 'direct', ds: 124364 });
    expect(dscrX(result.dscr as number)).toBe('1.45x');
    expect(formatCurrency(result.monthlyDebtService)).toBe(formatCurrency(124364 / 12));
  });
});

describe('interest-only branch (SPEC.md §T8)', () => {
  const result = ok({ ...DEFAULTS, io: true });

  it('annual DS = loan × rate (no amortization)', () => {
    expect(result.annualDebtService).toBeCloseTo(1500000 * 0.0675, 6); // $101,250
    expect(dscrX(result.dscr as number)).toBe('1.78x'); // 180,000 / 101,250
  });

  it('max loan (IO) = maxDS / (rate/100)', () => {
    // maxDS = 180,000 / 1.25 = 144,000 → 144,000 / 0.0675 = $2,133,333.
    expect(formatDollars(result.maxLoan)).toBe('$2,133,333');
  });
});

describe('max-loan solver — rate = 0 straight-line (§T8)', () => {
  it('amortizing maxLoan with r=0 is maxDS/12 × n', () => {
    const result = ok({ ...DEFAULTS, rate: 0 });
    // maxDS = 144,000; maxLoan = 144,000/12 × 300 = $3,600,000.
    expect(formatDollars(result.maxLoan)).toBe('$3,600,000');
  });
});

describe('guards & bands (§T8)', () => {
  it('errors IO_ZERO_RATE when interest-only at 0%', () => {
    expect(computeDscr({ ...DEFAULTS, io: true, rate: 0 })).toEqual({ ok: false, error: 'IO_ZERO_RATE' });
  });

  it('returns INCOMPLETE when annual debt service would be 0', () => {
    expect(computeDscr({ ...DEFAULTS, dmode: 'direct', ds: 0 })).toEqual({ ok: false, error: 'INCOMPLETE' });
  });

  it('reports DSCR N/A (null) when NOI is 0', () => {
    const result = ok({ ...DEFAULTS, noi: 0 });
    expect(result.dscr).toBeNull();
    expect(result.band).toBeNull();
  });

  it('maps DSCR to the right gauge band', () => {
    expect(ok({ ...DEFAULTS, dmode: 'direct', ds: 200000 }).band).toBe('fail'); // 0.90x
    expect(ok({ ...DEFAULTS, dmode: 'direct', ds: 160000 }).band).toBe('thin'); // 1.125x
    expect(ok({ ...DEFAULTS, dmode: 'direct', ds: 147000 }).band).toBe('near-min'); // 1.224x
    expect(ok({ ...DEFAULTS, dmode: 'direct', ds: 140000 }).band).toBe('bankable'); // 1.286x
    expect(ok({ ...DEFAULTS, dmode: 'direct', ds: 120000 }).band).toBe('strong'); // 1.50x
  });
});
