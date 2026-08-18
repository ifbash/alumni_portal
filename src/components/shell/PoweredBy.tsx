import type { BrandPack } from '@/lib/branding/pack';

/**
 * Vendor credit.
 *
 * Configurable rather than hardcoded, because a reseller shipping this to
 * ten colleges under their own name needs to replace it — and because a
 * college paying institution-tier fees will eventually ask for it to come
 * off entirely. Both are one field in the brand pack.
 */
export function PoweredBy({ pack, className }: { pack: BrandPack; className?: string }) {
  if (!pack.copy.poweredBy) return null;

  return (
    <p className={className ?? 'text-xs text-muted'}>
      Powered by{' '}
      {pack.copy.poweredByUrl ? (
        <a
          href={pack.copy.poweredByUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium text-secondary underline-offset-2 hover:underline"
        >
          {pack.copy.poweredBy}
        </a>
      ) : (
        <span className="font-medium text-secondary">{pack.copy.poweredBy}</span>
      )}
    </p>
  );
}
