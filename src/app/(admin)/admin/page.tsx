import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, DoorOpen } from 'lucide-react';
import { getSession, getSessionMember } from '@/lib/auth/session';
import { can } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { canOpen, hasAdminAccess } from '@/lib/navigation';
import { getDegreeRegisterStats, getEvents, getStats } from '@/lib/data/repo';
import { staffTasks } from '@/lib/staff-tasks';
import { greetingFor } from '@/lib/branding/copy';
import { firstNameOf, primaryRoleLabel } from '@/lib/identity';
import { daysUntil, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Card, CardBody, CardHeader, CardTitle, DateTile, NeedsYou, Section } from '@/components/ui';
import { BarList, Sparkline } from '@/components/charts';
import { PageBand } from '@/components/brand/PageBand';
import {
  CoverageChips,
  CoverageLegend,
  WeakestBatches,
  batchCommsHref,
  weakestBatches,
} from './_shared/RegisterFilesGrid';

export const metadata = { title: 'Today · Staff console' };

const MONTHS_LONG: Record<string, string> = {
  Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June',
  Jul: 'July', Aug: 'August', Sep: 'September', Sept: 'September', Oct: 'October', Nov: 'November', Dec: 'December',
};

/**
 * Today: the staff console's front page.
 *
 * The queue comes first, because it is the only part of this page that is
 * somebody's job this morning. Every count in it comes from
 * `staffTasks()`, the same source as the sidebar badges, and every read
 * behind it sits behind its own capability there. Reach comes second, as
 * a sentence and a batch strip rather than a chart. Everything is a link
 * to the screen that acts on it, and plain text when the viewer cannot
 * open that screen.
 */
export default async function AdminOverviewPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) redirect('/login');
  const { tenant, brand } = resolved;

  // Hiding a link is presentation; this is the guard. A member with no
  // staff surface at all has no business rendering the console.
  if (!hasAdminAccess(session, brand.pack)) redirect('/dashboard');

  const pack = brand.pack;
  const tz = pack.locale.timeZone;
  const { member } = await getSessionMember();

  const stats = getStats(session);
  const register = getDegreeRegisterStats();
  const tasks = staffTasks(session, pack);

  const openRegister = canOpen(session, pack, '/admin/degree-register');
  const openComms = canOpen(session, pack, '/admin/comms');
  const openMembers = canOpen(session, pack, '/admin/members');

  // ---- Up next: the door desk, for whoever runs check-in -------------
  const upNext =
    canOpen(session, pack, '/admin/events') && can(session, 'event.checkin')
      ? (getEvents(session, { when: 'upcoming' })
          .map((e) => ({ event: e, days: daysUntil(e.startsAt, tz) }))
          .find((x) => x.days >= 0 && x.days <= 14) ?? null)
      : null;

  // ---- Reach -------------------------------------------------------
  const pct = register.total ? register.claimed / register.total : 0;
  const weakest = openComms ? weakestBatches(register.byYear) : [];

  // ---- Registrations ------------------------------------------------
  // The last column is the month in progress: counted, never compared.
  const trend = stats.signupTrend;
  const current = trend[trend.length - 1];
  const full = trend.slice(0, -1);
  const lastThree = full.slice(-3);
  const priorThree = full.slice(-6, -3);
  const sum = (xs: typeof trend) => xs.reduce((n, p) => n + p.value, 0);
  const yearTotal = sum(trend);
  const recent = sum(lastThree);
  const before = sum(priorThree);
  const direction = recent > before ? 'up from' : recent < before ? 'down from' : 'level with';

  // The queue and "Up next" share one row of cards when they fit in it:
  // NeedsYou takes as many of the three columns as it has tasks, and its
  // own grid is narrowed to match, so the next event sits beside the work
  // rather than across an empty gap.
  const n = tasks.length;
  const queueSpan = cn(
    'min-w-0',
    !upNext || n >= 3
      ? 'sm:col-span-2 lg:col-span-3'
      : n === 2
        ? 'sm:col-span-2 lg:col-span-2 lg:[&>ul]:grid-cols-2'
        : n === 1
          ? 'sm:[&>ul]:grid-cols-1 lg:[&>ul]:grid-cols-1'
          : 'lg:col-span-2',
  );

  const greeting = greetingFor(pack.copy);
  const first = member ? firstNameOf(member.fullName, member.preferredName) : null;
  const lead = [first ? `${greeting}, ${first}` : greeting, primaryRoleLabel(session.roles)].join(' · ');

  return (
    <div className="space-y-8">
      <PageBand
        pack={pack}
        size="compact"
        eyebrow={`Staff console · ${tenant.shortName}`}
        title="Today"
        lead={lead}
      />

      {/* ---------------------------------------------------------------
          Your queue
         --------------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <NeedsYou items={tasks} heading="Your queue" className={queueSpan} />

        {upNext ? (
          <section aria-labelledby="up-next" className="min-w-0 space-y-3">
            <h2 id="up-next" className="text-sm font-semibold text-secondary">
              Up next
            </h2>
            <Link
              href={`/admin/events/${upNext.event.id}?mode=door`}
              className="group flex min-h-11 items-start gap-4 rounded-lg border border-line bg-surface-raised p-4 shadow-sm transition-colors duration-fast ease-brand hover:border-line-strong"
            >
              <DateTile iso={upNext.event.startsAt} locale={pack.locale.locale} timeZone={tz} size="sm" />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block text-sm font-medium text-primary">
                  {upNext.event.title}{' '}
                  {upNext.days === 0 ? 'today' : upNext.days === 1 ? 'tomorrow' : `in ${upNext.days} days`}
                </span>
                <span className="inline-flex items-center gap-1 pt-1 text-sm font-semibold text-brand-fg">
                  <DoorOpen className="size-4" aria-hidden="true" />
                  Open the door desk
                  <ArrowRight
                    className="size-4 transition-transform duration-fast ease-brand group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </span>
            </Link>
          </section>
        ) : null}
      </div>

      {/* ---------------------------------------------------------------
          Reach
         --------------------------------------------------------------- */}
      <section aria-labelledby="reach-title">
        <Card>
          <CardBody className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0 space-y-4">
              <div className="space-y-1">
                <h2 id="reach-title" className="text-sm font-semibold text-secondary">
                  Reach
                </h2>
                <p className="font-display text-xl font-semibold">
                  {formatNumber(register.claimed)} of {formatNumber(register.total)} graduates have joined ·{' '}
                  <span className="tabular">{formatPercent(pct)}</span>
                </p>
              </div>
              <CoverageChips
                ariaLabel="Share of each batch that has joined, by year of passing"
                batches={register.byYear}
                hrefFor={openRegister ? (year) => `/admin/degree-register?year=${year}` : undefined}
              />
              <CoverageLegend />
            </div>

            {weakest.length > 0 ? (
              <div className="min-w-0 space-y-1 border-t border-line pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <h3 className="text-sm font-semibold text-secondary">Furthest behind</h3>
                <WeakestBatches batches={weakest} commsHref={batchCommsHref} />
              </div>
            ) : null}
          </CardBody>
        </Card>
      </section>

      {/* ---------------------------------------------------------------
          Registrations and network health
         --------------------------------------------------------------- */}
      <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader variant="stack">
            <CardTitle as="h2" className="text-md">
              Registrations, last 12 months
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-display text-display-xs font-bold tabular">{formatNumber(yearTotal)}</span>
              <span className="text-sm text-secondary">
                new accounts{current ? ` · ${formatNumber(current.value)} so far in ${MONTHS_LONG[current.label] ?? current.label}` : ''}
              </span>
            </p>
            <Sparkline
              data={trend}
              label="New registrations per month over the last twelve months"
              height={56}
            />
            <div className="flex justify-between text-xs text-secondary" aria-hidden="true">
              <span>{MONTHS_LONG[trend[0]?.label ?? ''] ?? trend[0]?.label}</span>
              <span>{MONTHS_LONG[current?.label ?? ''] ?? current?.label}</span>
            </div>
            {lastThree.length === 3 && priorThree.length === 3 ? (
              <p className="text-sm text-secondary">
                {formatNumber(recent)} in the last three full months, {direction} {formatNumber(before)} in the three
                before.
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card className="min-w-0">
          <CardHeader variant="stack">
            <CardTitle as="h2" className="text-md">
              Network health
            </CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <dt className="text-sm text-secondary">Answered requests accepted</dt>
                <dd className="font-display text-display-xs font-bold tabular">{formatPercent(stats.acceptRate)}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-sm text-secondary">Alumni open to mentoring</dt>
                <dd className="font-display text-display-xs font-bold tabular">
                  {formatNumber(stats.openToMentoring)}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>

      {/* ---------------------------------------------------------------
          Where the network is
         --------------------------------------------------------------- */}
      <Section title="Where the network is" description="Alumni and final-year students together.">
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-3">
          <Card className="min-w-0">
            <CardHeader variant="stack">
              <CardTitle as="h3" className="text-md">
                Top employers
              </CardTitle>
            </CardHeader>
            <CardBody>
              <BarList
                label="Members by current employer"
                data={stats.topCompanies.map((c) => ({
                  ...c,
                  href: openMembers ? `/admin/members?q=${encodeURIComponent(c.label)}` : undefined,
                }))}
              />
            </CardBody>
          </Card>

          <Card className="min-w-0">
            <CardHeader variant="stack">
              <CardTitle as="h3" className="text-md">
                Top cities
              </CardTitle>
            </CardHeader>
            <CardBody>
              <BarList
                label="Members by city"
                tone="accent"
                data={stats.topCities.map((c) => ({
                  ...c,
                  href: openComms ? `/admin/comms/new?city=${encodeURIComponent(c.label)}` : undefined,
                }))}
              />
            </CardBody>
          </Card>

          <Card className="min-w-0">
            <CardHeader variant="stack">
              <CardTitle as="h3" className="text-md">
                By branch
              </CardTitle>
            </CardHeader>
            <CardBody>
              <BarList
                label="Members by branch"
                tone="neutral"
                data={stats.departmentDistribution.map((d) => ({
                  ...d,
                  href: openMembers ? `/admin/members?department=${encodeURIComponent(d.label)}` : undefined,
                }))}
              />
            </CardBody>
          </Card>
        </div>
      </Section>
    </div>
  );
}
