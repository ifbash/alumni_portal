import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  GraduationCap,
  Handshake,
  Link2,
  MapPin,
  UserCheck,
  Users,
} from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { require as requireCap, can } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDepartments, searchDirectory } from '@/lib/data/repo';
import type { Department } from '@/lib/data/types';
import { formatNumber, formatPercent } from '@/lib/format';
import {
  Alert,
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardTitle,
  EmptyState,
  PageHeader,
  SegmentedNav,
  Section,
  Stat,
} from '@/components/ui';
import { BarList, ColumnChart } from '@/components/charts';
import { MemberCard } from '@/components/members/MemberCard';
import { MarginNote } from '@/components/brand/Marks';

/**
 * One department, across every batch.
 *
 * "My branch" is the second search everybody runs, and it is the one an
 * HOD runs on behalf of a whole department — for an accreditation return,
 * for a guest lecture, for the three graduates who might take a call about
 * a placement drive. So the page leads with the shape of the department
 * over time rather than with a grid: how many claimed records exist, which
 * years they came from, and how many of them can still be reached.
 *
 * A view over the directory's own `department` filter, so it can never
 * show a person the directory would have withheld, and the link out hands
 * the reader the same search with the filter pre-applied.
 */

const SHOWN = 24;

/** See the batch page — the summary counts the department, not a page of it. */
const COHORT_CAP = 2000;

/**
 * Valid codes come from the register, never from the URL. A department
 * that does not exist is a 404: an empty grid would imply the college runs
 * a branch it does not, which is the kind of small untruth an accreditation
 * reviewer notices.
 */
function findDepartment(raw: string): Department | null {
  const code = decodeURIComponent(raw).trim().toUpperCase();
  return getDepartments().find((d) => d.code === code) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const department = findDepartment(code);
  if (!department) return { title: 'Branch not found' };

  return {
    title: department.name,
    description: `Graduates and final-years from ${department.name} (${department.code}) — batches, employers, cities, and who is open to being asked something.`,
  };
}

export default async function BranchPage({ params }: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.directory) notFound();

  const canSearchAlumni = can(session, 'directory.search.alumni');
  const canSearchStudents = can(session, 'directory.search.students');
  if (!canSearchAlumni && !canSearchStudents) requireCap(session, 'directory.search.alumni');

  const { code } = await params;
  const department = findDepartment(code);
  if (!department) notFound();

  const cohort = searchDirectory(session, {
    department: department.code,
    perPage: COHORT_CAP,
    sort: 'relevance',
  });

  const { total, facets, tier } = cohort;
  const shown = cohort.items.slice(0, SHOWN);
  const remaining = Math.max(0, total - shown.length);

  const traceable = cohort.items.filter((m) => Boolean(m.currentCompany)).length;
  const mentors = cohort.items.filter((m) => m.openToMentoring).length;
  const referrers = cohort.items.filter((m) => m.openToReferrals).length;

  const locale = { locale: pack.locale.locale };
  const directoryHref = `/directory?department=${encodeURIComponent(department.code)}`;

  // Oldest first: a department reads as a timeline, and the story is
  // whether the recent batches are better represented than the old ones.
  const byBatch = [...facets.batches]
    .map((b) => ({ label: b.value, value: b.count, year: Number(b.value) }))
    .filter((b) => Number.isFinite(b.year))
    .sort((a, b) => a.year - b.year);

  const firstYear = byBatch[0]?.year ?? null;
  const lastYear = byBatch[byBatch.length - 1]?.year ?? null;
  const departments = getDepartments();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[{ label: 'Directory', href: '/directory' }, { label: department.code }]}
          />
        }
        eyebrow={department.code}
        title={department.name}
        description={
          total === 0
            ? `No ${department.code} graduate has claimed a record yet. The degree register is loaded department by department from the examinations branch, and the page fills as those graduates verify themselves against it.`
            : `${formatNumber(total, locale)} ${total === 1 ? 'person' : 'people'} from ${department.code} have claimed their record${firstYear && lastYear && firstYear !== lastYear ? `, across the ${firstYear}–${lastYear} batches` : ''}. Send this address to a department group as it is — whoever opens it signs in first.`
        }
        actions={
          total > 0 ? (
            <ButtonLink href={directoryHref} variant="secondary">
              Open in the directory
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
          ) : null
        }
      />

      {/* Switching branch is the commonest thing to do next, and it has to
          survive a 360px screen — hence a scroller rather than a wrap. */}
      {departments.length > 1 ? (
        <div className="-mx-1 max-w-full overflow-x-auto px-1 pb-1">
          <SegmentedNav
            items={departments.map((d) => ({
              label: d.code,
              href: `/directory/branch/${d.code}`,
              active: d.code === department.code,
            }))}
          />
        </div>
      ) : null}

      {total === 0 ? (
        <>
          <EmptyState
            icon={<GraduationCap className="size-5" />}
            title={`Nobody from ${department.code} is on the portal yet`}
            description={`${department.name} has run since ${department.established ?? 'the college opened'}, so the graduates exist — they have not been matched against the degree register yet. That is a loading job, not a sign-up problem.`}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink href="/directory">Search every branch</ButtonLink>
                {departments.find((d) => d.code !== department.code) ? (
                  <ButtonLink
                    href={`/directory/branch/${departments.find((d) => d.code !== department.code)!.code}`}
                    variant="secondary"
                  >
                    Try {departments.find((d) => d.code !== department.code)!.code}
                  </ButtonLink>
                ) : null}
              </div>
            }
          />

          <Card className="mx-auto max-w-prose">
            <CardBody className="space-y-3">
              <CardTitle as="h2">What fills this page</CardTitle>
              <p className="text-sm text-secondary">
                Two things, in order. The examinations branch supplies the degree register for the
                department — roll number, name, year of passing, every batch. Then each graduate who
                registers is matched against it, automatically where the match is confident and by
                the alumni cell where it is not.
              </p>
              <p className="text-sm text-secondary">
                Until the first of those has happened for {department.code}, this page has nothing
                honest to show, and showing a partial list would be worse than showing none.
              </p>
            </CardBody>
          </Card>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="On the portal"
              value={formatNumber(total, locale)}
              hint={`from ${department.code}`}
              icon={<Users className="size-4" />}
            />
            <Stat
              label="Traceable today"
              value={formatNumber(traceable, locale)}
              hint={`${formatPercent(traceable / total)} have a current employer on record`}
              icon={<Building2 className="size-4" />}
            />
            <Stat
              label="Open to mentoring"
              value={formatNumber(mentors, locale)}
              hint="for final-years in this branch"
              icon={<UserCheck className="size-4" />}
            />
            <Stat
              label="Open to referrals"
              value={formatNumber(referrers, locale)}
              hint="for a specific opening"
              icon={<Handshake className="size-4" />}
            />
          </div>

          {byBatch.length > 1 ? (
            <Card>
              <CardBody className="space-y-4">
                <div className="space-y-1">
                  <CardTitle as="h2" className="flex items-center gap-2">
                    <GraduationCap className="size-4 text-muted" aria-hidden="true" />
                    Claimed records by batch
                  </CardTitle>
                  <p className="max-w-prose text-sm text-secondary">
                    Recent batches are always better represented — they were reachable when the
                    portal launched. The older years are the ones worth chasing, and each column
                    below is a page you can send to that batch&apos;s group.
                  </p>
                </div>

                <ColumnChart
                  data={byBatch.map((b) => ({ label: b.label, value: b.value }))}
                  label={`${department.code} members by graduating batch`}
                />

                <ul className="flex flex-wrap gap-2 border-t border-line pt-4">
                  {byBatch
                    .slice()
                    .reverse()
                    .slice(0, 8)
                    .map((b) => (
                      <li key={b.label}>
                        <Link href={`/directory/batch/${b.label}`} className="link-quiet">
                          <Badge tone="outline" className="gap-2">
                            <span className="font-semibold">{b.label}</span>
                            <span className="text-muted">·</span>
                            <span className="tabular">{formatNumber(b.value, locale)}</span>
                          </Badge>
                        </Link>
                      </li>
                    ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          <div className="grid gap-gutter lg:grid-cols-2">
            <Card>
              <CardBody className="space-y-4">
                <div className="space-y-1">
                  <CardTitle as="h2" className="flex items-center gap-2">
                    <Building2 className="size-4 text-muted" aria-hidden="true" />
                    Where {department.code} graduates work
                  </CardTitle>
                  <p className="text-sm text-secondary">
                    From the employer each person last recorded on their own profile. It is not a
                    placement report and should never be quoted as one.
                  </p>
                </div>

                <BarList
                  data={facets.companies.slice(0, 6).map((c) => ({ label: c.label, value: c.count }))}
                  label={`Most common employers among ${department.code} members`}
                />

                {facets.industries.length > 1 ? (
                  <p className="text-xs text-muted">
                    Spread across {facets.industries.length} industries.{' '}
                    <Link href={directoryHref} className="link">
                      Filter the branch by industry
                    </Link>
                    .
                  </p>
                ) : null}
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-4">
                <div className="space-y-1">
                  <CardTitle as="h2" className="flex items-center gap-2">
                    <MapPin className="size-4 text-muted" aria-hidden="true" />
                    Where they are now
                  </CardTitle>
                  <p className="text-sm text-secondary">
                    Useful before you plan anything that needs people in a room — an alumni meet in
                    Vijayawada reaches a different set from one in Hyderabad.
                  </p>
                </div>

                <BarList
                  data={facets.cities.slice(0, 6).map((c) => ({ label: c.label, value: c.count }))}
                  label={`Cities ${department.code} members live in`}
                  tone="accent"
                />

                {tier === 'student' ? (
                  <p className="text-xs text-muted">
                    These are counts, not addresses. Individual locations are not shown to students
                    on the profile cards below.
                  </p>
                ) : null}
              </CardBody>
            </Card>
          </div>

          {department.intake || department.established ? (
            <Alert tone="info" title="Read the numbers above against the intake, not against zero">
              <p>
                {department.name} has been running
                {department.established ? ` since ${department.established}` : ''}
                {department.intake
                  ? ` with a sanctioned intake of ${formatNumber(department.intake, locale)} seats a year`
                  : ''}
                . Far more {department.code} graduates exist than have claimed a record here, and the
                gap is what verification closes — so treat {formatNumber(total, locale)} as coverage
                so far, never as the size of the department.
              </p>
            </Alert>
          ) : null}

          <Section
            title={`${formatNumber(total, locale)} ${total === 1 ? 'person' : 'people'}`}
            description={
              remaining > 0
                ? `Showing the ${shown.length} most complete profiles. The remaining ${formatNumber(remaining, locale)} are in the directory under the same filter.`
                : `Everyone from ${department.code} who is on the portal.`
            }
            actions={
              mentors > 0 ? (
                <Badge tone="success" dot>
                  {mentors} open to mentoring
                </Badge>
              ) : null
            }
          >
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((member) => (
                // `relative` so the card's overlay link covers the tile and
                // nothing outside it.
                <li key={member.id} className="relative">
                  <MemberCard member={member} className="h-full" />
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <ButtonLink href={directoryHref}>
                {remaining > 0
                  ? `See all ${formatNumber(total, locale)} in the directory`
                  : 'Open this branch in the directory'}
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href={`${directoryHref}&mentoring=1`} variant="ghost" size="sm">
                Only those open to mentoring
              </ButtonLink>
            </div>
          </Section>

          <Alert
            tone="neutral"
            title="This page is a view, not an export"
            icon={<Link2 className="size-4" />}
          >
            <p>
              Everyone who opens it sees what their own account is entitled to and nothing more.
              Taking the department&apos;s contact details out of the portal in bulk is a separate,
              college-admin-only action that is logged with the actor, the scope and a stated reason.
            </p>
          </Alert>
        </>
      )}

      <MarginNote className="max-w-prose border-t border-line pt-4">
        CGPA and placement status are placement-side data and appear nowhere on this page, whichever
        role is reading it. Alumni post jobs here; they do not get to read an academic record.
      </MarginNote>
    </div>
  );
}
