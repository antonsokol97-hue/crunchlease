/**
 * GA4 loader (SPEC.md §10). Injects gtag only after consent and only when a
 * measurement ID is configured, so declining — or leaving GA_MEASUREMENT_ID
 * empty — ships zero analytics.
 */
let loaded = false;

export function loadGtag(id: string): void {
  if (loaded || !id || typeof window === 'undefined') return;
  loaded = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  const w = window as unknown as { dataLayer: unknown[] };
  w.dataLayer = w.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  function gtag(...args: unknown[]) {
    w.dataLayer.push(args);
  }
  gtag('js', new Date());
  gtag('config', id);
}
