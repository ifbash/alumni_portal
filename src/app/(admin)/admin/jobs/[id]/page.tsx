import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  Building2,
  CalendarClock,
  ExternalLink,
  GraduationCap,
  IndianRupee,
  Lock,
  MapPin,
  ScrollText,
  ShieldCheck,
  Timer,
  Users,
} from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getJobApplications, getJobById, getJobs } from '@/lib/data/repo';
import type { JobPosting } from '@/lib/data/types';
import {
  Alert,
  Avatar,
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  DetailRow,
  PageHeader,
  Separator,
  Stat,
} from '@/components/ui';
import { formatDate, formatRelative, memberLine, yearsOut } from '@/lib/format';
import { ModerationActions } from '../ModerationActions';

/**
 * One posting, in front of the moderator who has to decide about it.
 *
 * The queue on `/admin/jobs` is for working through a morning's
 * submissions. This page is for the one that made somebody stop — the
 * posting where the employer does not match the poster's profile, or the
 * description reads like a staffing advert. So it carries the two things
 * a queue card cannot afford to: the submission verbatim, and the
 * poster's standing on this board.
 *
 * A rejection cannot leave here without a reason attached. "Rejected, no
 * reason" is what makes an alumnus stop posting — they wrote the thing on
 * a Sunday evening for students they have never met, and silence reads as
 * the college having lost it.
 */

type Tone = 'neutral' | 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

const STATE_META: Record<JobPosting['state'], { label: string; tone: Tone; note: string }> = {
  draft: {
    label: 'Draft',
    tone: 'neutral',
    note: 'Never submitted. Only its author can see it, and there is nothing to decide yet.',
  },
  pending_moderation: {
    label: 'Awaiting moderation',
    tone: 'warning',
    note: 'No student can open this posting. It stays invisible until you decide, in either direction.',
  },
  live: {
    label: 'Live',
    tone: 'success',
    note: 'On the jobs board and open to applications.',
  },
  rejected: {
    label: 'Rejected',
    tone: 'danger',
    note: 'Sent back to the poster with the reason below. The posting is kept on file — a rejection is not a deletion.',
  },
  closed: {
    label: 'Closed',
    tone: 'neutral',
    note: 'Closed by the poster or by its closing date. Applicants can still see what they applied to.',
  },
};

/** Never let a malformed apply URL from a poster take the page down. */
function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession();
  const job = session && can(session, 'job.moderate') ? getJobById(session, id) : null;

  if (!job) return { title: 'Posting not found' };
  return {
    title: `Moderate · ${job.title}`,
    description: `${job.title} at ${job.company}, submitted by ${job.postedBy.fullName}.`,
  };
}

export default async function AdminJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const pack = resolved.brand.pack;
  if (!pack.features.jobs) notFound();

  requireCap(session, 'job.moderate');

  const { id } = await params;
  const job = getJobById(session, id);
  if (!job) notFound();

  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };
  const state = STATE_META[job.state];
  const poster = job.postedBy;

  const applications = getJobApplications(job.id);

  // The poster's history on this board. A first-time poster and someone on
  // their ninth submission are not the same review, and a poster with a
  // rejection already against them is a third case again.
  const theirs = getJobs(session, { state: 'all' }).filter((j) => j.postedBy.id === poster.id);
  const history = {
    total: theirs.length,
    live: theirs.filter((j) => j.state === 'live').length,
    rejected: theirs.filter((j) => j.state === 'rejected').length,
    closed: theirs.filter((j) => j.state === 'closed').length,
    pending: theirs.filter((j) => j.state === 'pending_moderation').length,
    // Everything they put up before this one.
    before: theirs.filter((j) => j.id !== job.id && j.createdAt < job.createdAt).length,
  };

  const employerMatch =
    Boolean(poster.currentCompany) &&
    poster.currentCompany?.toLowerCase() === job.company.toLowerCase();

  // The wording a rejection on this board actually used. Surfacing the
  // real precedent is what stops two moderators writing two different
  // policies for the same situation.
  const rejections = getJobs(session, { state: 'rejected' }).filter((j) => j.moderationNote);
  const precedent =
    rejections.find((j) => j.id !== job.id)?.moderationNote ??
    rejections[0]?.moderationNote ??
    null;

  // `job.moderate` opens this page; reading who applied is a different
  // capability, and holding one does not imply the other. The link is only
  // rendered when the viewer would actually be admitted.
  const canOpenApplicants =
    can(session, 'job.applicants.export') || poster.id === session.memberId;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Console', href: '/admin' },
              { label: 'Job moderation', href: '/admin/jobs' },
              { label: job.title },
            ]}
          />
        }
        eyebrow={job.company}
        title={job.title}
        description={
          memberLine([job.location, job.experienceYears, job.salaryRange]) ||
          'No location, experience band or salary was stated on this submission.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {job.isInternship ? (
              <Badge tone="info">
                <GraduationCap className="size-3" aria-hidden="true" />
                Internship
              </Badge>
            ) : null}
            <Badge tone={state.tone} dot>
              {state.label}
            </Badge>
          </div>
        }
      />

      <Alert
        tone={job.state === 'pending_moderation' ? 'warning' : job.state === 'rejected' ? 'danger' : 'neutral'}
        title={state.label}
        icon={
          job.state === 'pending_moderation' ? (
            <Timer className="size-4" />
          ) : job.state === 'rejected' ? (
            <ScrollText className="size-4" />
          ) : (
            <ShieldCheck className="size-4" />
          )
        }
      >
        <p>
          {state.note} Submitted {formatRelative(job.createdAt, timing)} on{' '}
          {formatDate(job.createdAt, timing)}.
        </p>
        {job.state === 'rejected' && job.moderationNote ? (
          <p className="mt-2">
            <span className="font-medium">The poster was told:</span> {job.moderationNote}
          </p>
        ) : null}
      </Alert>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Applications"
          value={applications.length}
          hint={
            job.state === 'live'
              ? 'Through the portal, on this posting'
              : 'Students never saw this posting'
          }
          icon={<Users className="size-4" />}
        />
        <Stat
          label="Postings before this"
          value={history.before}
          hint={
            history.before === 0
              ? 'First submission from this member'
              : `${history.live} live, ${history.rejected} rejected`
          }
          icon={<Building2 className="size-4" />}
        />
        <Stat
          label="Closes"
          value={job.closesOn ? formatDate(job.closesOn, timing) : 'Open-ended'}
          hint={job.closesOn ? formatRelative(job.closesOn, timing) : 'Until the poster closes it'}
          icon={<CalendarClock className="size-4" />}
        />
      </div>

      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        {/* ---------------------------------------------------------------
            The submission
           --------------------------------------------------------------- */}
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h2">The posting as submitted</CardTitle>
              <CardDescription>
                Word for word, nothing tidied. If the description is what makes this a rejection,
                this is the text that made it one.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-5 pt-4">
              <div className="rounded-lg border border-line bg-surface-sunken p-4">
                {job.description ? (
                  <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed text-secondary">
                    {job.description}
                  </p>
                ) : (
                  <p className="text-sm text-muted">
                    No description was submitted, which is itself grounds for sending it back — a
                    student cannot evaluate a role described by its title alone.
                  </p>
                )}
              </div>

              <dl className="divide-y divide-line">
                <DetailRow label="Employer">
                  <span className="inline-flex items-center gap-2">
                    <Building2 className="size-3.5 text-muted" aria-hidden="true" />
                    {job.company}
                  </span>
                </DetailRow>
                <DetailRow label="Location">
                  {job.location ? (
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="size-3.5 text-muted" aria-hidden="true" />
                      {job.location}
                    </span>
                  ) : (
                    <span className="font-normal text-muted">Not stated</span>
                  )}
                </DetailRow>
                <DetailRow label="Experience">
                  {job.experienceYears ?? <span className="font-normal text-muted">Not stated</span>}
                </DetailRow>
                <DetailRow label="Compensation">
                  {job.salaryRange ? (
                    <span className="inline-flex items-center gap-2 tabular">
                      <IndianRupee className="size-3.5 text-muted" aria-hidden="true" />
                      {job.salaryRange}
                    </span>
                  ) : (
                    <span className="font-normal text-muted">
                      Not stated — allowed, but students discount a posting without one
                    </span>
                  )}
                </DetailRow>
                <DetailRow label="Type">{job.isInternship ? 'Internship' : 'Full-time'}</DetailRow>
                <DetailRow label="Apply route">
                  {job.applyUrl ? (
                    <span className="space-y-0.5">
                      <a
                        href={job.applyUrl}
                        target="_blank"
                        rel="noreferrer noopener nofollow"
                        className="link inline-flex items-center gap-1 break-all font-mono text-xs"
                      >
                        {job.applyUrl}
                        <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                      </a>
                      <span className="block text-xs font-normal text-secondary">
                        {hostOf(job.applyUrl)
                          ? `Opens ${hostOf(job.applyUrl)}. Check it reaches the hiring team and not a lead-capture form.`
                          : 'The address does not parse as a URL. That alone is worth sending back.'}
                      </span>
                    </span>
                  ) : (
                    'Through the portal only'
                  )}
                </DetailRow>
                <DetailRow label="Skills screened for">
                  {job.skills.length ? (
                    <span className="flex flex-wrap gap-1.5">
                      {job.skills.map((s) => (
                        <Badge key={s} tone="outline">
                          {s}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    <span className="font-normal text-muted">None listed</span>
                  )}
                </DetailRow>
                <DetailRow label="Posting ID">
                  <span className="font-mono text-xs text-secondary">{job.id}</span>
                </DetailRow>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h2">A rejection carries a reason. Always.</CardTitle>
              <CardDescription>
                The reason box is not optional, and the poster reads what you write there word for
                word.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-4 pt-4 text-sm">
              <p className="max-w-prose text-secondary">
                An alumnus who is told only &ldquo;not approved&rdquo; assumes the college lost the
                submission, or that somebody did not like them. Either way they do not post again,
                and the board loses the person who was willing to bring a role to it. Name the rule
                the posting breaks, and they can fix it and resubmit the same evening.
              </p>

              {precedent ? (
                <figure className="space-y-2">
                  <blockquote className="rounded-lg border border-line border-l-2 border-l-line-strong bg-surface-sunken p-4 text-secondary">
                    {precedent}
                  </blockquote>
                  <figcaption className="text-xs text-muted">
                    The wording used on the last rejection recorded on this board. It names the
                    policy — direct employers only, not third-party staffing listings — so the
                    poster knows exactly what to change.
                  </figcaption>
                </figure>
              ) : (
                <p className="text-xs text-muted">
                  Nothing has been rejected on this board yet, so there is no precedent to copy. The
                  policy in full is on the{' '}
                  <Link href="/admin/jobs" className="link">
                    moderation queue
                  </Link>
                  .
                </p>
              )}

              <Separator />

              <p className="flex items-start gap-2 text-xs text-muted">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  Both outcomes are written to <span className="font-mono">audit_log</span> under{' '}
                  <span className="font-mono">job.moderate</span> with your name, the time and a
                  before/after snapshot. An approval does not need a reason; a rejection cannot be
                  submitted without one.
                </span>
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h2">Who applied</CardTitle>
              <CardDescription>
                {applications.length
                  ? `${applications.length} student${applications.length === 1 ? '' : 's'} applied through the portal.`
                  : 'No applications through the portal yet.'}
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-3 pt-4">
              {canOpenApplicants ? (
                <>
                  <ButtonLink href={`/jobs/${job.id}/applicants`} variant="secondary">
                    <Users className="size-4" aria-hidden="true" />
                    Open the applicant list
                  </ButtonLink>
                  <p className="text-xs text-muted">
                    Names, branches, batches and the note each applicant wrote. No contact details —
                    those are never attached to an application.
                  </p>
                </>
              ) : (
                <p className="flex items-start gap-2 text-xs text-secondary">
                  <Lock className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
                  <span>
                    Reading the applicant list needs{' '}
                    <span className="font-mono">job.applicants.export</span>, which sits with the
                    placement cell. Moderating the board is a separate capability and deliberately
                    does not carry it — deciding whether a posting is genuine never required knowing
                    which students answered it.
                  </span>
                </p>
              )}
            </CardBody>
          </Card>
        </div>

        {/* ---------------------------------------------------------------
            The poster
           --------------------------------------------------------------- */}
        <aside className="min-w-0 space-y-6">
          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h2" className="text-md">
                Who posted this
              </CardTitle>
              <CardDescription>
                Their standing on the board is half the decision. The other half is the text.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-4 pt-4">
              <div className="flex items-start gap-3">
                <Avatar name={poster.fullName} src={poster.photoUrl} size="md" />
                <div className="min-w-0">
                  <Link
                    href={`/admin/members/${poster.id}`}
                    className="block truncate font-semibold link-quiet"
                  >
                    {poster.fullName}
                  </Link>
                  <p className="text-xs text-secondary">
                    {memberLine([
                      poster.departmentCode,
                      poster.batchYear ? `Batch of ${poster.batchYear}` : null,
                      yearsOut(poster.batchYear),
                    ])}
                  </p>
                </div>
              </div>

              <dl className="divide-y divide-line">
                <DetailRow label="Current employer">
                  {poster.currentCompany ? (
                    memberLine([poster.designation, poster.currentCompany])
                  ) : (
                    <span className="font-normal text-muted">Nothing on their profile</span>
                  )}
                </DetailRow>
                <DetailRow label="Based in">
                  {memberLine([poster.city, poster.country !== 'IN' ? poster.country : poster.state]) || (
                    <span className="font-normal text-muted">Not on record</span>
                  )}
                </DetailRow>
                <DetailRow label="Postings before this">
                  <span className="tabular">{history.before}</span>
                  {history.total > 1 ? (
                    <span className="ml-2 font-normal text-secondary">
                      · {history.live} live, {history.closed} closed, {history.rejected} rejected
                      {history.pending ? `, ${history.pending} in the queue` : ''}
                    </span>
                  ) : null}
                </DetailRow>
                <DetailRow label="Open to referrals">
                  {poster.openToReferrals ? (
                    <Badge tone="success" dot>
                      Yes
                    </Badge>
                  ) : (
                    <span className="font-normal text-muted">Not marked</span>
                  )}
                </DetailRow>
              </dl>

              {employerMatch ? (
                <Alert tone="success" title="Consistent with the direct-employer rule">
                  <p>
                    They work at {job.company}. An application from this posting reaches a real
                    person inside the company, which is the whole point of the board.
                  </p>
                </Alert>
              ) : poster.currentCompany ? (
                <Alert tone="warning" title="Posting for a company they do not work at">
                  <p>
                    Their profile says {poster.currentCompany}; the posting says {job.company}. That
                    is fine for an alumnus passing on a genuine opening — and it is also exactly
                    what a staffing listing looks like. Read the description before approving.
                  </p>
                </Alert>
              ) : (
                <Alert tone="warning" title="No employer on their profile">
                  <p>
                    There is nothing to check the posting against. Ask them to complete their
                    profile, or verify the opening independently before it goes live.
                  </p>
                </Alert>
              )}

              {history.rejected > 0 ? (
                <p className="text-xs text-secondary">
                  {history.rejected} earlier posting{history.rejected === 1 ? '' : 's'} from this
                  member {history.rejected === 1 ? 'was' : 'were'} sent back. A repeat of the same
                  problem is worth saying so plainly in the reason.
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h2" className="text-md">
                Decision
              </CardTitle>
              <CardDescription>
                Recorded against your name, either way. Nothing leaves the queue silently.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-3 pt-4">
              {job.state === 'pending_moderation' ? (
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <ModerationActions
                    jobId={job.id}
                    jobTitle={job.title}
                    company={job.company}
                    posterName={poster.fullName}
                  />
                </div>
              ) : (
                <>
                  <Badge tone={state.tone} dot>
                    {state.label}
                  </Badge>
                  <p className="text-sm text-secondary">
                    {job.state === 'rejected'
                      ? 'This one has been decided. The poster can correct it and submit again; a resubmission arrives in the queue as a new posting.'
                      : job.state === 'live'
                        ? 'Approved and on the board. To take it down, close it from the posting itself — a takedown after students have applied needs a word to them too.'
                        : 'There is nothing to decide on this posting.'}
                  </p>
                  <ButtonLink href="/admin/jobs" variant="secondary" size="sm" className="w-full">
                    Back to the queue
                  </ButtonLink>
                </>
              )}
            </CardBody>
          </Card>

          <ButtonLink href={`/jobs/${job.id}`} variant="secondary" size="sm" className="w-full">
            View as a member sees it
          </ButtonLink>
        </aside>
      </div>
    </div>
  );
}
