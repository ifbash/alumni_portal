import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  FileCheck2,
  Handshake,
  ScrollText,
  Users,
} from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { hasAdminAccess } from '@/lib/navigation';
import { getDegreeRegisterStats, getStats } from '@/lib/data/repo';
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Progress,
  Section,
  Stat,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { BarList, ColumnChart, DonutChart, ProportionBar } from '@/components/charts';
import { MarginNote } from '@/components/brand/Marks';
import { formatNumber, formatPercent } from '@/lib/format';

export const metadata = { title: 'Console' };

/**
 * The staff console overview.
 *
 * Ordered by what the alumni cell is actually measured on, not by what is
 * easiest to count. Register coverage comes first and takes the whole
 * width, because "how many of our graduates have we reached" is the only
 * number the dean asks for by name — everything else on this page is a
 * lever that moves it.
 *
 * Every tile is a link to the screen that acts on it, and the link is
 * dropped rather than 403'd when the viewer lacks the capability.
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

  const stats = getStats(session);
  const register = getDegreeRegisterStats();

  const canReview = can(session, 'verification.review.department');
  const canSeeRegister = can(session, 'verification.review.any');
  const canRunEvents = can(session, 'event.create.department');
  const canModerateJobs = can(session, 'job.moderate');
  const canSendComms = can(session, 'comms.send.department') || can(session, 'comms.send.segment');
  const canReadMembers = can(session, 'profile.read.any');

  const worstBatches = [...register.byYear]
    .filter((y) => y.total >= 5)
    .sort((a, b) => a.claimed / a.total - b.claimed / b.total)
    .slice(0, 3)
    .map((y) => y.year);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={tenant.shortName}
        title="Alumni cell console"
        description={`${formatNumber(stats.totalMembers)} people on the portal against ${formatNumber(register.total)} rows in the degree register. The gap between those two numbers is the job.`}
        actions={
          canReview ? (
            <ButtonLink href="/admin/verification">
              Verification queue
              {stats.pendingVerification > 0 ? (
                <Badge tone="warning" className="ml-1">
                  {stats.pendingVerification}
                </Badge>
              ) : null}
            </ButtonLink>
          ) : null
        }
      />

      {stats.pendingVerification > 0 && canReview ? (
        <Alert
          tone="warning"
          title={`${stats.pendingVerification} registrations are waiting for a decision`}
          icon={<FileCheck2 className="size-4" />}
        >
          <p>
            Each one is a person who has already typed their roll number and is waiting to be let in.
            The matcher has attached the candidate register rows to every claim, so none of them needs
            a judgement made against no evidence.{' '}
            <Link href="/admin/verification" className="link">
              Open the queue
            </Link>
            .
          </p>
        </Alert>
      ) : null}

      {/* ---------------------------------------------------------------
          Register coverage — the headline
         --------------------------------------------------------------- */}
      <Section
        title="Degree register coverage"
        description="The examinations branch file is the source of truth. A row with no account against it is a graduate the college cannot reach."
        actions={
          canSeeRegister ? (
            <ButtonLink href="/admin/degree-register" variant="secondary" size="sm">
              <ScrollText className="size-4" />
              Open register
            </ButtonLink>
          ) : null
        }
      >
        <div className="grid gap-gutter lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <Card>
            <CardBody className="space-y-5">
              <DonutChart
                value={register.claimed}
                max={register.total}
                label="Degree register coverage"
                caption={`${formatNumber(register.claimed)} of ${formatNumber(register.total)} register rows claimed`}
                size={148}
              />

              <ProportionBar
                label="Degree register rows by claim state"
                segments={[
                  { label: 'Claimed', value: register.claimed, tone: 'brand' },
                  { label: 'No account yet', value: register.unclaimed, tone: 'neutral' },
                ]}
              />

              <MarginNote>
                Coverage is the number to move. Everything else on this page —
                events, jobs, mentors — is a reason for the other{' '}
                {formatNumber(register.unclaimed)} to sign up.
              </MarginNote>

              {canSendComms ? (
                <ButtonLink href="/admin/comms" variant="secondary" size="sm" className="w-full">
                  Draft an outreach message
                  <ArrowRight className="size-4" />
                </ButtonLink>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h3">Coverage by year of passing</CardTitle>
              <CardDescription>
                {worstBatches.length > 0
                  ? `The batches of ${worstBatches.join(', ')} are furthest behind. Those are the WhatsApp groups worth finding first.`
                  : 'Every batch in the register has at least one account against it.'}
              </CardDescription>
            </CardHeader>
            <CardBody className="pt-4">
              <TableWrap caption="Degree register coverage by year of passing">
                <Table>
                  <THead>
                    <TR>
                      <TH>Year</TH>
                      <TH align="right">In register</TH>
                      <TH align="right">Claimed</TH>
                      <TH className="w-40">Coverage</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {register.byYear.map((row) => {
                      const pct = row.total ? row.claimed / row.total : 0;
                      return (
                        <TR key={row.year} interactive>
                          <TD className="font-mono tabular">{row.year}</TD>
                          <TD numeric>{formatNumber(row.total)}</TD>
                          <TD numeric>{formatNumber(row.claimed)}</TD>
                          <TD>
                            <div className="flex items-center gap-2.5">
                              <Progress
                                value={row.claimed}
                                max={row.total}
                                label={`${row.year} coverage`}
                                tone={pct < 0.2 ? 'warning' : 'brand'}
                                className="w-20 shrink-0"
                              />
                              <span className="tabular text-xs text-secondary">
                                {formatPercent(pct)}
                              </span>
                              {pct < 0.2 ? (
                                <Badge tone="warning" className="ml-auto">
                                  Chase
                                </Badge>
                              ) : null}
                            </div>
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              </TableWrap>
            </CardBody>
          </Card>
        </div>
      </Section>

      {/* ---------------------------------------------------------------
          Tiles
         --------------------------------------------------------------- */}
      <Section title="Waiting on someone">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TileLink href={canReview ? '/admin/verification' : null}>
            <Stat
              label="Registrations to review"
              value={formatNumber(stats.pendingVerification)}
              hint={canReview ? 'Decide against the register' : 'Handled by the alumni cell'}
              icon={<FileCheck2 className="size-4" />}
            />
          </TileLink>

          <TileLink href={canReadMembers ? '/admin/members' : null}>
            <Stat
              label="People on the portal"
              value={formatNumber(stats.totalMembers)}
              hint={`${formatNumber(stats.alumni)} alumni · ${formatNumber(stats.students)} final-years`}
              icon={<Users className="size-4" />}
            />
          </TileLink>

          <TileLink href={canRunEvents ? '/admin/events' : '/events'}>
            <Stat
              label="Events upcoming"
              value={formatNumber(stats.eventsUpcoming)}
              hint="Published and open for registration"
              icon={<CalendarDays className="size-4" />}
            />
          </TileLink>

          <TileLink href={canModerateJobs ? '/admin/jobs' : '/jobs'}>
            <Stat
              label="Job posts live"
              value={formatNumber(stats.jobsLive)}
              hint={canModerateJobs ? 'Plus anything held for moderation' : 'Posted by alumni'}
              icon={<Briefcase className="size-4" />}
            />
          </TileLink>
        </div>
      </Section>

      {/* ---------------------------------------------------------------
          Signups
         --------------------------------------------------------------- */}
      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle as="h2">Registrations, last 12 months</CardTitle>
            <CardDescription>
              New accounts per month. The spikes are reunion invitations and convocation week — the
              flat months are what outreach has to fix.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <ColumnChart
              data={stats.signupTrend}
              label="New registrations per month over the last twelve months"
              highlight={stats.signupTrend[stats.signupTrend.length - 1]?.label}
              height={180}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle as="h2">Network health</CardTitle>
            <CardDescription>Whether a request sent through the portal gets answered.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-secondary">Connection accept rate</span>
                <span className="font-display text-xl font-bold tabular">
                  {formatPercent(stats.acceptRate)}
                </span>
              </div>
              <Progress
                value={stats.acceptRate * 100}
                label="Connection accept rate"
                tone={stats.acceptRate >= 0.5 ? 'success' : 'warning'}
              />
              <p className="text-xs text-secondary">
                {formatNumber(stats.connectionsThisMonth)} requests sent this month. Requests that go
                unanswered expire rather than sitting open, so this figure is honest.
              </p>
            </div>

            <ProportionBar
              label="Alumni who have opted in to mentoring"
              segments={[
                { label: 'Open to mentoring', value: stats.openToMentoring, tone: 'success' },
                {
                  label: 'Not offering',
                  value: Math.max(0, stats.alumni - stats.openToMentoring),
                  tone: 'neutral',
                },
              ]}
            />

            <p className="flex items-start gap-2 border-t border-line pt-4 text-xs text-secondary">
              <Handshake className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
              <span>
                Students are rate-limited to five open requests. That valve is the reason alumni keep
                answering at all — it is not a licence quota.
              </span>
            </p>
          </CardBody>
        </Card>
      </div>

      {/* ---------------------------------------------------------------
          Distribution
         --------------------------------------------------------------- */}
      <Section
        title="Where the network is"
        description="Counted across every member record, alumni and final-years together."
      >
        <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h3">Top employers</CardTitle>
              <CardDescription>Useful when the placement cell asks who to approach.</CardDescription>
            </CardHeader>
            <CardBody>
              <BarList data={stats.topCompanies} label="Members by current employer" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h3">Top cities</CardTitle>
              <CardDescription>Where a city chapter meet would actually fill a room.</CardDescription>
            </CardHeader>
            <CardBody>
              <BarList data={stats.topCities} label="Members by city" tone="accent" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h3">By branch</CardTitle>
              <CardDescription>
                CSE dominates because the sanctioned intake does.
              </CardDescription>
            </CardHeader>
            <CardBody>
              <BarList data={stats.departmentDistribution} label="Members by branch" tone="neutral" />
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle as="h3">Alumni by batch</CardTitle>
            <CardDescription>
              Registered alumni accounts per year of passing. Compare against the coverage table above:
              a tall bar here with low coverage means the batch is easy to reach and has not been asked.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <ColumnChart
              data={stats.batchDistribution}
              label="Registered alumni by year of passing"
              height={150}
            />
          </CardBody>
        </Card>
      </Section>
    </div>
  );
}

/** A stat tile that is a link when the viewer can act on it, plain text when not. */
function TileLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <Link
      href={href}
      className="block rounded-lg transition-shadow duration-fast ease-brand hover:shadow-md"
    >
      {children}
    </Link>
  );
}
