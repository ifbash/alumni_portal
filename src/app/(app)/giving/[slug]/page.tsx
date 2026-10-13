import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getCampaigns, getOwnProfile } from '@/lib/data/repo';
import type { DonationCampaign } from '@/lib/data/types';
import {
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  CoverArt,
  MediaFrame,
  Progress,
  Section,
  StickyActionBar,
} from '@/components/ui';
import { receiptLabel } from '@/lib/branding/copy';
import { canOpen } from '@/lib/navigation';
import { daysUntil, formatCompactINR, formatCurrency, formatDate, formatNumber, formatPercent } from '@/lib/format';
import { firstNameOf } from '@/lib/identity';
import { siteOrigin, whatsappShareUrl } from '@/lib/share';
import { campaignShareText } from '@/lib/share-text';
import { DonateForm } from './DonateForm';

/**
 * The same gates as the index page's metadata, plus the student gate the
 * page itself applies: a student's browser tab must not name a campaign
 * on a module that is absent for them. Display narrowing only; the page
 * below still enforces every gate on its own.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const resolved = await getTenantBrand();
  if (!resolved?.brand.pack.features.donations) return { title: 'Not found' };
  const session = await getSession();
  if (session?.roles.some((r) => r.role === 'student')) return { title: 'Not found' };

  const { slug } = await params;
  const campaign = getCampaigns().find((c) => c.slug === slug);
  if (!campaign) return { title: 'Campaign not found' };
  return {
    title: campaign.title,
    description: campaign.description ?? undefined,
  };
}

export default async function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { tenant, brand } = (await getTenantBrand())!;

  // The same three gates as the index, repeated here rather than inherited.
  // A detail route reachable because someone was sent the link is exactly
  // how a gated module leaks.
  if (!brand.pack.features.donations) notFound();
  if (session.roles.some((r) => r.role === 'student')) notFound();
  requireCap(session, 'donation.give');

  const { slug } = await params;
  const campaign = getCampaigns().find((c) => c.slug === slug);
  if (!campaign) notFound();

  const me = getOwnProfile(session);

  const pack = brand.pack;
  const tz = pack.locale.timeZone;
  const timing = { locale: pack.locale.locale, timeZone: tz };

  const { title, description, target, raised, donorCount, startsOn, endsOn, active } = campaign;
  const left = endsOn ? daysUntil(endsOn, tz) : null;
  const funded = target !== null && raised >= target;
  const pct = target ? raised / target : null;
  const remaining = target ? Math.max(0, target - raised) : null;
  const averageGift = donorCount > 0 ? Math.round(raised / donorCount) : null;
  const first = donorCount === 0;

  const url = `${await siteOrigin()}/giving/${campaign.slug}`;
  const whatsappHref = whatsappShareUrl(campaignShareText(pack, campaign), url);
  const otherOpen = getCampaigns().filter((c) => c.active && c.id !== campaign.id);

  // Figures that say something. None at 0: a campaign nobody has given to
  // yet says so in words instead.
  const figures: Array<{ label: string; value: string }> = [];
  if (donorCount > 0) figures.push({ label: 'Donors', value: formatNumber(donorCount) });
  if (averageGift) figures.push({ label: 'Average gift', value: formatCurrency(averageGift) });
  if (target !== null && donorCount > 0) {
    figures.push(
      funded
        ? { label: 'Over target by', value: formatCompactINR(raised - target) }
        : { label: 'Still needed', value: formatCompactINR(remaining ?? 0) },
    );
  }
  if (active) {
    figures.push({
      label: 'Time left',
      value: left === null ? 'Open-ended' : left <= 0 ? 'Closes today' : `${left} day${left === 1 ? '' : 's'}`,
    });
  } else if (endsOn) {
    figures.push({ label: 'Closed', value: formatDate(endsOn, timing) });
  }

  const motif = !first && pct !== null ? formatPercent(Math.min(pct, 9.99)) : formatCompactINR(target ?? raised);
  const motifLabel = !first && pct !== null ? `of ${formatCompactINR(target!)}` : target ? 'to raise' : 'raised';

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Giving', href: '/giving' }, { label: title }]} />

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          {/* The campaign's own photo leads at full width. Without one, the
              figure tile sits beside the title instead of a wide empty band. */}
          {campaign.coverImage ? (
            <MediaFrame src={campaign.coverImage} alt="" aspect="21/9" loading="eager" />
          ) : null}

          <div
            className={
              campaign.coverImage ? undefined : 'grid grid-cols-1 gap-5 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-center'
            }
          >
            {campaign.coverImage ? null : (
              <MediaFrame aspect="16/9" fallback={<CoverArt motif={motif} label={motifLabel} />} />
            )}
            <header className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {active ? <Badge tone="brand">Open</Badge> : <Badge tone="neutral">Closed</Badge>}
                {funded ? <Badge tone="success">Target met</Badge> : null}
                {active && left !== null && left >= 0 && left <= 14 ? (
                  <Badge tone="warning">{left === 0 ? 'Closes today' : `${left} day${left === 1 ? '' : 's'} left`}</Badge>
                ) : null}
              </div>
              <h1 className="font-display text-display-xs font-bold">{title}</h1>
              {description ? <p className="max-w-prose text-md text-secondary">{description}</p> : null}
              <p className="text-sm text-secondary">
                {startsOn ? `Opened ${formatDate(startsOn, timing)}` : null}
                {startsOn && endsOn ? ' · ' : null}
                {endsOn ? `${active ? 'closes' : 'closed'} ${formatDate(endsOn, timing)}` : null}
              </p>
            </header>
          </div>

          <Card>
            <CardBody className="space-y-4">
              {first && active ? (
                <div className="space-y-1">
                  <p className="font-display text-xl font-semibold">Be the first to give</p>
                  {target ? (
                    <p className="text-sm text-secondary">
                      The target is <span className="font-semibold tabular text-primary">{formatCompactINR(target)}</span>.
                    </p>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-sm text-secondary">
                      <span className="font-display text-display-xs font-bold tabular text-primary">{formatCompactINR(raised)}</span>{' '}
                      raised
                      {target ? (
                        <>
                          {' '}
                          of <span className="font-semibold tabular text-primary">{formatCompactINR(target)}</span>
                        </>
                      ) : null}
                    </p>
                    {pct !== null ? (
                      <p className="font-display text-xl font-semibold tabular text-brand-fg">{formatPercent(pct)}</p>
                    ) : null}
                  </div>
                  {target ? (
                    <Progress
                      value={raised}
                      max={target}
                      tone={funded ? 'success' : 'brand'}
                      label={`${title}: ${formatCompactINR(raised)} raised of ${formatCompactINR(target)}`}
                    />
                  ) : null}
                </>
              )}

              {figures.length > 0 ? (
                <dl className="grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
                  {figures.map((f) => (
                    <div key={f.label} className="min-w-0 space-y-0.5">
                      <dt className="text-sm text-secondary">{f.label}</dt>
                      <dd className="font-display text-lg font-semibold tabular">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </CardBody>
          </Card>
        </div>

        <aside
          id="give"
          aria-label="Give to this campaign"
          className="min-w-0 scroll-mt-20 lg:sticky lg:top-20 lg:self-start"
        >
          {active ? (
            <DonateForm
              campaignTitle={title}
              shortName={pack.copy.shortName}
              officeName={pack.copy.officeName}
              fcraRegistered={tenant.fcraRegistered}
              defaultCountry={me?.country ?? 'IN'}
              donorName={me?.fullName ?? 'You'}
              donorFirstName={me ? firstNameOf(me.fullName, me.preferredName) : 'friend'}
              locale={pack.locale.locale}
              currency={pack.locale.currency}
              supportEmail={pack.copy.supportEmail ?? null}
              averageGift={averageGift}
              receiptLabel={receiptLabel(pack.copy)}
              shareUrl={url}
              whatsappHref={whatsappHref}
              mentorHref={canOpen(session, pack, '/mentorship') ? '/mentorship' : null}
              postJobHref={canOpen(session, pack, '/jobs') && can(session, 'job.post') ? '/jobs/new' : null}
            />
          ) : (
            <Card as="section" aria-labelledby="closed-title">
              <CardHeader variant="stack">
                <CardTitle as="h2" id="closed-title">
                  {funded ? 'Target met' : 'This campaign has closed'}
                </CardTitle>
                <CardDescription>
                  It closed{endsOn ? ` on ${formatDate(endsOn, timing)}` : ''} having raised{' '}
                  {nb(formatCompactINR(raised))} from {formatNumber(donorCount)} alumni and staff
                  {target ? `, against a ${nb(formatCompactINR(target))} target` : ''}.
                </CardDescription>
              </CardHeader>
              <CardBody>
                <ButtonLink href="/giving" variant="secondary" className="min-h-11 w-full">
                  See open campaigns
                </ButtonLink>
              </CardBody>
            </Card>
          )}
        </aside>
      </div>

      {!active && otherOpen.length > 0 ? (
        <Section title="Open now">
          <ul className="grid grid-cols-1 gap-gutter md:grid-cols-2">
            {otherOpen.map((c) => (
              <li key={c.id} className="min-w-0">
                <OpenCard campaign={c} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {active ? (
        <StickyActionBar label="Give">
          <ButtonLink href="#give">Give to this campaign</ButtonLink>
        </StickyActionBar>
      ) : null}
    </div>
  );
}

/** "₹18.02 L" never breaks between the figure and its unit. */
const nb = (s: string) => s.replace(/ /g, ' ');

function OpenCard({ campaign }: { campaign: DonationCampaign }) {
  const pct = campaign.target ? campaign.raised / campaign.target : null;
  return (
    <Card as="article" interactive className="relative flex h-full flex-col gap-2 p-card">
      <h3 className="font-display text-md font-semibold leading-snug">
        <Link href={`/giving/${campaign.slug}`} className="link-quiet after:absolute after:inset-0 after:rounded-lg">
          {campaign.title}
        </Link>
      </h3>
      {campaign.description ? <p className="line-clamp-2 text-sm text-secondary">{campaign.description}</p> : null}
      <p className="mt-auto flex items-center justify-between gap-2 pt-2 text-sm text-secondary">
        <span>
          {campaign.donorCount === 0
            ? 'Be the first to give'
            : `${formatCompactINR(campaign.raised)}${pct !== null ? ` · ${formatPercent(pct)}` : ''} raised`}
        </span>
        <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
      </p>
    </Card>
  );
}
