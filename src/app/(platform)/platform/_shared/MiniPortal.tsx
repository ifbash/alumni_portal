import * as React from 'react';

import { Crest } from '@/components/brand/Crest';
import { Logo } from '@/components/brand/Logo';
import { MediaFrame } from '@/components/ui';
import type { BrandPack } from '@/lib/branding/pack';
import { scopedTokensCss } from '@/lib/branding/scope';
import { buildTokens, fontFaceCss, googleFontsHref } from '@/lib/branding/tokens';
import { cn } from '@/lib/cn';

/**
 * A college's sign-in screen in miniature, light and dark side by side.
 *
 * Everything in it is pack data: the band with the crest and wordmark,
 * the hero headline with its emphasis, the subhead, the primary button
 * and the hero photo when the pack has one. It never shows a member, a
 * name, an event or a figure — a real college's preview must not invent
 * people, and a demo pack's preview must not look like a real college's.
 *
 * Each side sits inside `.pack-{id}.mode-{light|dark}` with that pack's
 * tokens forced to one mode, so the console around it keeps the house
 * tokens and the preview is exactly what the college's pages derive.
 *
 * Isomorphic: no hooks and no server-only imports. Server pages let it
 * compute its own CSS; the set-up form passes CSS the page computed, so
 * the browser never derives tokens.
 */

type Mode = 'light' | 'dark';
const MODES: Mode[] = ['light', 'dark'];

/** The scoped token CSS for both preview modes, plus any self-hosted faces. */
export function miniPortalCss(pack: BrandPack): string {
  const tokens = buildTokens(pack);
  return fontFaceCss(pack) + MODES.map((m) => scopedTokensCss(tokens, `.pack-${pack.id}.mode-${m}`, m)).join('');
}

export interface MiniPortalNames {
  shortName?: string;
  institutionName?: string;
}

export function MiniPortal({
  pack,
  css,
  fontHref,
  names,
  size = 'md',
  className,
}: {
  pack: BrandPack;
  /** From `miniPortalCss(pack)`. Computed here when absent. */
  css?: string;
  /** From `googleFontsHref(pack)`. Computed here when absent. */
  fontHref?: string | null;
  /** A new college's typed names, shown in place of the pack's own. */
  names?: MiniPortalNames;
  /** `sm` for a narrow rail: smaller type, no subhead. */
  size?: 'sm' | 'md';
  className?: string;
}) {
  const shown = withNames(pack, names);
  const styles = css ?? miniPortalCss(pack);
  const href = fontHref === undefined ? googleFontsHref(pack) : fontHref;

  return (
    <div
      role="group"
      aria-label={`${shown.copy.portalName}, sign-in screen in light and dark`}
      className={cn('grid min-w-0 grid-cols-2 gap-3', className)}
    >
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      {href ? <link rel="stylesheet" href={href} precedence="default" /> : null}
      {MODES.map((mode) => (
        <Screen key={mode} pack={shown} mode={mode} size={size} />
      ))}
    </div>
  );
}

function Screen({ pack, mode, size }: { pack: BrandPack; mode: Mode; size: 'sm' | 'md' }) {
  const { copy, assets } = pack;
  const small = size === 'sm';
  const headline = copy.heroHeadline ?? `Welcome back to ${copy.shortName}.`;
  const emphasis = copy.heroEmphasis ?? (copy.heroHeadline ? undefined : copy.shortName);

  return (
    // The dark side repeats the light one word for word; it is announced once.
    <figure className="min-w-0 space-y-1.5" aria-hidden={mode === 'dark' ? true : undefined}>
      <div
        className={cn(
          `pack-${pack.id} mode-${mode}`,
          'overflow-hidden rounded-lg border border-line bg-surface font-body text-primary shadow-sm',
        )}
      >
        <div className={cn('band-surface flex items-center gap-2', small ? 'min-h-9 px-2.5 py-1.5' : 'min-h-11 px-3 py-2')}>
          <Crest pack={pack} size={small ? 20 : 24} />
          <span className="min-w-0 truncate">
            <Logo pack={pack} variant="band" height={small ? 15 : 19} />
          </span>
        </div>

        {assets.heroImage ? (
          <MediaFrame
            src={assets.heroImage}
            alt=""
            focus={assets.heroFocus}
            aspect="21/9"
            rounded={false}
            className="[&>div]:border-0"
          />
        ) : null}

        <div className={cn('space-y-2', small ? 'p-2.5' : 'p-3.5')}>
          <p className="truncate text-xs font-semibold text-brand-fg">{copy.institutionName}</p>
          <p className={cn('font-display font-bold leading-snug text-primary', small ? 'text-sm' : 'text-md')}>
            <Emphasised text={headline} emphasis={emphasis} />
          </p>
          {!small && copy.heroSubhead ? (
            <p className="line-clamp-3 text-xs text-secondary">{copy.heroSubhead}</p>
          ) : null}
          {/* A picture of the button, not a control: nothing in a preview is clickable. */}
          <span
            className={cn(
              'inline-flex items-center rounded bg-[var(--button-primary-bg)] font-semibold text-[var(--button-primary-fg)] shadow-sm',
              small ? 'h-7 px-2.5 text-xs' : 'h-control-sm px-3 text-xs',
            )}
          >
            Sign in
          </span>
        </div>
      </div>
      <figcaption className="text-xs text-secondary">{mode === 'light' ? 'Light' : 'Dark'}</figcaption>
    </figure>
  );
}

/**
 * The colours a college supplied, labelled as it would name them.
 *
 * The band leads, since it is the colour people recognise; any other seed
 * equal to it is not repeated. Swatches are pack data, set inline.
 */
export function SeedSwatches({ pack, className }: { pack: BrandPack; className?: string }) {
  const tokens = buildTokens(pack);
  const band = (tokens.light['--band'] ?? tokens.base['--band'] ?? pack.color.primary).toLowerCase();
  const same = (hex: string | undefined) => (hex ?? '').toLowerCase() === band;

  const swatches: Array<{ label: string; hex: string }> = [
    { label: 'Band', hex: band },
    ...(!same(pack.color.primary) ? [{ label: 'Primary', hex: pack.color.primary }] : []),
    ...(pack.color.accent && !same(pack.color.accent) ? [{ label: 'Accent', hex: pack.color.accent }] : []),
    ...(pack.color.ink && !same(pack.color.ink) ? [{ label: 'Ink', hex: pack.color.ink }] : []),
    { label: 'Page', hex: pack.color.surface },
    { label: 'Dark page', hex: pack.color.surfaceDark },
  ];

  return (
    <ul className={cn('grid grid-cols-2 gap-x-4 gap-y-2.5', className)} aria-label="Colours">
      {swatches.map((s) => (
        <li key={s.label} className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="size-7 shrink-0 rounded border border-line-strong"
            style={{ backgroundColor: s.hex }}
          />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-xs font-medium text-primary">{s.label}</span>
            <span className="block font-mono text-xs text-secondary">{s.hex.toUpperCase()}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The emphasised phrase in brand text; a headline that lost its emphasis renders plain. */
function Emphasised({ text, emphasis }: { text: string; emphasis?: string }) {
  const at = emphasis ? text.indexOf(emphasis) : -1;
  if (!emphasis || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="text-brand-fg">{emphasis}</span>
      {text.slice(at + emphasis.length)}
    </>
  );
}

/**
 * The pack with a new college's names in place of its own.
 *
 * The pack's crest and logos belong to whichever college or template it
 * came from, so a renamed preview drops them and sets the new name in
 * type, which is what the band shows until the college's own arrive.
 */
function withNames(pack: BrandPack, names?: MiniPortalNames): BrandPack {
  const short = names?.shortName?.trim();
  const full = names?.institutionName?.trim();
  if (!short && !full) return pack;

  const swap = (s: string | undefined) => {
    if (!s) return s;
    let out = s;
    if (full) out = out.split(pack.copy.institutionName).join(full);
    if (short) out = out.split(pack.copy.shortName).join(short);
    return out;
  };

  return {
    ...pack,
    assets: { ...pack.assets, crest: undefined, logoPrimary: undefined, logoInverse: undefined, logoMark: undefined },
    copy: {
      ...pack.copy,
      shortName: short || pack.copy.shortName,
      institutionName: full || pack.copy.institutionName,
      portalName: short || full || pack.copy.portalName,
      heroHeadline: swap(pack.copy.heroHeadline),
      heroEmphasis: swap(pack.copy.heroEmphasis),
      heroSubhead: swap(pack.copy.heroSubhead),
    },
  };
}
