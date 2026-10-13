import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Briefcase, ClipboardList, Search, ShieldCheck } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, isActive } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getJobs, getMyApplications, getOwnProfile } from '@/lib/data/repo';
import type { JobApplication, JobPosting } from '@/lib/data/types';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  ChipNav,
  EmptyState,
  Input,
  Section,
  Tabs,
} from '@/components/ui';
import { BandChip, PageBand } from '@/components/brand/PageBand';
import { jobReviewLine } from '@/lib/branding/copy';
import { isFresherFriendly } from '@/lib/event-status';
import { daysUntil, formatDate, formatRelative } from '@/lib/format';
import { FooterLink, JobList, JobStateBadge, applicantsLabel, type JobListItem } from './JobCard';

export const metadata: Metadata = {
  title: 'Jobs & internships',
  description: 'Roles and internships posted by alumni and faculty, checked by the placement cell.',
};

type Tab = 'open' | 'mine' | 'applied' | 'review';
type Show = 'freshers' | 'closing';

/** "Closing soon" on this board: a deadline within this many calendar days. */
const CLOSING_WINDOW_DAYS = 14;

const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const plural = (n: number, word: string, many = `${word}s`) =>
  `${n.toLocaleString('en-IN')} ${n === 1 ? word : many}`;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!isActive(session)) redirect('/pending');

  const { brand } = (await getTenantBrand())!;
  // The jobs board is a bought feature, not a given. A college that has
  // not taken it must 404 here, not merely lose the sidebar link.
  if (!brand.pack.features.jobs) notFound();

  const params = await searchParams;
  const q = one(params.q)?.trim() ?? '';
  const internshipsOnly = one(params.internships) === '1';
  // A second filter on what was fetched, never on what is fetched: it
  // narrows the list below and changes nothing about who may see what.
  const requestedShow = one(params.show);
  const show: Show | null =
    !internshipsOnly && (requestedShow === 'freshers' || requestedShow === 'closing') ? requestedShow : null;

  const canPost = can(session, 'job.post');
  const canApply = can(session, 'job.apply');
  const isModerator = can(session, 'job.moderate');

  const requested = (one(params.tab) ?? 'open') as Tab;
  const tab: Tab =
    (requested === 'mine' && !canPost) ||
    (requested === 'applied' && !canApply) ||
    (requested === 'review' && !isModerator)
      ? 'open'
      : requested;

  // Tab counts are the totals, deliberately unaffected by the search box —
  // a count that drops to zero as you type makes the tab look broken.
  const liveTotal = getJobs(session, {}).length;
  const minePosts = canPost ? getJobs(session, { mine: true }) : [];
  const myApplications = canApply ? getMyApplications(session) : [];
  const reviewQueue = isModerator ? getJobs(session, { state: 'pending_moderation' }) : [];

  const filterOpts = { q: q || undefined, internshipsOnly: internshipsOnly || undefined };
  const results =
    tab === 'mine'
      ? getJobs(session, { ...filterOpts, mine: true })
      : tab === 'review'
        ? getJobs(session, { ...filterOpts, state: 'pending_moderation' })
        : getJobs(session, filterOpts);

  // Applications point at a posting that may since have closed. Resolve
  // what is still reachable so a dead link is never rendered as a live one.
  const reachable = new Map<string, JobPosting>();
  for (const j of [...getJobs(session, {}), ...minePosts, ...reviewQueue]) reachable.set(j.id, j);

  const pack = brand.pack;
  const { shortName } = pack.copy;
  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };
  const isStudent = session.roles.some((r) => r.role === 'student');

  const closingSoon = (j: JobPosting): boolean => {
    if (!j.closesOn) return false;
    const n = daysUntil(j.closesOn, timing.timeZone);
    return n >= 0 && n <= CLOSING_WINDOW_DAYS;
  };
  // Soonest deadline first; open-until-filled roles after every dated one.
  const byDeadline = (a: JobPosting, b: JobPosting): number => {
    if (a.closesOn && b.closesOn) return a.closesOn.localeCompare(b.closesOn);
    if (a.closesOn) return -1;
    if (b.closesOn) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  };

  // The live board, for the band's figures. Each is shown only above 0.
  const board = getJobs(session, {});
  const internshipCount = board.filter((j) => j.isInternship).length;
  const closingCount = board.filter(closingSoon).length;

  const href = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (internshipsOnly) sp.set('internships', '1');
    if (show) sp.set('show', show);
    if (tab !== 'open') sp.set('tab', tab);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    }
    const s = sp.toString();
    return s ? `/jobs?${s}` : '/jobs';
  };
  // Switching tabs drops the board's own filters: an internship filter
  // carried into "My postings" would narrow a list with no chip to say so.
  const tabHref = (t: Tab) => href({ tab: t === 'open' ? null : t, internships: null, show: null });

  const shown =
    show === 'freshers'
      ? results.filter(isFresherFriendly)
      : show === 'closing'
        ? results.filter(closingSoon)
        : results;
  const ordered =
    tab === 'review'
      ? [...shown].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      : tab === 'open'
        ? [...shown].sort(byDeadline)
        : shown;

  const filtering = Boolean(q || internshipsOnly || show);

  const withPlacementCell = minePosts.filter(
    (j) => j.state === 'pending_moderation' || j.state === 'rejected',
  );
  const sentBack = withPlacementCell.filter((j) => j.state === 'rejected').length;

  const tabs = [
    { label: 'Open roles', href: tabHref('open'), count: liveTotal, active: tab === 'open' },
    canPost
      ? { label: 'My postings', href: tabHref('mine'), count: minePosts.length, active: tab === 'mine' }
      : null,
    canApply
      ? {
          label: 'My applications',
          href: tabHref('applied'),
          count: myApplications.length,
          active: tab === 'applied',
        }
      : null,
    isModerator
      ? {
          label: 'Awaiting review',
          href: tabHref('review'),
          count: reviewQueue.length,
          active: tab === 'review',
        }
      : null,
  ].filter((t): t is NonNullable<typeof t> => t !== null);

  const title = isStudent
    ? `Roles ${shortName} graduates are hiring for`
    : isModerator
      ? 'Board and review queue'
      : canPost
        ? `Hiring? Put it in front of ${shortName} final-years`
        : `Roles ${shortName} graduates are hiring for`;

  // The search sits over a list. With nothing posted yet there is nothing
  // to search, and the empty "My postings" tab gets the way to post instead.
  const showSearch = tab !== 'applied' && !(tab === 'mine' && minePosts.length === 0);

  // ---- What goes under each posting ------------------------------
  const reviewLine = jobReviewLine(pack.copy);
  const canOpenApplicantLists = can(session, 'job.applicants.export');

  const footerFor = (job: JobPosting): React.ReactNode => {
    if (tab === 'review') {
      return (
        <FooterLink href={`/admin/jobs/${job.id}`}>
          Submitted {formatRelative(job.createdAt, timing)} — review now
        </FooterLink>
      );
    }

    // The same rule as before: the poster and a moderator see the count.
    const showApplicants = isModerator || job.postedBy.id === session.memberId;
    const isOwn = job.postedBy.id === session.memberId;

    if (tab === 'mine') {
      const applicantsLink =
        showApplicants && (job.state === 'live' || (job.state === 'closed' && job.applicationCount > 0)) ? (
          <FooterLink href={`/jobs/${job.id}/applicants`}>{applicantsLabel(job.applicationCount)}</FooterLink>
        ) : null;
      return (
        <div className="space-y-1">
          <div className="flex min-h-9 flex-wrap items-center gap-x-3">
            <JobStateBadge state={job.state} />
            {applicantsLink}
          </div>
          {job.state === 'pending_moderation' ? (
            <p className="text-sm text-secondary">
              Students cannot see it yet. The placement cell reads it first
              {reviewLine ? `, ${reviewLine}` : ''}.
            </p>
          ) : null}
          {job.state === 'rejected' ? (
            <p className="text-sm text-secondary">
              {job.moderationNote ?? 'No reason was recorded. Write to the placement cell before posting it again.'}
            </p>
          ) : null}
          {job.state === 'closed' && job.closesOn ? (
            <p className="text-sm text-secondary">Closed {formatDate(job.closesOn, timing)}.</p>
          ) : null}
        </div>
      );
    }

    if (showApplicants && job.state === 'live') {
      // The count follows the rule above; the link only goes where the
      // applicant page's own guard will let this viewer in.
      const opensList = isOwn || canOpenApplicantLists;
      return (
        <div className="flex min-h-9 flex-wrap items-center gap-x-3">
          {isOwn ? <Badge tone="brand">Your posting</Badge> : null}
          {opensList ? (
            <FooterLink href={`/jobs/${job.id}/applicants`}>{applicantsLabel(job.applicationCount)}</FooterLink>
          ) : (
            <span className="text-sm text-secondary">
              {job.applicationCount.toLocaleString('en-IN')} {job.applicationCount === 1 ? 'applicant' : 'applicants'}
            </span>
          )}
        </div>
      );
    }
    return undefined;
  };

  const items = (jobs: JobPosting[]): JobListItem[] => jobs.map((job) => ({ job, footer: footerFor(job) }));

  // A student sees the board in the order that serves them: what closes
  // soon, then what a fresher can apply to, then everything else. The
  // same roles, re-sorted; nothing is added or dropped.
  const grouped =
    tab === 'open' && isStudent && !filtering
      ? (() => {
          const soon = ordered.filter(closingSoon);
          const rest = ordered.filter((j) => !closingSoon(j));
          return [
            { key: 'soon', label: `Closing in the next ${CLOSING_WINDOW_DAYS} days`, jobs: soon },
            { key: 'freshers', label: 'Open to freshers', jobs: rest.filter(isFresherFriendly) },
            { key: 'rest', label: 'More roles', jobs: rest.filter((j) => !isFresherFriendly(j)) },
          ].filter((g) => g.jobs.length > 0);
        })()
      : null;

  const heading =
    tab === 'mine'
      ? `${plural(ordered.length, 'posting')} · newest first`
      : tab === 'review'
        ? `${plural(ordered.length, 'posting')} waiting · oldest first`
        : q
          ? `${plural(ordered.length, 'role')} matching “${q}”`
          : `${plural(ordered.length, 'role')} · soonest deadline first`;

  const own = tab === 'mine' && minePosts.length === 0 ? getOwnProfile(session) : null;

  return (
    <div className="space-y-6">
      <PageBand
        pack={pack}
        size="compact"
        eyebrow="Jobs and internships"
        title={title}
        meta={
          <>
            {board.length > 0 ? (
              <BandChip href={tabHref('open')}>{plural(board.length, 'open role')}</BandChip>
            ) : null}
            {internshipCount > 0 ? (
              <BandChip href="/jobs?internships=1">{plural(internshipCount, 'internship')}</BandChip>
            ) : null}
            {closingCount > 0 ? (
              <BandChip href="/jobs?show=closing">
                {closingCount.toLocaleString('en-IN')} closing in {CLOSING_WINDOW_DAYS} days
              </BandChip>
            ) : null}
            {isModerator && reviewQueue.length > 0 ? (
              <BandChip href={tabHref('review')}>{reviewQueue.length.toLocaleString('en-IN')} waiting for review</BandChip>
            ) : null}
            <BandChip icon={<ShieldCheck />}>Checked by the placement cell</BandChip>
          </>
        }
        actions={
          canPost ? (
            <ButtonLink href="/jobs/new" variant="band" className="min-h-11">
              <Briefcase className="size-4" aria-hidden="true" />
              Post a role
            </ButtonLink>
          ) : null
        }
      />

      {tab === 'open' && withPlacementCell.length > 0 ? (
        <Alert tone={sentBack > 0 ? 'warning' : 'neutral'}>
          <p>
            {sentBack > 0
              ? `${plural(sentBack, 'posting')} came back from the placement cell with a note.`
              : `${plural(withPlacementCell.length, 'of your postings', 'of your postings')} ${withPlacementCell.length === 1 ? 'is' : 'are'} with the placement cell. Students see ${withPlacementCell.length === 1 ? 'it' : 'them'} once approved.`}{' '}
            <Link href={tabHref('mine')} className="link font-medium">
              Open my postings
            </Link>
          </p>
        </Alert>
      ) : null}

      <Tabs items={tabs} ariaLabel="Job board sections" />

      {showSearch ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <form method="get" role="search" aria-label="Search postings" className="w-full lg:max-w-md">
            {tab !== 'open' ? <input type="hidden" name="tab" value={tab} /> : null}
            {internshipsOnly ? <input type="hidden" name="internships" value="1" /> : null}
            {show ? <input type="hidden" name="show" value={show} /> : null}
            <label htmlFor="job-q" className="sr-only">
              Search postings by title, company, city or skill
            </label>
            <div className="relative">
              <Input
                id="job-q"
                name="q"
                type="search"
                sizeVariant="lg"
                defaultValue={q}
                placeholder="Role, company or skill"
                leading={<Search className="size-4" />}
                className="pr-24"
              />
              <Button type="submit" variant="secondary" className="absolute right-1 top-1">
                Search
              </Button>
            </div>
          </form>

          {tab === 'open' ? (
            <ChipNav
              ariaLabel="Filter roles"
              items={[
                { label: 'All', href: href({ internships: null, show: null }), active: !internshipsOnly && !show },
                { label: 'Internships', href: href({ internships: '1', show: null }), active: internshipsOnly },
                { label: 'Open to freshers', href: href({ internships: null, show: 'freshers' }), active: show === 'freshers' },
                { label: 'Closing soon', href: href({ internships: null, show: 'closing' }), active: show === 'closing' },
              ]}
            />
          ) : null}
        </div>
      ) : null}

      {tab === 'applied' ? (
        <AppliedList applications={myApplications} reachable={reachable} timing={timing} />
      ) : ordered.length === 0 ? (
        <PostingsEmpty
          tab={tab}
          q={q}
          internshipsOnly={internshipsOnly}
          show={show}
          filtering={filtering}
          canPost={canPost}
          company={own?.currentCompany ?? null}
          clearHref={href({ q: null, internships: null, show: null })}
        />
      ) : (
        <Section
          title={heading}
          actions={
            filtering ? (
              <ButtonLink href={href({ q: null, internships: null, show: null })} variant="ghost" size="sm" className="min-h-11 sm:min-h-0">
                Clear filters
              </ButtonLink>
            ) : null
          }
        >
          {grouped ? (
            <div className="space-y-8">
              {grouped.map((g) => (
                <section key={g.key} aria-labelledby={`jobs-${g.key}`} className="space-y-3">
                  <h3 id={`jobs-${g.key}`} className="font-sans text-sm font-semibold text-secondary">
                    {g.label} <span className="font-normal tabular">· {g.jobs.length}</span>
                  </h3>
                  <JobList items={items(g.jobs)} locale={pack.locale} />
                </section>
              ))}
            </div>
          ) : (
            <JobList items={items(ordered)} locale={pack.locale} />
          )}
        </Section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Empty lists
// ---------------------------------------------------------------

function PostingsEmpty({
  tab,
  q,
  internshipsOnly,
  show,
  filtering,
  canPost,
  company,
  clearHref,
}: {
  tab: Tab;
  q: string;
  internshipsOnly: boolean;
  show: Show | null;
  filtering: boolean;
  canPost: boolean;
  company: string | null;
  clearHref: string;
}) {
  if (filtering) {
    const description = q
      ? `No posting mentions “${q}”. Try the company name on its own, or one skill.`
      : internshipsOnly
        ? 'No internship is open right now.'
        : show === 'freshers'
          ? 'No open role says a fresher can apply right now.'
          : `Nothing closes in the next ${CLOSING_WINDOW_DAYS} days.`;
    return (
      <EmptyState
        icon={<Search className="size-5" />}
        title="Nothing matches"
        description={description}
        action={
          <ButtonLink href={clearHref} variant="secondary">
            Clear the filters
          </ButtonLink>
        }
      />
    );
  }

  if (tab === 'mine') {
    return (
      <EmptyState
        icon={<Briefcase className="size-5" />}
        title={company ? `Hiring at ${company}? Post it` : 'Know of an opening? Post it'}
        description="Final-year students see it once the placement cell has checked it, and you see everyone who applies."
        action={<ButtonLink href="/jobs/new">Post a role</ButtonLink>}
      />
    );
  }

  if (tab === 'review') {
    return (
      <EmptyState
        icon={<ShieldCheck className="size-5" />}
        title="Nothing is waiting for review"
        description="New postings from alumni and faculty land here before any student can see them."
        action={
          <ButtonLink href="/admin/jobs" variant="secondary">
            Open the placement console
          </ButtonLink>
        }
      />
    );
  }

  return (
    <EmptyState
      icon={<Briefcase className="size-5" />}
      title="No roles are live right now"
      description="Postings from alumni and faculty appear here once the placement cell has checked them."
      action={canPost ? <ButtonLink href="/jobs/new">Post a role</ButtonLink> : undefined}
    />
  );
}

// ---------------------------------------------------------------
// My applications
// ---------------------------------------------------------------

function AppliedList({
  applications,
  reachable,
  timing,
}: {
  applications: JobApplication[];
  reachable: Map<string, JobPosting>;
  timing: { locale: string; timeZone: string };
}) {
  if (applications.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="size-5" />}
        title="You have not applied to anything yet"
        description="Each application you send is kept here with the note you wrote."
        action={
          <ButtonLink href="/jobs" variant="secondary">
            Browse open roles
          </ButtonLink>
        }
      />
    );
  }

  const sorted = [...applications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <Section
      title={`${plural(applications.length, 'application')} · newest first`}
      description="The poster and the placement cell see your name, branch, batch and note."
    >
      <ul className="grid grid-cols-1 gap-3">
        {sorted.map((app) => {
          const job = reachable.get(app.jobId);
          return (
            <li key={app.id} className="min-w-0">
              <Card as="article" className="p-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-md font-semibold leading-snug">
                      {job ? (
                        <Link href={`/jobs/${app.jobId}`} className="link-quiet">
                          {app.jobTitle}
                        </Link>
                      ) : (
                        app.jobTitle
                      )}
                    </h3>
                    <p className="mt-0.5 text-sm text-secondary">{app.company}</p>
                  </div>
                  <p className="shrink-0 text-sm text-secondary">
                    Applied {formatRelative(app.createdAt, timing)}
                    <span className="sr-only">, on {formatDate(app.createdAt, timing)}</span>
                  </p>
                </div>

                {app.note ? (
                  <blockquote className="mt-3 border-l-2 border-line-strong pl-3 text-sm text-secondary">
                    {app.note}
                  </blockquote>
                ) : (
                  <p className="mt-3 text-sm text-secondary">You applied without a note.</p>
                )}

                {!job ? (
                  <p className="mt-3 text-sm text-secondary">This posting has closed. Your application is kept here.</p>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
