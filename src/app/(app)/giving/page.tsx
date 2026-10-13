import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight, Briefcase, CalendarDays, Globe2, GraduationCap, Heart, Receipt, UserRound } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getCampaigns } from '@/lib/data/repo';
import type { DonationCampaign } from '@/lib/data/types';
import {
  Badge,
  ButtonLink,
  Card,
  CoverArt,
  Disclosure,
  EmptyState,
  MediaFrame,
  Progress,
  Section,
  TrustChip,
} from '@/components/ui';
import { BandChip, PageBand } from '@/components/brand/PageBand';
import { capitalise } from '@/lib/branding/copy';
import { pickBandPhoto } from '@/lib/branding/media';
import { canOpen } from '@/lib/navigation';
import { daysUntil, formatCompactINR, formatDate, formatNumber, formatPercent } from '@/lib/format';

/**
 * Metadata has to be gated too.
 *
 * A static `metadata` export runs whether or not the page below calls
 * `notFound()`, so a college that has not bought the donations module —
 * or has not confirmed FCRA registration, which is why it is off by
 * default — was still shipping `<title>Giving · DIET Connect</title>` and
 * a meta description naming 80G receipts and foreign contributions. A
 * student saw the module named in their browser tab; a crawler indexed a
 * description of something that does not exist here.
 */
export async function generateMetadata(): Promise<Metadata> {
  const resolved = await getTenantBrand();
  if (!resolved?.brand.pack.features.donations) return { title: 'Not found' };

  return {
    title: 'Giving',
    description: `Back the next thing ${resolved.brand.pack.copy.shortName} builds.`,
  };
}

/** Soonest closing first; open-ended campaigns after every dated one. */
function bySoonest(a: DonationCampaign, b: DonationCampaign): number {
  if (a.endsOn && b.endsOn) return a.endsOn.localeCompare(b.endsOn);
  if (a.endsOn) return -1;
  if (b.endsOn) return 1;
  return a.title.localeCompare(b.title);
}

export default async function GivingPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const { tenant, brand } = (await getTenantBrand())!;

  // Three gates, checked independently and in this order.
  //
  //  1. The module is a purchase *and* a legal clearance. With
  //     `features.donations` off — which is how the DIET pack ships until
  //     the college confirms FCRA registration — this route does not
  //     exist. That is intended, not a bug in the demo.
  if (!brand.pack.features.donations) notFound();

  //  2. Students never see the donations module. Not hidden, not disabled:
  //     absent. Asking a final-year for money on the portal that is meant
  //     to help them find work poisons the whole product, and no
  //     capability grant may override it.
  if (session.roles.some((r) => r.role === 'student')) notFound();

  //  3. And only then, the capability.
  requireCap(session, 'donation.give');

  const campaigns = getCampaigns();
  const pack = brand.pack;
  const { shortName, officeName } = pack.copy;
  const tz = pack.locale.timeZone;
  const timing = { locale: pack.locale.locale, timeZone: tz };

  const open = campaigns.filter((c) => c.active).sort(bySoonest);
  const past = campaigns.filter((c) => !c.active).sort((a, b) => (b.endsOn ?? '').localeCompare(a.endsOn ?? ''));
  const featured = open[0] ?? null;
  const others = open.slice(1);

  // Money raised is a sum that means something. Donors counted per
  // campaign double-count anyone who gave twice, so no total of them.
  const totalRaised = campaigns.reduce((n, c) => n + c.raised, 0);
  const canManage = can(session, 'donation.campaign.manage');

  const ways = [
    canOpen(session, pack, '/mentorship')
      ? {
          href: '/mentorship',
          icon: <GraduationCap className="size-5" />,
          title: 'Mentor a final-year student',
          line: 'Answer a question from someone sitting the papers you sat.',
        }
      : null,
    canOpen(session, pack, '/jobs') && can(session, 'job.post')
      ? {
          href: '/jobs/new',
          icon: <Briefcase className="size-5" />,
          title: 'Post a job',
          line: `Put a role at your company in front of ${shortName} final-years.`,
        }
      : null,
    canOpen(session, pack, '/events')
      ? {
          href: '/events',
          icon: <CalendarDays className="size-5" />,
          title: 'Come to an event',
          line: 'Meet your batch and the students coming up behind it.',
        }
      : null,
  ].filter((w): w is NonNullable<typeof w> => w !== null);

  return (
    <div className="space-y-8">
      <PageBand
        pack={pack}
        photo={pickBandPhoto(pack, 'giving')}
        eyebrow={`${shortName} alumni giving`}
        title={`Give back to ${shortName}`}
        lead="Back something specific at your college, and see what earlier gifts built."
        meta={
          totalRaised > 0 ? (
            <BandChip icon={<Heart />}>
              {formatCompactINR(totalRaised)} raised across {campaigns.length}{' '}
              {campaigns.length === 1 ? 'campaign' : 'campaigns'}
            </BandChip>
          ) : null
        }
        actions={
          <>
            {featured ? (
              <ButtonLink
                href={`/giving/${featured.slug}`}
                variant="band"
                className="h-auto min-h-11 whitespace-normal py-2 text-left"
              >
                Give to {featured.title}
              </ButtonLink>
            ) : null}
            {past.length > 0 ? (
              <ButtonLink href="#impact" variant="band-outline" className="min-h-11">
                See what alumni have funded
              </ButtonLink>
            ) : null}
            {canManage ? (
              <ButtonLink href="/admin/giving" variant="band-outline" className="min-h-11">
                Manage campaigns
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {!tenant.fcraRegistered ? (
        <Disclosure
          summary={
            <span className="flex items-start gap-2">
              <Globe2 className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
              <span>
                Giving from outside India? {shortName} cannot accept foreign contributions yet.
              </span>
            </span>
          }
        >
          <div className="space-y-2">
            <p>
              {shortName} has not confirmed FCRA registration for the trust. Until it does, a contribution from a
              source outside India will be refused at the point of collection rather than accepted and sorted out
              later — under the Foreign Contribution (Regulation) Act, taking it first and asking afterwards is the
              offence.
            </p>
            <p>If you are giving from abroad, the donate form will tell you before you enter an amount.</p>
          </div>
        </Disclosure>
      ) : null}

      {featured ? (
        <FeaturedCampaign campaign={featured} tz={tz} />
      ) : (
        <EmptyState
          icon={<Heart className="size-5" />}
          title={`The ${officeName} has not opened a campaign yet.`}
          description={ways.length ? 'There are other ways to give back below.' : undefined}
        />
      )}

      {featured ? (
        <ul className="flex flex-wrap gap-2" aria-label="How giving works here">
          {pack.copy.donationReceiptNote ? (
            <li>
              <TrustChip icon={<Receipt />}>{pack.copy.donationReceiptNote}</TrustChip>
            </li>
          ) : null}
          <li>
            <TrustChip icon={<UserRound />}>Give in your own name or anonymously</TrustChip>
          </li>
        </ul>
      ) : null}

      {others.length > 0 ? (
        <Section title="Also open">
          <ul className="grid grid-cols-1 gap-gutter md:grid-cols-2">
            {others.map((c) => (
              <li key={c.id} className="min-w-0">
                <OpenCampaignCard campaign={c} tz={tz} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {past.length > 0 ? (
        <Section id="impact" className="scroll-mt-20" title="What alumni giving has built">
          <ul className="grid grid-cols-1 gap-gutter md:grid-cols-2">
            {past.map((c) => (
              <li key={c.id} className="min-w-0">
                <OutcomeCard campaign={c} timing={timing} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {ways.length > 0 ? (
        <Section title="Other ways to give back">
          <ul className="grid grid-cols-1 gap-gutter md:grid-cols-3">
            {ways.map((w) => (
              <li key={w.href} className="min-w-0">
                <Card interactive className="relative flex h-full items-start gap-3 p-card">
                  <span className="grid size-10 shrink-0 place-items-center rounded bg-brand-soft text-brand-soft-fg" aria-hidden="true">
                    {w.icon}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <h3 className="font-display text-md font-semibold">
                      <Link href={w.href} className="link-quiet after:absolute after:inset-0 after:rounded-lg">
                        {w.title}
                      </Link>
                    </h3>
                    <p className="text-sm text-secondary">{w.line}</p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {!featured && canManage ? (
        <p className="text-sm text-secondary">
          {capitalise(officeName)} staff open campaigns from the{' '}
          <Link href="/admin/giving" className="link">
            staff console
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------

function progressOf(c: DonationCampaign) {
  const pct = c.target ? c.raised / c.target : null;
  return { pct, funded: c.target !== null && c.raised >= c.target };
}

function daysLeftLabel(endsOn: string | null, tz: string): string | null {
  if (!endsOn) return null;
  const n = daysUntil(endsOn, tz);
  if (n < 0) return null;
  return n === 0 ? 'Closes today' : n === 1 ? '1 day left' : `${n} days left`;
}

/** The campaign's own image, else one real figure. Never a campus photo. */
function CampaignArt({ campaign, aspect }: { campaign: DonationCampaign; aspect: '16/9' | '21/9' }) {
  const { pct } = progressOf(campaign);
  const motif =
    campaign.donorCount > 0 && pct !== null
      ? formatPercent(Math.min(pct, 9.99))
      : campaign.target
        ? formatCompactINR(campaign.target)
        : formatCompactINR(campaign.raised);
  const label =
    campaign.donorCount > 0 && pct !== null
      ? `of ${formatCompactINR(campaign.target!)}`
      : campaign.target
        ? 'to raise'
        : 'raised';
  return (
    <MediaFrame
      src={campaign.coverImage}
      alt=""
      aspect={aspect}
      fallback={<CoverArt motif={motif} label={label} />}
    />
  );
}

function FeaturedCampaign({ campaign, tz }: { campaign: DonationCampaign; tz: string }) {
  const { pct, funded } = progressOf(campaign);
  const left = daysLeftLabel(campaign.endsOn, tz);
  const first = campaign.donorCount === 0;

  return (
    <Card as="section" aria-labelledby="featured-campaign" className="grid grid-cols-1 gap-5 p-card md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-center lg:gap-8">
      <CampaignArt campaign={campaign} aspect="16/9" />

      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">Open now</Badge>
          {left ? <Badge tone={daysUntil(campaign.endsOn!, tz) <= 14 ? 'warning' : 'neutral'}>{left}</Badge> : null}
          {funded ? <Badge tone="success">Target met</Badge> : null}
        </div>
        <div className="space-y-2">
          <h2 id="featured-campaign" className="font-display text-xl font-semibold">
            <Link href={`/giving/${campaign.slug}`} className="link-quiet">
              {campaign.title}
            </Link>
          </h2>
          {campaign.description ? <p className="max-w-prose text-md text-secondary">{campaign.description}</p> : null}
        </div>

        {first ? (
          <p className="font-display text-lg font-semibold">Be the first to give</p>
        ) : (
          <div className="space-y-2">
            <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-secondary">
              <span className="font-display text-xl font-bold tabular text-primary">{formatCompactINR(campaign.raised)}</span>
              {campaign.target ? <span>of {formatCompactINR(campaign.target)}</span> : <span>raised</span>}
              {pct !== null ? <span className="tabular">· {formatPercent(pct)}</span> : null}
            </p>
            {campaign.target ? (
              <Progress
                value={campaign.raised}
                max={campaign.target}
                tone={funded ? 'success' : 'brand'}
                label={`${campaign.title}: ${formatCompactINR(campaign.raised)} raised of ${formatCompactINR(campaign.target)}`}
              />
            ) : null}
            <p className="text-sm text-secondary">
              {formatNumber(campaign.donorCount)} alumni and staff have given
            </p>
          </div>
        )}

        <ButtonLink href={`/giving/${campaign.slug}`} size="lg" className="min-h-11">
          Give
        </ButtonLink>
      </div>
    </Card>
  );
}

function OpenCampaignCard({ campaign, tz }: { campaign: DonationCampaign; tz: string }) {
  const { pct, funded } = progressOf(campaign);
  const left = daysLeftLabel(campaign.endsOn, tz);

  return (
    <Card as="article" interactive className="relative flex h-full flex-col gap-3 p-card">
      <h3 className="font-display text-md font-semibold leading-snug">
        <Link href={`/giving/${campaign.slug}`} className="link-quiet after:absolute after:inset-0 after:rounded-lg">
          {campaign.title}
        </Link>
      </h3>
      {campaign.description ? <p className="line-clamp-2 text-sm text-secondary">{campaign.description}</p> : null}
      <div className="mt-auto space-y-2">
        {campaign.donorCount === 0 ? (
          <p className="text-sm font-medium">Be the first to give</p>
        ) : (
          <>
            <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-secondary">
              <span className="font-semibold tabular text-primary">{formatCompactINR(campaign.raised)}</span>
              {campaign.target ? <span>of {formatCompactINR(campaign.target)}</span> : <span>raised</span>}
              {pct !== null ? <span className="tabular">· {formatPercent(pct)}</span> : null}
            </p>
            {campaign.target ? (
              <Progress value={campaign.raised} max={campaign.target} tone={funded ? 'success' : 'brand'} label={`${campaign.title}: ${formatPercent(pct ?? 0)} raised`} />
            ) : null}
          </>
        )}
        <p className="flex items-center justify-between gap-2 text-sm text-secondary">
          <span>{left ?? 'Open until the target is met'}</span>
          <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
        </p>
      </div>
    </Card>
  );
}

function OutcomeCard({
  campaign,
  timing,
}: {
  campaign: DonationCampaign;
  timing: { locale: string; timeZone: string };
}) {
  const { funded } = progressOf(campaign);

  return (
    <Card as="article" interactive className="relative flex h-full flex-col gap-3 p-card">
      <div className="flex flex-wrap items-center gap-2">
        {funded ? <Badge tone="success">Target met</Badge> : <Badge tone="neutral">Closed</Badge>}
      </div>
      <h3 className="font-display text-md font-semibold leading-snug">{campaign.title}</h3>
      {campaign.description ? <p className="line-clamp-2 text-sm text-secondary">{campaign.description}</p> : null}
      <dl className="mt-auto grid grid-cols-3 gap-3 border-t border-line pt-3 text-sm">
        <div className="min-w-0">
          <dt className="text-secondary">Raised</dt>
          <dd className="font-semibold tabular">{formatCompactINR(campaign.raised)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-secondary">Donors</dt>
          <dd className="font-semibold tabular">{formatNumber(campaign.donorCount)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-secondary">Closed</dt>
          <dd className="font-semibold">{formatDate(campaign.endsOn, timing)}</dd>
        </div>
      </dl>
      <Link
        href={`/giving/${campaign.slug}`}
        className="link inline-flex min-h-11 items-center gap-1.5 text-sm font-medium after:absolute after:inset-0 after:rounded-lg"
      >
        See the result
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </Card>
  );
}
