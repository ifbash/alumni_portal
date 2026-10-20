import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Eye, Users } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getJobApplications, getJobById, getJobs } from '@/lib/data/repo';
import type { JobPosting } from '@/lib/data/types';
import {
  Avatar,
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DetailRow,
  PageHeader,
} from '@/components/ui';
import { JobSummary, closesLabel } from '@/components/content';
import { formatDate, formatRelative, memberLine, yearsOut } from '@/lib/format';
import { ModerationActions } from '../ModerationActions';
import { CheckList, buildJobChecks, hostOf } from '../checks';

/**
 * One posting, in front of the moderator who has to decide about it.
 *
 * The queue is for working through a morning's submissions; this page is
 * for the one that made somebody stop. The posting on the left, exactly as
 * students would see it; the checks on the right; the decision pinned where
 * it cannot scroll away.
 */

type Tone = 'neutral' | 'success' | 'warning' | 'danger';

const STATE_META: Record<JobPosting['state'], { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending_moderation: { label: 'Waiting for a decision', tone: 'warning' },
  live: { label: 'Live', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  closed: { label: 'Closed', tone: 'neutral' },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession();
  const job = session && can(session, 'job.moderate') ? getJobById(session, id) : null;

  if (!job) return { title: 'Posting not found · Staff console' };
  return {
    title: `${job.title} · Staff console`,
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

  // The wording a rejection on this board actually used, shown inside the
  // Reject dialog so two moderators reach the same answer.
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

  const pending = job.state === 'pending_moderation';
  const closes = closesLabel(job.closesOn, timing.timeZone);
  const facts = [
    closes ? closes.text.replace(/^Closes/, 'closes') : job.closesOn ? 'closed' : 'no closing date',
    history.before === 0 ? 'first posting from this member' : `posting ${history.before + 1} from this member`,
    `submitted ${formatRelative(job.createdAt, timing)}`,
  ];
  const posterHref = can(session, 'profile.read.any') ? `/admin/members/${poster.id}` : `/directory/${poster.slug}`;
  const host = job.applyUrl ? hostOf(job.applyUrl) : null;

  const checks = buildJobChecks(job);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Staff console', href: '/admin' },
              { label: 'Jobs', href: '/admin/jobs' },
              { label: job.title },
            ]}
          />
        }
        eyebrow="Jobs"
        title={job.title}
        description={memberLine([job.company, job.location])}
        meta={
          <>
            <Badge tone={state.tone} dot>
              {state.label}
            </Badge>
            <span className="text-sm text-secondary">{facts.join(' · ')}</span>
          </>
        }
        actions={
          job.state === 'live' ? (
            <ButtonLink href={`/jobs/${job.id}`} variant="secondary">
              <Eye className="size-4" aria-hidden="true" />
              View as member
            </ButtonLink>
          ) : undefined
        }
      />

      {pending ? (
        <div className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-raised px-4 py-3 shadow-sm">
          <p className="text-sm text-secondary">
            Students cannot see this posting until you decide.
          </p>
          <ModerationActions
            jobId={job.id}
            jobTitle={job.title}
            company={job.company}
            posterName={poster.fullName}
            precedent={precedent}
            rejectLabel="Reject with reason"
          />
        </div>
      ) : job.state === 'rejected' && job.moderationNote ? (
        <div className="rounded-lg border border-line bg-surface-raised px-4 py-3 text-sm">
          <p className="font-medium text-primary">The poster was told</p>
          <p className="mt-1 text-secondary">{job.moderationNote}</p>
        </div>
      ) : null}

      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div id="posting" className="min-w-0 space-y-4">
          <h2 className="text-sm font-semibold text-secondary">The posting as students see it</h2>
          <JobSummary
            job={job}
            href={job.state === 'live' ? `/jobs/${job.id}` : '#posting'}
            locale={pack.locale}
            className="h-auto"
          />
          <Card>
            <CardBody className="space-y-4">
              {job.description ? (
                <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed text-primary">{job.description}</p>
              ) : (
                <p className="text-sm text-secondary">No description was submitted.</p>
              )}
              {job.skills.length ? (
                <ul className="flex flex-wrap gap-1.5" aria-label="Skills">
                  {job.skills.map((s) => (
                    <li key={s}>
                      <Badge tone="outline">{s}</Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
              <dl className="divide-y divide-line border-t border-line">
                <DetailRow label="How to apply">
                  {job.applyUrl ? (
                    <a
                      href={job.applyUrl}
                      target="_blank"
                      rel="noreferrer noopener nofollow"
                      className="link break-all"
                    >
                      {host ?? job.applyUrl}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    'Through the portal'
                  )}
                </DetailRow>
                <DetailRow label="Pay">
                  {job.salaryRange ?? <span className="font-normal text-secondary">Not stated</span>}
                </DetailRow>
                <DetailRow label="Experience">
                  {job.isInternship
                    ? 'Internship'
                    : (job.experienceYears ?? <span className="font-normal text-secondary">Not stated</span>)}
                </DetailRow>
                <DetailRow label="Closes">
                  {job.closesOn ? formatDate(job.closesOn, timing) : 'No closing date'}
                </DetailRow>
              </dl>
            </CardBody>
          </Card>

          {job.state === 'live' ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2" className="text-md">
                  Who applied
                </CardTitle>
              </CardHeader>
              <CardBody className="flex flex-wrap items-center justify-between gap-3 pt-3">
                <p className="text-sm text-secondary">
                  {applications.length
                    ? `${applications.length} student${applications.length === 1 ? '' : 's'} applied through the portal.`
                    : 'Nobody has applied through the portal yet.'}
                </p>
                {canOpenApplicants && applications.length ? (
                  <ButtonLink href={`/jobs/${job.id}/applicants`} variant="secondary" size="sm">
                    <Users className="size-4" aria-hidden="true" />
                    Open the applicant list
                  </ButtonLink>
                ) : !canOpenApplicants ? (
                  <p className="text-sm text-secondary">The placement cell can open the list.</p>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </div>

        <aside aria-label="Checks and poster" className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-md">
                Checks
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-3">
              <CheckList checks={checks} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-md">
                Posted by
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3 pt-3">
              <div className="flex items-start gap-3">
                <Avatar name={poster.fullName} src={poster.photoUrl} size="md" />
                <div className="min-w-0">
                  <Link href={posterHref} className="block truncate font-semibold link-quiet">
                    {poster.fullName}
                  </Link>
                  <p className="text-sm text-secondary">
                    {memberLine([
                      poster.departmentCode,
                      poster.batchYear ? `Batch of ${poster.batchYear}` : null,
                      yearsOut(poster.batchYear),
                    ])}
                  </p>
                </div>
              </div>
              <dl className="divide-y divide-line">
                <DetailRow className="grid-cols-[6.5rem_1fr]" label="Works at">
                  {poster.currentCompany ? (
                    memberLine([poster.designation, poster.currentCompany])
                  ) : (
                    <span className="font-normal text-secondary">Not on their profile</span>
                  )}
                </DetailRow>
                <DetailRow className="grid-cols-[6.5rem_1fr]" label="On this board">
                  {history.total > 1 ? (
                    memberLine([
                      history.live ? `${history.live} live` : null,
                      history.closed ? `${history.closed} closed` : null,
                      history.rejected ? `${history.rejected} rejected` : null,
                      history.pending ? `${history.pending} waiting` : null,
                    ])
                  ) : (
                    'This is their first posting'
                  )}
                </DetailRow>
                <DetailRow className="grid-cols-[6.5rem_1fr]" label="Referrals">
                  {poster.openToReferrals ? 'Open to referrals' : <span className="font-normal text-secondary">Not offered</span>}
                </DetailRow>
              </dl>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
