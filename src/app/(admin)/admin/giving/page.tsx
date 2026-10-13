import type * as React from 'react';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { Globe2, Landmark, ReceiptIndianRupee } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDonationSummary, getDonations, getCampaigns } from '@/lib/data/repo';
import type { Donation } from '@/lib/data/types';
import { staffTasks } from '@/lib/staff-tasks';
import { receiptLabel } from '@/lib/branding/copy';
import {
  PageHeader,
  Section,
  Badge,
  Card,
  CardBody,
  Stat,
  Progress,
  SegmentedNav,
  Tabs,
  Pagination,
  EmptyState,
  NeedsYou,
  Disclosure,
  TableWrap,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from '@/components/ui';
import { ProportionBar, ColumnChart } from '@/components/charts';
import { formatCompactINR, formatCurrency, formatDate, formatPercent, memberLine } from '@/lib/format';

export const metadata = { title: 'Giving · Staff console' };

const PER_PAGE = 20;
type Origin = 'all' | 'domestic' | 'foreign';
type State = 'all' | Donation['state'];

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const plural = (n: number, a: string, b: string) => (n === 1 ? a : b);

const STATE_LABEL: Record<Donation['state'], string> = {
  succeeded: 'Succeeded',
  initiated: 'Unconfirmed',
  failed: 'Failed',
  refunded: 'Refunded',
};

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
  // Narrows the ledger to domestic gifts that still have no receipt number.
  const missingReceipt = one(params.receipt) === 'missing';
  const page = Math.max(1, Number(one(params.page) ?? 1) || 1);

  const summary = getDonationSummary();
  const everything = getDonations();
  const foreign = getDonations({ foreignOnly: true });
  const domestic = everything.filter((d) => !d.isForeignContribution);
  const campaigns = getCampaigns();

  const pack = brand.pack;
  const locale = pack.locale.locale;
  const fmt = { locale, timeZone: pack.locale.timeZone, currency: pack.locale.currency };
  const receiptWord = receiptLabel(pack.copy);

  const succeeded = everything.filter((d) => d.state === 'succeeded');
  const domesticSucceeded = succeeded.filter((d) => !d.isForeignContribution);
  const receipted = domesticSucceeded.filter((d) => d.receipt80gNo);
  const outstanding = domesticSucceeded.length - receipted.length;

  const byOrigin = origin === 'foreign' ? foreign : origin === 'domestic' ? domestic : everything;
  const byState = state === 'all' ? byOrigin : byOrigin.filter((d) => d.state === state);
  const rows = missingReceipt ? byState.filter(needsReceipt) : byState;
  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const pageRows = rows.slice((Math.min(page, pageCount) - 1) * PER_PAGE, Math.min(page, pageCount) * PER_PAGE);

  const href = (patch: Partial<{ origin: Origin; state: State; page: number; receipt: boolean }>) => {
    const qs = new URLSearchParams();
    const o = patch.origin ?? origin;
    const s = patch.state ?? state;
    const p = patch.page ?? 1;
    const r = patch.receipt ?? missingReceipt;
    if (o !== 'all') qs.set('origin', o);
    if (s !== 'all') qs.set('state', s);
    if (r) qs.set('receipt', 'missing');
    if (p > 1) qs.set('page', String(p));
    const q = qs.toString();
    return q ? `/admin/giving?${q}` : '/admin/giving';
  };
  const noReceiptHref = href({ origin: 'domestic', state: 'succeeded', receipt: true, page: 1 });
  const unconfirmedHref = href({ origin: 'all', state: 'initiated', receipt: false, page: 1 });

  const months = monthlySeries(succeeded, fmt);
  const foreignCountries = [...new Set(foreign.map((d) => d.sourceCountry).filter(Boolean))] as string[];

  // Reporting and reconciling are separate grants on purpose: the person who
  // reads the ledger is not automatically the person who can mark a payment
  // settled, and the college admin who opens a campaign cannot touch either.
  const canReconcile = can(session, 'donation.reconcile');
  const canManageCampaigns = can(session, 'donation.campaign.manage');
  // The FCRA card lives on the college profile, which not every finance
  // reader can open. The link is drawn only for those who can follow it.
  const canOpenSettings = can(session, 'tenant.configure');
  // Nothing on this page settles a payment yet, so `canReconcile` changes no
  // wording. It stays beside its sibling so the day an endpoint exists, the
  // check is already here.
  void canReconcile;

  // The finance tasks, from the one source every staff count comes from.
  // The receipts task points at the narrower list this page can draw.
  const all = staffTasks(session, pack);
  const tasks = (['receipts', 'payments'] as const).flatMap((key) => {
    const t = all.find((x) => x.key === key);
    return t ? [{ ...t, href: key === 'receipts' ? noReceiptHref : unconfirmedHref }] : [];
  });

  const fcra = tenant.fcraRegistered;
  const foreignLabel = fcra ? 'Foreign received' : 'Foreign — held';

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Finance"
        title="Giving"
        description="Money on record, with domestic and foreign gifts kept in separate ledgers."
      />

      {/* ---- Status strip ------------------------------------------ */}
      <div
        role="group"
        aria-label="Giving status"
        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-surface-raised px-4 py-3 text-sm shadow-sm"
      >
        <span>
          <span className="text-secondary">Members can give:</span>{' '}
          <span className="font-semibold">{pack.features.donations ? 'On' : 'Off'}</span>
        </span>
        <span aria-hidden="true" className="text-muted">
          ·
        </span>
        {canOpenSettings ? (
          <Link
            href="/admin/settings#fcra"
            className="inline-flex min-h-11 items-center gap-1.5 underline-offset-4 hover:text-brand-fg hover:underline sm:min-h-0"
          >
            <span className="text-secondary">FCRA:</span>
            <Badge tone={fcra ? 'success' : 'warning'}>{fcra ? 'confirmed' : 'not confirmed'}</Badge>
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-secondary">FCRA:</span>
            <Badge tone={fcra ? 'success' : 'warning'}>{fcra ? 'confirmed' : 'not confirmed'}</Badge>
          </span>
        )}
        {summary.foreign.amount > 0 ? (
          <>
            <span aria-hidden="true" className="text-muted">
              ·
            </span>
            <Link
              href={href({ origin: 'foreign', state: 'all', receipt: false, page: 1 })}
              className="inline-flex min-h-11 items-center underline-offset-4 hover:text-brand-fg hover:underline sm:min-h-0"
            >
              <span className="font-semibold tabular">{formatCompactINR(summary.foreign.amount)}</span>
              &nbsp;
              <span className="text-secondary">{fcra ? 'foreign, in the FCRA account' : 'foreign held'}</span>
            </Link>
          </>
        ) : null}
      </div>

      {/* ---- Needs a look ------------------------------------------ */}
      <NeedsYou items={tasks} heading="Needs a look" caughtUp="Every gift has a receipt number and every payment is confirmed." />

      {/* ---- Domestic and foreign ---------------------------------- */}
      <section aria-labelledby="origin-heading" className="space-y-3">
        <h2 id="origin-heading" className="text-sm font-semibold text-secondary">
          Domestic and foreign, never added together
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Stat
            label="Domestic received"
            value={formatCompactINR(summary.domestic.amount)}
            hint={`${summary.domestic.count} ${plural(summary.domestic.count, 'payment', 'payments')} from India`}
            icon={<Landmark className="size-4" />}
            href={href({ origin: 'domestic', state: 'succeeded', receipt: false, page: 1 })}
          />
          <Stat
            label={foreignLabel}
            value={formatCompactINR(summary.foreign.amount)}
            hint={
              foreignCountries.length
                ? `${summary.foreign.count} ${plural(summary.foreign.count, 'payment', 'payments')} · ${foreignCountries.length} ${plural(foreignCountries.length, 'country', 'countries')}`
                : 'Nothing from outside India'
            }
            icon={<Globe2 className="size-4" />}
            tone={!fcra && summary.foreign.amount > 0 ? 'attention' : 'default'}
            href={href({ origin: 'foreign', state: 'all', receipt: false, page: 1 })}
          />
          {outstanding > 0 ? (
            <Stat
              // On phones "Needs a look" above already carries this figure.
              className="hidden sm:block"
              label="Without a receipt number"
              value={outstanding.toLocaleString(locale)}
              hint={`${receipted.length} of ${domesticSucceeded.length} domestic gifts have one`}
              icon={<ReceiptIndianRupee className="size-4" />}
              tone="attention"
              href={noReceiptHref}
            />
          ) : null}
          {summary.pending > 0 ? (
            <Stat
              className="hidden sm:block"
              label="Unconfirmed"
              value={summary.pending.toLocaleString(locale)}
              hint="Started at the gateway, never confirmed"
              href={unconfirmedHref}
            />
          ) : null}
        </div>

        <Card>
          <CardBody className="space-y-4">
            <ProportionBar
              label="Successful gifts by origin, in rupees"
              segments={[
                { label: 'Domestic ₹', value: summary.domestic.amount, tone: 'brand' },
                { label: fcra ? 'Foreign ₹' : 'Foreign, held ₹', value: summary.foreign.amount, tone: 'warning' },
              ]}
            />
            <p className="text-xs text-secondary">
              Share of rupees received:{' '}
              {formatPercent(summary.totalRaised ? summary.domestic.amount / summary.totalRaised : 0, 1)} domestic,{' '}
              {formatPercent(summary.totalRaised ? summary.foreign.amount / summary.totalRaised : 0, 1)} foreign.
            </p>
          </CardBody>
        </Card>

        <Disclosure summary={fcra ? 'Why foreign gifts are kept apart' : 'Why foreign gifts are held'}>
          {fcra ? (
            <p>
              {tenant.name} may accept and use foreign contributions. They must still be received into the designated
              FCRA account, kept in books separate from domestic receipts, and reported in the annual FC-4 return. The
              separate ledgers on this page are the working version of that separation.
            </p>
          ) : (
            <div className="space-y-2">
              <p>
                Without registration or prior permission under the Foreign Contribution (Regulation) Act, 2010,{' '}
                {tenant.shortName} may accept domestic contributions only.
              </p>
              <p>
                The {summary.foreign.count} foreign {plural(summary.foreign.count, 'contribution', 'contributions')}{' '}
                already on record, worth {formatCompactINR(summary.foreign.amount)}, are flagged and kept apart. They must
                not be receipted or used until the college confirms the trust&rsquo;s registration status in writing.
              </p>
            </div>
          )}
        </Disclosure>
      </section>

      {/* ---- Foreign in full (always rendered, whatever the filters) - */}
      <Section
        title="Foreign contributions in full"
        description="Listed on their own whatever the ledger filters say."
      >
        {foreign.length === 0 ? (
          <EmptyState
            variant="inline"
            title="Nothing received from outside India."
            description="Every gift on record has an Indian source country."
          />
        ) : (
          <>
            <TableWrap caption="Foreign contributions, listed separately for FCRA reporting" className="hidden sm:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Received</TH>
                    <TH>Donor</TH>
                    <TH>From</TH>
                    <TH>Campaign</TH>
                    <TH align="right">Amount</TH>
                    <TH>State</TH>
                  </TR>
                </THead>
                <TBody>
                  {foreign.map((d) => (
                    <TR key={d.id} interactive>
                      <TD className="whitespace-nowrap tabular">{formatDate(d.createdAt, fmt)}</TD>
                      <TD className="max-w-[14rem] truncate font-medium" title={d.donorName}>
                        {d.donorName}
                      </TD>
                      <TD className="whitespace-nowrap">{d.sourceCountry ?? 'Unknown'}</TD>
                      <TD className="max-w-[14rem] truncate text-secondary" title={d.campaignTitle ?? 'General fund'}>
                        {d.campaignTitle ?? 'General fund'}
                      </TD>
                      <TD numeric className="whitespace-nowrap">
                        {formatCurrency(d.amount, fmt)}
                      </TD>
                      <TD className="whitespace-nowrap">
                        <StateBadge state={d.state} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>

            <ul className="divide-y divide-line rounded-lg border border-line bg-surface-raised sm:hidden">
              {foreign.map((d) => (
                <PhoneRow
                  key={d.id}
                  amount={formatCurrency(d.amount, fmt)}
                  line={memberLine([d.donorName, d.sourceCountry, formatDate(d.createdAt, fmt)])}
                  detail={d.campaignTitle ?? 'General fund'}
                  badges={<StateBadge state={d.state} />}
                />
              ))}
            </ul>
          </>
        )}
      </Section>

      {/* ---- Campaigns ---------------------------------------------- */}
      <Section
        title="Campaigns"
        description={
          canManageCampaigns
            ? 'What each appeal asked for and how close it is. Opening and closing appeals is yours to decide.'
            : 'What each appeal asked for and how close it is.'
        }
      >
        {campaigns.length === 0 ? (
          <EmptyState variant="inline" title="No appeals on record." />
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {campaigns.map((c) => {
              const pct = c.target ? c.raised / c.target : 0;
              const met = Boolean(c.target && c.raised >= c.target);
              return (
                <li key={c.id} className="min-w-0">
                  <Card className="flex h-full flex-col">
                    <CardBody className="flex flex-1 flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="min-w-0 font-display text-md font-semibold">{c.title}</h3>
                        <Badge
                          tone={c.active ? 'brand' : met ? 'success' : 'neutral'}
                          dot={c.active}
                          className="shrink-0 whitespace-nowrap"
                        >
                          {c.active ? 'Open' : met ? 'Target met' : 'Closed'}
                        </Badge>
                      </div>
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-display text-xl font-bold tabular">{formatCompactINR(c.raised)}</span>
                        <span className="text-sm text-secondary">
                          {c.target ? `of ${formatCompactINR(c.target)}` : 'No target set'}
                        </span>
                      </p>
                      {c.target ? (
                        <Progress
                          value={Math.min(c.raised, c.target)}
                          max={c.target}
                          tone={met ? 'success' : 'brand'}
                          label={`${c.title}: ${formatPercent(pct)} of target`}
                        />
                      ) : null}
                      <p className="mt-auto text-sm text-secondary">
                        {c.target
                          ? met
                            ? `Target met · ${formatCompactINR(c.raised - c.target)} over`
                            : `${formatPercent(pct)} of target · ${formatCompactINR(c.target - c.raised)} to go`
                          : null}
                        {c.target ? ' · ' : null}
                        {c.donorCount.toLocaleString(locale)} {plural(c.donorCount, 'donor', 'donors')} ·{' '}
                        {c.endsOn ? `until ${formatDate(c.endsOn, fmt)}` : 'open-ended'}
                      </p>
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* ---- Ledger ------------------------------------------------- */}
      <Section title="Ledger" description="Every payment the gateway reported, in the state it was left in.">
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
          {missingReceipt ? (
            <p className="text-sm text-secondary">
              Showing gifts without a receipt number ·{' '}
              <Link href={href({ receipt: false, page: 1 })} className="link">
                Show every gift
              </Link>
            </p>
          ) : null}
        </div>

        <Tabs
          ariaLabel="Payment state"
          items={(['all', 'succeeded', 'initiated', 'failed', 'refunded'] as State[]).map((s) => ({
            label: s === 'all' ? 'Every state' : STATE_LABEL[s],
            href: href({ state: s, page: 1 }),
            count: s === 'all' ? byOrigin.length : byOrigin.filter((d) => d.state === s).length,
            active: state === s,
          }))}
        />

        {pageRows.length === 0 ? (
          <EmptyState
            variant="inline"
            title="No payment matches this view."
            description="Try another origin or state."
          />
        ) : (
          <>
            <TableWrap caption="Payments reported by the gateway" className="hidden sm:block">
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
                    <TH>{receiptWord} no.</TH>
                  </TR>
                </THead>
                <TBody>
                  {pageRows.map((d) => (
                    <TR key={d.id} interactive>
                      <TD className="whitespace-nowrap tabular">{formatDate(d.createdAt, fmt)}</TD>
                      <TD className="max-w-[12rem] truncate font-medium" title={d.donorName}>
                        {d.donorName}
                      </TD>
                      <TD className="max-w-[10rem] truncate text-secondary" title={d.campaignTitle ?? 'General fund'}>
                        {d.campaignTitle ?? 'General fund'}
                      </TD>
                      <TD className="whitespace-nowrap">
                        {d.isForeignContribution ? (
                          <Badge tone="warning">Foreign · {d.sourceCountry ?? 'unknown'}</Badge>
                        ) : (
                          <span className="text-secondary">India</span>
                        )}
                      </TD>
                      <TD numeric className="whitespace-nowrap">
                        {formatCurrency(d.amount, fmt)}
                      </TD>
                      <TD className="whitespace-nowrap">
                        <StateBadge state={d.state} />
                      </TD>
                      <TD className="whitespace-nowrap">
                        <span className="font-mono text-xs text-secondary">{d.gatewayRef ?? '—'}</span>
                      </TD>
                      <TD className="whitespace-nowrap">
                        <ReceiptCell d={d} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>

            <ul className="divide-y divide-line rounded-lg border border-line bg-surface-raised sm:hidden">
              {pageRows.map((d) => (
                <PhoneRow
                  key={d.id}
                  amount={formatCurrency(d.amount, fmt)}
                  line={memberLine([
                    d.donorName,
                    formatDate(d.createdAt, fmt),
                    d.isForeignContribution ? `Foreign · ${d.sourceCountry ?? 'unknown'}` : null,
                  ])}
                  detail={
                    d.receipt80gNo ? `${receiptWord} no. ${d.receipt80gNo}` : (d.campaignTitle ?? 'General fund')
                  }
                  badges={
                    <>
                      <StateBadge state={d.state} />
                      {needsReceipt(d) ? <Badge tone="warning">Not issued</Badge> : null}
                    </>
                  }
                />
              ))}
            </ul>

            <Pagination
              page={Math.min(page, pageCount)}
              pageCount={pageCount}
              total={rows.length}
              buildHref={(p) => href({ page: p })}
            />
          </>
        )}

        {outstanding > 0 ? (
          <p className="text-sm text-secondary">
            <Link href={noReceiptHref} className="link">
              {outstanding} domestic {plural(outstanding, 'gift has', 'gifts have')} no receipt number yet.
            </Link>
          </p>
        ) : null}
      </Section>

      {/* ---- Monthly ------------------------------------------------ */}
      {months.length > 1 ? (
        <Section title="Successful gifts per month" description="A count of gifts, so one large gift does not read as a busy month.">
          <Card>
            <CardBody>
              <ColumnChart data={months} label="Successful gifts per month" height={160} />
            </CardBody>
          </Card>
        </Section>
      ) : null}
    </div>
  );
}

/** A ledger row on a phone: the amount is the title, then who, when and what for. */
function PhoneRow({
  amount,
  line,
  detail,
  badges,
}: {
  amount: string;
  line: string;
  detail: string;
  badges: React.ReactNode;
}) {
  return (
    <li className="space-y-0.5 px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold tabular">{amount}</p>
        <div className="flex shrink-0 items-center gap-1">{badges}</div>
      </div>
      <p className="truncate text-xs text-secondary" title={`${line} · ${detail}`}>
        {line} · {detail}
      </p>
    </li>
  );
}

function needsReceipt(d: Donation): boolean {
  return d.state === 'succeeded' && !d.isForeignContribution && !d.receipt80gNo;
}

function ReceiptCell({ d }: { d: Donation }) {
  if (d.receipt80gNo) return <span className="font-mono text-xs">{d.receipt80gNo}</span>;
  if (needsReceipt(d)) return <Badge tone="warning">Not issued</Badge>;
  return <span className="text-xs text-secondary">—</span>;
}

function StateBadge({ state }: { state: Donation['state'] }) {
  const tone = {
    succeeded: 'success',
    initiated: 'warning',
    failed: 'danger',
    refunded: 'neutral',
  } as const;
  return (
    <Badge tone={tone[state]} dot={state !== 'refunded'} className="whitespace-nowrap">
      {STATE_LABEL[state]}
    </Badge>
  );
}

/**
 * Successful gifts per calendar month, oldest first, last 12 months. The
 * month is read in the college's time zone and named with its locale, so
 * the server and the browser agree on every label.
 */
function monthlySeries(
  rows: Donation[],
  fmt: { locale: string; timeZone: string },
): Array<{ label: string; value: number }> {
  const keyOf = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: fmt.timeZone });
  const counts = new Map<string, number>();
  for (const d of rows) {
    const key = keyOf.format(new Date(d.createdAt)).slice(0, 7);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const name = new Intl.DateTimeFormat(fmt.locale, { month: 'short', timeZone: 'UTC' });
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([key, value]) => {
      const [y, m] = key.split('-');
      return { label: name.format(new Date(Date.UTC(Number(y), Number(m) - 1, 15))), value };
    });
}
