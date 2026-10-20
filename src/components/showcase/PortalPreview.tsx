import * as React from 'react';
import { ArrowRight, Globe, Menu } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Crest } from '@/components/brand/Crest';
import { buildTokens, fontFaceCss, googleFontsHref } from '@/lib/branding/tokens';
import { inSentence } from '@/lib/branding/copy';
import { yearIn } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { BrandPack } from '@/lib/branding/pack';

/**
 * A college's portal, in miniature, wearing that college's real tokens.
 *
 * The showcase's claim is "the same product under a different college's
 * name", and the only honest way to show that is to run each pack through
 * the same resolver the portal itself runs (`buildTokens`) and scope the
 * result to a wrapper. Every colour, font, corner and density inside the
 * frame is therefore that college's, derived exactly as it ships, and
 * follows the page into dark mode the way the real portal would.
 *
 * Not an iframe: `frame-src` is `'none'`. Custom properties inherit, so
 * redefining the whole token set on one element restyles everything under
 * it, Tailwind utilities included, without touching the host page.
 *
 * It is a picture of a phone screen in a browser window, not a second copy of the portal:
 * nothing in it is focusable, and assistive technology gets the caption
 * the showcase puts beside it rather than every word inside it.
 *
 * It shows the screen the college's address actually opens on. A pack
 * with `features.publicLanding` off has no landing page (`/` redirects to
 * `/login`), so its frame shows the sign-in screen, not a page that
 * college does not have.
 */

/** Which screen a college's address opens on: the landing page, or sign-in when the pack has none. */
export function previewScreen(pack: BrandPack): 'landing' | 'sign-in' {
  return pack.features.publicLanding ? 'landing' : 'sign-in';
}

const scopeClass = (pack: BrandPack) => `pv-${pack.id}`;

/** `<` cannot appear in a token, but a pack is data, so a style block never gets the chance to close early. */
const safe = (css: string) => css.replace(/</g, '\\3c ');

/** One pack's tokens, scoped to its preview wrapper, light and dark. */
export function scopedTokenCss(pack: BrandPack): string {
  const t = buildTokens(pack);
  const decl = (o: Record<string, string>) =>
    Object.entries(o)
      .map(([k, v]) => `${k}:${v}`)
      .join(';');
  const s = `.${scopeClass(pack)}`;
  const dark = decl(t.dark);

  // The same three conditions as `tokensToCss`: light by default, dark by
  // the OS unless the visitor chose light, dark when the visitor chose it.
  return safe(
    fontFaceCss(pack) +
      `${s}{${decl(t.base)};${decl(t.light)}}` +
      `@media(prefers-color-scheme:dark){:root:not([data-theme="light"]) ${s}{${dark}}}` +
      `[data-theme="dark"] ${s}{${dark}}`,
  );
}

/**
 * The stylesheets every preview on the page needs, once: the scoped token
 * blocks and one Google Fonts link per distinct family set.
 */
export function PreviewStyles({ packs }: { packs: BrandPack[] }) {
  const fonts = [...new Set(packs.map(googleFontsHref).filter((h): h is string => Boolean(h)))];
  return (
    <>
      {fonts.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
      <style dangerouslySetInnerHTML={{ __html: packs.map(scopedTokenCss).join('') }} />
    </>
  );
}

/** The portal's own emphasis rule: the phrase must sit inside the headline, or it renders plain. */
function Headline({ text, emphasis }: { text: string; emphasis?: string }) {
  const at = emphasis ? text.indexOf(emphasis) : -1;
  if (!emphasis || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="text-band-accent">{emphasis}</span>
      {text.slice(at + emphasis.length)}
    </>
  );
}

/** The landing page's first screen, as a phone shows it. */
function LandingScreen({ pack }: { pack: BrandPack }) {
  const { copy, assets, locale } = pack;
  const photo = assets.heroImage;
  const current = yearIn(locale.timeZone);
  const years = Array.from({ length: 8 }, (_, i) => current - i);

  const headline = copy.heroHeadline ?? `Welcome back to ${copy.shortName}.`;
  const emphasis = copy.heroEmphasis ?? (copy.heroHeadline ? undefined : copy.shortName);

  const batchCard = (
    <div className="band-exit rounded-lg border border-line bg-surface-raised p-4 shadow-sm">
      <p className="font-display text-base font-semibold text-primary">Which year did you pass out?</p>
      <p className="mt-0.5 text-xs text-secondary">Pick your year to start registering.</p>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {years.map((y) => (
          <span
            key={y}
            className="grid h-9 place-items-center rounded border border-line bg-surface text-xs font-semibold tabular text-primary"
          >
            {y}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ objectPosition: assets.heroFocus }}
          className="block aspect-[5/2] w-full object-cover"
        />
      ) : null}

      <div className={cn('band-surface px-4 pt-6', photo ? 'pb-12' : 'pb-5')}>
        <p className="text-xs font-semibold text-band-accent">{copy.institutionName}</p>
        {copy.tagline ? <p className="text-xs text-band-muted">{copy.tagline}</p> : null}
        <p className="mt-3 font-display text-display-sm font-bold text-band-fg">
          <Headline text={headline} emphasis={emphasis} />
        </p>
        {copy.heroSubhead ? <p className="mt-2 line-clamp-3 text-sm text-band-muted">{copy.heroSubhead}</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <span className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-band-fg text-sm font-semibold text-band">
            Register
            <ArrowRight className="size-3.5" />
          </span>
          <span className="inline-flex h-10 items-center justify-center rounded-lg border border-band-muted text-sm font-semibold text-band-fg">
            Sign in
          </span>
        </div>
        {photo ? null : <div className="mt-6">{batchCard}</div>}
      </div>

      {photo ? <div className="relative -mt-8 px-4">{batchCard}</div> : null}
    </>
  );
}

/**
 * The sign-in screen, as a phone shows it: the college strip, then the
 * form. The wording is the sign-in page's own, so the frame shows what a
 * member of that college sees at its address.
 */
function SignInScreen({ pack }: { pack: BrandPack }) {
  const { copy } = pack;

  return (
    <>
      <div className="band-surface flex min-h-16 items-center gap-3 px-4 py-3">
        <Crest pack={pack} size={36} />
        <span className="min-w-0">
          <span className="block font-display text-base font-semibold leading-snug text-band-fg">
            {copy.institutionName}
          </span>
          <span className="block text-xs text-band-muted">{copy.portalName}</span>
        </span>
      </div>

      <div className="px-4 pt-6">
        <p className="font-display text-display-sm font-bold text-primary">Sign in</p>
        <p className="mt-2 text-sm text-secondary">
          Welcome back. We will email you a six-digit code — there is no password to remember.
        </p>

        <p className="mt-5 text-sm font-medium text-primary">Email address</p>
        <span className="mt-1.5 flex h-control-lg items-center rounded border border-line bg-surface-raised px-3 text-sm text-muted">
          you@example.com
        </span>
        <span className="mt-3 flex h-control-lg items-center justify-center rounded-lg bg-[var(--button-primary-bg)] text-sm font-semibold text-[var(--button-primary-fg)] shadow-sm">
          Email me a sign-in code
        </span>

        <div className="mt-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs font-medium uppercase tracking-wide text-secondary">New here?</span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <span className="mt-5 flex h-control-lg items-center justify-center rounded-lg border border-line bg-surface-raised text-sm font-semibold text-primary">
          Register with your {inSentence(copy.rollNumberLabel)}
        </span>
      </div>

      {/* The sign-in frame's footer: the legal links, and the one line that names the vendor. */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 text-xs text-secondary">
        <span className="flex flex-wrap gap-x-4">
          <span>Privacy notice</span>
          <span>Terms of use</span>
          <span>Help signing in</span>
        </span>
        {copy.poweredBy ? (
          <span>
            Powered by <span className="font-medium text-primary">{copy.poweredBy}</span>
          </span>
        ) : null}
      </div>
    </>
  );
}

export function PortalPreview({
  pack,
  host,
  label,
  className,
}: {
  pack: BrandPack;
  /** The address this college's portal answers on, shown in the frame's bar. */
  host: string;
  /** A short tag in the bar, such as "Demo". */
  label?: string;
  className?: string;
}) {
  const screen = previewScreen(pack);
  // Reads like a browser's address bar: no dev port, and the path when it is not `/`.
  const address = host.replace(/:\d+$/, '') + (screen === 'sign-in' ? '/login' : '');

  return (
    <div className={cn('flex flex-col border border-line bg-surface-raised', className)}>
      {/* The frame is the showcase's own chrome, in the house tokens. */}
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line px-3">
        {/* Window controls: three empty hairline circles. They read as a browser window and mean nothing else. */}
        <span aria-hidden="true" className="flex shrink-0 gap-1.5">
          <span className="size-2.5 rounded-full border border-line-strong" />
          <span className="size-2.5 rounded-full border border-line-strong" />
          <span className="size-2.5 rounded-full border border-line-strong" />
        </span>
        <Globe className="ml-1 size-3.5 shrink-0 text-muted" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-secondary">{address}</span>
        {label ? (
          <span className="shrink-0 border border-line-strong px-1.5 font-mono text-xs uppercase leading-5 tracking-[0.12em] text-secondary">
            {label}
          </span>
        ) : null}
      </div>

      {/*
        Everything below wears the college's tokens. The lower edge fades out
        through an alpha mask, not a colour, so the crop reads as a crop and
        the frame's own hairline stays crisp.
      */}
      <div
        aria-hidden="true"
        inert
        className={cn(
          scopeClass(pack),
          'relative flex-1 overflow-hidden bg-surface font-body text-primary',
          '[mask-image:linear-gradient(to_bottom,black_calc(100%-4.5rem),transparent)]',
        )}
      >
        {screen === 'landing' ? (
          <>
            <div className="flex h-12 items-center gap-2 border-b border-line bg-surface-raised px-4">
              <Logo pack={pack} height={24} className="min-w-0" />
              <span className="ml-auto inline-flex h-8 items-center rounded bg-[var(--button-primary-bg)] px-3 text-xs font-semibold text-[var(--button-primary-fg)]">
                Sign in
              </span>
              <Menu className="size-4 shrink-0 text-secondary" />
            </div>
            <LandingScreen pack={pack} />
          </>
        ) : (
          // The sign-in frame on a phone opens on the college strip; there is no header above it.
          <SignInScreen pack={pack} />
        )}
      </div>
    </div>
  );
}
