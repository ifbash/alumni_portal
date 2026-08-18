import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Briefcase,
  BadgeCheck,
  ShieldAlert,
  Building2,
  MapPin,
  Users,
  ExternalLink,
  CalendarClock,
  ScrollText,
} from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getJobs } from '@/lib/data/repo';
import type { JobPosting } from '@/lib/data/types';
import {
  PageHeader,
  Section,
  Alert,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  Stat,
  Avatar,
  EmptyState,
  Separator,
  TableWrap,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  DefinitionCard,
} from '@/components/ui';
import { formatDate, formatRelative, memberLine } from '@/lib/format';
import { ModerationActions } from './ModerationActions';

export const metadata = { title: 'Job moderation' };

export default async function AdminJobsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  if (!resolved.brand.pack.features.jobs) notFound();

  requireCap(session, 'job.moderate');

  const pending = getJobs(session, { state: 'pending_moderation' });
  const live = getJobs(session, { state: 'live' });
  const rejected = getJobs(session, { state: 'rejected' });
  const closed = getJobs(session, { state: 'closed' });

  const applications = live.reduce((n, j) => n + j.applicationCount, 0);

  // How many live postings this member already has behind them. A first-time
  // poster and someone on their ninth posting are not the same review.
  const livePerPoster = new Map<string, number>();
  for (const j of live) livePerPoster.set(j.postedBy.id, (livePerPoster.get(j.postedBy.id) ?? 0) + 1);

  const moderated = [...rejected, ...live, ...closed]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12);

  const canReadAudit = can(session, 'audit.read');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Job moderation"
        description="Every posting is held until a human reads it. Alumni post here to reach students who trust the college's name on the listing — that trust is the thing moderation protects."
        actions={
          <Badge tone={pending.length ? 'warning' : 'success'} dot>
            {pending.length ? `${pending.length} waiting` : 'Queue clear'}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="In the queue"
          value={pending.length}
          hint={pending.length ? 'Nothing is visible to students until you decide' : 'Nothing waiting'}
          icon={<ShieldAlert className="size-4" />}
        />
        <Stat label="Live postings" value={live.length} hint="Visible in the jobs board" icon={<Briefcase className="size-4" />} />
        <Stat
          label="Applications"
          value={applications.toLocaleString('en-IN')}
          hint="Across every live posting"
          icon={<Users className="size-4" />}
        />
        <Stat
          label="Rejected"
          value={rejected.length}
          hint="Each one carries a reason the poster can read"
          icon={<ScrollText className="size-4" />}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="min-w-0 space-y-1">
            <CardTitle as="h2">The policy you are applying</CardTitle>
            <CardDescription>
              The rule the last rejection cited, written out so two moderators reach the same answer.
            </CardDescription>
          </div>
        </CardHeader>
        <CardBody className="space-y-4 text-sm">
          <div className="space-y-1">
            <p className="font-semibold">Direct employers only.</p>
            <p className="text-secondary">
              The posting must come from the organisation that will employ the candidate. A consultancy or staffing
              firm advertising a role at an unnamed client is refused, however genuine the role is — a student cannot
              evaluate an employer they are not told the name of, and the placement cell cannot follow up on an offer
              that was never made by anyone identifiable.
            </p>
          </div>
          <Separator />
          <ul className="space-y-2 text-secondary">
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-brand-fg">
                ·
              </span>
              <span>
                <strong className="text-primary">Name the employer.</strong> &ldquo;A leading MNC&rdquo; is a
                rejection.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-brand-fg">
                ·
              </span>
              <span>
                <strong className="text-primary">No fee from the candidate</strong>, in any form — registration,
                training, certification, deposit.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-brand-fg">
                ·
              </span>
              <span>
                <strong className="text-primary">The apply route must reach the hiring team.</strong> A link to a
                lead-capture form is not an application.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-brand-fg">
                ·
              </span>
              <span>
                <strong className="text-primary">A rejection always carries a reason</strong>, and the poster reads
                it. An approval does not need one.
              </span>
            </li>
          </ul>
        </CardBody>
      </Card>

      <Section
        title="Queue"
        description={
          pending.length
            ? 'Read the whole posting, then decide. Both outcomes are recorded against your name.'
            : 'Nothing is waiting on you.'
        }
      >
        {pending.length === 0 ? (
          <EmptyState
            icon={<BadgeCheck className="size-5" />}
            title="The queue is clear"
            description="Every posting an alumnus has submitted has been decided. New submissions land here immediately and stay invisible to students until then."
          />
        ) : (
          <div className="space-y-6">
            {pending.map((job) => (
              <QueueCard key={job.id} job={job} livePostings={livePerPoster.get(job.postedBy.id) ?? 0} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Recently moderated"
        description="What was decided, and on what grounds. A queue nobody can audit at a glance is a queue that drifts."
        actions={
          canReadAudit ? (
            <Link href="/admin/audit" className="text-sm font-medium text-brand-fg hover:underline">
              Full audit log
            </Link>
          ) : undefined
        }
      >
        {moderated.length === 0 ? (
          <EmptyState title="Nothing has been moderated yet" description="Decisions appear here as they are made." />
        ) : (
          <>
            <TableWrap caption="Recently moderated job postings with the decision and its reason" className="hidden sm:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Posting</TH>
                    <TH>Posted by</TH>
                    <TH>Submitted</TH>
                    <TH>Decision</TH>
                    <TH>Reason</TH>
                  </TR>
                </THead>
                <TBody>
                  {moderated.map((j) => (
                    <TR key={j.id} interactive>
                      <TD>
                        <p className="font-medium">{j.title}</p>
                        <p className="text-xs text-secondary">
                          {memberLine([j.company, j.location, j.isInternship ? 'Internship' : null])}
                        </p>
                      </TD>
                      <TD>
                        <p className="text-sm">{j.postedBy.fullName}</p>
                        <p className="text-xs text-muted">
                          {memberLine([j.postedBy.departmentCode, j.postedBy.batchYear])}
                        </p>
                      </TD>
                      <TD>
                        <span className="text-sm">{formatDate(j.createdAt)}</span>
                      </TD>
                      <TD>
                        <DecisionBadge state={j.state} />
                      </TD>
                      <TD>
                        <p className="max-w-prose text-sm text-secondary">
                          {j.moderationNote ?? (j.state === 'live' ? 'No reason recorded — approvals do not need one.' : '—')}
                        </p>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>

            <div className="space-y-3 sm:hidden">
              {moderated.map((j) => (
                <DefinitionCard
                  key={j.id}
                  title={j.title}
                  subtitle={memberLine([j.company, j.location])}
                  rows={[
                    { label: 'Posted by', value: j.postedBy.fullName },
                    { label: 'Submitted', value: formatDate(j.createdAt) },
                    { label: 'Decision', value: <DecisionBadge state={j.state} /> },
                    {
                      label: 'Reason',
                      value: j.moderationNote ?? (j.state === 'live' ? 'None recorded' : '—'),
                    },
                  ]}
                />
              ))}
            </div>

            <p className="text-xs text-muted">
              The moderator&rsquo;s name and the exact time of each decision live in the audit log under{' '}
              <code className="font-mono">job.moderate</code>
              {canReadAudit ? '.' : ', which needs the audit.read capability to open.'}
            </p>
          </>
        )}
      </Section>
    </div>
  );
}

function DecisionBadge({ state }: { state: JobPosting['state'] }) {
  if (state === 'live') {
    return (
      <Badge tone="success" dot>
        Approved
      </Badge>
    );
  }
  if (state === 'rejected') {
    return (
      <Badge tone="danger" dot>
        Rejected
      </Badge>
    );
  }
  return <Badge tone="neutral">Closed by the poster</Badge>;
}

function QueueCard({ job, livePostings }: { job: JobPosting; livePostings: number }) {
  const poster = job.postedBy;
  const employerMatch =
    poster.currentCompany && poster.currentCompany.toLowerCase() === job.company.toLowerCase();

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning" dot>
              Awaiting moderation
            </Badge>
            {job.isInternship ? <Badge tone="info">Internship</Badge> : null}
            <span className="text-xs text-muted">Submitted {formatRelative(job.createdAt)}</span>
          </div>
          <CardTitle as="h3">{job.title}</CardTitle>
          <CardDescription>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1.5">
                <Building2 className="size-4" aria-hidden="true" />
                {job.company}
              </span>
              {job.location ? (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden="true" />
                  {job.location}
                </span>
              ) : null}
              {job.closesOn ? (
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="size-4" aria-hidden="true" />
                  Closes {formatDate(job.closesOn)}
                </span>
              ) : null}
            </span>
          </CardDescription>
        </div>
      </CardHeader>

      <CardBody className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-secondary">Experience</dt>
              <dd className="font-medium">{job.experienceYears ?? 'Not stated'}</dd>
            </div>
            <div>
              <dt className="text-xs text-secondary">Compensation</dt>
              <dd className="font-medium tabular">{job.salaryRange ?? 'Not stated'}</dd>
            </div>
            <div>
              <dt className="text-xs text-secondary">Apply route</dt>
              <dd className="font-medium">
                {job.applyUrl ? (
                  <a
                    href={job.applyUrl}
                    rel="noreferrer noopener nofollow"
                    target="_blank"
                    className="inline-flex items-center gap-1 text-brand-fg underline underline-offset-2"
                  >
                    External link
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                ) : (
                  'Through the portal'
                )}
              </dd>
            </div>
          </dl>

          {job.skills.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {job.skills.map((s) => (
                <li key={s}>
                  <Badge tone="outline">{s}</Badge>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="whitespace-pre-line text-sm leading-relaxed text-secondary">
              {job.description ?? 'No description was submitted, which is itself grounds for a rejection.'}
            </p>
          </div>
        </div>

        <aside className="space-y-4 rounded-lg border border-line bg-surface-sunken p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Who posted this</p>

          <div className="flex items-start gap-3">
            <Avatar name={poster.fullName} src={poster.photoUrl} size="md" />
            <div className="min-w-0">
              <Link href={`/directory/${poster.slug}`} className="font-semibold hover:text-brand-fg hover:underline">
                {poster.fullName}
              </Link>
              <p className="text-xs text-secondary">
                {memberLine([poster.departmentCode, poster.batchYear ? `Batch of ${poster.batchYear}` : null, poster.city])}
              </p>
            </div>
          </div>

          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-secondary">Current employer on their profile</dt>
              <dd className="font-medium">
                {poster.currentCompany
                  ? memberLine([poster.designation, poster.currentCompany])
                  : 'Nothing on their profile'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-secondary">Standing</dt>
              <dd className="font-medium">
                {livePostings === 0
                  ? 'First posting from this member'
                  : `${livePostings} posting${livePostings === 1 ? '' : 's'} already live`}
              </dd>
            </div>
          </dl>

          {employerMatch ? (
            <Alert tone="success" title="Consistent with the direct-employer rule">
              <p>
                They work at {job.company}. A referral from this posting reaches a real person inside the company.
              </p>
            </Alert>
          ) : poster.currentCompany ? (
            <Alert tone="warning" title="Posting for a company they do not work at">
              <p>
                Their profile says {poster.currentCompany}, the posting says {job.company}. That is fine for an
                alumnus passing on a genuine opening — and it is exactly what a staffing listing looks like. Read the
                description before approving.
              </p>
            </Alert>
          ) : (
            <Alert tone="warning" title="No employer on their profile">
              <p>
                There is nothing to check the posting against. Ask them to complete their profile, or verify the
                opening independently.
              </p>
            </Alert>
          )}

          {poster.openToReferrals ? (
            <p className="text-xs text-secondary">Open to referrals — students may contact them about this role.</p>
          ) : null}
        </aside>
      </CardBody>

      <CardFooter className="justify-end">
        <ModerationActions jobId={job.id} jobTitle={job.title} company={job.company} posterName={poster.fullName} />
      </CardFooter>
    </Card>
  );
}
