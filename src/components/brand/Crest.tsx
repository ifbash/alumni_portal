import * as React from 'react';
import { cn } from '@/lib/cn';
import type { BrandPack } from '@/lib/branding/pack';

/**
 * The college crest on the band.
 *
 * Only for band surfaces (the hero, the sign-in panel and strip, the
 * footer). Crests are drawn for paper: most are dark line art that
 * disappears on a navy or maroon band, so this sets the crest on a light
 * disc in the band's foreground rather than trusting the artwork.
 *
 * Renders nothing when the pack has no crest. There is deliberately no
 * stand-in — no monogram seal, no initials — because a placeholder crest
 * reads as a real one, and the institution name is always next to it.
 */
export function Crest({ pack, size = 48, className }: { pack: BrandPack; size?: number; className?: string }) {
  const crest = pack.assets.crest;
  if (!crest) return null;

  return (
    <span
      className={cn('grid shrink-0 place-items-center rounded-full bg-band-fg p-1.5 ring-1 ring-band-rule', className)}
      style={{ width: size, height: size }}
    >
      {/*
        Not next/image, for the same reason as Logo: tenant-supplied URLs
        on arbitrary hosts. Empty alt because the institution name is
        always adjacent; announcing the crest as well repeats it.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={crest} alt="" className="size-full object-contain" />
    </span>
  );
}
