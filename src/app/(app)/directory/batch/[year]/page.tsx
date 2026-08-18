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
import { searchDirectory } from '@/lib/data/repo';
import { formatNumber, formatPercent, yearsOut } from '@/lib/format';
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
import { BarList } from '@/components/charts';
import { MemberCard } from '@/components/members/MemberCard';
import { MarginNote } from '@/components/brand/Marks';

/**
 * One graduating batch, on one page.
 *
 * This route exists because `/directory/batch/2017` is what actually gets
 * pasted into a batch WhatsApp group, and that group is the real
 * distribution channel for this product — not email, not a notice board.
 * A link someone forwards has to open into something that looks
 * deliberate to a stranger who has never seen the portal, on a phone, in
 * one screen: how many of us are here, where we ended up, who is willing
 * to be asked something.
 *
 * It is a view over the same query the directory runs — `batchFrom` and
 * `batchTo` set to the same year — so nothing here can show a person the
 * directory would have withheld, and every number is the number the
 * directory would report. The link out at the bottom hands the reader the
 * full search with the filter already applied, which is the only way to
 * widen it.
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
    title: `Batch of ${year}`,
    description: `Everyone from the ${year} graduating batch who has claimed their record — branch, where they work now, and who is open to being asked something.`,
  };
}

export default async function BatchPage({ params }: { params: Promise<{ year: string }> }) {
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
  const shown = cohort.items.slice(0, SHOWN);
  const remaining = Math.max(0, total - shown.length);

  const traceable = cohort.items.filter((m) => Boolean(m.currentCompany)).length;
  const mentors = cohort.items.filter((m) => m.openToMentoring).length;
  const referrers = cohort.items.filter((m) => m.openToReferrals).length;

  const locale = { locale: pack.locale.locale };
  const directoryHref = `/directory?batchFrom=${year}&batchTo=${year}`;

  const years = everyBatch
    .map((b) => Number(b.value))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  const previous = [...years].reverse().find((y) => y < year) ?? null;
  const next = years.find((y) => y > year) ?? null;
  const nearest =
    years.length === 0
      ? null
      : years.reduce((best, y) => (Math.abs(y - year) < Math.abs(best - year) ? y : best), years[0]!);

  const out = yearsOut(year);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[{ label: 'Directory', href: '/directory' }, { label: `Batch of ${year}` }]}
          />
        }
        eyebrow={pack.copy.shortName}
        title={`Batch of ${year}`}
        description={
          total === 0
            ? `The ${year} graduating batch, as it stands on the portal today. Nothing on this page is being withheld from you — there is genuinely nobody on it yet.`
            : `${formatNumber(total, locale)} ${total === 1 ? 'person' : 'people'} from the ${year} graduating batch have claimed their record${out ? `, ${out}` : ''}. This address is the whole page — send it to the batch group as it is.`
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

      {/* Every batch on one strip. The scroller matches the directory's own
          sort control: a wrapping row of fourteen years pushes the summary
          below the fold on a 360px screen. */}
      {years.length > 1 ? (
        <div className="-mx-1 max-w-full overflow-x-auto px-1 pb-1">
          <SegmentedNav
            items={years.map((y) => ({
              label: String(y),
              href: `/directory/batch/${y}`,
              active: y === year,
            }))}
          />
        </div>
      ) : null}

      {total === 0 ? (
        <>
          <EmptyState
            icon={<GraduationCap className="size-5" />}
            title={`No ${year} graduate has claimed a record yet`}
            description="Verification is a match between a self-registration and the degree register loaded from the examinations branch. Until a batch is loaded and its graduates start signing up, the year is genuinely empty rather than hidden."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {nearest !== null ? (
                  <ButtonLink href={`/directory/batch/${nearest}`}>
                    Batch of {nearest} instead
                  </ButtonLink>
                ) : null}
                <ButtonLink href="/directory" variant="secondary">
                  Search every batch
                </ButtonLink>
              </div>
            }
          />

          <Card className="mx-auto max-w-prose">
            <CardBody className="space-y-3">
              <CardTitle as="h2">If you graduated in {year}</CardTitle>
              <p className="text-sm text-secondary">
                You can still register. Your record is matched against the degree register on roll
                number and name, and the alumni cell reviews anything the match is not confident
                about — so a batch with nobody in it is the batch that most needs the first few
                people to sign up and tell the rest.
              </p>
              <p className="text-sm text-secondary">
                {previous !== null ? (
                  <>
                    The nearest batch with members on it is{' '}
                    <Link href={`/directory/batch/${previous}`} className="link">
                      {previous}
                    </Link>
                    .{' '}
                  </>
                ) : null}
                Or search the whole network from{' '}
                <Link href="/directory" className="link">
                  the directory
                </Link>
                .
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
              hint={`of the ${year} batch`}
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
              hint="have agreed to be asked"
              icon={<UserCheck className="size-4" />}
            />
            <Stat
              label="Open to referrals"
              value={formatNumber(referrers, locale)}
              hint="for a specific opening"
              icon={<Handshake className="size-4" />}
            />
          </div>

          <div className="grid gap-gutter lg:grid-cols-2">
            <Card>
              <CardBody className="space-y-4">
                <div className="space-y-1">
                  <CardTitle as="h2" className="flex items-center gap-2">
                    <Building2 className="size-4 text-muted" aria-hidden="true" />
                    Where the {year} batch works
                  </CardTitle>
                  <p className="text-sm text-secondary">
                    Counted from the employer each person last recorded on their own profile, not
                    from a placement sheet.
                  </p>
                </div>

                <BarList
                  data={facets.companies.slice(0, 6).map((c) => ({ label: c.label, value: c.count }))}
                  label={`Most common employers in the ${year} batch`}
                />

                {facets.companies.length > 6 ? (
                  <p className="text-xs text-muted">
                    {facets.companies.length - 6} more employers appear in this batch.{' '}
                    <Link href={directoryHref} className="link">
                      Filter the batch by company
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
                    Cities as people last recorded them. A batch scatters within three years of
                    graduating, which is exactly why the batch group stops being enough.
                  </p>
                </div>

                <BarList
                  data={facets.cities.slice(0, 6).map((c) => ({ label: c.label, value: c.count }))}
                  label={`Cities the ${year} batch lives in`}
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

          {facets.departments.length > 0 ? (
            <Card>
              <CardBody className="space-y-3">
                <CardTitle as="h2" className="flex items-center gap-2">
                  <GraduationCap className="size-4 text-muted" aria-hidden="true" />
                  Branches in this batch
                </CardTitle>
                <ul className="flex flex-wrap gap-2">
                  {facets.departments.map((d) => (
                    <li key={d.value}>
                      {/* Both filters, not one: the reader who clicks this
                          wants their own branch *within* their own year. */}
                      <Link
                        href={`/directory?batchFrom=${year}&batchTo=${year}&department=${encodeURIComponent(d.value)}`}
                        className="link-quiet"
                      >
                        <Badge tone="outline" className="gap-2">
                          <span className="font-semibold">{d.value}</span>
                          <span className="text-muted">·</span>
                          <span className="tabular">{formatNumber(d.count, locale)}</span>
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted">
                  Each opens the {year} batch narrowed to that branch. For a whole department across
                  every year, open{' '}
                  <Link
                    href={`/directory/branch/${facets.departments[0]!.value}`}
                    className="link"
                  >
                    the branch page
                  </Link>
                  .
                </p>
              </CardBody>
            </Card>
          ) : null}

          <Section
            title={`${formatNumber(total, locale)} ${total === 1 ? 'person' : 'people'}`}
            description={
              remaining > 0
                ? `Showing the ${shown.length} most complete profiles. The remaining ${formatNumber(remaining, locale)} are in the directory under the same filter.`
                : 'Everyone from this batch who is on the portal.'
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
                  : 'Open this batch in the directory'}
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
              {previous !== null ? (
                <ButtonLink href={`/directory/batch/${previous}`} variant="ghost" size="sm">
                  ← Batch of {previous}
                </ButtonLink>
              ) : null}
              {next !== null ? (
                <ButtonLink href={`/directory/batch/${next}`} variant="ghost" size="sm">
                  Batch of {next} →
                </ButtonLink>
              ) : null}
            </div>
          </Section>

          <Alert
            tone="neutral"
            title="Sharing this page is safe; forwarding a member list is not"
            icon={<Link2 className="size-4" />}
          >
            <p>
              Anyone who opens this address has to sign in first, and then sees only what their own
              account is entitled to — a final-year opening the same link gets a shorter page than
              you do. That is the difference between sending this link and sending a screenshot.
            </p>
          </Alert>
        </>
      )}

      <MarginNote className="max-w-prose border-t border-line pt-4">
        No email address or phone number appears on this page. Contact details are released only
        when the member has consented in their own settings <em>and</em> the viewer is entitled to
        see them — both, never either.
      </MarginNote>
    </div>
  );
}
