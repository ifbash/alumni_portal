import { Logo } from '@/components/brand/Logo';
import type { BrandPack } from '@/lib/branding/pack';
import { displayNow, formatDate } from '@/lib/format';

/**
 * The college letterhead on a printed annexure. Print only: on screen the
 * console shell already says whose portal this is, and a second header
 * would push the figures down.
 *
 * Everything on it is pack data — the logo (or the wordmark when the
 * college has supplied none), the institution name and its address — so a
 * second college prints on its own paper with no change here. The date is
 * the portal's clock, read on the server, in the college's time zone.
 */
export function Letterhead({ pack, title }: { pack: BrandPack; title?: string }) {
  const generated = formatDate(displayNow(), { locale: pack.locale.locale, timeZone: pack.locale.timeZone });
  // Address lines often open with the institution's name; it is already set above them.
  const address = pack.copy.addressLines.filter((l) => l.trim() !== pack.copy.institutionName.trim());

  return (
    <div className="print-only mb-6 border-b-2 border-line-strong pb-4">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 space-y-1">
          <Logo pack={pack} variant="crest" height={40} />
          <p className="pt-2 font-display text-lg font-bold text-primary">{pack.copy.institutionName}</p>
          {address.length ? <p className="text-sm text-secondary">{address.join(', ')}</p> : null}
        </div>
        <div className="shrink-0 text-right text-sm text-secondary">
          {title ? <p className="font-semibold text-primary">{title}</p> : null}
          <p>Generated from the degree register on {generated}</p>
        </div>
      </div>
    </div>
  );
}
