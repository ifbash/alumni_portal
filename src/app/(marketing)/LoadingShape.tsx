'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui';

/**
 * The public surface, in outline, at the size the real page will be.
 *
 * Two shapes, because the public pages open two ways:
 *
 *  - **The landing page** (`/`): the aurora hero with the year picker
 *    beside the headline (below it on a phone, and below the hero on a
 *    college with a photograph), then the numbered sections opened by an
 *    events bento. It is tall and it is what a WhatsApp tap lands on, so
 *    it is drawn closely: the hero's padding, the headline's three lines,
 *    the panel's tile ribbon.
 *  - **Every other public page** (About, Contact, Events, the notices): a
 *    shorter band with an eyebrow, a heading and a paragraph, then
 *    sections of cards.
 *
 * It is a client component only to read the pathname, which a loading
 * boundary has no other way to know. Whether the college has a photograph
 * or a crest comes in as props from `loading.tsx`, which can read the pack.
 *
 * Drawn on the band in the band's own foreground at low strength, so the
 * college's colour is already on screen and nothing flashes white where
 * the hero is about to be. Pulse is opacity only, and the global
 * reduced-motion rule stops it. The header and footer belong to the
 * layout and are not drawn here.
 */

const TONE = {
  faint: 'bg-[color-mix(in_srgb,var(--band-fg)_13%,transparent)]',
  soft: 'bg-[color-mix(in_srgb,var(--band-fg)_20%,transparent)]',
  strong: 'bg-[color-mix(in_srgb,var(--band-fg)_30%,transparent)]',
} as const;

/** A block on the band. */
function Bar({ tone = 'soft', className }: { tone?: keyof typeof TONE; className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded', TONE[tone], className)} />;
}

const TILE =
  'min-h-16 rounded-lg border border-[color-mix(in_srgb,var(--band-fg)_28%,transparent)] bg-[color-mix(in_srgb,var(--band-fg)_7%,transparent)]';

/** The "which year did you pass out?" panel: a heading, a line, the tile ribbon and two footnotes. */
function YearPanel({ wide }: { wide: boolean }) {
  const tiles = Array.from({ length: wide ? 16 : 14 });

  return (
    <div
      aria-hidden="true"
      className={cn(
        'ring-hairline rounded-xl border shadow-lg',
        wide
          ? 'band-exit border-line bg-surface-raised'
          : 'border-[color-mix(in_srgb,var(--band-fg)_24%,transparent)] bg-[color-mix(in_srgb,var(--band-fg)_9%,transparent)]',
      )}
    >
      <div
        className={cn(
          'p-4 sm:p-6',
          wide
            ? 'lg:grid lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-x-10 lg:p-8'
            : 'space-y-4',
        )}
      >
        <div className="space-y-2">
          {wide ? <Skeleton className="h-7 w-3/4" /> : <Bar tone="strong" className="h-7 w-3/4" />}
          {wide ? <Skeleton className="h-4 w-full" /> : <Bar className="h-4 w-full" />}
          {wide ? <Skeleton className="h-4 w-2/3" /> : <Bar tone="faint" className="h-4 w-2/3" />}
        </div>
        {/* Phones: a two-row ribbon with the next column peeking in. From sm: a grid. */}
        <div
          className={cn(
            '-mx-4 mt-4 grid auto-cols-[4.5rem] grid-flow-col grid-rows-2 gap-2 overflow-hidden px-4',
            'sm:mx-0 sm:auto-cols-auto sm:grid-flow-row sm:grid-rows-none sm:px-0',
            wide ? 'sm:grid-cols-7 lg:mt-0 lg:grid-cols-8' : 'sm:grid-cols-6 lg:grid-cols-4',
          )}
        >
          {tiles.map((_, i) =>
            wide ? (
              <Skeleton key={i} className="min-h-16 rounded-lg" />
            ) : (
              <div key={i} className={cn('animate-pulse', TILE)} />
            ),
          )}
        </div>
        {!wide ? (
          <div className="space-y-2 border-t border-band-rule pt-3">
            <Bar tone="faint" className="h-4 w-full" />
            <Bar tone="faint" className="h-4 w-4/5" />
            <Bar tone="faint" className="h-4 w-3/5" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** A section opener: numbered eyebrow, display heading, one line. */
function SectionHeadSkeleton() {
  return (
    <div className="max-w-2xl space-y-3" aria-hidden="true">
      <div className="flex items-center gap-3">
        <Skeleton className="h-3 w-6" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-9 w-4/5 max-w-sm md:h-10" />
      <Skeleton className="h-4 w-full max-w-md" />
    </div>
  );
}

/** The events bento: a lead card led by its date, two compact rows beside it. */
function EventsBento() {
  return (
    <section className="py-10 md:py-section" aria-hidden="true">
      <div className="page-shell">
        <SectionHeadSkeleton />
        <div className="mt-6 grid gap-3 md:mt-10 md:grid-cols-12 md:gap-5">
          <div className="rounded-xl border border-line bg-surface-raised p-5 md:col-span-7 md:row-span-2 md:p-8">
            <div className="flex items-end gap-4">
              <Skeleton className="h-14 w-20 md:h-24 md:w-36" />
              <div className="space-y-2 pb-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3.5 w-20" />
              </div>
            </div>
            <Skeleton className="mt-5 h-7 w-4/5 md:mt-6" />
            <Skeleton className="mt-3 h-4 w-3/5" />
            <div className="mt-4 flex gap-1.5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <Skeleton className="mt-6 h-4 w-28" />
          </div>
          {[0, 1].map((i) => (
            <div
              key={i}
              className={cn(
                'grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 rounded-xl border border-line bg-surface-raised p-5 md:col-span-5',
                i === 1 && 'hidden md:grid',
              )}
            >
              <Skeleton className="h-[4.5rem] rounded-lg" />
              <div className="space-y-2.5">
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-3.5 w-3/5" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The next numbered section: heading, then a row of three cards. */
function CardRowSection() {
  return (
    <section className="py-10 md:py-section" aria-hidden="true">
      <div className="page-shell">
        <SectionHeadSkeleton />
        <div className="mt-6 grid gap-4 md:mt-10 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                'space-y-3 rounded-xl border border-line bg-surface-raised p-5',
                i === 2 && 'hidden md:block',
              )}
            >
              <Skeleton className="size-10 rounded-lg" />
              <Skeleton className="h-5 w-2/5" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LandingShape({ photo, crest }: { photo: boolean; crest: boolean }) {
  return (
    <>
      {/* ------------------------------------------------------------ Hero */}
      <section className="band-surface grain relative isolate overflow-hidden" aria-hidden="true">
        {/* A college with a photograph shows it as a strip above the words on a phone; at lg it fills the hero. */}
        {photo ? (
          <Bar
            tone="faint"
            className="aspect-[5/2] w-full rounded-none sm:aspect-[2/1] lg:hidden"
          />
        ) : null}
        <div className="aurora" />

        <div
          className={cn(
            'page-shell relative z-10 pt-8 lg:pt-20',
            photo
              ? 'pb-20 lg:flex lg:min-h-[34rem] lg:items-center lg:pb-28'
              : 'pb-16 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-12 lg:pb-32',
          )}
        >
          <div className={cn(photo && 'lg:w-1/2')}>
            {crest ? <Bar tone="strong" className="mb-5 size-14 rounded-full" /> : null}
            <Bar tone="strong" className="h-4 w-64 max-w-full" />
            <Bar tone="faint" className="mt-2 h-4 w-40" />

            {/* The headline: two or three lines of display type, set tight. */}
            <div className="mt-5 space-y-1.5">
              <Bar tone="strong" className="h-11 w-[min(100%,20rem)] rounded-md sm:h-14" />
              <Bar tone="strong" className="h-11 w-[min(100%,26rem)] rounded-md sm:h-14" />
            </div>

            <div className="mt-5 max-w-prose space-y-2">
              <Bar className="h-5 w-full" />
              <Bar className="h-5 w-2/3" />
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3 sm:flex">
              <Bar tone="strong" className="min-h-12 rounded-lg sm:w-36" />
              <div className="min-h-12 animate-pulse rounded-lg border border-band-rule sm:w-32" />
            </div>
            <Bar tone="faint" className="mt-4 h-4 w-full max-w-md" />
            {/* The next-event link under a rule. */}
            <div className="mt-6 max-w-md space-y-2 border-t border-band-rule pt-4 lg:mt-8">
              <Bar tone="faint" className="h-3 w-24" />
              <Bar className="h-4 w-3/4" />
            </div>
          </div>

          {/* On the band, beside the headline, unless a photograph has the hero. */}
          {!photo ? <YearPanel wide={false} /> : null}
        </div>
      </section>

      {photo ? (
        <div className="page-shell relative z-10 -mt-14 lg:-mt-16">
          <YearPanel wide />
        </div>
      ) : null}

      <EventsBento />
      <CardRowSection />
    </>
  );
}

function InteriorShape() {
  return (
    <>
      {/* The page band: eyebrow, heading, one paragraph. */}
      <section className="band-surface grain relative isolate overflow-hidden" aria-hidden="true">
        <div className="aurora" />
        <div className="page-shell relative z-10 py-14 lg:py-20">
          <div className="max-w-prose space-y-3">
            <Bar tone="strong" className="h-4 w-44" />
            <Bar tone="strong" className="h-11 w-4/5 max-w-sm rounded-md sm:h-12" />
            <div className="space-y-2 pt-1">
              <Bar className="h-5 w-full" />
              <Bar className="h-5 w-3/5" />
            </div>
          </div>
        </div>
      </section>

      <div className="page-shell space-y-12 py-section" aria-hidden="true">
        <SectionHeadSkeleton />

        <div className="grid gap-6 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-3 rounded-xl border border-line bg-surface-raised p-5">
              <Skeleton className="size-10 rounded-lg" />
              <Skeleton className="h-5 w-2/5" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="flex flex-col gap-4 rounded-xl border border-line bg-surface-raised p-5 sm:flex-row"
            >
              <Skeleton className="h-16 w-full rounded sm:w-20" />
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3.5 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function MarketingLoadingShape({
  photo,
  crest,
  shape,
}: {
  photo: boolean;
  crest: boolean;
  /** Overrides the pathname, for rendering either shape on a page of its own. */
  shape?: 'landing' | 'interior';
}) {
  const pathname = usePathname();
  const landing = shape ? shape === 'landing' : pathname === '/';

  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {landing ? <LandingShape photo={photo} crest={crest} /> : <InteriorShape />}
    </div>
  );
}
