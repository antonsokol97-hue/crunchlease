import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDollars, formatNumber, formatPercent, formatSf, roundMoney, roundTo } from '../money';

describe('roundTo', () => {
  it('rounds half-up to the given number of decimals', () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(28.375, 2)).toBe(28.38);
  });
});

describe('roundMoney', () => {
  it('rounds to the cent', () => {
    expect(roundMoney(10733.333333)).toBe(10733.33);
    expect(roundMoney(7.475)).toBe(7.48);
  });

  it('leaves already-rounded values unchanged', () => {
    expect(roundMoney(128800)).toBe(128800);
  });
});

describe('formatCurrency', () => {
  it('formats as USD with thousands separators and 2 decimals', () => {
    expect(formatCurrency(128800)).toBe('$128,800.00');
    expect(formatCurrency(10733.333333)).toBe('$10,733.33');
  });
});

describe('formatDollars', () => {
  it('formats a whole-dollar total with 0 decimals', () => {
    expect(formatDollars(98100)).toBe('$98,100');
    expect(formatDollars(17500.4)).toBe('$17,500');
  });
});

describe('formatSf', () => {
  it('formats an integer with thousands separators and no currency', () => {
    expect(formatSf(5750)).toBe('5,750');
  });
});

describe('formatPercent', () => {
  it('formats a fraction as a percentage string to 2 decimals', () => {
    expect(formatPercent(0.15)).toBe('15.00%');
    expect(formatPercent(0.2836)).toBe('28.36%');
  });
});

describe('formatNumber', () => {
  it('formats a plain number to a fixed number of decimals', () => {
    expect(formatNumber(1.15)).toBe('1.15');
    expect(formatNumber(32.2)).toBe('32.20');
  });
});
