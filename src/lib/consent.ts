/** Analytics consent state, persisted in localStorage (SPEC.md §10). */
export type Consent = 'granted' | 'denied';

const KEY = 'analyticsConsent';

export function getConsent(): Consent | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(KEY);
  return value === 'granted' || value === 'denied' ? value : null;
}

export function setConsent(consent: Consent): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, consent);
}
