import { redirect, notFound } from 'next/navigation';
import { Globe2, Landmark, ReceiptIndianRupee, ShieldAlert, HeartHandshake, TriangleAlert, EyeOff } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDonationSummary, getDonations, getCampaigns } from '@/lib/data/repo';
import type { Donation } from '@/lib/data/types';
import {
  PageHeader,
  Section,
  Alert,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Stat,
  Progress,
  Separator,
  SegmentedNav,
  Tabs,
  Pagination,
  EmptyState,
  DetailRow,
  TableWrap,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  DefinitionCard,
} from '@/components/ui';
import { ProportionBar, ColumnChart } from '@/components/charts';
import { formatCompactINR, formatCurrency, formatDate, formatPercent, memberLine } from '@/lib/format';

export const metadata = { title: 'Giving' };

const PER_PAGE = 20;
type Origin = 'all' | 'domestic' | 'foreign';
type State = 'all' | Donation['state'];

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminGivingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { tenant, brand } = resolved;

  // `donation.report` is finance and the college admin. The member-facing
  // giving module is a separate surface behind `features.donations`; this
  // console reports on money already on record, which stays readable whether
  // or not the college is currently collecting.
  requireCap(session, 'donation.report');

  const params = await searchParams;
  const origin: Origin = ((v) => (v === 'domestic' || v === 'foreign' ? v : 'all'))(one(params.origin));
  const state: State = ((v) =>
    v === 'succeeded' || v === 'initiated' || v === 'failed' || v === 'refunded' ? v : 'all')(one(params.state));
  const page = Math.max(1, Number(one(params.page) ?? 1) || 1);

  const summary = getDonationSummary();
  const everything = getDonations();
  const foreign = getDonations({ foreignOnly: true });
  const domestic = everything.filter((d) => !d.isForeignContribution);
  const campaigns = getCampaigns();

  const succeeded = everything.filter((d) => d.state === 'succeeded');
  const domesticSucceeded = succeeded.filter((d) => !d.isForeignContribution);
  const receipted = domesticSucceeded.filter((d) => d.receipt80gNo);
  const outstanding = domesticSucceeded.length - receipted.length;

  const byOrigin = origin === 'foreign' ? foreign : origin === 'domestic' ? domestic : everything;
  const rows = state === 'all' ? byOrigin : byOrigin.filter((d) => d.state === state);
  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const pageRows = rows.slice((Math.min(page, pageCount) - 1) * PER_PAGE, Math.min(page, pageCount) * PER_PAGE);

  const href = (patch: Partial<{ origin: Origin; state: State; page: number }>) => {
    const qs = new URLSearchParams();
    const o = patch.origin ?? origin;
    const s = patch.state ?? state;
    const p = patch.page ?? 1;
    if (o !== 'all') qs.set('origin', o);
    if (s !== 'all') qs.set('state', s);
    if (p > 1) qs.set('page', String(p));
    const q = qs.toString();
    return q ? `/admin/giving?${q}` : '/admin/giving';
  };

  const months = monthlySeries(succeeded);
  const foreignCountries = [...new Set(foreign.map((d) => d.sourceCountry).filter(Boolean))] as string[];

  // Reporting and reconciling are separate grants on purpose: the person who
  // reads the ledger is not automatically the person who can mark a payment
  // settled, and the college admin who opens a campaign cannot touch either.
  const canReconcile = can(session, 'donation.reconcile');
  const canManageCampaigns = can(session, 'donation.campaign.manage');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Giving"
        description="Contributions on record, reconciled against the gateway. Domestic and foreign money are reported separately here from the first rupee — that separation is how the ledger is built, not a filter somebody remembers to apply."
        actions={
          <Badge tone={tenant.fcraRegistered ? 'success' : 'warning'} dot>
            FCRA {tenant.fcraRegistered ? 'registered' : 'not confirmed'}
          </Badge>
        }
      />

      {tenant.fcraRegistered ? (
        <Alert tone="success" title="FCRA registration is on record" icon={<ShieldAlert className="size-4" />}>
          <p>
            {tenant.name} may accept and utilise foreign contributions. They must still be received into the
            designated FCRA account, kept in books separate from domestic receipts, and reported in the annual
            FC-4 return. The split below is the working version of that separation.
          </p>
        </Alert>
      ) : (
        <Alert tone="warning" title="FCRA registration is not confirmed" icon={<ShieldAlert className="size-4" />}>
          <p>
            Without registration or prior permission under the Foreign Contribution (Regulation) Act, 2010,{' '}
            {tenant.shortName} may accept <strong>domestic contributions only</strong>. Those may be receipted under
            section 80G in the normal way.
          </p>
          <p className="mt-2">
            The{' '}
            <strong className="tabular">
              {summary.foreign.count} foreign contribution{summary.foreign.count === 1 ? '' : 's'}
            </strong>{' '}
            already on record, worth {formatCompactINR(summary.foreign.amount)}, are flagged and segregated. They must
            not be receipted or utilised until the trust&rsquo;s registration status is confirmed in writing by the
            college. Chasing that confirmation is on the critical path.
          </p>
        </Alert>
      )}

      {!brand.pack.features.donations ? (
        <Alert tone="neutral" title="The member-facing giving module is switched off" icon={<EyeOff className="size-4" />}>
          <p>
            Alumni cannot see a donate page or start a new contribution while{' '}
            <code className="font-mono text-xs">features.donations</code> is off, and students never see it at all.
            This console reports what is already on record and stays open to finance regardless — money that has been
            received still has to be reconciled and receipted.
          </p>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Received"
          value={formatCompactINR(summary.totalRaised)}
          hint={`${formatCurrency(summary.totalRaised)} across ${succeeded.length} successful payments`}
          icon={<HeartHandshake className="size-4" />}
        />
        <Stat
          label="Donors"
          value={summary.donorCount.toLocaleString('en-IN')}
          hint="Distinct givers, not payments"
        />
        <Stat
          label="Awaiting confirmation"
          value={summary.pending.toLocaleString('en-IN')}
          hint="Initiated at the gateway, never confirmed"
          icon={<TriangleAlert className="size-4" />}
        />
        <Stat
          label="80G receipts outstanding"
          value={outstanding.toLocaleString('en-IN')}
          hint={`${receipted.length} of ${domesticSucceeded.length} domestic receipts issued`}
          icon={<ReceiptIndianRupee className="size-4" />}
        />
      </div>

      {/* ------------------------------------------------------------ */}
      <Section
        title="Domestic and foreign, reported separately"
        description="FCRA segregation is structural. Every contribution carries its source country and a foreign-contribution flag from the moment it is recorded, so the two ledgers can never be accidentally merged."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle>
                  <span className="flex items-center gap-2">
                    <Landmark className="size-4 text-muted" aria-hidden="true" />
                    Domestic contributions
                  </span>
                </CardTitle>
                <CardDescription>Received from sources in India.</CardDescription>
              </div>
              <Badge tone="success">Receiptable under 80G</Badge>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="font-display text-display-sm font-bold tabular">
                {formatCompactINR(summary.domestic.amount)}
              </p>
              <p className="text-sm text-secondary">
                {formatCurrency(summary.domestic.amount)} across{' '}
                <span className="tabular">{summary.domestic.count}</span> successful contribution
                {summary.domestic.count === 1 ? '' : 's'}.
              </p>
              <Separator />
              <dl className="divide-y divide-line">
                <DetailRow label="Share of receipts">
                  {formatPercent(summary.totalRaised ? summary.domestic.amount / summary.totalRaised : 0, 1)}
                </DetailRow>
                <DetailRow label="80G issued">
                  <span className="tabular">
                    {receipted.length} of {domesticSucceeded.length}
                  </span>
                </DetailRow>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle>
                  <span className="flex items-center gap-2">
                    <Globe2 className="size-4 text-muted" aria-hidden="true" />
                    Foreign contributions
                  </span>
                </CardTitle>
                <CardDescription>
                  {foreignCountries.length
                    ? `From ${foreignCountries.slice(0, 6).join(', ')}${foreignCountries.length > 6 ? ' and elsewhere' : ''}.`
                    : 'Nothing received from outside India.'}
                </CardDescription>
              </div>
              <Badge tone={tenant.fcraRegistered ? 'success' : 'danger'}>
                {tenant.fcraRegistered ? 'FCRA account' : 'Held — no FCRA'}
              </Badge>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="font-display text-display-sm font-bold tabular">
                {formatCompactINR(summary.foreign.amount)}
              </p>
              <p className="text-sm text-secondary">
                {formatCurrency(summary.foreign.amount)} across{' '}
                <span className="tabular">{summary.foreign.count}</span> successful contribution
                {summary.foreign.count === 1 ? '' : 's'}.
              </p>
              <Separator />
              <dl className="divide-y divide-line">
                <DetailRow label="Share of receipts">
                  {formatPercent(summary.totalRaised ? summary.foreign.amount / summary.totalRaised : 0, 1)}
                </DetailRow>
                <DetailRow label="80G eligibility">
                  {tenant.fcraRegistered ? 'Not applicable to foreign contributions' : 'Blocked until FCRA is confirmed'}
                </DetailRow>
              </dl>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody className="space-y-4">
            <ProportionBar
              label="Successful contributions by origin"
              segments={[
                { label: 'Domestic', value: summary.domestic.count, tone: 'brand' },
                { label: 'Foreign', value: summary.foreign.count, tone: 'warning' },
              ]}
            />
            <p className="max-w-prose text-sm text-secondary">
              Counted separately by origin, always. The two totals above are never added into one headline figure on
              this page, because the moment they are, a return that has to distinguish them cannot be produced from
              it.
            </p>
          </CardBody>
        </Card>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section
        title="Foreign contributions in full"
        description="Its own list, rendered whether or not anyone has filtered for it. A foreign receipt that only appears when someone thinks to ask for it is a receipt that gets missed."
      >
        {foreign.length === 0 ? (
          <EmptyState
            icon={<Globe2 className="size-5" />}
            title="Nothing received from outside India"
            description="Every contribution on record carries an Indian source country. The flag stays on the schema regardless — a single overseas gift must not require a migration."
          />
        ) : (
          <>
            <TableWrap caption="Foreign contributions listed separately for FCRA reporting" className="hidden sm:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Received</TH>
                    <TH>Donor</TH>
                    <TH>Source country</TH>
                    <TH>Campaign</TH>
                    <TH align="right">Amount</TH>
                    <TH>State</TH>
                  </TR>
                </THead>
                <TBody>
                  {foreign.map((d) => (
                    <TR key={d.id} interactive>
                      <TD>{formatDate(d.createdAt)}</TD>
                      <TD>
                        <span className="font-medium">{d.donorName}</span>
                      </TD>
                      <TD>
                        <Badge tone="warning">{d.sourceCountry ?? 'Unknown'}</Badge>
                      </TD>
                      <TD>
                        <span className="text-sm text-secondary">{d.campaignTitle ?? 'General fund'}</span>
                      </TD>
                      <TD numeric>{formatCurrency(d.amount)}</TD>
                      <TD>
                        <StateBadge state={d.state} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>

            <div className="space-y-3 sm:hidden">
              {foreign.map((d) => (
                <DefinitionCard
                  key={d.id}
                  title={d.donorName}
                  subtitle={memberLine([d.sourceCountry, formatDate(d.createdAt)])}
                  rows={[
                    { label: 'Amount', value: formatCurrency(d.amount) },
                    { label: 'Campaign', value: d.campaignTitle ?? 'General fund' },
                    { label: 'State', value: <StateBadge state={d.state} /> },
                  ]}
                />
              ))}
            </div>
          </>
        )}
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section
        title="Campaigns"
        description={
          canManageCampaigns
            ? 'What the money was asked for, and how close each appeal is to its target. You hold donation.campaign.manage, so opening and closing an appeal is yours.'
            : 'What the money was asked for, and how close each appeal is to its target. Opening or closing an appeal needs donation.campaign.manage, which the college admin holds.'
        }
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {campaigns.map((c) => {
            const pct = c.target ? c.raised / c.target : 0;
            const met = Boolean(c.target && c.raised >= c.target);
            return (
              <Card key={c.id}>
                <CardHeader>
                  <div className="min-w-0 space-y-1">
                    <CardTitle as="h3">{c.title}</CardTitle>
                    <CardDescription>{c.description ?? 'No description written.'}</CardDescription>
                  </div>
                  <Badge tone={c.active ? 'brand' : met ? 'success' : 'neutral'} dot={c.active}>
                    {c.active ? 'Open' : met ? 'Target met' : 'Closed'}
                  </Badge>
                </CardHeader>
                <CardBody className="space-y-4">
                  <div className="flex items-end justify-between gap-3">
                    <p className="font-display text-xl font-bold tabular">{formatCompactINR(c.raised)}</p>
                    <p className="text-sm text-muted">
                      {c.target ? `of ${formatCompactINR(c.target)}` : 'No target set'}
                    </p>
                  </div>

                  {c.target ? (
                    <>
                      <Progress
                        value={Math.min(c.raised, c.target)}
                        max={c.target}
                        tone={met ? 'success' : 'brand'}
                        label={`${c.title}: ${formatPercent(pct)} of target`}
                      />
                      <p className="text-sm text-secondary">
                        {met ? (
                          <>
                            Target met, {formatCurrency(c.raised - c.target)} over. Anything further goes to the
                            general fund unless the committee reopens it.
                          </>
                        ) : (
                          <>
                            {formatPercent(pct)} of target · {formatCompactINR(c.target - c.raised)} still to raise.
                          </>
                        )}
                      </p>
                    </>
                  ) : null}

                  <dl className="divide-y divide-line">
                    <DetailRow label="Donors">
                      <span className="tabular">{c.donorCount.toLocaleString('en-IN')}</span>
                    </DetailRow>
                    <DetailRow label="Runs until">{c.endsOn ? formatDate(c.endsOn) : 'Open-ended'}</DetailRow>
                  </dl>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </Section>

      {/* ------------------------------------------------------------ */}
      {months.length > 1 ? (
        <Card>
          <CardHeader>
            <div className="min-w-0 space-y-1">
              <CardTitle>Successful contributions per month</CardTitle>
              <CardDescription>
                Counts, not amounts — one large gift should not read as a busy month.
              </CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            <ColumnChart data={months} label="Successful contributions per month" height={140} />
          </CardBody>
        </Card>
      ) : null}

      {/* ------------------------------------------------------------ */}
      <Section
        title="Reconciliation"
        description="Every payment the gateway told us about, in the state it left us in. A failed payment is not a missing donor — it is a donor who tried."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedNav
            items={[
              { label: `All ${everything.length}`, href: href({ origin: 'all', page: 1 }), active: origin === 'all' },
              {
                label: `Domestic ${domestic.length}`,
                href: href({ origin: 'domestic', page: 1 }),
                active: origin === 'domestic',
              },
              {
                label: `Foreign ${foreign.length}`,
                href: href({ origin: 'foreign', page: 1 }),
                active: origin === 'foreign',
              },
            ]}
          />
          <p className="text-xs text-muted">
            {summary.failed} failed · {summary.pending} never confirmed ·{' '}
            {canReconcile
              ? 'you may settle a payment against the bank statement'
              : 'settling a payment needs donation.reconcile'}
          </p>
        </div>

        <Tabs
          ariaLabel="Payment state"
          items={(['all', 'succeeded', 'initiated', 'failed', 'refunded'] as State[]).map((s) => ({
            label: s === 'all' ? 'Every state' : s[0]!.toUpperCase() + s.slice(1),
            href: href({ state: s, page: 1 }),
            count: s === 'all' ? byOrigin.length : byOrigin.filter((d) => d.state === s).length,
            active: state === s,
          }))}
        />

        {pageRows.length === 0 ? (
          <EmptyState
            icon={<ReceiptIndianRupee className="size-5" />}
            title="No payment matches this view"
            description="Nothing in this origin and state combination. Widen the filters — the ledger itself is unchanged."
          />
        ) : (
          <>
            <TableWrap caption="Payment reconciliation against the gateway" className="hidden sm:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Received</TH>
                    <TH>Donor</TH>
                    <TH>Campaign</TH>
                    <TH>Origin</TH>
                    <TH align="right">Amount</TH>
                    <TH>State</TH>
                    <TH>Gateway ref</TH>
                    <TH>80G receipt</TH>
                  </TR>
                </THead>
                <TBody>
                  {pageRows.map((d) => (
                    <TR key={d.id} interactive>
                      <TD>{formatDate(d.createdAt)}</TD>
                      <TD>
                        <span className="font-medium">{d.donorName}</span>
                      </TD>
                      <TD>
                        <span className="text-sm text-secondary">{d.campaignTitle ?? 'General fund'}</span>
                      </TD>
                      <TD>
                        {d.isForeignContribution ? (
                          <Badge tone="warning">Foreign · {d.sourceCountry ?? '??'}</Badge>
                        ) : (
                          <Badge tone="neutral">India</Badge>
                        )}
                      </TD>
                      <TD numeric>{formatCurrency(d.amount)}</TD>
                      <TD>
                        <StateBadge state={d.state} />
                      </TD>
                      <TD>
                        <span className="font-mono text-xs text-muted">{d.gatewayRef ?? '—'}</span>
                      </TD>
                      <TD>
                        {d.receipt80gNo ? (
                          <span className="font-mono text-xs">{d.receipt80gNo}</span>
                        ) : d.state === 'succeeded' && !d.isForeignContribution ? (
                          <span className="text-xs text-warning-fg">Not issued</span>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>

            <div className="space-y-3 sm:hidden">
              {pageRows.map((d) => (
                <DefinitionCard
                  key={d.id}
                  title={d.donorName}
                  subtitle={memberLine([formatDate(d.createdAt), d.campaignTitle])}
                  rows={[
                    { label: 'Amount', value: formatCurrency(d.amount) },
                    { label: 'Origin', value: d.isForeignContribution ? `Foreign · ${d.sourceCountry ?? '??'}` : 'India' },
                    { label: 'State', value: <StateBadge state={d.state} /> },
                    { label: 'Gateway ref', value: <span className="font-mono text-xs">{d.gatewayRef ?? '—'}</span> },
                    { label: '80G receipt', value: d.receipt80gNo ?? 'Not issued' },
                  ]}
                />
              ))}
            </div>

            <Pagination
              page={Math.min(page, pageCount)}
              pageCount={pageCount}
              total={rows.length}
              buildHref={(p) => href({ page: p })}
            />
          </>
        )}
      </Section>

      {outstanding > 0 ? (
        <Alert tone="warning" title={`${outstanding} domestic receipts are outstanding`}>
          <p>
            A donor who has not received an 80G receipt cannot claim the deduction, and will not give a second time.
            Every successful domestic contribution needs a receipt number against it before the financial year
            closes.
          </p>
        </Alert>
      ) : null}
    </div>
  );
}

function StateBadge({ state }: { state: Donation['state'] }) {
  const map = {
    succeeded: { tone: 'success', label: 'Succeeded' },
    initiated: { tone: 'warning', label: 'Not confirmed' },
    failed: { tone: 'danger', label: 'Failed' },
    refunded: { tone: 'neutral', label: 'Refunded' },
  } as const;
  const { tone, label } = map[state];
  return (
    <Badge tone={tone} dot={state !== 'refunded'}>
      {label}
    </Badge>
  );
}

/** Successful contributions per calendar month, oldest first, last 12 months. */
function monthlySeries(rows: Donation[]): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>();
  for (const d of rows) {
    const key = d.createdAt.slice(0, 7);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([key, value]) => {
      const [y, m] = key.split('-');
      const label = new Date(Number(y), Number(m) - 1, 15).toLocaleDateString('en-IN', { month: 'short' });
      return { label, value };
    });
}
