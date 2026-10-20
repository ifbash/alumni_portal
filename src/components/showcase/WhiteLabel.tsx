import * as React from 'react';
import { Scribble } from '@/components/brand/Marks';
import type { BrandPack } from '@/lib/branding/pack';
import { PackExcerpt } from './PackExcerpt';
import { NUMERAL, SECTION } from './styles';
import { SectionHead } from './parts';

/**
 * Idea two: the identity is data. One JSON file in, a whole design system
 * out. The centrepiece is the real pack of the demo college and what the
 * resolver derived from it; the five rows under it say what else lives in
 * that one file.
 */

const POINTS: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: 'One file per college',
    body: 'Name, colours, typefaces, crest, photographs, wording and modules. Adding a college touches no screen, component or stylesheet.',
  },
  {
    title: 'Seeds in, design system out',
    body: 'You give the colours from your style guide. Hover states, tints, dark mode and every text pairing are derived.',
  },
  {
    title: 'A contrast gate',
    body: (
      <>
        <code className="font-mono text-sm text-primary">npm run brand:check</code> audits every pack. A pack whose text
        would be hard to read cannot be published.
      </>
    ),
  },
  {
    title: 'Photographs and video',
    body: 'A campus photograph, a short silent loop on desktop, a gallery. No photographs yet: a solid band in your colour.',
  },
  {
    title: 'Modules as switches',
    body: 'Jobs, events, mentorship, news, gallery and giving. Giving stays off until your FCRA status is confirmed.',
  },
];

export function WhiteLabel({ example, audited }: { example: BrandPack | undefined; audited: BrandPack[] }) {
  return (
    <section aria-labelledby="white-label-title" id="white-label" className={SECTION}>
      <div className="page-shell">
        <SectionHead
          id="white-label-title"
          n="02"
          eyebrow="White label"
          title={
            <>
              Your college,{' '}
              <span className="relative inline-block">
                not ours.
                <Scribble className="absolute -bottom-[0.1em] left-0 h-[0.2em] w-full" />
              </span>
            </>
          }
        >
          <p>
            Members see your name, crest, colours and photographs. ifBash appears only in a &ldquo;Powered by&rdquo;
            line, itself a field in your file, and on the privacy page.
          </p>
        </SectionHead>

        {example ? (
          <div className="reveal-scale mt-8">
            <PackExcerpt pack={example} audited={audited} />
          </div>
        ) : null}

        <ol className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-5">
          {POINTS.map((item, i) => (
            <li key={item.title} className="reveal border-t border-line-strong pt-4">
              <h3 className="flex items-baseline gap-2.5 font-body text-base font-semibold tracking-normal text-primary">
                <span className={`${NUMERAL} text-base`}>{String(i + 1).padStart(2, '0')}</span>
                {item.title}
              </h3>
              <p className="mt-1.5 text-sm text-secondary">{item.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
