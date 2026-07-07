/**
 * GA4 loader + event tracking (SPEC.md §10). Injects gtag only after consent
 * and only when a measurement ID is configured, so declining — or leaving
 * GA_MEASUREMENT_ID empty — ships zero analytics. `track` is a safe no-op
 * until gtag is live.
 */
type Gtag = (...args: unknown[]) => void;
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag };

let loaded = false;

export function loadGtag(id: string): void {
  if (loaded || !id || typeof window === 'undefined') return;
  loaded = true;

  const w = window as unknown as AnalyticsWindow;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  w.dataLayer = w.dataLayer || [];
  const gtag: Gtag = (...args) => {
    w.dataLayer!.push(args);
  };
  w.gtag = gtag;
  gtag('js', new Date());
  gtag('config', id);
}

/** Fire a GA4 event. No-op until consent has loaded gtag (SPEC.md §10). */
export function track(event: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  const { gtag } = window as unknown as AnalyticsWindow;
  if (typeof gtag === 'function') gtag('event', event, params);
}

const firedOnce = new Set<string>();

/** Fire an event at most once per page session (for high-frequency signals). */
export function trackOnce(key: string, event: string, params: Record<string, unknown> = {}): void {
  if (firedOnce.has(key)) return;
  firedOnce.add(key);
  track(event, params);
}
