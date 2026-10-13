import * as React from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { Scribble } from '@/components/brand/Marks';
import { PACKS, DEMO_PACK_IDS } from '@/lib/branding/registry';
import { cn } from '@/lib/cn';
import type { BrandPack } from '@/lib/branding/pack';
import { PortalPreview, PreviewStyles, previewScreen } from './PortalPreview';
import { EYEBROW } from './styles';
import type { ShowcaseLinks } from './links';

/**
 * The first screen of the product site.
 *
 * Written for a principal, a T&P officer or a trust member deciding
 * whether this is worth a call. The headline is the promise, the subhead
 * says what the thing is in one breath, and the visual proves the
 * white-label claim instead of asserting it: three colleges' real brand
 * packs, rendered through the real resolver, side by side.
 */

/** Left to right on a laptop. The college with photographs sits in the middle and leads on a phone. */
const PREVIEWS = ['diet', 'srivarsity', 'northgate'] as const;
const LEAD = 'srivarsity';

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

/** The headline, with its last promise underlined in the marker. Plain if the wording changes. */
function Headline({ text, mark }: { text: string; mark: string }) {
  const at = text.lastIndexOf(mark);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="relative inline-block">
        {mark}
        <Scribble className="absolute -bottom-[0.12em] left-0 h-[0.18em] w-full" />
      </span>
      {text.slice(at + mark.length)}
    </>
  );
}

export function Hero({ pack, links }: { pack: BrandPack; links: ShowcaseLinks }) {
  const previews = PREVIEWS.map((id) => PACKS[id]).filter((p): p is BrandPack => Boolean(p));
  const headline = pack.copy.tagline ?? 'The alumni network your college actually owns.';
  // A pack on the stage whose landing page is switched off, named in the note under the frames.
  const signInOnly = previews.find((p) => previewScreen(p) === 'sign-in');

  return (
    <section aria-labelledby="showcase-title">
      <PreviewStyles packs={previews} />

      <div className="page-shell pb-12 pt-12 lg:pb-14 lg:pt-14">
        <div className="grid gap-y-8 lg:grid-cols-12 lg:items-end lg:gap-x-12">
          <div className="lg:col-span-7">
            <p className={EYEBROW}>Alumni portal for Indian engineering colleges</p>
            <h1
              id="showcase-title"
              className="mt-5 max-w-[15ch] font-display text-display-xl font-bold text-primary"
            >
              <Headline text={headline} mark="owns" />
            </h1>
          </div>

          <div className="lg:col-span-5 lg:pb-2">
            <p className="text-lg text-secondary">
              One network for your final-year students and alumni, in your college&rsquo;s own name, colours
              and photographs. Every alumni registration is checked against your degree register, and
              ifBash&rsquo;s own admin account has no permission to open a profile or search your directory.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              {links.requestDemo ? (
                <ButtonLink href={links.requestDemo} size="lg" className="min-h-11">
                  Request a demo
                  <ArrowRight className="size-4" aria-hidden="true" />
                </ButtonLink>
              ) : null}
              {links.demoCollege ? (
                <ButtonLink href={links.demoCollege} variant="secondary" size="lg" className="min-h-11">
                  See a demo college
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </ButtonLink>
              ) : null}
            </div>

            <p className="mt-4 text-sm text-secondary">
              The demo college is fictional and runs on sample data.
            </p>
          </div>
        </div>
      </div>

      {/* The stage: the same portal in three brand packs. */}
      <div className="border-y border-line bg-surface-sunken pb-10 pt-8 lg:pb-14 lg:pt-10">
        {/* Says what the frames are before a reader has to work it out, and survives a crop of the stage. */}
        <div className="page-shell mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1.5">
          <p className={EYEBROW}>One product · three colleges</p>
          <p className="text-base text-secondary">The same code in every frame. Only each college&rsquo;s JSON file differs.</p>
        </div>

        <div
          className={cn(
            'snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scroll-padding-inline:clamp(16px,4vw,32px)]',
            'lg:snap-none lg:overflow-visible',
          )}
        >
          <ul
            aria-label="The same portal wearing three colleges’ brand packs"
            className={cn(
              'page-shell flex gap-4 lg:grid lg:grid-cols-3 lg:gap-8',
              // Room after the last frame when the row scrolls on a phone.
              "after:block after:w-px after:shrink-0 after:content-[''] lg:after:hidden",
            )}
          >
            {previews.map((p) => (
              <li
                key={p.id}
                className={cn(
                  // `relative` keeps the caption's sr-only text inside the scroller's clip.
                  'relative w-[84%] max-w-[24rem] shrink-0 snap-start sm:w-[22rem] lg:w-auto lg:max-w-none',
                  p.id === LEAD && 'order-first lg:order-none',
                )}
              >
                <figure className="m-0">
                  <PortalPreview
                    pack={p}
                    host={links.hostFor(p.id)}
                    label={isDemo(p.id) ? 'Demo' : 'Preview'}
                    // Tall enough that every frame's Register / Sign in row sits clear of the fade at its foot.
                    className="h-[37rem]"
                  />
                  <figcaption className="mt-4 flex gap-3">
                    {/* The college's band colour, from its own scoped tokens. */}
                    <span aria-hidden="true" className={cn(`pv-${p.id}`, 'mt-1.5 size-3.5 shrink-0 bg-band')} />
                    <span className="min-w-0">
                      <span className="block font-display text-lg font-bold text-primary">
                        {p.copy.portalName}
                        <span className="sr-only">
                          , a phone-sized preview of its {previewScreen(p) === 'sign-in' ? 'sign-in page' : 'landing page'}
                        </span>
                      </span>
                      <span className="block text-sm text-secondary">
                        {p.copy.institutionName} · {isDemo(p.id) ? 'fictional demo college' : 'our first college'}
                      </span>
                      <span className="mt-1.5 block font-mono text-xs text-secondary">{specLine(p)}</span>
                    </span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </div>

        <div className="page-shell mt-10 grid gap-4 lg:grid-cols-12 lg:gap-12">
          <p className="text-base text-primary lg:col-span-7">
            <span className="font-semibold">Same product, three brand packs.</span> Every colour, typeface,
            corner, photograph and name in these screens comes from one JSON file per college, through the
            same resolver and contrast check the portal itself runs.
            {signInOnly ? (
              <>
                {' '}
                So does the screen each address opens on: {signInOnly.copy.institutionName} has switched its
                public landing page off, so its members start at sign-in.
              </>
            ) : null}
          </p>
          <p className="text-sm text-secondary lg:col-span-5">
            DIET&rsquo;s colours are placeholders until the college sends its official values. Tamarind
            Grove University and Northgate Polytechnic are fictional demonstration colleges; their photographs are
            illustrative.
          </p>
        </div>
      </div>
    </section>
  );
}
