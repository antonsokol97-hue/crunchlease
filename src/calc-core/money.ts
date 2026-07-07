/**
 * Rounding and formatting helpers shared by every calc-core module.
 *
 * SPEC.md §3.1: compute in full floating-point precision, round only at the
 * presentation/result boundary. Currency rounds half-up to 2 decimals.
 */

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

/** Round half-up to `decimals` places, correcting for binary floating-point drift. */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Round a dollar amount half-up to the cent. */
export function roundMoney(value: number): number {
  return roundTo(value, 2);
}

/** Format a dollar amount as `$1,234.56` (rounds via roundMoney first). */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(roundMoney(value));
}

/** Format a fraction (e.g. 0.15) as a percentage string (e.g. "15.00%"). */
export function formatPercent(value: number, decimals = 2): string {
  return `${roundTo(value * 100, decimals).toFixed(decimals)}%`;
}

/** Format a plain number (ratios, $/SF, etc.) to a fixed number of decimals. */
export function formatNumber(value: number, decimals = 2): string {
  return roundTo(value, decimals).toFixed(decimals);
}
