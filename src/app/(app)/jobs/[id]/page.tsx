import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import {
  Building2,
  CalendarClock,
  ExternalLink,
  GraduationCap,
  IndianRupee,
  MapPin,
  ShieldCheck,
  Timer,
  Users,
} from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getJobById, getMyApplications } from '@/lib/data/repo';
import type { JobPosting } from '@/lib/data/types';
import {
  Alert,
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DetailRow,
  PageHeader,
  Section,
  Separator,
} from '@/components/ui';
import { MemberRow } from '@/components/members/MemberCard';
import { formatDate, formatRelative, memberLine } from '@/lib/format';
import { ApplyButton } from './ApplyButton';

type Tone = 'neutral' | 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

const STATE_META: Record<JobPosting['state'], { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending_moderation: { label: 'With the placement cell', tone: 'warning' },
  live: { label: 'Live', tone: 'success' },
  rejected: { label: 'Not published', tone: 'danger' },
  closed: { label: 'Closed', tone: 'neutral' },
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
  const job = session ? getJobById(session, id) : null;

  if (!job) return { title: 'Posting not found' };
  return {
    title: `${job.title} · ${job.company}`,
    description: memberLine([job.company, job.location, job.experienceYears]) || undefined,
  };
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { brand } = (await getTenantBrand())!;
  if (!brand.pack.features.jobs) notFound();

  const { id } = await params;

  // `getJobById` already refuses anything that is not live to anyone who is
  // neither the author nor a moderator. A 404 here is an authorisation
  // outcome, not only a missing row.
  const job = getJobById(session, id);
  if (!job) notFound();

  const isModerator = can(session, 'job.moderate');
  const isAuthor = job.postedBy.id === session.memberId;
  const canApply = can(session, 'job.apply');
  const canSeeApplicants = isModerator || isAuthor;

  const myApplication = canApply
    ? getMyApplications(session).find((a) => a.jobId === job.id) ?? null
    : null;

  const state = STATE_META[job.state];
  const supportEmail = brand.pack.copy.supportEmail ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Jobs', href: '/jobs' },
              { label: job.company, href: `/jobs?q=${encodeURIComponent(job.company)}` },
              { label: job.title },
            ]}
          />
        }
        eyebrow={job.company}
        title={job.title}
        description={
          memberLine([job.location, job.experienceYears, job.salaryRange]) ||
          'No location, experience band or salary was stated on this posting.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {job.isInternship ? (
              <Badge tone="accent">
                <GraduationCap className="size-3" aria-hidden="true" />
                Internship
              </Badge>
            ) : null}
            {job.state !== 'live' ? (
              <Badge tone={state.tone} dot>
                {state.label}
              </Badge>
            ) : null}
          </div>
        }
      />

      {job.state === 'pending_moderation' ? (
        <Alert
          tone="warning"
          title="Not on the board yet — the placement cell is reading it"
          icon={<Timer className="size-4" />}
        >
          <p>
            {isAuthor
              ? 'Your posting was received and is queued for review. No student can open it until the placement cell approves it, usually within two working days. Nothing further is needed from you.'
              : 'This posting has been submitted but not published. Students cannot see it.'}
            {isModerator ? ' Approve or send it back from the placement console.' : ''}
          </p>
        </Alert>
      ) : null}

      {job.state === 'rejected' ? (
        <Alert tone="danger" title="Sent back by the placement cell" icon={<ShieldCheck className="size-4" />}>
          <p>{job.moderationNote ?? 'No reason was recorded against this decision.'}</p>
          <p className="mt-2">
            {isAuthor ? (
              <>
                Correct the posting and submit it again, or write to{' '}
                {supportEmail ? <a href={`mailto:${supportEmail}`}>{supportEmail}</a> : 'the alumni cell'}{' '}
                if you think the decision is wrong.
              </>
            ) : (
              'The decision and its reason are kept against the posting for audit.'
            )}
          </p>
        </Alert>
      ) : null}

      {job.state === 'closed' ? (
        <Alert tone="neutral" title="This role is closed" icon={<CalendarClock className="size-4" />}>
          <p>
            {job.closesOn
              ? `Applications shut on ${formatDate(job.closesOn)}.`
              : 'Applications are shut.'}{' '}
            The posting is kept so applicants can still see what they applied to.
          </p>
        </Alert>
      ) : null}

      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2">About the role</CardTitle>
            </CardHeader>
            <CardBody>
              {job.description ? (
                // Line breaks are preserved: posters write these as short
                // paragraphs, and collapsing them turns a readable brief into
                // one grey block.
                <div className="max-w-prose whitespace-pre-line text-sm leading-relaxed text-secondary">
                  {job.description}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  The poster did not write a description. Everything known about this role is in the
                  details panel.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Details</CardTitle>
            </CardHeader>
            <CardBody className="pt-2">
              <dl className="divide-y divide-line">
                <DetailRow label="Company">
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
                    <span className="text-muted">Not stated</span>
                  )}
                </DetailRow>
                <DetailRow label="Experience">
                  {job.experienceYears ?? <span className="text-muted">Not stated</span>}
                </DetailRow>
                <DetailRow label="Compensation">
                  {job.salaryRange ? (
                    <span className="inline-flex items-center gap-2 tabular">
                      <IndianRupee className="size-3.5 text-muted" aria-hidden="true" />
                      {job.salaryRange}
                    </span>
                  ) : (
                    <span className="text-muted">Not stated — ask at the first call</span>
                  )}
                </DetailRow>
                <DetailRow label="Type">
                  {job.isInternship ? 'Internship' : 'Full-time'}
                </DetailRow>
                <DetailRow label="Posted">
                  {formatDate(job.createdAt)} <span className="text-muted">({formatRelative(job.createdAt)})</span>
                </DetailRow>
                <DetailRow label="Closes">
                  {job.closesOn ? (
                    <>
                      {formatDate(job.closesOn)}{' '}
                      <span className="text-muted">({formatRelative(job.closesOn)})</span>
                    </>
                  ) : (
                    <span className="text-muted">Open until filled</span>
                  )}
                </DetailRow>
                {canSeeApplicants ? (
                  <DetailRow label="Applications">
                    <span className="inline-flex items-center gap-2 tabular">
                      <Users className="size-3.5 text-muted" aria-hidden="true" />
                      {job.applicationCount}
                    </span>
                  </DetailRow>
                ) : null}
              </dl>
            </CardBody>
          </Card>

          {job.skills.length ? (
            <Section title="What they are screening for">
              <ul className="flex flex-wrap gap-1.5">
                {job.skills.map((s) => (
                  <li key={s}>
                    <Badge tone="brand">{s}</Badge>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardBody className="space-y-3">
              <ApplyButton
                jobTitle={job.title}
                company={job.company}
                isLive={job.state === 'live'}
                canApply={canApply}
                isAuthor={isAuthor}
                alreadyApplied={Boolean(myApplication) || job.viewerHasApplied}
                appliedOn={myApplication ? formatDate(myApplication.createdAt) : null}
                appliedNote={myApplication?.note ?? null}
                applyUrl={job.applyUrl}
              />

              {job.applyUrl && job.state === 'live' ? (
                <>
                  <Separator label="or" />
                  <ButtonLink
                    href={job.applyUrl}
                    variant="secondary"
                    className="w-full"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="size-4" aria-hidden="true" />
                    Company careers page
                  </ButtonLink>
                  <p className="text-xs text-muted">
                    {hostOf(job.applyUrl)
                      ? `Opens ${hostOf(job.applyUrl)} in a new tab.`
                      : 'Opens an external site in a new tab.'}{' '}
                    Applying through the portal instead tells the poster you are from{' '}
                    {brand.pack.copy.shortName}.
                  </p>
                </>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-md">
                Posted by
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-1">
              <MemberRow member={job.postedBy} />
              <p className="mt-1 text-xs text-muted">
                {job.postedBy.currentCompany
                  ? `${job.postedBy.currentCompany}${job.postedBy.designation ? ` · ${job.postedBy.designation}` : ''}`
                  : 'Company not listed on their profile.'}
              </p>
              <p className="mt-3 text-xs text-secondary">
                Contact details are never attached to a posting. Send a connection request from
                their profile if you want to ask something before applying.
              </p>
            </CardBody>
          </Card>

          {canSeeApplicants ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2" className="text-md">
                  Applications
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-3 pt-1">
                <p className="font-display text-display-xs font-bold tabular">
                  {job.applicationCount}
                </p>
                <p className="text-xs text-secondary">
                  {isAuthor
                    ? 'Visible to you because you posted this role, and to the placement cell. No one else can see who applied.'
                    : 'Visible to you as a moderator. Applicant lists are never shown to other members.'}
                </p>
                {isModerator ? (
                  <ButtonLink href="/admin/jobs" variant="secondary" size="sm" className="w-full">
                    Open in the placement console
                  </ButtonLink>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardBody className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="size-4 text-muted" aria-hidden="true" />
                Reviewed before it was listed
              </p>
              <p className="text-xs text-secondary">
                A person in the placement cell read this posting before any student could open it.
                They reject staffing-agency listings, unpaid &ldquo;training&rdquo; offers and
                anything asking a candidate for money. If this one looks wrong,{' '}
                {supportEmail ? (
                  <a href={`mailto:${supportEmail}`} className="link">
                    tell the alumni cell
                  </a>
                ) : (
                  'tell the alumni cell'
                )}
                .
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
