import { useEffect, useState } from 'react';
import { GA_MEASUREMENT_ID } from '../config';
import { getConsent, setConsent } from '../lib/consent';
import { loadGtag } from '../lib/analytics';

/**
 * Minimal analytics consent banner (SPEC.md §10). Shows only until the visitor
 * decides; declining ships no GA. Loads gtag on grant (and on later visits if
 * already granted). Renders nothing server-side to avoid a hydration flash.
 */
export default function ConsentBanner() {
  const [decided, setDecided] = useState(true);

  useEffect(() => {
    const consent = getConsent();
    setDecided(consent !== null);
    if (consent === 'granted') loadGtag(GA_MEASUREMENT_ID);
  }, []);

  if (decided) return null;

  const accept = () => {
    setConsent('granted');
    loadGtag(GA_MEASUREMENT_ID);
    setDecided(true);
  };
  const decline = () => {
    setConsent('denied');
    setDecided(true);
  };

  return (
    <div
      role="dialog"
      aria-label="Analytics consent"
      data-print-hide
      className="fixed inset-x-0 bottom-0 z-40 border-t p-4"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          We use cookies for anonymous analytics to improve these tools. Declining keeps them off.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={decline}
            className="rounded-md border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--color-border)' }}
          >
            Decline
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded-md px-3 py-1.5 text-sm"
            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-contrast)' }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
