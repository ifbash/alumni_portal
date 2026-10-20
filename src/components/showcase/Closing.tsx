import * as React from 'react';
import { ArrowRight, ArrowUpRight, Check } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { cn } from '@/lib/cn';
import { CELL, EYEBROW, H2, LABEL, SECTION } from './styles';
import { demoMailto, type ShowcaseLinks } from './links';

/**
 * Idea seven, and the close: what it costs, then the one thing to do next.
 * No numbers appear because none are published; the price depends on the
 * college, so the page says so and asks for a conversation.
 */

const PRICES: Array<{ tag: string; title: string; covers: string[] }> = [
  {
    tag: 'Once',
    title: 'Setup',
    covers: ['Your brand pack and preview', 'Degree-register import and checks', 'Your first final-year batch loaded'],
  },
  {
    tag: 'Every year, per college',
    title: 'Subscription',
    covers: ['The portal for your college', 'Every update to it', 'Support for your alumni cell and placement cell'],
  },
];

export function Pricing({ email }: { email: string | undefined }) {
  const talk = email ? demoMailto(email, 'Pricing for our college') : null;

  return (
    <section aria-labelledby="pricing-title" id="pricing" className={SECTION}>
      <div className="page-shell grid gap-x-12 gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className={EYEBROW}>
            <span className="tabular">07</span>
            <span aria-hidden="true"> / </span>
            Pricing
          </p>
          <h2 id="pricing-title" className={`${H2} mt-3`}>
            A setup fee, then a yearly subscription.
          </h2>
          <p className="mt-4 text-lg text-secondary">
            The numbers depend on the size of your college and how it is hosted, so we quote after a conversation, not
            before one.
          </p>
          {talk ? (
            <ButtonLink href={talk} size="lg" className="mt-6 min-h-11">
              Talk to us
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
          {PRICES.map((price) => (
            <article key={price.title} className={cn(CELL, 'reveal')}>
              <p className={LABEL}>{price.tag}</p>
              <h3 className="mt-2 font-display text-display-xs font-bold text-primary">{price.title}</h3>
              {talk ? (
                <a
                  href={talk}
                  className="group mt-3 inline-flex min-h-11 items-center gap-2 font-display text-display-xs font-bold text-brand-fg"
                >
                  <span className="underline decoration-1 underline-offset-[0.18em] group-hover:decoration-2">Talk to us</span>
                  <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
                  <span className="sr-only"> about {price.title.toLowerCase()} pricing</span>
                </a>
              ) : (
                <p className="mt-3 font-display text-display-xs font-bold text-brand-fg">Talk to us</p>
              )}
              <p className="text-sm text-secondary">Quoted for your college</p>
              <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                {price.covers.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-secondary">
                    <Check className="mt-1 size-4 shrink-0 text-accent-fg" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** One batch year, outlined: the portal is organised by the year people passed out. */
function Year({ y }: { y: number }) {
  return (
    <li className="font-display text-[length:calc(var(--display-xl)*1.5)] font-bold leading-none tabular text-transparent [-webkit-text-stroke:1.5px_var(--text-muted)]">
      {y}
    </li>
  );
}

/**
 * The close. The page's one dark field is the hero, so this is the loudest
 * thing the light ground allows: the batch ribbon at the size of a banner,
 * a headline at display scale and one primary action. Light, and a different
 * ground from the section above (sunken, not paper), so it reads as a floor.
 */
export function FinalCta({ links, year }: { links: ShowcaseLinks; year: number }) {
  // Decorative: every year since the first batches the register covers. Read by no one, so hidden from all.
  const years = Array.from({ length: Math.max(1, year - 2013 + 1) }, (_, i) => year - i);

  return (
    <section aria-labelledby="final-cta-title" className="overflow-hidden border-t border-line bg-surface-sunken">
      <div aria-hidden="true" className="marquee pt-8 [--marquee-gap:3rem] [--marquee-dur:60s] lg:pt-10">
        <div className="marquee-track">
          <ul className="flex shrink-0 gap-12">
            {years.map((y) => (
              <Year key={y} y={y} />
            ))}
          </ul>
          <ul className="flex shrink-0 gap-12">
            {years.map((y) => (
              <Year key={y} y={y} />
            ))}
          </ul>
        </div>
      </div>

      <div className="page-shell py-8 lg:py-10">
        <p className={EYEBROW}>Next step</p>
        <h2
          id="final-cta-title"
          className="mt-3 font-display text-display-lg font-bold text-primary"
        >
          See the portal in your college&rsquo;s colours.
        </h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-12 lg:items-center lg:gap-16">
          <p className="text-lg text-secondary lg:col-span-7">
            Send us your college&rsquo;s name, crest and colours. We will write its brand pack and show you your own
            portal on the call.
          </p>
          <div className="flex flex-wrap gap-3 lg:col-span-5 lg:justify-end">
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
        </div>
      </div>
    </section>
  );
}
