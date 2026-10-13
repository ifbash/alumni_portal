import * as React from 'react';
import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { PageBand } from '@/components/brand/PageBand';
import { pickBandPhoto, type BandPhoto } from '@/lib/branding/media';
import type { BrandPack } from '@/lib/branding/pack';

/**
 * The college, at the top of the home page.
 *
 * One band, standard size, carrying three things: who the viewer is here
 * (the eyebrow), a greeting, and the single most useful next step with
 * its button. It is the only identity surface on the page; everything
 * under it is work.
 *
 * The photo is the college's own, picked by `pickBandPhoto(pack, 'home')`
 * and shown only at lg behind the scrim. Without one the band is solid,
 * which is the case this was designed for first.
 *
 * The padding is pulled in from the kit's standard band so the header
 * stays under 220px on a desktop and 200px on a phone: the home page is
 * opened every day, and a hero that pushes the first task below the fold
 * is a hero people learn to scroll past.
 */

export interface BandAction {
  href: string;
  label: string;
  /** `band` for the one primary step, `band-outline` for the rest. */
  variant?: 'band' | 'band-outline';
}

export function HomeBand({
  pack,
  eyebrow,
  title,
  lead,
  meta,
  actions = [],
  photo,
}: {
  pack: BrandPack;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  lead?: React.ReactNode;
  /** `BandChip`s under the lead. */
  meta?: React.ReactNode;
  actions?: BandAction[];
  /** Defaults to the college's home photo. Pass null for a solid band. */
  photo?: BandPhoto | null;
}) {
  const shown = photo === undefined ? pickBandPhoto(pack, 'home') : photo;

  return (
    <PageBand
      pack={pack}
      size="standard"
      photo={shown}
      eyebrow={eyebrow}
      title={title}
      lead={lead}
      meta={meta}
      className={BAND_TIGHT}
      actions={
        actions.length ? (
          <>
            {actions.map((a, i) => (
              <ButtonLink key={a.href} href={a.href} variant={a.variant ?? (i === 0 ? 'band' : 'band-outline')} className="min-h-11">
                {a.label}
                {i === 0 ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
              </ButtonLink>
            ))}
          </>
        ) : null
      }
    />
  );
}

/**
 * Tighter than the kit's standard band: 20px top and bottom on a phone,
 * 28px on a desktop, and 16px above the buttons instead of 20px. Applied
 * to the band's inner block and its action row by position, because the
 * kit exposes only the outer `className`.
 */
const BAND_TIGHT = '[&>div]:py-5 lg:[&>div]:py-7 [&_.mt-5]:mt-4';
