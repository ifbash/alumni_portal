import { LogoMark } from '@/components/brand/Logo';
import { readableTextOn } from '@/lib/branding/color';
import type { BrandPack } from '@/lib/branding/pack';
import { cn } from '@/lib/cn';

/**
 * A college's mark in the vendor's lists.
 *
 * The console wears the house tokens, so a college's own colour cannot
 * come from a token here: it is the pack's primary seed, set inline from
 * pack data, with its text picked by the same contrast rule the button
 * tokens use. A crest or mark, when the pack has one, sits on the pack's
 * own page colour, the ground it was drawn for.
 *
 * Decorative: the college's name is always beside it.
 */
export function CollegeMark({
  pack,
  name,
  size = 40,
  className,
}: {
  pack: BrandPack | null;
  /** The short name the monogram is cut from. */
  name: string;
  size?: number;
  className?: string;
}) {
  const box = { width: size, height: size };

  if (pack && (pack.assets.logoMark || pack.assets.crest)) {
    return (
      <span
        aria-hidden="true"
        className={cn('grid shrink-0 place-items-center overflow-hidden rounded border border-line', className)}
        style={{ ...box, backgroundColor: pack.color.surface }}
      >
        <LogoMark pack={pack} size={Math.round(size * 0.72)} />
      </span>
    );
  }

  const letters = monogram(name);
  const fontSize = size * (letters.length <= 2 ? 0.42 : letters.length === 3 ? 0.34 : 0.27);

  if (!pack) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'grid shrink-0 place-items-center rounded border border-line bg-surface-sunken font-display font-bold text-secondary',
          className,
        )}
        style={{ ...box, fontSize }}
      >
        {letters}
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn('grid shrink-0 place-items-center rounded font-display font-bold leading-none', className)}
      style={{ ...box, fontSize, backgroundColor: pack.color.primary, color: readableTextOn(pack.color.primary) }}
    >
      {letters}
    </span>
  );
}

function monogram(name: string): string {
  const letters = name.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase();
  return letters.slice(0, 4) || '·';
}
