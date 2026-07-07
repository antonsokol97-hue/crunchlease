import { useState } from 'react';
import { track } from '../lib/analytics';

export type ShareBarProps = {
  /** Tool slug, for analytics events (SPEC.md §10). */
  tool: string;
  onCopyLink: () => void | Promise<void>;
  onEmbed?: () => void;
  onReset?: () => void;
  className?: string;
};

/**
 * Results action row: copy link, PDF export, embed snippet, reset (SPEC.md
 * §4 item 4; embed snippet §3). Copy-link and PDF need no tool-specific logic
 * and are fully wired here; embed (opens the snippet modal, built with the
 * first tool, T5 Load Factor) and reset are supplied by each tool's island
 * via props.
 */
export default function ShareBar({ tool, onCopyLink, onEmbed, onReset, className = '' }: ShareBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await onCopyLink();
    track('share_link_copied', { tool });
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    track('pdf_export', { tool });
    window.print();
  };

  const buttonStyle = { borderColor: 'var(--color-border)' };
  const buttonClassName = 'rounded-md border px-3 py-1.5 text-sm';

  return (
    <div
      role="toolbar"
      aria-label="Calculator actions"
      data-print-hide
      className={`flex flex-wrap gap-2 ${className}`}
    >
      <button type="button" onClick={handleCopy} className={buttonClassName} style={buttonStyle}>
        {copied ? 'Copied!' : 'Copy link'}
      </button>
      <button type="button" onClick={handlePrint} className={buttonClassName} style={buttonStyle}>
        Download PDF
      </button>
      {onEmbed && (
        <button type="button" onClick={onEmbed} className={buttonClassName} style={buttonStyle}>
          Embed
        </button>
      )}
      {onReset && (
        <button type="button" onClick={onReset} className={buttonClassName} style={buttonStyle}>
          Reset
        </button>
      )}
    </div>
  );
}
