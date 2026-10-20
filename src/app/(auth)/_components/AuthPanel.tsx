import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { BrandPack } from '@/lib/branding/pack';
import { capitalise } from '@/lib/branding/copy';
import { Crest } from '@/components/brand/Crest';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/cn';

/**
 * The college half of the sign-in frame: the desktop panel and the phone
 * strip. Server components, no state.
 *
 * Both sit on the college band, which is the same colour in light and dark
 * mode. With a photograph (`authImage`, else `heroImage`) the panel is the
 * photo and the words move onto a scrim caption card; without one the panel
 * is the designed state, not a gap: aurora and grain on the band, and the
 * batch ribbon, a stack of large year numerals. The ribbon is the product's
 * idea in one picture (the network is organised by year of passing), it is
 * decoration only, and it carries no claim about the college.
 *
 * The panel and the strip hold no heading: the page supplies the only h1.
 */

type Props = {
  pack: BrandPack;
  /** Whether `/` is a public landing; with it off, nothing here may link home. */
  home: boolean;
  photo?: string;
  focus?: string;
  /** The calendar year in the college's time zone, for the ribbon. */
  year: number;
};

const WELCOME =
  'Find your batchmates, come back to campus, and help the students coming up behind you.';

/** Stagger index for the entrance; see `.stagger` in globals.css. */
const at = (n: number) => ({ '--i': n }) as React.CSSProperties;

function HomeLogo({ pack, home, height }: { pack: BrandPack; home: boolean; height: number }) {
  return home ? (
    <Link
      href="/"
      aria-label={`${pack.copy.portalName} — home`}
      className="inline-flex min-h-11 items-center self-start"
    >
      <Logo pack={pack} variant="band" height={height} />
    </Link>
  ) : (
    <div className="inline-flex min-h-11 items-center self-start">
      <Logo pack={pack} variant="band" height={height} />
    </div>
  );
}

/** Three years, the newest filled in the accent and the rest fading out. Decoration. */
function BatchRibbon({ year }: { year: number }) {
  const rows = [
    { y: year, cls: 'text-band-accent', pad: '' },
    {
      y: year - 1,
      cls: 'text-transparent [-webkit-text-stroke:1.5px_color-mix(in_srgb,var(--band-fg)_42%,transparent)]',
      pad: 'ml-[14%]',
    },
    {
      y: year - 2,
      cls: 'text-transparent [-webkit-text-stroke:1.5px_color-mix(in_srgb,var(--band-fg)_22%,transparent)]',
      pad: 'ml-[28%]',
    },
  ];
  return (
    <div
      aria-hidden="true"
      className="stagger relative z-[2] flex min-h-0 flex-1 select-none flex-col justify-center overflow-hidden [@media(max-height:720px)]:hidden"
    >
      {rows.map((r, i) => (
        <p
          key={r.y}
          style={at(3 + i)}
          className={cn(
            'font-display font-bold leading-[0.86] tracking-tight tabular',
            'text-[clamp(3.5rem,min(7.5vw,10vh),7.5rem)]',
            r.cls,
            r.pad,
          )}
        >
          {r.y}
        </p>
      ))}
    </div>
  );
}

export function AuthPanel({ pack, home, photo, focus, year }: Props) {
  const { copy } = pack;
  const office = copy.officeName;
  const address = copy.addressLines.filter((line) => line !== copy.institutionName).join(', ');

  if (photo) {
    return (
      <div className="relative isolate flex h-full flex-col justify-end overflow-hidden p-10 xl:p-12">
        {/*
          Tenant-supplied, arbitrary host: see next.config.ts on why brand
          imagery bypasses the optimiser. Decorative: the caption card names
          the college.
        */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-10 size-full animate-fade-in object-cover"
          style={{ objectPosition: focus }}
        />

        {/* Text never sits on the photo itself: only on the audited scrim,
            and only in band-fg. */}
        <div className="stagger max-w-md space-y-4 rounded-lg border border-band-rule bg-scrim p-8 shadow-lg backdrop-blur-md">
          <div style={at(0)} className="flex flex-wrap items-center gap-4">
            <Crest pack={pack} size={48} />
            <HomeLogo pack={pack} home={home} height={28} />
          </div>
          <p
            style={at(2)}
            className="font-display text-display-sm font-bold text-band-fg"
          >
            {copy.institutionName}
          </p>
          {copy.tagline ? (
            <p style={at(3)} className="text-md text-band-fg">
              {copy.tagline}
            </p>
          ) : null}
          <p style={at(4)} className="text-md text-band-fg">
            {WELCOME}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="band-surface grain relative isolate flex h-full flex-col overflow-hidden p-10 xl:p-14">
      <div className="aurora" aria-hidden="true" />

      <div className="stagger relative z-[2] flex items-center gap-4">
        <div style={at(0)} className="flex items-center gap-4">
          <Crest pack={pack} size={56} />
          <HomeLogo pack={pack} home={home} height={30} />
        </div>
      </div>

      <BatchRibbon year={year} />

      <div className="stagger relative z-[2] mt-6 max-w-md space-y-4">
        <p style={at(5)} className="eyebrow text-band-accent">
          {copy.portalName}
        </p>
        <p
          style={at(6)}
          className="font-display text-display-sm font-bold text-band-fg"
        >
          {copy.institutionName}
        </p>
        {copy.tagline ? (
          <p style={at(7)} className="text-md text-band-muted">
            {copy.tagline}
          </p>
        ) : null}
        {copy.affiliationLine ? (
          <p style={at(7)} className="text-sm text-band-muted">
            {copy.affiliationLine}
          </p>
        ) : null}
        <span style={at(8)} aria-hidden="true" className="block h-px w-16 bg-band-accent" />
        <p style={at(8)} className="text-md text-band-fg">
          {WELCOME}
        </p>
        {address ? (
          <p style={at(9)} className="text-sm text-band-muted">
            {address}
          </p>
        ) : null}
        {copy.supportEmail ? (
          <p style={at(9)} className="text-sm text-band-fg">
            {capitalise(office)} ·{' '}
            <a className="underline underline-offset-4" href={`mailto:${copy.supportEmail}`}>
              {copy.supportEmail}
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The phone identity strip: a short band at the top of the form column.
 * The full institution name, never truncated. A photo tenant gets its
 * photograph behind a full scrim; everyone else gets aurora and grain.
 */
export function AuthStrip({ pack, home, photo, focus }: Omit<Props, 'year'>) {
  const { copy } = pack;

  const body = (
    <>
      {home ? <ChevronLeft className="size-4 shrink-0" aria-hidden="true" /> : null}
      <Crest pack={pack} size={40} />
      <span className="min-w-0">
        <span className="block font-display text-lg font-semibold leading-snug text-band-fg">
          {copy.institutionName}
        </span>
        <span className="eyebrow mt-0.5 text-band-accent">{copy.portalName}</span>
      </span>
      {home ? <span className="sr-only"> — back to the home page</span> : null}
    </>
  );
  const cls = 'relative z-[2] flex min-h-20 items-center gap-3 px-4 py-4 sm:px-8';

  return (
    <div className="band-surface grain relative isolate overflow-hidden lg:hidden">
      {photo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 -z-10 size-full object-cover"
            style={{ objectPosition: focus }}
          />
          <div className="absolute inset-0 -z-10 bg-scrim" aria-hidden="true" />
        </>
      ) : (
        <div className="aurora" aria-hidden="true" />
      )}
      {home ? (
        <Link href="/" className={cls}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </div>
  );
}
