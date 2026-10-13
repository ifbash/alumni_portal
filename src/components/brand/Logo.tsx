import * as React from 'react';
import { cn } from '@/lib/cn';
import type { BrandPack } from '@/lib/branding/pack';

/**
 * Logo.
 *
 * Colleges supply logos inconsistently — often only a crest, frequently a
 * single PNG with a baked-in white background that is unusable on a dark
 * header, sometimes nothing at all for the first month. This falls back
 * down a chain rather than rendering a broken image, and ends at the
 * portal name set in the display face, which always works.
 *
 * That last fallback is not a placeholder to be replaced later. A tenant
 * can run indefinitely as a wordmark and still look deliberate.
 */

/**
 * `band` is for the college band (`.band-surface`). It takes only the
 * reversed logo: a crest or a mark drawn for a light ground disappears on
 * the band, so without `logoInverse` it falls through to the wordmark in
 * the band's foreground. A crest on the band goes on a light disc instead
 * — see `Crest`.
 */
type Variant = 'primary' | 'inverse' | 'mark' | 'crest' | 'band';

export function Logo({
  pack,
  variant = 'primary',
  height = 32,
  className,
  showName = false,
}: {
  pack: BrandPack;
  variant?: Variant;
  /** Height in px. Width is derived, so odd aspect ratios do not distort. */
  height?: number;
  className?: string;
  /** Render the portal name beside the mark. Used in narrow headers. */
  showName?: boolean;
}) {
  const a = pack.assets;

  const chain: Record<Variant, Array<string | undefined>> = {
    primary: [a.logoPrimary, a.crest, a.logoMark],
    inverse: [a.logoInverse, a.logoMark, a.crest],
    mark: [a.logoMark, a.crest, a.logoPrimary],
    crest: [a.crest, a.logoPrimary, a.logoMark],
    band: [a.logoInverse],
  };

  const src = chain[variant].find(Boolean);

  // A logo drawn for a light ground is ink on ink in dark mode. When the
  // pack supplies a reversed one, both are rendered and the theme picks in
  // CSS (`.logo-on-light` in globals.css), so it follows the OS and the
  // toggle without a flash. Packs without one keep a single image.
  const onDark =
    variant === 'primary' && src === a.logoPrimary && a.logoInverse ? a.logoInverse : null;

  const wordmark = (
    <span
      className={cn(
        'font-display font-bold leading-none tracking-[var(--tracking-display)]',
        variant === 'band' ? 'text-band-fg' : variant === 'inverse' ? 'text-on-inverse' : 'text-primary',
      )}
      // 0.72 of the slot: a 28px header slot sets the name at about 20px,
      // clearly larger than the 14px nav beside it. At half the slot the
      // college's name read no bigger than a nav link.
      style={{ fontSize: height * 0.72 }}
    >
      {pack.copy.portalName}
    </span>
  );

  if (!src) {
    return <span className={cn('inline-flex items-center', className)}>{wordmark}</span>;
  }

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {/*
        Deliberately not next/image: logo URLs are tenant-supplied and may
        point at arbitrary hosts, which would need a remotePatterns
        allowlist wide enough to be meaningless. These are small assets and
        the optimisation is not worth the hole.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={showName ? '' : pack.copy.portalName}
        height={height}
        style={{ height, width: 'auto' }}
        className={cn('object-contain', onDark ? 'logo-on-light' : 'block')}
      />
      {onDark ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={onDark}
          alt={showName ? '' : pack.copy.portalName}
          height={height}
          style={{ height, width: 'auto' }}
          className="logo-on-dark object-contain"
        />
      ) : null}
      {showName ? wordmark : null}
    </span>
  );
}

/**
 * Square avatar-shaped mark, for tight spaces where even a stacked lockup
 * does not fit. Falls back to the institution's initials on the brand
 * tint — never to an empty box.
 */
export function LogoMark({
  pack,
  size = 32,
  className,
}: {
  pack: BrandPack;
  size?: number;
  className?: string;
}) {
  const src = pack.assets.logoMark ?? pack.assets.crest;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={pack.copy.portalName}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={cn('rounded object-contain', className)}
      />
    );
  }

  const initials = pack.copy.shortName.slice(0, 2).toUpperCase();

  return (
    <span
      aria-label={pack.copy.portalName}
      role="img"
      className={cn(
        'grid shrink-0 place-items-center rounded bg-[var(--button-primary-bg)] font-display font-bold text-[var(--button-primary-fg)]',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initials}
    </span>
  );
}
