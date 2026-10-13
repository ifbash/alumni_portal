import type { BrandPack } from '@/lib/branding/pack';

/**
 * Vendor credit.
 *
 * Configurable rather than hardcoded, because a reseller shipping this to
 * ten colleges under their own name needs to replace it — and because a
 * college paying institution-tier fees will eventually ask for it to come
 * off entirely. Both are one field in the brand pack.
 *
 * `tone="band"` is for the college band (the public footer), where only
 * band-* text tokens are legible. An explicit `className` still replaces
 * the paragraph class in either tone.
 */
const TONE = {
  default: { p: 'text-xs text-secondary', name: 'font-medium text-primary' },
  band: { p: 'text-xs text-band-muted', name: 'font-medium text-band-fg' },
} as const;

export function PoweredBy({
  pack,
  className,
  tone = 'default',
}: {
  pack: BrandPack;
  className?: string;
  tone?: 'default' | 'band';
}) {
  if (!pack.copy.poweredBy) return null;
  const t = TONE[tone];

  return (
    <p className={className ?? t.p}>
      Powered by{' '}
      {pack.copy.poweredByUrl ? (
        <a
          href={pack.copy.poweredByUrl}
          target="_blank"
          rel="noreferrer noopener"
          className={`${t.name} underline-offset-2 hover:underline`}
        >
          {pack.copy.poweredBy}
        </a>
      ) : (
        <span className={t.name}>{pack.copy.poweredBy}</span>
      )}
    </p>
  );
}
