import type { Metadata } from 'next';
import type * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, GraduationCap } from 'lucide-react';
import { getTenantBrand } from '@/lib/tenant';
import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/auth/guard';
import { getPublicEvents, getPublicRegister, pickLeadEvent } from '@/lib/data/public-events';
import { capitalise, joinList, rollNumber } from '@/lib/branding/copy';
import { siteOrigin } from '@/lib/share';
import { yearIn } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ButtonLink } from '@/components/ui';
import { Crest } from '@/components/brand/Crest';
import { HeroMedia } from '@/components/marketing/HeroMedia';
import { BatchCard } from '@/components/marketing/BatchCard';
import { BatchMarquee } from '@/components/marketing/BatchMarquee';
import { EventRows } from '@/components/marketing/EventRows';
import { Announcements } from '@/components/marketing/Announcements';
import { CampusPhotos } from '@/components/marketing/CampusPhotos';
import { GetInvolved } from '@/components/marketing/GetInvolved';
import { CollegeMessage } from '@/components/marketing/CollegeMessage';
import { ShareBand } from '@/components/marketing/ShareBand';
import { QuickLinks } from '@/components/marketing/QuickLinks';
import { Showcase, showcaseMetadata } from '@/components/showcase/Showcase';
import { HOUSE_PACK_ID } from '@/lib/branding/registry';
import type { BrandPack } from '@/lib/branding/pack';

/**
 * The landing page.
 *
 * Written for one reader first: a graduate on a 390px phone who was sent
 * the link in a batch WhatsApp group. The first screen answers three
 * questions — is this really my college's, what is it for, how do I get
 * in — with the college's colour and full name, a warm headline, and
 * Register and Sign in, all above the fold.
 *
 * It must look as deliberate for a college with no photographs (DIET
 * today: a generative band, with aurora, grain, a ribbon of batch years
 * and the year picker as its signature) as for one that supplies a
 * hero photo, a desktop video loop and campus pictures. Every media slot
 * renders nothing when absent.
 *
 * What it will not show, because it is a public page: any count built
 * from member rows — how many have registered, per-batch "joined"
 * figures, event headcounts or capacity. The register's size is the only
 * number, only above a floor, and only when the register is the college's
 * own rather than fixture data standing in for it (`getPublicRegister`).
 * Events come through `getPublicEvents`, whose projection has no counts
 * to leak.
 *
 * All copy that differs between colleges comes from the brand pack.
 */

/** The hero subhead when the pack has none: one clause per feature that is on. */
function composedSubhead(pack: BrandPack): string {
  const { features, copy } = pack;
  const clauses = [
    ...(features.directory ? ['find your batchmates'] : []),
    ...(features.events ? ['come back to campus'] : []),
    ...(features.mentorship ? ['help the final-year students coming up behind you'] : []),
  ];
  return clauses.length ? `${capitalise(joinList(clauses))}.` : `Stay connected to ${copy.institutionName}.`;
}

export async function generateMetadata(): Promise<Metadata> {
  const resolved = await getTenantBrand();
  const pack = resolved?.brand.pack;
  if (!pack) return { title: 'Alumni Portal' };
  if (pack.id === HOUSE_PACK_ID) return showcaseMetadata(pack);

  return {
    title: { absolute: `${pack.copy.portalName} — ${pack.copy.institutionName}` },
    description: pack.copy.heroSubhead ?? composedSubhead(pack),
  };
}

/**
 * Sets the emphasised phrase apart. The pack promises `heroEmphasis`
 * appears inside `heroHeadline`; if a college edits one and not the
 * other, the headline renders plain rather than breaking the page.
 */
function Headline({ text, emphasis, className }: { text: string; emphasis?: string; className: string }) {
  const at = emphasis ? text.indexOf(emphasis) : -1;
  if (!emphasis || at < 0) return <>{text}</>;

  return (
    <>
      {text.slice(0, at)}
      <span className={className}>{emphasis}</span>
      {text.slice(at + emphasis.length)}
    </>
  );
}

export default async function LandingPage() {
  const { brand } = (await getTenantBrand())!;
  const pack = brand.pack;

  // The house tenant's front door is ifBash's product showcase, for colleges shopping for a portal.
  if (pack.id === HOUSE_PACK_ID) return <Showcase pack={pack} />;

  const { copy, features, locale, assets } = pack;

  // A college that has not bought the public surface has no landing page,
  // and the door is the sign-in screen instead.
  if (!features.publicLanding) redirect('/login');

  // Public-safe reads only. The session decides wording and capability
  // gates; nothing here touches a member row.
  const session = await getSession();
  const register = getPublicRegister(pack.id);
  const upcoming = features.events ? getPublicEvents('upcoming') : [];
  const past =
    features.events && !upcoming.length
      ? [...getPublicEvents('past')].sort((a, b) => b.startsAt.localeCompare(a.startsAt)).slice(0, 2)
      : [];
  const lead = features.events ? pickLeadEvent(upcoming) : null;
  const currentYear = yearIn(locale.timeZone);
  const origin = await siteOrigin();

  // From the register, only its years — and its size and range when those
  // are the college's own and worth stating. Never who has registered.
  const years = register.years;
  const firstBatch = register.span?.first ?? null;

  const roll = rollNumber(copy);
  const signedIn = Boolean(session);
  const photo = Boolean(assets.heroImage);
  // An empty register has no chips to show, signed in or out.
  const showCard =
    years.length > 0 && (session ? features.directory && can(session, 'directory.search.alumni') : true);

  const headline = copy.heroHeadline ?? `Welcome back to ${copy.shortName}.`;
  const emphasis = copy.heroEmphasis ?? (copy.heroHeadline ? undefined : copy.shortName);
  const subhead = copy.heroSubhead ?? composedSubhead(pack);

  // Over a photo (lg and up) every line of text goes to band-fg: muted and
  // accent are measured against the solid band, not against a scrim.
  const P = (cls: string) => (photo ? cls : '');

  const leadDate = lead
    ? new Intl.DateTimeFormat(locale.locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: locale.timeZone,
      }).format(new Date(lead.event.startsAt))
    : null;

  const batchCard = (layout: 'column' | 'wide', className?: string) => (
    <BatchCard
      mode={session ? 'directory' : 'register'}
      layout={layout}
      years={years}
      total={register.total}
      branches={register.branches}
      statesRange={register.span !== null}
      currentYear={currentYear}
      copy={copy}
      locale={locale.locale}
      className={className}
    />
  );

  // Entrance order for the hero's children: each takes the next 70ms step.
  const step = (n: number) => ({ '--i': n }) as React.CSSProperties;

  const text = (
    <div className={cn('stagger', photo ? 'lg:w-1/2' : !showCard && 'max-w-3xl')}>
      <div style={step(0)}>
        <Crest pack={pack} size={56} className="mb-5" />
      </div>
      <p className={cn('text-sm font-semibold text-band-accent', P('lg:text-band-fg'))} style={step(1)}>
        {copy.institutionName}
      </p>
      {copy.tagline ? (
        <p className={cn('mt-1 text-sm text-band-muted', P('lg:text-band-fg'))} style={step(1)}>
          {copy.tagline}
        </p>
      ) : null}

      <h1
        id="hero-title"
        className="mt-5 max-w-[15ch] font-display text-display-xl font-bold tracking-tight text-band-fg"
        style={step(2)}
      >
        <Headline
          text={headline}
          emphasis={emphasis}
          className={cn(
            'text-band-accent',
            P(
              'lg:text-band-fg lg:underline lg:decoration-band-accent lg:decoration-[3px] lg:underline-offset-[0.16em]',
            ),
          )}
        />
      </h1>

      <p className={cn('mt-5 max-w-prose text-md text-band-muted', P('lg:text-band-fg'))} style={step(3)}>
        {subhead}
      </p>

      <div className="mt-7 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap" style={step(4)}>
        {signedIn ? (
          <ButtonLink href="/dashboard" variant="band" size="lg" className="col-span-2 min-h-12">
            Go to the portal
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        ) : (
          <>
            <ButtonLink href="/claim" variant="band" size="lg" className="min-h-12">
              Register
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="/login" variant="band-outline" size="lg" className="min-h-12">
              Sign in
            </ButtonLink>
          </>
        )}
      </div>

      {!signedIn ? (
        <p className={cn('mt-4 flex items-start gap-2 text-sm text-band-muted', P('lg:text-band-fg'))} style={step(5)}>
          <GraduationCap className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Final-year student? The placement cell invites you by email — you do not need to register.</span>
        </p>
      ) : null}

      {lead ? (
        <Link
          href={`/campus-events#event-${lead.event.slug}`}
          className="group mt-6 flex min-h-11 max-w-md items-center gap-3 border-t border-band-rule pt-4 lg:mt-8"
          style={step(6)}
        >
          <span className="min-w-0">
            <span
              className={cn(
                'block text-xs font-semibold uppercase tracking-wider text-band-accent',
                P('lg:text-band-fg'),
              )}
            >
              {lead.onCampus ? 'Next on campus' : 'Next up'}
            </span>
            <span className="block truncate text-sm font-medium text-band-fg group-hover:underline">
              {lead.event.title} · {leadDate}
            </span>
          </span>
          <span className="sr-only"> — see the event</span>
          <ArrowRight
            className="ml-auto size-4 shrink-0 transition-transform duration-fast ease-brand group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>
      ) : null}
    </div>
  );

  return (
    <>
      {/* ---------------------------------------------------------- Hero */}
      <section aria-labelledby="hero-title" className="band-surface grain relative isolate overflow-hidden">
        {photo ? <HeroMedia pack={pack} /> : null}
        {/* Light behind the words. Over the desktop photo the scrim owns the contrast, so the aurora steps back. */}
        <div className={cn('aurora', photo && 'lg:hidden')} aria-hidden="true" />
        {!photo ? <BatchMarquee years={years} /> : null}

        <div
          className={cn(
            'page-shell relative z-10 pt-8 lg:pt-20',
            photo
              ? cn(showCard ? 'pb-20 lg:pb-28' : 'pb-12 lg:pb-20', 'lg:flex lg:min-h-[34rem] lg:items-center')
              : cn(
                  years.length ? 'pb-16 lg:pb-32' : 'pb-10 lg:pb-20',
                  showCard && 'lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-12',
                ),
          )}
        >
          {text}
          {!photo && showCard
            ? batchCard('column', 'animate-fade-up mt-8 [animation-delay:420ms] lg:mt-0')
            : null}
        </div>
      </section>

      {photo && showCard ? (
        <section className="page-shell relative z-10 -mt-14 lg:-mt-16" aria-labelledby="batch-title">
          {batchCard('wide', 'animate-fade-up [animation-delay:420ms]')}
        </section>
      ) : null}

      {/* Section numbers are a CSS counter: an absent section does not leave a gap. */}
      <div className="[counter-reset:sec]">
        <EventRows upcoming={upcoming} past={past} shortName={copy.shortName} locale={locale} />
        <Announcements items={copy.announcements} locale={locale} />
        <CampusPhotos photos={assets.campusPhotos} />
        <GetInvolved
          features={features}
          session={session}
          shortName={copy.shortName}
          office={copy.officeName}
          firstBatch={firstBatch}
          rollMid={roll.mid}
        />
        <CollegeMessage message={copy.collegeMessage} />
        <ShareBand
          shareText={copy.shareText}
          origin={origin}
          portalName={copy.portalName}
          institutionName={copy.institutionName}
          rollMid={roll.mid}
        />
        <QuickLinks copy={copy} signedIn={signedIn} rollMid={roll.mid} />
      </div>
    </>
  );
}
