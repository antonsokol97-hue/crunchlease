import { ADS_ENABLED } from '../config';

export type AdPlacement = 'below-results' | 'mid-content' | 'sidebar';

const RESERVED_HEIGHT: Record<AdPlacement, number> = {
  'below-results': 100,
  'mid-content': 250,
  sidebar: 600,
};

export type AdSlotProps = {
  id: string;
  placement: AdPlacement;
  className?: string;
};

/**
 * Reserved-height ad container (SPEC.md §6). Always occupies the same box so
 * enabling a network later causes zero layout shift. When ADS_ENABLED is
 * false, the box stays visible in dev (so the reserved space is easy to
 * spot) and is hidden via `visibility` (not `display`, which would collapse
 * the reserved height) in production.
 */
export default function AdSlot({ id, placement, className = '' }: AdSlotProps) {
  const minHeight = RESERVED_HEIGHT[placement];
  const showPlaceholder = ADS_ENABLED || import.meta.env.DEV;

  return (
    <div
      id={id}
      data-adslot={placement}
      aria-hidden={!ADS_ENABLED}
      className={`flex items-center justify-center rounded-md border border-dashed ${className}`}
      style={{
        minHeight,
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        visibility: showPlaceholder ? 'visible' : 'hidden',
      }}
    >
      {!ADS_ENABLED && (
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Advertisement
        </span>
      )}
    </div>
  );
}
