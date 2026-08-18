import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CalendarClock, Globe2, Heart, Receipt, ShieldAlert, Users } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getCampaigns } from '@/lib/data/repo';
import type { DonationCampaign } from '@/lib/data/types';
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Progress,
  Section,
  Stat,
} from '@/components/ui';
import { formatCompactINR, formatDate, formatNumber, formatPercent } from '@/lib/format';

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
    description: 'Alumni-funded campaigns, 80G receipts, and FCRA-segregated foreign contributions.',
  };
}

/**
 * Days from now until an ISO date. Positive means still to come.
 * Rounded up, so a campaign closing tonight reads "1 day left" rather
 * than "0".
 */
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.ceil(ms / 86400000);
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
  const open = campaigns.filter((c) => c.active);
  const past = campaigns.filter((c) => !c.active);

  const totalRaised = campaigns.reduce((n, c) => n + c.raised, 0);
  const totalDonors = campaigns.reduce((n, c) => n + c.donorCount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Alumni giving"
        title="Give to the college"
        description={`Campaigns run by the alumni cell of ${brand.pack.copy.institutionName}. Every contribution is receipted, and contributions from outside India are recorded separately from the rupee they arrive as.`}
      />

      {!tenant.fcraRegistered ? (
        <Alert
          tone="warning"
          title="Foreign contributions cannot be accepted yet"
          icon={<Globe2 className="size-4" />}
        >
          <p>
            {brand.pack.copy.shortName} has not confirmed FCRA registration for the trust. Until it
            does, a contribution from a source outside India will be refused at the point of
            collection rather than accepted and sorted out later — under the Foreign Contribution
            (Regulation) Act, taking it first and asking afterwards is the offence.
          </p>
          <p className="mt-2">
            If you are giving from abroad, the donate form will tell you before you enter an amount.
          </p>
        </Alert>
      ) : null}

      <div className="grid gap-gutter sm:grid-cols-3">
        <Stat
          label="Raised across all campaigns"
          value={formatCompactINR(totalRaised)}
          hint={`${campaigns.length} campaigns since the fund opened`}
          icon={<Heart className="size-4" />}
        />
        <Stat
          label="Alumni who have given"
          value={formatNumber(totalDonors)}
          hint="Counted per campaign, so repeat donors appear more than once"
          icon={<Users className="size-4" />}
        />
        <Stat
          label="Campaigns open now"
          value={formatNumber(open.length)}
          hint={open.length ? 'Accepting contributions' : 'Nothing open at the moment'}
          icon={<CalendarClock className="size-4" />}
        />
      </div>

      <Section
        title="Open campaigns"
        description="Each one funds a named thing with a stated target. When the target is met the campaign closes."
      >
        {open.length === 0 ? (
          <EmptyState
            icon={<Heart className="size-5" />}
            title="No campaign is open right now"
            description="The alumni cell opens campaigns against a specific need — equipment, a scholarship cohort, a building. Closed campaigns and what they funded are listed below."
          />
        ) : (
          <ul className="grid gap-gutter lg:grid-cols-2">
            {open.map((c) => (
              <li key={c.id} className="flex">
                <CampaignCard campaign={c} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {past.length ? (
        <Section
          title="Closed campaigns"
          description="Kept visible on purpose. A giving page that only shows what is open tells a donor nothing about whether the last ask was delivered."
        >
          <ul className="grid gap-gutter lg:grid-cols-2">
            {past.map((c) => (
              <li key={c.id} className="flex">
                <CampaignCard campaign={c} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="How giving is handled here">
        <div className="grid gap-gutter md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle as="h3" className="text-md">
                <Receipt className="mb-1 size-4 text-muted" aria-hidden="true" />
                <span className="block">80G receipts</span>
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-1 text-sm text-secondary">
              Receipts are issued against the trust&rsquo;s 80G registration and emailed within
              seven working days. PAN is required above ₹50,000 — without it the receipt cannot be
              filed against your return.
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h3" className="text-md">
                <Globe2 className="mb-1 size-4 text-muted" aria-hidden="true" />
                <span className="block">FCRA segregation</span>
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-1 text-sm text-secondary">
              Source country is captured at the point of collection, not reconstructed at audit
              time. A foreign contribution is flagged, routed to the designated FCRA account, and
              reported separately — or refused outright if the trust is not registered.
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h3" className="text-md">
                <ShieldAlert className="mb-1 size-4 text-muted" aria-hidden="true" />
                <span className="block">Payments are not live</span>
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-1 text-sm text-secondary">
              The gateway (Razorpay, UPI first) is not connected in this build. You can walk the
              whole donate flow, and it will tell you plainly at the end that no money moved.
            </CardBody>
          </Card>
        </div>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------
// Campaign card
// ---------------------------------------------------------------

function CampaignCard({ campaign }: { campaign: DonationCampaign }) {
  const { title, slug, description, target, raised, donorCount, endsOn, active } = campaign;

  const left = daysUntil(endsOn);
  const funded = target !== null && raised >= target;
  const pct = target ? raised / target : null;

  return (
    <Card interactive as="article" className="flex w-full flex-col p-card">
      <div className="flex flex-wrap items-center gap-2">
        {funded ? (
          <Badge tone="success" dot>
            Target met
          </Badge>
        ) : null}
        {!active ? <Badge tone="neutral">Closed</Badge> : null}
        {active && left !== null && left <= 30 ? (
          <Badge tone="warning">
            {left <= 0 ? 'Closing today' : `${left} day${left === 1 ? '' : 's'} left`}
          </Badge>
        ) : null}
      </div>

      <h3 className="mt-2 font-display text-md font-semibold leading-snug">
        <Link href={`/giving/${slug}`} className="link-quiet">
          {title}
        </Link>
      </h3>

      {description ? (
        <p className="mt-1.5 text-sm text-secondary">{description}</p>
      ) : (
        <p className="mt-1.5 text-sm text-muted">No description was written for this campaign.</p>
      )}

      <div className="mt-4 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="font-display text-lg font-bold tabular">{formatCompactINR(raised)}</p>
          {target ? (
            <p className="text-sm text-secondary">
              of <span className="font-semibold tabular">{formatCompactINR(target)}</span>
              {pct !== null ? (
                <span className="ml-1.5 text-muted tabular">({formatPercent(pct)})</span>
              ) : null}
            </p>
          ) : (
            <p className="text-sm text-muted">No target set</p>
          )}
        </div>

        {target ? (
          <Progress
            value={raised}
            max={target}
            tone={funded ? 'success' : 'brand'}
            label={`${title}: ${formatCompactINR(raised)} raised of ${formatCompactINR(target)}`}
          />
        ) : null}
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-secondary">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Donors</dt>
          <Users className="size-3.5 text-muted" aria-hidden="true" />
          <dd className="tabular">
            {formatNumber(donorCount)} donor{donorCount === 1 ? '' : 's'}
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Closing date</dt>
          <CalendarClock className="size-3.5 text-muted" aria-hidden="true" />
          <dd>
            {endsOn
              ? active
                ? `Closes ${formatDate(endsOn)}`
                : `Closed ${formatDate(endsOn)}`
              : 'No closing date'}
          </dd>
        </div>
      </dl>

      <div className="mt-auto pt-4">
        <ButtonLink
          href={`/giving/${slug}`}
          variant={active ? 'primary' : 'secondary'}
          size="sm"
        >
          {active ? 'Give to this campaign' : 'See what it funded'}
        </ButtonLink>
      </div>
    </Card>
  );
}
