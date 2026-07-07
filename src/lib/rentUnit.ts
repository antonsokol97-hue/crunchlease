/**
 * Sitewide rent-basis unit ($/SF/yr ↔ $/SF/mo), persisted in localStorage and
 * shared across the independent calculator islands (SPEC.md §6). Canonical
 * storage everywhere is $/SF/yr; this only affects how rent is entered/shown.
 */
export type RentUnit = 'yr' | 'mo';

const STORAGE_KEY = 'rentUnit';
/** Custom event so islands in separate React roots stay in sync within a tab. */
export const RENT_UNIT_EVENT = 'cre-rent-unit-change';

export function getRentUnit(): RentUnit {
  if (typeof window === 'undefined') return 'yr';
  return window.localStorage.getItem(STORAGE_KEY) === 'mo' ? 'mo' : 'yr';
}

export function setRentUnit(unit: RentUnit): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, unit);
  window.dispatchEvent(new CustomEvent(RENT_UNIT_EVENT));
}

/** Convert a canonical $/SF/yr value into the active display unit. */
export function toDisplayUnit(perYr: number, unit: RentUnit): number {
  return unit === 'mo' ? perYr / 12 : perYr;
}

/** Convert a value entered in the active display unit back to canonical $/SF/yr. */
export function fromDisplayUnit(value: number, unit: RentUnit): number {
  return unit === 'mo' ? value * 12 : value;
}
