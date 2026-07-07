import { useState } from 'react';
import { DOMAIN, SITE_NAME } from '../config';

export type EmbedModalProps = {
  open: boolean;
  onClose: () => void;
  /** Tool slug without slashes, e.g. "load-factor-calculator". */
  slug: string;
  title: string;
  /** Reserved iframe height in px. */
  height?: number;
};

/**
 * Copy-ready iframe snippet for embedding a calculator (SPEC.md §3). The
 * snippet points at the tool's `?embed=1` route, which ToolLayout renders
 * chrome-less with a dofollow credit line back to {SITE_NAME}.
 */
export default function EmbedModal({ open, onClose, slug, title, height = 560 }: EmbedModalProps) {
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  // TODO(SPEC.md §3): height is "per tool" — 560px is a placeholder for T5;
  // confirm against the rendered embed once design tokens land.
  // The spec's `?embed=1` can't drive a static build, so the snippet targets
  // the prerendered /…/embed/ route instead (see the tool's embed.astro).
  const src = `${DOMAIN}/${slug}/embed/`;
  const snippet = `<iframe src="${src}" width="100%" height="${height}" style="border:0" loading="lazy" title="${title} — ${SITE_NAME}"></iframe>`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Embed this calculator"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg p-6"
        style={{ backgroundColor: 'var(--color-bg)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Embed this calculator</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-sm">
            ✕
          </button>
        </div>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Paste this snippet into your site. It links back to {SITE_NAME}.
        </p>
        <textarea
          readOnly
          value={snippet}
          rows={4}
          className="mt-3 w-full rounded-md border p-2 font-mono text-xs"
          style={{ borderColor: 'var(--color-border)' }}
          onFocus={(event) => event.currentTarget.select()}
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {copied ? 'Copied!' : 'Copy snippet'}
          </button>
        </div>
      </div>
    </div>
  );
}
