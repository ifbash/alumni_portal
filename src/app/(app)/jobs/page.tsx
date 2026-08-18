import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  Briefcase,
  Building2,
  ClipboardList,
  Clock,
  GraduationCap,
  MapPin,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getJobs, getMyApplications } from '@/lib/data/repo';
import type { JobApplication, JobPosting } from '@/lib/data/types';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  EmptyState,
  Field,
  Input,
  PageHeader,
  SegmentedNav,
  Section,
  Tabs,
} from '@/components/ui';
import { formatDate, formatRelative, memberLine } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Jobs & internships',
  description: 'Roles and internships posted by alumni and faculty, reviewed by the placement cell.',
};

type Tone = 'neutral' | 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
type Tab = 'open' | 'mine' | 'applied' | 'review';

const STATE_META: Record<JobPosting['state'], { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending_moderation: { label: 'With the placement cell', tone: 'warning' },
  live: { label: 'Live', tone: 'success' },
  rejected: { label: 'Not published', tone: 'danger' },
  closed: { label: 'Closed', tone: 'neutral' },
};

const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { brand } = (await getTenantBrand())!;
  // The jobs board is a bought feature, not a given. A college that has
  // not taken it must 404 here, not merely lose the sidebar link.
  if (!brand.pack.features.jobs) notFound();

  const params = await searchParams;
  const q = one(params.q)?.trim() ?? '';
  const internshipsOnly = one(params.internships) === '1';

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

  const href = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (internshipsOnly) sp.set('internships', '1');
    if (tab !== 'open') sp.set('tab', tab);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    }
    const s = sp.toString();
    return s ? `/jobs?${s}` : '/jobs';
  };

  const withPlacementCell = minePosts.filter(
    (j) => j.state === 'pending_moderation' || j.state === 'rejected',
  );

  const tabs = [
    { label: 'Open roles', href: href({ tab: null }), count: liveTotal, active: tab === 'open' },
    canPost
      ? { label: 'My postings', href: href({ tab: 'mine' }), count: minePosts.length, active: tab === 'mine' }
      : null,
    canApply
      ? {
          label: 'My applications',
          href: href({ tab: 'applied' }),
          count: myApplications.length,
          active: tab === 'applied',
        }
      : null,
    isModerator
      ? {
          label: 'Awaiting review',
          href: href({ tab: 'review' }),
          count: reviewQueue.length,
          active: tab === 'review',
        }
      : null,
  ].filter((t): t is NonNullable<typeof t> => t !== null);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Placement & careers"
        title="Jobs and internships"
        description={`Openings shared by ${brand.pack.copy.shortName} alumni and faculty. Every posting is read by the placement cell before a student can see it, because the college is accountable for what its students are pointed at.`}
        actions={
          canPost ? (
            <ButtonLink href="/jobs/new">
              <Briefcase className="size-4" aria-hidden="true" />
              Post a role
            </ButtonLink>
          ) : null
        }
      />

      {tab === 'open' && withPlacementCell.length > 0 ? (
        <Alert
          tone="warning"
          title={`${withPlacementCell.length} of your postings ${withPlacementCell.length === 1 ? 'is' : 'are'} not on the board yet`}
          icon={<Clock className="size-4" />}
        >
          <p>
            Nothing has been lost. They are with the placement cell for review, or came back with a
            note.{' '}
            <Link href={href({ tab: 'mine' })} className="link">
              Open my postings
            </Link>
            .
          </p>
        </Alert>
      ) : null}

      {/* The search and the internship filter act on postings. On the
          applications tab they would filter a list they are not looking at,
          so they are not rendered there at all. */}
      {tab !== 'applied' ? (
        <Card>
          <CardBody className="space-y-4">
            <form method="get" className="flex flex-wrap items-end gap-3">
              {tab !== 'open' ? <input type="hidden" name="tab" value={tab} /> : null}
              {internshipsOnly ? <input type="hidden" name="internships" value="1" /> : null}

              <Field
                htmlFor="job-q"
                label="Search postings"
                className="min-w-0 flex-1 basis-64"
                hint="Title, company, location or skill — Razorpay, Verilog, Vijayawada."
              >
                <Input
                  id="job-q"
                  name="q"
                  type="search"
                  defaultValue={q}
                  placeholder="Backend engineer, Hyderabad, Python…"
                  leading={<Search className="size-4" />}
                  aria-describedby="job-q-hint"
                />
              </Field>

              <div className="flex items-center gap-2">
                <Button type="submit" variant="secondary">
                  Search
                </Button>
                {q ? (
                  <ButtonLink href={href({ q: null })} variant="ghost">
                    Clear
                  </ButtonLink>
                ) : null}
              </div>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <SegmentedNav
                items={[
                  { label: 'All roles', href: href({ internships: null }), active: !internshipsOnly },
                  {
                    label: 'Internships only',
                    href: href({ internships: '1' }),
                    active: internshipsOnly,
                  },
                ]}
              />
              <p className="text-xs text-muted">
                {results.length.toLocaleString('en-IN')} posting{results.length === 1 ? '' : 's'}
                {q ? ` matching “${q}”` : ''}
                {internshipsOnly ? ' · internships only' : ''}
              </p>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Tabs items={tabs} ariaLabel="Job board sections" />

      {tab === 'applied' ? (
        <AppliedList applications={myApplications} reachable={reachable} />
      ) : (
        <PostingList
          tab={tab}
          jobs={results}
          q={q}
          internshipsOnly={internshipsOnly}
          canPost={canPost}
          isModerator={isModerator}
          viewerId={session.memberId}
          clearHref={href({ q: null, internships: null })}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Postings
// ---------------------------------------------------------------

function PostingList({
  tab,
  jobs,
  q,
  internshipsOnly,
  canPost,
  isModerator,
  viewerId,
  clearHref,
}: {
  tab: Tab;
  jobs: JobPosting[];
  q: string;
  internshipsOnly: boolean;
  canPost: boolean;
  isModerator: boolean;
  viewerId: string;
  clearHref: string;
}) {
  if (jobs.length === 0) {
    if (q || internshipsOnly) {
      return (
        <EmptyState
          icon={<Search className="size-5" />}
          title="Nothing matches that search"
          description={
            internshipsOnly && q
              ? `No internship matches “${q}”. Internships are seasonal here — most are posted between December and March.`
              : internshipsOnly
                ? 'No internships are open at the moment. They are seasonal — most land between December and March.'
                : `No posting mentions “${q}”. Try the company name on its own, or a single skill.`
          }
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
          title="You have not posted a role yet"
          description="If your team is hiring, post it here. Final-year students see it once the placement cell has read it, and applications come to you rather than disappearing into a careers portal."
          action={<ButtonLink href="/jobs/new">Post a role</ButtonLink>}
        />
      );
    }

    if (tab === 'review') {
      return (
        <EmptyState
          icon={<ShieldCheck className="size-5" />}
          title="Nothing is waiting for review"
          description="Every posting alumni and faculty have submitted has been decided. New submissions appear here and in the placement console."
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
        description="The board fills up when alumni post openings from their own companies. Postings stay listed until they are closed or the closing date passes."
        action={canPost ? <ButtonLink href="/jobs/new">Post the first one</ButtonLink> : undefined}
      />
    );
  }

  return (
    <Section
      title={
        tab === 'mine'
          ? 'Your postings'
          : tab === 'review'
            ? 'Submitted, not yet published'
            : 'Open roles'
      }
      description={
        tab === 'mine'
          ? 'Every state, including the ones students cannot see yet.'
          : tab === 'review'
            ? 'Students cannot see any of these. Approve or reject each one in the placement console.'
            : undefined
      }
    >
      <ul className="grid gap-gutter lg:grid-cols-2">
        {jobs.map((job) => (
          <li key={job.id} className="flex">
            <JobCard
              job={job}
              showApplicants={isModerator || job.postedBy.id === viewerId}
              showState={tab !== 'open' || job.state !== 'live'}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function JobCard({
  job,
  showApplicants,
  showState,
}: {
  job: JobPosting;
  showApplicants: boolean;
  showState: boolean;
}) {
  const state = STATE_META[job.state];
  const meta = memberLine([job.experienceYears, job.salaryRange]);

  return (
    <Card interactive as="article" className="relative flex w-full flex-col p-card">
      <div className="flex flex-wrap items-center gap-2">
        {job.isInternship ? (
          <Badge tone="accent">
            <GraduationCap className="size-3" aria-hidden="true" />
            Internship
          </Badge>
        ) : null}
        {showState ? (
          <Badge tone={state.tone} dot>
            {state.label}
          </Badge>
        ) : null}
        {job.viewerHasApplied ? <Badge tone="info">You applied</Badge> : null}
      </div>

      <h3 className="mt-2 font-display text-md font-semibold leading-snug">
        <Link href={`/jobs/${job.id}`} className="link-quiet after:absolute after:inset-0">
          {job.title}
        </Link>
      </h3>

      <dl className="mt-2 space-y-1.5 text-sm">
        <div className="flex items-start gap-2">
          <dt className="sr-only">Company</dt>
          <Building2 className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
          <dd className="min-w-0 truncate text-secondary">{job.company}</dd>
        </div>

        {job.location ? (
          <div className="flex items-start gap-2">
            <dt className="sr-only">Location</dt>
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
            <dd className="min-w-0 truncate text-secondary">{job.location}</dd>
          </div>
        ) : null}

        {meta ? (
          <div className="flex items-start gap-2">
            <dt className="sr-only">Experience and pay</dt>
            <Briefcase className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
            <dd className="min-w-0 truncate text-secondary">{meta}</dd>
          </div>
        ) : null}

        {/* A posting with no location and no salary still gets a line, so the
            card reads as complete rather than half-rendered. */}
        {!job.location && !meta ? (
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
            <dd className="text-muted">Location and pay not stated — ask when you apply</dd>
          </div>
        ) : null}
      </dl>

      {job.skills.length ? (
        <ul className="mt-3 flex flex-wrap gap-1">
          {job.skills.slice(0, 4).map((s) => (
            <li key={s}>
              <Badge tone="outline">{s}</Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {job.state === 'pending_moderation' ? (
        <p className="mt-3 rounded border border-line bg-warning-soft px-3 py-2 text-xs text-warning-fg">
          Waiting for the placement cell. It has not been lost and it has not been rejected — no
          student can see it until someone in the cell reads it, usually within two working days.
        </p>
      ) : null}

      {job.state === 'rejected' ? (
        <p className="mt-3 rounded border border-line bg-danger-soft px-3 py-2 text-xs text-danger-fg">
          <span className="font-semibold">Sent back by the placement cell.</span>{' '}
          {job.moderationNote ?? 'No reason was recorded. Write to the cell before resubmitting.'}
        </p>
      ) : null}

      {job.state === 'closed' ? (
        <p className="mt-3 text-xs text-muted">
          {job.closesOn ? `Closed ${formatRelative(job.closesOn)}. ` : 'Closed. '}
          Kept for the record; applications are shut.
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-xs text-muted">
        <span>
          Posted by {job.postedBy.fullName}
          {job.postedBy.batchYear ? ` · ${job.postedBy.batchYear}` : ''}
        </span>
        <span aria-hidden="true">·</span>
        <span>{formatRelative(job.createdAt)}</span>
        {showApplicants ? (
          <>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-medium text-secondary">
              <Users className="size-3.5" aria-hidden="true" />
              {job.applicationCount} applicant{job.applicationCount === 1 ? '' : 's'}
            </span>
          </>
        ) : null}
        {job.state === 'live' && job.closesOn ? (
          <>
            <span aria-hidden="true">·</span>
            <span>Closes {formatDate(job.closesOn)}</span>
          </>
        ) : null}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------
// My applications
// ---------------------------------------------------------------

function AppliedList({
  applications,
  reachable,
}: {
  applications: JobApplication[];
  reachable: Map<string, JobPosting>;
}) {
  if (applications.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="size-5" />}
        title="You have not applied to anything yet"
        description="Applications you send from this board are listed here with the note you attached, so you know what you told each company and when."
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
      title="Your applications"
      description="Only you and the person who posted the role can see these."
    >
      <ul className="space-y-3">
        {sorted.map((app) => {
          const job = reachable.get(app.jobId);
          return (
            <li key={app.id}>
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
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone="info">Applied {formatRelative(app.createdAt)}</Badge>
                    <span className="text-xs text-muted">{formatDate(app.createdAt)}</span>
                  </div>
                </div>

                {app.note ? (
                  <blockquote className="mt-3 border-l-2 border-line-strong pl-3 text-sm text-secondary">
                    {app.note}
                  </blockquote>
                ) : (
                  <p className="mt-3 text-sm text-muted">You applied without a note.</p>
                )}

                {!job ? (
                  <p className="mt-3 text-xs text-muted">
                    This posting has since been closed or withdrawn, so it is no longer on the
                    board. Your application record stays here.
                  </p>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
