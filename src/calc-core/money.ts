/**
 * Rounding and formatting helpers shared by every calc-core module.
 *
 * SPEC.md §6: compute in full floating-point precision, round only at
 * display. Currency rounds half-up to 2 decimals.
 */

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const dollarsFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
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

/** Format a whole-dollar total as `$98,100` (0 decimals, §6 result convention). */
export function formatDollars(value: number): string {
  return dollarsFormatter.format(Math.round(value));
}

/** Format an integer count (e.g. square feet) with thousands separators: `5,750`. */
export function formatSf(value: number): string {
  return integerFormatter.format(Math.round(value));
}

/** Format a fraction (e.g. 0.15) as a percentage string (e.g. "15.00%"). */
export function formatPercent(value: number, decimals = 2): string {
  return `${roundTo(value * 100, decimals).toFixed(decimals)}%`;
}

/**
 * Format a $/SF/yr value showing both the annual and monthly basis, e.g.
 * "$32.70 /SF/yr · $2.73 /SF/mo" (SPEC.md §6 — results always show both).
 * `unitLabel` is the area basis: SF, USF, RSF, etc.
 */
export function formatPerSf(perYr: number, unitLabel = 'SF'): string {
  return `${formatCurrency(perYr)} /${unitLabel}/yr · ${formatCurrency(perYr / 12)} /${unitLabel}/mo`;
}

/** Format a plain number (ratios, $/SF, etc.) to a fixed number of decimals. */
export function formatNumber(value: number, decimals = 2): string {
  return roundTo(value, decimals).toFixed(decimals);
}
