import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight, Building2, GraduationCap, MapPin } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { require as requireCap, can } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { searchDirectory } from '@/lib/data/repo';
import type { MemberSummary } from '@/lib/data/types';
import { displayNow, formatNumber, yearIn } from '@/lib/format';
import { joinList } from '@/lib/branding/copy';
import { photoForBatch } from '@/lib/branding/media';
import { batchShareText } from '@/lib/share-text';
import { siteOrigin, whatsappShareUrl } from '@/lib/share';
import { viewerBatchYear } from '@/lib/identity';
import {
  Avatar,
  ButtonLink,
  Card,
  CardBody,
  CardTitle,
  ChipNav,
  CopyButton,
  EmptyState,
  ShareActions,
} from '@/components/ui';
import { BandChip, PageBand } from '@/components/brand/PageBand';
import { BarList } from '@/components/charts';
import { MemberCard } from '@/components/members/MemberCard';

/**
 * One graduating batch, on one page.
 *
 * This is what gets forwarded to a batch WhatsApp group, so it opens on
 * the class itself — "Class of 2017" on the college's band — and puts the
 * people in the first screen on a phone. The share it offers points at
 * the public registration page for the year, because most people in a
 * batch group have not registered and cannot open this page.
 *
 * It is a view over the same query the directory runs — `batchFrom` and
 * `batchTo` set to the same year — so nothing here can show a person the
 * directory would have withheld, and every number is the number the
 * directory would report.
 */

const SHOWN = 24;

/** Same window the directory's own batch filter accepts, deliberately. */
const MIN_YEAR = 1950;
const MAX_YEAR = 2100;

/**
 * The whole cohort in one read, so the summary counts the batch rather
 * than the first page of it. A batch is a few hundred rows at most; in
 * Postgres this is one `count(*) filter (where …)` per figure, which is
 * why the numbers are derived here rather than being stored anywhere.
 */
const COHORT_CAP = 1000;

function parseYear(raw: string): number | null {
  // A mistyped or truncated segment is a 404, not an empty grid. An empty
  // grid tells a reader the batch has nobody in it, which is a different
  // and much more discouraging claim than "that is not an address".
  if (!/^\d{4}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= MIN_YEAR && n <= MAX_YEAR ? n : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>;
}): Promise<Metadata> {
  const { year: raw } = await params;
  const year = parseYear(raw);
  if (year === null) return { title: 'Batch not found' };

  return {
    title: `Class of ${year}`,
    description: `Graduates of ${year} on the portal: where they work and who is open to being asked.`,
  };
}

export default async function BatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.directory) notFound();

  // Identical to /directory: two capabilities lead here, holding either is
  // enough, holding neither is a 403 rather than a thin page.
  const canSearchAlumni = can(session, 'directory.search.alumni');
  const canSearchStudents = can(session, 'directory.search.students');
  if (!canSearchAlumni && !canSearchStudents) requireCap(session, 'directory.search.alumni');

  const { year: raw } = await params;
  const year = parseYear(raw);
  if (year === null) notFound();

  const cohort = searchDirectory(session, {
    batchFrom: year,
    batchTo: year,
    perPage: COHORT_CAP,
    sort: 'relevance',
  });

  // Every batch the viewer can see anything of, for the year switcher.
  // Counted over the same visible-status set as the grid, so the strip
  // never advertises a batch that opens empty for this account.
  const everyBatch = searchDirectory(session, { perPage: 1 }).facets.batches;

  const { total, facets, tier } = cohort;
  const studentTier = tier === 'student';
  const locale = { locale: pack.locale.locale };
  const viewerYear = viewerBatchYear(session);
  const yourBatch = viewerYear === year;

  // Branch chips narrow the grid within the year. The code is checked
  // against this batch's own branches, so it can only ever narrow.
  const sp = await searchParams;
  const rawBranch = (Array.isArray(sp.department) ? sp.department[0] : sp.department)?.trim().toUpperCase();
  const branch = facets.departments.find((d) => d.value === rawBranch) ?? null;
  const people = branch ? cohort.items.filter((m) => m.departmentCode === branch.value) : cohort.items;

  // The viewer's own card first on their own batch, then the people who
  // have said yes to being asked, then everyone else in relevance order.
  const own = yourBatch ? people.filter((m) => m.id === session.memberId) : [];
  const others = people.filter((m) => !own.includes(m));
  const ordered = [...own, ...others.filter((m) => m.openToMentoring), ...others.filter((m) => !m.openToMentoring)];
  const shown = ordered.slice(0, SHOWN);
  const remaining = Math.max(0, people.length - shown.length);

  const mentors = people.filter((m) => m.openToMentoring).length;
  const companies = countBy(people, (m) => m.currentCompany);
  const cities = studentTier ? [] : countBy(people, (m) => m.city);

  const directoryHref = `/directory?batchFrom=${year}&batchTo=${year}${
    branch ? `&department=${encodeURIComponent(branch.value)}` : ''
  }`;
  const filtered = (key: 'company' | 'city', value: string) => `${directoryHref}&${key}=${encodeURIComponent(value)}`;

  const origin = await siteOrigin();
  const registrationUrl = `${origin}/claim?year=${year}`;
  const shareText = batchShareText(pack, year);
  const whatsappHref = whatsappShareUrl(shareText, registrationUrl);

  const since = yearIn(pack.locale.timeZone, displayNow()) - year;
  const lead =
    since > 1
      ? `${since} years since graduation`
      : since === 1
        ? '1 year since graduation'
        : since === 0
          ? 'Graduated this year'
          : `Graduating in ${year}`;

  const years = everyBatch
    .map((b) => Number(b.value))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a);
  const nearest =
    years.length === 0
      ? null
      : years.reduce((best, y) => (Math.abs(y - year) < Math.abs(best - year) ? y : best), years[0]!);

  // "14 batchmates are here · 6 happy to mentor · working at Amazon,
  // Google, Deloitte and 6 more". A part whose figure is 0 or 1 is left
  // out rather than said.
  const summary: string[] = [];
  if (people.length >= 2) {
    summary.push(`${formatNumber(people.length, locale)} ${yourBatch && !branch ? 'batchmates are' : 'from this batch are'} here`);
  }
  // Students read the mentor count in the heading over the grid.
  if (mentors >= 2 && !studentTier) summary.push(`${formatNumber(mentors, locale)} happy to mentor`);
  if (companies.length > 0) {
    const top = companies.slice(0, 3).map((c) => c.label);
    const rest = companies.length - top.length;
    summary.push(
      rest >= 2
        ? `working at ${top.join(', ')} and ${rest} more`
        : `working at ${joinList(companies.map((c) => c.label))}`,
    );
  }

  const band = (
    <PageBand
      pack={pack}
      eyebrow={pack.copy.institutionName}
      title={`Class of ${year}`}
      lead={lead}
      photo={photoForBatch(pack, year)}
      photoOnPhones
      meta={yourBatch ? <BandChip icon={<GraduationCap />}>Your batch</BandChip> : undefined}
      actions={
        total > 0 ? (
          <div className="w-full space-y-3">
            {!studentTier ? (
              <div className="space-y-2">
                <p className="text-sm text-band-muted">Invite batchmates who have not registered yet</p>
                <ShareActions band url={registrationUrl} whatsappHref={whatsappHref} title={`Class of ${year}`} />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {!studentTier ? (
                <CopyButton
                  text={`${origin}/directory/batch/${year}`}
                  label="Copy link to this page"
                  copiedLabel="Link copied"
                  variant="band-outline"
                />
              ) : null}
              <ButtonLink
                href={`/directory?batchFrom=${year}&batchTo=${year}`}
                variant={studentTier ? 'band' : 'band-outline'}
                className="min-h-11"
              >
                Open in directory
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
            </div>
          </div>
        ) : undefined
      }
    />
  );

  const yearStrip =
    years.length > 1 ? (
      <nav aria-labelledby="other-batches" className="space-y-2">
        <h2 id="other-batches" className="text-xs font-semibold uppercase tracking-wider text-secondary">
          Other batches
        </h2>
        <ChipNav
          ariaLabel="Batches"
          items={years.map((y) => ({
            label: y === viewerYear ? `${y} · Your batch` : String(y),
            href: `/directory/batch/${y}`,
            active: y === year,
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
          title={`No one from ${year} has joined yet.`}
          action={
            <div className="flex flex-col items-center gap-3">
              {!studentTier ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-primary">Send the registration link</p>
                  <ShareActions url={registrationUrl} whatsappHref={whatsappHref} title={`Class of ${year}`} />
                </div>
              ) : null}
              {nearest !== null && nearest !== year ? (
                <Link href={`/directory/batch/${nearest}`} className="link inline-flex min-h-11 items-center text-sm">
                  See the class of {nearest}
                </Link>
              ) : null}
            </div>
          }
        />
        {yearStrip}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {band}

      {summary.length ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <FacePile people={shown.slice(0, 5)} />
          <p className="min-w-0 text-md text-primary sm:flex-1">{summary.join(' · ')}</p>
        </div>
      ) : null}

      {facets.departments.length > 1 ? (
        <div className="space-y-1">
          <ChipNav
            ariaLabel={`Branches in the class of ${year}`}
            items={[
              { label: 'All branches', href: `/directory/batch/${year}`, active: !branch, count: total },
              ...facets.departments.map((d) => ({
                label: d.value,
                href: `/directory/batch/${year}?department=${encodeURIComponent(d.value)}`,
                active: branch?.value === d.value,
                count: d.count,
              })),
            ]}
          />
          {branch ? (
            <Link
              href={`/directory/branch/${encodeURIComponent(branch.value)}`}
              className="link inline-flex min-h-11 items-center gap-1.5 text-sm font-medium sm:min-h-8"
            >
              {branch.value} across all years
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      ) : null}

      <section aria-labelledby="batch-people" className="space-y-4">
        <h2 id="batch-people" className="font-display text-xl font-semibold">
          {studentTier
            ? `Graduates of ${year}${branch ? ` in ${branch.value}` : ''}${mentors >= 2 ? ` — ${mentors} happy to mentor` : ''}`
            : `${formatNumber(people.length, locale)} ${people.length === 1 ? 'person' : 'people'}${branch ? ` from ${branch.value}` : ''}`}
        </h2>

        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface-raised shadow-sm sm:hidden">
          {shown.map((member) => (
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
          {shown.map((member) => (
            // `relative` so the card's overlay link covers the tile and
            // nothing outside it.
            <li key={member.id} className="relative min-w-0">
              <MemberCard member={member} className="h-full" isViewer={member.id === session.memberId} />
            </li>
          ))}
        </ul>

        {remaining > 0 ? (
          <ButtonLink href={directoryHref} variant="secondary" className="min-h-11 sm:min-h-0">
            See all {formatNumber(people.length, locale)} in the directory
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        ) : null}
      </section>

      {companies.length || cities.length ? (
        <div className={`grid grid-cols-1 gap-gutter [&>*]:min-w-0 ${companies.length && cities.length ? 'lg:grid-cols-2 lg:items-start' : ''}`}>
          {companies.length ? (
            <Tally
              title="Where they work"
              icon={<Building2 className="size-4" />}
              label={`Employers in the class of ${year}`}
              items={companies}
              href={(v) => filtered('company', v)}
            />
          ) : null}
          {cities.length ? (
            <Tally
              title="Where they live now"
              icon={<MapPin className="size-4" />}
              label={`Cities the class of ${year} lives in`}
              items={cities}
              href={(v) => filtered('city', v)}
            />
          ) : null}
        </div>
      ) : null}

      {yearStrip}

      {!studentTier ? (
        <p className="border-t border-line pt-4 text-sm text-secondary">
          Share the registration link, not a list of names. Everyone signs in before they see anyone.
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------

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
}: {
  title: string;
  icon: React.ReactNode;
  label: string;
  items: Tallied[];
  href: (value: string) => string;
}) {
  const chips = items[0]!.count <= 2;
  const limit = chips ? 12 : 6;
  const more = items.length - limit;

  return (
    <Card>
      <CardBody className="space-y-3">
        <CardTitle as="h2" className="flex items-center gap-2">
          <span className="text-muted" aria-hidden="true">
            {icon}
          </span>
          {title}
        </CardTitle>
        {chips ? (
          <ul className="flex flex-wrap gap-1.5" aria-label={label}>
            {items.slice(0, limit).map((i) => (
              <li key={i.label}>
                <Link
                  href={href(i.label)}
                  className="inline-flex min-h-11 items-center rounded-full border border-line px-3 text-sm text-secondary transition-colors duration-fast ease-brand hover:border-line-strong hover:text-primary sm:min-h-8"
                >
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
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

/** A few faces from the batch. Decorative: the sentence beside it carries the facts. */
function FacePile({ people }: { people: MemberSummary[] }) {
  if (people.length < 2) return null;
  return (
    <span className="flex shrink-0 -space-x-2" aria-hidden="true">
      {people.map((m) => (
        <span key={m.id} className="rounded-full bg-surface p-0.5">
          <Avatar name={m.fullName} src={m.photoUrl} size="md" />
        </span>
      ))}
    </span>
  );
}
