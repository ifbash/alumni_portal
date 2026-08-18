import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { CalendarClock, Globe2, Receipt, ShieldAlert, Target, Users } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getCampaigns, getOwnProfile } from '@/lib/data/repo';
import {
  Alert,
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DetailRow,
  PageHeader,
  Progress,
  Section,
} from '@/components/ui';
import { formatCompactINR, formatCurrency, formatDate, formatNumber, formatPercent } from '@/lib/format';
import { DonateForm } from './DonateForm';

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.ceil(ms / 86400000);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
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

  const { title, description, target, raised, donorCount, startsOn, endsOn, active } = campaign;
  const left = daysUntil(endsOn);
  const funded = target !== null && raised >= target;
  const pct = target ? raised / target : null;
  const remaining = target ? Math.max(0, target - raised) : null;
  const averageGift = donorCount > 0 ? Math.round(raised / donorCount) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs items={[{ label: 'Giving', href: '/giving' }, { label: title }]} />
        }
        eyebrow="Alumni giving"
        title={title}
        description={description ?? 'No description was written for this campaign.'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {funded ? (
              <Badge tone="success" dot>
                Target met
              </Badge>
            ) : null}
            {active ? (
              <Badge tone="brand">Open</Badge>
            ) : (
              <Badge tone="neutral">Closed</Badge>
            )}
          </div>
        }
      />

      {!tenant.fcraRegistered ? (
        <Alert
          tone="warning"
          title="Contributions from outside India cannot be accepted"
          icon={<Globe2 className="size-4" />}
        >
          <p>
            {brand.pack.copy.shortName} has not confirmed FCRA registration for the trust. A
            contribution whose source country is not India will be refused at the point of
            collection. It is not held, not converted, and not &ldquo;sorted out later&rdquo; —
            under the Foreign Contribution (Regulation) Act, accepting it first is the offence.
          </p>
        </Alert>
      ) : null}

      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <div>
                  <p className="font-display text-display-sm font-bold tabular">
                    {formatCompactINR(raised)}
                  </p>
                  <p className="text-sm text-secondary">
                    raised
                    {target ? (
                      <>
                        {' '}
                        of a <span className="font-semibold tabular">{formatCompactINR(target)}</span>{' '}
                        target
                      </>
                    ) : (
                      ' — no target was set for this campaign'
                    )}
                  </p>
                </div>
                {pct !== null ? (
                  <p className="font-display text-xl font-semibold tabular text-brand-fg">
                    {formatPercent(pct)}
                  </p>
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

              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Figure
                  icon={<Users className="size-3.5" />}
                  label="Donors"
                  value={formatNumber(donorCount)}
                />
                <Figure
                  icon={<Receipt className="size-3.5" />}
                  label="Average gift"
                  value={averageGift ? formatCurrency(averageGift) : '—'}
                />
                <Figure
                  icon={<Target className="size-3.5" />}
                  label={funded ? 'Over target by' : 'Still needed'}
                  value={
                    target === null
                      ? '—'
                      : funded
                        ? formatCompactINR(raised - target)
                        : formatCompactINR(remaining ?? 0)
                  }
                />
                <Figure
                  icon={<CalendarClock className="size-3.5" />}
                  label={active ? 'Time left' : 'Closed'}
                  value={
                    active
                      ? left === null
                        ? 'Open-ended'
                        : left <= 0
                          ? 'Closing today'
                          : `${left} day${left === 1 ? '' : 's'}`
                      : endsOn
                        ? formatDate(endsOn)
                        : '—'
                  }
                />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">What this campaign funds</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="max-w-prose text-sm leading-relaxed text-secondary">
                {description ??
                  'The alumni cell did not record a description for this campaign. Ask them before giving — a campaign with no stated purpose is one you cannot check afterwards.'}
              </p>

              <dl className="divide-y divide-line">
                <DetailRow label="Opened">
                  {startsOn ? formatDate(startsOn) : <span className="text-muted">Not recorded</span>}
                </DetailRow>
                <DetailRow label={active ? 'Closes' : 'Closed'}>
                  {endsOn ? formatDate(endsOn) : <span className="text-muted">Open-ended</span>}
                </DetailRow>
                <DetailRow label="Beneficiary">
                  {brand.pack.copy.institutionName}
                </DetailRow>
                <DetailRow label="Receipt">
                  80G, issued by the trust within seven working days
                </DetailRow>
              </dl>
            </CardBody>
          </Card>

          <Section title="Before you give">
            <div className="grid gap-gutter sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle as="h3" className="text-md">
                    <Receipt className="mb-1 size-4 text-muted" aria-hidden="true" />
                    <span className="block">PAN and 80G</span>
                  </CardTitle>
                </CardHeader>
                <CardBody className="pt-1 text-sm text-secondary">
                  Give up to ₹50,000 and PAN is optional — you will still get a receipt, but you
                  cannot claim the deduction without it. Above ₹50,000 PAN is required before the
                  payment is created, because a receipt issued without one cannot be filed.
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle as="h3" className="text-md">
                    <Globe2 className="mb-1 size-4 text-muted" aria-hidden="true" />
                    <span className="block">Where you are giving from</span>
                  </CardTitle>
                </CardHeader>
                <CardBody className="pt-1 text-sm text-secondary">
                  The form asks for the source country and means it. A contribution from outside
                  India is a foreign contribution in law even when it arrives in rupees from an NRE
                  account, and it is flagged and segregated as the payment is created — not
                  reclassified during an audit six months later.
                </CardBody>
              </Card>
            </div>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          {active ? (
            <DonateForm
              campaignTitle={title}
              institutionName={brand.pack.copy.institutionName}
              shortName={brand.pack.copy.shortName}
              fcraRegistered={tenant.fcraRegistered}
              defaultCountry={me?.country ?? 'IN'}
              donorName={me?.fullName ?? 'You'}
              locale={brand.pack.locale.locale}
              currency={brand.pack.locale.currency}
              supportEmail={brand.pack.copy.supportEmail ?? null}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">This campaign is closed</CardTitle>
              </CardHeader>
              <CardBody className="space-y-4">
                <p className="text-sm text-secondary">
                  It closed on {formatDate(endsOn)} having raised{' '}
                  <span className="font-semibold tabular">{formatCompactINR(raised)}</span> from{' '}
                  <span className="font-semibold tabular">{formatNumber(donorCount)}</span> alumni
                  {target ? (
                    <>
                      {' '}
                      against a {formatCompactINR(target)} target
                      {funded ? ', which it met' : ', which it did not reach'}
                    </>
                  ) : null}
                  .
                </p>
                <p className="text-sm text-secondary">
                  Contributions are no longer accepted here. The alumni cell publishes what each
                  closed campaign paid for; ask them if you cannot find it.
                </p>
                <ButtonLink href="/giving" variant="secondary" className="w-full">
                  See open campaigns
                </ButtonLink>
              </CardBody>
            </Card>
          )}

          <Card className="mt-4">
            <CardBody className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <ShieldAlert className="size-4 text-muted" aria-hidden="true" />
                Payments are not connected
              </p>
              <p className="text-xs text-secondary">
                Razorpay, UPI first, is the intended gateway and it is not wired up in this build.
                Nothing on this page can take money. The donate flow runs end to end and says so at
                the point where a payment would be created.
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Figure({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <dt className="flex items-center gap-1.5 text-xs text-secondary">
        <span className="text-muted" aria-hidden="true">
          {icon}
        </span>
        {label}
      </dt>
      <dd className="font-display text-lg font-semibold tabular">{value}</dd>
    </div>
  );
}
