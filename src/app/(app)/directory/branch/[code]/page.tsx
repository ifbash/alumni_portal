import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight, Building2, GraduationCap, MapPin, Mic } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { require as requireCap, can } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDepartments, searchDirectory } from '@/lib/data/repo';
import type { Department, MemberSummary } from '@/lib/data/types';
import { formatNumber, formatPercent } from '@/lib/format';
import { joinList } from '@/lib/branding/copy';
import { photoForBranch } from '@/lib/branding/media';
import { portalShareText } from '@/lib/share-text';
import { siteOrigin, whatsappShareUrl } from '@/lib/share';
import { viewerBatchYear, viewerBranch } from '@/lib/identity';
import {
  ButtonLink,
  Card,
  CardBody,
  CardTitle,
  ChipNav,
  EmptyState,
  ShareActions,
} from '@/components/ui';
import { BandChip, PageBand } from '@/components/brand/PageBand';
import { BarList, ColumnChart } from '@/components/charts';
import { MemberCard } from '@/components/members/MemberCard';

/**
 * One department, across every batch.
 *
 * "My branch" is the second search everybody runs, and it is the one an
 * HOD runs on behalf of a whole department — for a guest lecture, a
 * placement drive, the graduates who might take a call. So the page leads
 * with the people and the shape of the department over time: which years
 * are here, where they work, who will help.
 *
 * A view over the directory's own `department` filter, so it can never
 * show a person the directory would have withheld, and every link out
 * hands the reader the same search with the filter pre-applied. No
 * establishment year or intake appears: those are the college's facts to
 * confirm, not ours to print.
 */

const SHOWN = 24;

/** See the batch page — the summary counts the department, not a page of it. */
const COHORT_CAP = 2000;

/** Roles that organise talks and drives rather than attend them. */
const STAFF_ROLES = new Set(['faculty', 'hod', 'placement_officer', 'alumni_cell_operator', 'college_admin']);

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
    description: `${department.name} (${department.code}) graduates on the portal: their batches, where they work, and who is open to being asked.`,
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

  const { total, tier } = cohort;
  const studentTier = tier === 'student';
  const isStaff = session.roles.some((r) => STAFF_ROLES.has(r.role));
  const showCoverage = tier === 'privileged' || isStaff;
  const locale = { locale: pack.locale.locale };
  const dcode = department.code;
  const enc = encodeURIComponent(dcode);
  const directoryHref = `/directory?department=${enc}`;

  // Graduates and final-years are counted apart: staff see both, and
  // "240 graduates" must not include the class still sitting exams.
  const graduates = cohort.items.filter((m) => !m.isStudent);
  const finalYears = cohort.items.length - graduates.length;
  const mentorList = graduates.filter((m) => m.openToMentoring);
  const mentors = mentorList.length;
  const traceable = graduates.filter((m) => Boolean(m.currentCompany)).length;

  const companies = countBy(graduates, (m) => m.currentCompany);
  const cities = studentTier ? [] : countBy(graduates, (m) => m.city);

  // Oldest first: a department reads as a timeline.
  const byBatch = countBy(graduates, (m) => (m.batchYear ? String(m.batchYear) : null))
    .map((b) => ({ label: b.label, value: b.count, year: Number(b.label) }))
    .sort((a, b) => a.year - b.year);
  const peak = Math.max(0, ...byBatch.map((b) => b.value));
  const viewerYear = viewerBatchYear(session);
  const highlight = viewerYear && byBatch.some((b) => b.year === viewerYear) ? String(viewerYear) : undefined;

  const origin = await siteOrigin();
  const registrationUrl = `${origin}/claim`;
  const whatsappHref = whatsappShareUrl(portalShareText(pack), registrationUrl);

  const lead = [
    graduates.length > 0
      ? `${formatNumber(graduates.length, locale)} ${graduates.length === 1 ? 'graduate' : 'graduates'} on the portal`
      : null,
    mentors >= 2 ? `${formatNumber(mentors, locale)} happy to mentor` : null,
    finalYears >= 2 ? `${formatNumber(finalYears, locale)} final-year students` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Staff read the chart as coverage: which batches are thin, and so
  // worth chasing. Built from the counts on this page; no intake figure.
  const thinnest =
    byBatch.length >= 4
      ? [...byBatch].sort((a, b) => a.value - b.value || a.year - b.year).slice(0, 2).map((b) => b.label).sort()
      : [];
  const coverage = showCoverage && graduates.length > 0
    ? `${formatPercent(traceable / graduates.length)} of ${dcode} graduates here have a current employer on record.${
        thinnest.length ? ` The thinnest batches, ${joinList(thinnest)}, are the ones worth chasing.` : ''
      }`
    : null;

  const departments = getDepartments();
  const isYourBranch = viewerBranch(session) === dcode;

  const band = (
    <PageBand
      pack={pack}
      eyebrow={pack.copy.institutionName}
      title={department.name}
      lead={total > 0 ? lead || undefined : undefined}
      photo={photoForBranch(pack, dcode)}
      photoOnPhones
      meta={isYourBranch ? <BandChip icon={<GraduationCap />}>Your branch</BandChip> : undefined}
      actions={
        total > 0 ? (
          <div className="w-full space-y-3">
            {!studentTier ? (
              <div className="space-y-2">
                <p className="text-sm text-band-muted">Invite {dcode} graduates who have not registered yet</p>
                <ShareActions band url={registrationUrl} whatsappHref={whatsappHref} title={department.name} />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={directoryHref} variant={studentTier ? 'band' : 'band-outline'} className="min-h-11">
                Open in directory
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
              {isStaff ? (
                <ButtonLink href={`${directoryHref}&speaking=1`} variant="band-outline" className="min-h-11">
                  <Mic className="size-4" aria-hidden="true" />
                  Find speakers
                </ButtonLink>
              ) : null}
            </div>
          </div>
        ) : undefined
      }
    />
  );

  const otherBranches =
    departments.length > 1 ? (
      <nav aria-labelledby="other-branches" className="space-y-2">
        <h2 id="other-branches" className="text-xs font-semibold uppercase tracking-wider text-secondary">
          Other branches
        </h2>
        <ChipNav
          ariaLabel="Branches"
          items={departments.map((d) => ({
            label: d.code,
            href: `/directory/branch/${encodeURIComponent(d.code)}`,
            active: d.code === dcode,
          }))}
        />
      </nav>
    ) : null;

  if (total === 0) {
    return (
      <div className="space-y-6">
        {band}
        <EmptyState
          icon={<GraduationCap className="size-5" />}
          title={`No ${dcode} graduates have joined yet.`}
          action={
            !studentTier ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-primary">Send the registration link</p>
                <ShareActions url={registrationUrl} whatsappHref={whatsappHref} title={department.name} />
              </div>
            ) : (
              <ButtonLink href="/directory" variant="secondary" className="min-h-11 sm:min-h-0">
                Search every branch
              </ButtonLink>
            )
          }
        />
        {otherBranches}
      </div>
    );
  }

  const chart =
    byBatch.length > 1 ? (
      <Card>
        <CardBody className="space-y-4">
          <div className="space-y-1">
            <CardTitle as="h2" className="flex items-center gap-2">
              <GraduationCap className="size-4 text-muted" aria-hidden="true" />
              Graduates by batch
            </CardTitle>
            <p className="text-sm text-secondary">
              Each column opens that batch in the directory.
              {highlight ? ` Your batch, ${highlight}, is marked.` : ''}
            </p>
          </div>
          {peak >= 3 ? (
            <>
              {/* Four-digit years truncate under a narrow column on a phone,
                  so phones get the two-digit form ("’17"). */}
              {[
                { className: 'hidden sm:block', short: false },
                { className: 'sm:hidden', short: true },
              ].map((v) => (
                <ColumnChart
                  key={v.className}
                  className={v.className}
                  label={`${dcode} graduates by batch`}
                  highlight={highlight ? (v.short ? shortYear(highlight) : highlight) : undefined}
                  showValues
                  data={byBatch.map((b) => ({
                    label: v.short ? shortYear(b.label) : b.label,
                    value: b.value,
                    href: `/directory?department=${enc}&batchFrom=${b.label}&batchTo=${b.label}`,
                  }))}
                />
              ))}
            </>
          ) : (
            <LinkChips
              label={`${dcode} graduates by batch`}
              items={byBatch.map((b) => ({
                label: b.label,
                href: `/directory?department=${enc}&batchFrom=${b.label}&batchTo=${b.label}`,
              }))}
            />
          )}
          {coverage ? <p className="border-t border-line pt-3 text-sm text-secondary">{coverage}</p> : null}
        </CardBody>
      </Card>
    ) : null;

  const employers = companies.length ? (
    <Tally
      title={`Where ${dcode} graduates work`}
      icon={<Building2 className="size-4" />}
      label={`Employers of ${dcode} graduates`}
      items={companies}
      href={(v) => `${directoryHref}&company=${encodeURIComponent(v)}`}
    />
  ) : null;

  const topCities = cities.slice(0, 2).filter((c) => c.count >= 2);
  const places = cities.length ? (
    <Tally
      title="Where they live now"
      icon={<MapPin className="size-4" />}
      label={`Cities ${dcode} graduates live in`}
      items={cities}
      href={(v) => `${directoryHref}&city=${encodeURIComponent(v)}`}
      note={
        topCities.length === 2
          ? `${topCities[0]!.label} and ${topCities[1]!.label} have the most ${dcode} graduates.`
          : topCities.length === 1
            ? `${topCities[0]!.label} has the most ${dcode} graduates.`
            : undefined
      }
    />
  ) : null;

  const availability = (
    <ChipNav
      ariaLabel={`${dcode} graduates open to being asked`}
      items={[
        { label: 'Mentors', href: `${directoryHref}&mentoring=1` },
        { label: 'Referrals', href: `${directoryHref}&referrals=1` },
        { label: 'Speakers', href: `${directoryHref}&speaking=1` },
      ]}
    />
  );

  // Students get a shorter first list: the employers below are the other
  // half of what they came for.
  const shownPeople = studentTier ? mentorList.slice(0, 12) : cohort.items.slice(0, SHOWN);
  const peopleTotal = studentTier ? mentors : total;

  const people = (
    <section aria-labelledby="branch-people" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="branch-people" className="font-display text-xl font-semibold">
          {studentTier
            ? `${dcode} graduates who mentor`
            : `${formatNumber(total, locale)} ${total === 1 ? 'person' : 'people'} from ${dcode}`}
        </h2>
        {!studentTier ? availability : null}
      </div>

      {shownPeople.length ? (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface-raised shadow-sm sm:hidden">
            {shownPeople.map((member) => (
              <li key={member.id} className="relative min-w-0">
                <MemberCard
                  member={member}
                  variant="row"
                  isViewer={member.id === session.memberId}
                  className="min-h-0 rounded-none border-0 py-2 shadow-none hover:bg-surface-sunken hover:shadow-none"
                />
              </li>
            ))}
          </ul>
          <ul className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-3">
            {shownPeople.map((member) => (
              // `relative` so the card's overlay link covers the tile and
              // nothing outside it.
              <li key={member.id} className="relative min-w-0">
                <MemberCard member={member} className="h-full" isViewer={member.id === session.memberId} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState
          variant="inline"
          title={`No ${dcode} graduate has said yes to mentoring yet.`}
          action={
            <Link href={directoryHref} className="link inline-flex min-h-11 items-center sm:min-h-0">
              See everyone from {dcode}
            </Link>
          }
        />
      )}

      {peopleTotal > shownPeople.length ? (
        <ButtonLink
          href={studentTier ? `${directoryHref}&mentoring=1` : directoryHref}
          variant="secondary"
          className="min-h-11 sm:min-h-0"
        >
          See all {formatNumber(peopleTotal, locale)} in the directory
          <ArrowRight className="size-4" aria-hidden="true" />
        </ButtonLink>
      ) : null}
    </section>
  );

  return (
    <div className="space-y-6">
      {band}

      {studentTier ? (
        <>
          {people}
          {employers || chart ? (
            <div className={`grid grid-cols-1 gap-gutter [&>*]:min-w-0 ${employers && chart ? 'lg:grid-cols-2 lg:items-start' : ''}`}>
              {employers}
              {chart}
            </div>
          ) : null}
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-secondary">Also open to being asked</h2>
            {availability}
          </div>
        </>
      ) : (
        <>
          {chart}
          {employers || places ? (
            <div className={`grid grid-cols-1 gap-gutter [&>*]:min-w-0 ${employers && places ? 'lg:grid-cols-2 lg:items-start' : ''}`}>
              {employers}
              {places}
            </div>
          ) : null}
          {people}
        </>
      )}

      {otherBranches}

      <p className="border-t border-line pt-4 text-sm text-secondary">
        Figures come from what members recorded on their own profiles, not from a placement report.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------

/** "2017" → "’17". */
function shortYear(year: string): string {
  return `’${year.slice(-2)}`;
}

type Tallied = { label: string; count: number };

/** Distinct values with how often each occurs, most common first. */
function countBy(rows: MemberSummary[], get: (m: MemberSummary) => string | null | undefined): Tallied[] {
  const map = new Map<string, number>();
  for (const m of rows) {
    const v = get(m)?.trim();
    if (v) map.set(v, (map.get(v) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ label, count }));
}

function LinkChips({ label, items }: { label: string; items: Array<{ label: string; href: string }> }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={label}>
      {items.map((i) => (
        <li key={i.href}>
          <Link
            href={i.href}
            className="inline-flex min-h-11 items-center rounded-full border border-line px-3 text-sm text-secondary transition-colors duration-fast ease-brand hover:border-line-strong hover:text-primary sm:min-h-8"
          >
            {i.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Employers or cities. When the most common value has two people or
 * fewer, bars would be a row of equal slivers, so it is a wrap of linked
 * chips instead; otherwise a bar list whose rows link to the filtered
 * directory.
 */
function Tally({
  title,
  icon,
  label,
  items,
  href,
  note,
}: {
  title: string;
  icon: React.ReactNode;
  label: string;
  items: Tallied[];
  href: (value: string) => string;
  note?: string;
}) {
  const chips = items[0]!.count <= 2;
  const limit = chips ? 12 : 6;
  const more = items.length - limit;

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="space-y-1">
          <CardTitle as="h2" className="flex items-center gap-2">
            <span className="text-muted" aria-hidden="true">
              {icon}
            </span>
            {title}
          </CardTitle>
          {note ? <p className="text-sm text-secondary">{note}</p> : null}
        </div>
        {chips ? (
          <LinkChips label={label} items={items.slice(0, limit).map((i) => ({ label: i.label, href: href(i.label) }))} />
        ) : (
          <BarList
            label={label}
            data={items.slice(0, limit).map((i) => ({ label: i.label, value: i.count, href: href(i.label) }))}
          />
        )}
        {more > 0 ? <p className="text-sm text-secondary">And {more} more.</p> : null}
      </CardBody>
    </Card>
  );
}
