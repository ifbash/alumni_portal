import * as React from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { PACKS, DEMO_PACK_IDS } from '@/lib/branding/registry';
import { cn } from '@/lib/cn';
import type { BrandPack } from '@/lib/branding/pack';
import { PortalPreview, PreviewStyles, previewScreen } from './PortalPreview';
import type { ShowcaseLinks } from './links';

/**
 * The first screen of the product site, and the page's one dark field.
 *
 * Written for a principal, a T&P officer or a trust member deciding
 * whether this is worth a call. The headline is the promise; the visual
 * proves the white-label claim instead of asserting it: three colleges'
 * real brand packs, rendered through the real resolver, as browser windows
 * on an aubergine field. The windows rise in turn, float, tilt toward the
 * visitor and settle flat under the pointer. They are cropped by the
 * hero's floor, so the page seems to continue under them.
 */

/** Left to right on a laptop. The college with photographs sits in the middle and leads on a phone. */
const PREVIEWS = ['diet', 'srivarsity', 'northgate'] as const;
const LEAD = 'srivarsity';

/** Where each window stands on a laptop (see ShowcaseStyles): left and right lean in, the middle faces front. */
const STANCE: Record<string, string> = { diet: 'sc-dev sc-dev-l', srivarsity: 'sc-dev sc-dev-m z-10', northgate: 'sc-dev sc-dev-r' };

const CORNERS: Record<BrandPack['shape']['radius'], string> = {
  none: 'square',
  subtle: 'subtle',
  rounded: 'rounded',
  pill: 'pill',
};

function isDemo(id: string): boolean {
  return (DEMO_PACK_IDS as readonly string[]).includes(id);
}

/** What differs between the packs, read from the packs. */
function specLine(pack: BrandPack): string {
  const { color, type, shape, assets } = pack;
  const colours = color.accent && color.accent !== color.primary ? `${color.primary} + ${color.accent}` : color.primary;
  const faces = type.display === type.body ? type.display : `${type.display} / ${type.body}`;
  const corners = `${CORNERS[shape.radius]} corners${shape.density === 'compact' ? ', compact' : ''}`;
  const photos = assets.heroImage ? `${1 + assets.campusPhotos.length} photos` : 'no photos yet';
  // A switch in the same file: with no public landing page the address opens on sign-in.
  const door = previewScreen(pack) === 'sign-in' ? ['sign-in only'] : [];
  return [colours, faces, corners, photos, ...door].join(' · ');
}

/** The headline, with its last promise in the band's accent: the portal's own emphasis rule. Plain if the wording changes. */
function Headline({ text, mark }: { text: string; mark: string }) {
  const at = text.lastIndexOf(mark);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="text-band-accent">{mark}</span>
      {text.slice(at + mark.length)}
    </>
  );
}

const step = (i: number) => ({ '--i': i }) as React.CSSProperties;

export function Hero({ pack, links }: { pack: BrandPack; links: ShowcaseLinks }) {
  const previews = PREVIEWS.map((id) => PACKS[id]).filter((p): p is BrandPack => Boolean(p));
  const headline = pack.copy.tagline ?? 'The alumni network your college actually owns.';

  return (
    <section aria-labelledby="showcase-title" className="sc-field band-surface grain relative overflow-hidden">
      <PreviewStyles packs={previews} />
      <div className="aurora" aria-hidden="true" />

      <div className="page-shell relative z-10 pt-10 lg:pt-14">
        <div className="stagger">
          <p
            style={step(0)}
            className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-band-accent"
          >
            Alumni portal for Indian engineering colleges
          </p>
          <h1
            id="showcase-title"
            style={step(1)}
            className="mt-4 max-w-[17ch] font-display text-display-xl font-bold text-band-fg [text-wrap:balance] lg:max-w-[22ch] lg:text-[length:calc(var(--display-xl)*1.2)]"
          >
            <Headline text={headline} mark="owns" />
          </h1>
        </div>

        <div className="stagger mt-5 grid gap-x-12 gap-y-5 lg:grid-cols-12 lg:items-center">
          <p style={step(2)} className="text-md text-band-muted lg:col-span-7">
            One network for final-year students and alumni, in your college&rsquo;s own name, colours and
            photographs. Every alumni registration is checked against your degree register, and
            ifBash&rsquo;s own admin account has no permission to open a profile or search your directory.
          </p>

          <div style={step(3)} className="flex flex-wrap gap-3 lg:col-span-5 lg:justify-end">
            {links.requestDemo ? (
              <ButtonLink href={links.requestDemo} variant="band" size="lg" className="min-h-11">
                Request a demo
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
            ) : null}
            {links.demoCollege ? (
              <ButtonLink href={links.demoCollege} variant="band-outline" size="lg" className="min-h-11">
                See a demo college
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </div>

      {/* The stage: the same portal in three brand packs. */}
      <div className="relative z-10 mt-8 lg:mt-9">
        <div className="page-shell mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-band-accent">
            One product · three colleges
          </p>
          <p className="text-sm text-band-muted">The same code in every frame. Only each college&rsquo;s JSON file differs.</p>
        </div>

        {/* On a laptop the windows are cropped by the hero's floor; on a phone they scroll sideways. */}
        <div className="relative lg:h-[23rem] lg:overflow-hidden lg:pt-3">
          <div
            className={cn(
              'snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scroll-padding-inline:clamp(16px,4vw,32px)]',
              'lg:snap-none lg:overflow-visible',
            )}
          >
            <ul
              aria-label="The same portal wearing three colleges’ brand packs"
              className={cn(
                'sc-stage page-shell flex gap-4 pb-8 lg:grid lg:grid-cols-3 lg:gap-8 lg:pb-0',
                // Room after the last frame when the row scrolls on a phone.
                "after:block after:w-px after:shrink-0 after:content-[''] lg:after:hidden",
              )}
            >
              {previews.map((p, i) => (
                <li
                  key={p.id}
                  className={cn(
                    // `relative` keeps the caption's sr-only text inside the scroller's clip.
                    'relative w-[84%] max-w-[24rem] shrink-0 snap-start sm:w-[22rem] lg:w-auto lg:max-w-none',
                    STANCE[p.id],
                    p.id === LEAD && 'order-first lg:order-none',
                  )}
                >
                  <div className="sc-rise" style={step(i)}>
                    <figure className="sc-float m-0" style={{ animationDelay: `${i * -2.3}s` }}>
                      <figcaption className="mb-3 flex gap-3">
                        {/* The college's band colour, from its own scoped tokens. */}
                        <span
                          aria-hidden="true"
                          className={cn(
                            `pv-${p.id}`,
                            'mt-1.5 size-3.5 shrink-0 border border-[color-mix(in_srgb,var(--band-fg)_45%,transparent)] bg-band',
                          )}
                        />
                        <span className="min-w-0">
                          <span className="block font-display text-lg font-bold text-band-fg">
                            {p.copy.portalName}
                            <span className="ml-2 align-middle font-mono text-xs font-medium uppercase tracking-[0.12em] text-band-muted">
                              {isDemo(p.id) ? 'Fictional' : 'First college'}
                            </span>
                            <span className="sr-only">
                              , {p.copy.institutionName}: a phone-sized preview of its{' '}
                              {previewScreen(p) === 'sign-in' ? 'sign-in page' : 'landing page'}
                            </span>
                          </span>
                          <span className="block font-mono text-xs text-band-muted">{specLine(p)}</span>
                        </span>
                      </figcaption>
                      <PortalPreview
                        pack={p}
                        host={links.hostFor(p.id)}
                        label={isDemo(p.id) ? 'Demo' : 'Preview'}
                        // Tall enough that the crop, not the frame, ends the window on a laptop.
                        className="sc-window h-[30rem] lg:h-[34rem]"
                      />
                    </figure>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* The hero's floor: the windows sink into the field instead of stopping at a line. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-20 hidden h-28 bg-[linear-gradient(to_bottom,transparent,var(--band))] lg:block"
          />
        </div>

        {/* Names what is fictional before a reader has to ask, and survives a crop of the stage. */}
        <p className="page-shell relative z-30 pb-6 pt-3 text-xs text-band-muted lg:pb-7">
          The demo college is fictional and runs on sample data. DIET&rsquo;s colours are placeholders until the college
          sends its official values. Tamarind Grove University and Northgate Polytechnic are fictional, and their
          photographs are illustrative.
        </p>
      </div>
    </section>
  );
}
