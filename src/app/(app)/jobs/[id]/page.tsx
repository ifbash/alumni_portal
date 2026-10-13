import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import {
  Briefcase,
  CalendarClock,
  ExternalLink,
  GraduationCap,
  MapPin,
  ShieldCheck,
  Wallet,
} from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, isActive } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getConnectionQuota, getJobById, getMyApplications } from '@/lib/data/repo';
import {
  Avatar,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  ShareActions,
  StickyActionBar,
} from '@/components/ui';
import { closesLabel } from '@/components/content';
import { cn } from '@/lib/cn';
import { jobReviewLine } from '@/lib/branding/copy';
import { isFresherFriendly } from '@/lib/event-status';
import { formatDate, formatRelative, memberLine } from '@/lib/format';
import { firstNameOf } from '@/lib/identity';
import { mailto } from '@/lib/mailto';
import { siteOrigin, whatsappShareUrl } from '@/lib/share';
import { jobShareText } from '@/lib/share-text';
import { JobStateBadge } from '../JobCard';
import { ApplyButton } from './ApplyButton';

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
  if (!isActive(session)) redirect('/pending');

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

  const pack = brand.pack;
  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };
  const supportEmail = pack.copy.supportEmail ?? null;
  const live = job.state === 'live';
  const applied = Boolean(myApplication) || job.viewerHasApplied;

  // Who gets which panel. Presentation only: the apply endpoint, the
  // applicant list and the console each keep their own guard.
  const applyNow = canApply && live && !isAuthor && !applied;
  const showApplied = canApply && !isAuthor && applied;
  const canOpenApplicants = isAuthor || can(session, 'job.applicants.export');
  const shareWithStudents = !canApply && live && !isAuthor;
  const isStudent = session.roles.some((r) => r.role === 'student');

  const url = `${await siteOrigin()}/jobs/${job.id}`;
  const whatsappHref = whatsappShareUrl(jobShareText(pack, job), url);

  const closes = closesLabel(job.closesOn, timing.timeZone);
  const fresher = isFresherFriendly(job);
  const applicantsHref = `/jobs/${job.id}/applicants`;
  const count = job.applicationCount;
  const seeApplicants = count > 0 ? `See ${count.toLocaleString('en-IN')} applicant${count === 1 ? '' : 's'}` : 'Open the applicant list';

  // The poster, as a way in rather than a byline.
  const posterFirst = firstNameOf(job.postedBy.fullName);
  const yy = job.postedBy.batchYear ? `’${String(job.postedBy.batchYear).slice(-2)}` : null;
  const posterTag = [job.postedBy.departmentCode, yy].filter(Boolean).join(' ');
  const posterWork = memberLine([
    job.postedBy.designation,
    job.postedBy.currentCompany ? `at ${job.postedBy.currentCompany}` : null,
  ]).replace(' · at ', ' at ');
  const canAskPoster =
    !isAuthor &&
    pack.features.directory &&
    can(session, 'directory.search.alumni') &&
    job.postedBy.status === 'active_alumni';
  const quota = isStudent && canAskPoster ? getConnectionQuota(session) : null;
  const available = quota ? Math.max(0, Math.min(quota.openLimit - quota.openRequests, quota.monthlyLimit - quota.usedThisMonth)) : 0;

  const reviewLine = jobReviewLine(pack.copy);
  const railOnPhones = showApplied || isAuthor || (isModerator && !isAuthor) || shareWithStudents;

  const chip = 'inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line bg-surface-raised px-3 text-sm text-secondary';

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Jobs', href: '/jobs' }, { label: job.title }]} />

      <header className="space-y-3">
        <div className="flex items-start gap-4">
          <Avatar name={job.company} size="lg" shape="square" />
          <div className="min-w-0 flex-1 space-y-0.5">
            <h1 className="font-display text-display-xs font-bold">{job.title}</h1>
            <p className="text-md text-secondary">{job.company}</p>
          </div>
        </div>

        {/* Under the title from sm; the full width on a phone, where the
            monogram's column would squeeze the chips into a stack. */}
        <div className="space-y-3 sm:pl-[4.5rem]">
          <ul className="flex flex-wrap gap-1.5" aria-label="About this role">
            {job.state !== 'live' ? (
              <li className="flex">
                <JobStateBadge state={job.state} className="min-h-8 px-3" />
              </li>
            ) : null}
            {job.location ? (
              <li className={chip}>
                <MapPin className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                {job.location}
              </li>
            ) : null}
            {fresher ? (
              <li className={cn(chip, 'border-transparent bg-accent-soft font-medium text-accent-soft-fg')}>Open to freshers</li>
            ) : job.experienceYears ? (
              <li className={chip}>
                <Briefcase className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                {job.experienceYears}
              </li>
            ) : null}
            {job.salaryRange ? (
              <li className={cn(chip, 'tabular')}>
                <Wallet className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                {job.salaryRange}
              </li>
            ) : null}
            {job.isInternship ? (
              <li className={chip}>
                <GraduationCap className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                Internship
              </li>
            ) : null}
            {live ? (
              <li
                className={cn(
                  chip,
                  closes?.soon && 'border-transparent bg-warning-soft font-medium text-warning-fg',
                )}
              >
                <CalendarClock className={cn('size-3.5 shrink-0', !closes?.soon && 'text-muted')} aria-hidden="true" />
                {closes ? closes.text : 'Open until filled'}
              </li>
            ) : job.state === 'closed' && job.closesOn ? (
              <li className={chip}>
                <CalendarClock className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                Closed {formatDate(job.closesOn, timing)}
              </li>
            ) : null}
          </ul>

          <p className="text-sm text-secondary">
            Posted {formatDate(job.createdAt, timing)}
            {job.isInternship ? null : ' · Full-time'}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* First in the document, so on a phone the panel that matters to
            this viewer sits under the header; on a desktop it is the rail. */}
        <aside
          aria-label="Actions for this posting"
          className={cn(
            'min-w-0 space-y-4 lg:sticky lg:top-20 lg:col-start-2 lg:row-start-1 lg:self-start',
            !railOnPhones && 'hidden lg:block',
          )}
        >
          {applyNow ? (
            <Card className="hidden lg:block">
              <CardBody className="space-y-3">
                <ApplyButton
                  jobTitle={job.title}
                  company={job.company}
                  alreadyApplied={false}
                  appliedOn={null}
                  appliedNote={null}
                />
                {job.applyUrl ? (
                  <ButtonLink
                    href={job.applyUrl}
                    variant="secondary"
                    className="min-h-11 w-full"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="size-4" aria-hidden="true" />
                    Company site
                    <span className="sr-only"> (opens in a new tab)</span>
                  </ButtonLink>
                ) : null}
                <p className="text-sm text-secondary">
                  The poster sees your name, branch, batch and note — never your phone or email.
                </p>
              </CardBody>
            </Card>
          ) : null}

          {showApplied ? (
            <Card>
              <CardBody>
                <ApplyButton
                  jobTitle={job.title}
                  company={job.company}
                  alreadyApplied
                  appliedOn={myApplication ? formatDate(myApplication.createdAt, timing) : null}
                  appliedNote={myApplication?.note ?? null}
                />
              </CardBody>
            </Card>
          ) : null}

          {isAuthor ? (
            <Card>
              <CardHeader variant="stack">
                <CardTitle as="h2" className="text-md">
                  Your posting
                </CardTitle>
                <JobStateBadge state={job.state} />
              </CardHeader>
              <CardBody className="space-y-3">
                {job.state === 'live' || job.state === 'closed' ? (
                  <>
                    <p className="text-sm text-secondary">
                      {count > 0
                        ? `${count.toLocaleString('en-IN')} ${count === 1 ? 'person has' : 'people have'} applied through the portal.`
                        : 'Nobody has applied yet.'}
                    </p>
                    <ButtonLink href={applicantsHref} className="min-h-11 w-full">
                      {seeApplicants}
                    </ButtonLink>
                  </>
                ) : null}
                {job.state === 'pending_moderation' ? (
                  <p className="text-sm text-secondary">
                    Students cannot see it yet. The placement cell reads it first{reviewLine ? `, ${reviewLine}` : ''}.
                  </p>
                ) : null}
                {job.state === 'rejected' ? (
                  <>
                    <p className="text-sm text-secondary">
                      {job.moderationNote ?? 'No reason was recorded against this decision.'}
                    </p>
                    {supportEmail ? (
                      <a
                        href={mailto(supportEmail, `About my posting: ${job.title}`, [])}
                        className="link inline-flex min-h-11 items-center text-sm font-medium"
                      >
                        Write to {supportEmail}
                      </a>
                    ) : null}
                  </>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          {isModerator && !isAuthor ? (
            <Card>
              <CardHeader variant="stack">
                <CardTitle as="h2" className="text-md">
                  Placement cell
                </CardTitle>
                {job.state === 'pending_moderation' ? (
                  <CardDescription>
                    Submitted {formatRelative(job.createdAt, timing)}. Students cannot see it until it is approved.
                  </CardDescription>
                ) : null}
              </CardHeader>
              <CardBody className="space-y-2">
                {canOpenApplicants && canSeeApplicants && (job.state === 'live' || job.state === 'closed') ? (
                  <ButtonLink href={applicantsHref} className="min-h-11 w-full">
                    {count > 0 ? seeApplicants : 'See applicants'}
                  </ButtonLink>
                ) : null}
                <ButtonLink href={`/admin/jobs/${job.id}`} variant="secondary" className="min-h-11 w-full">
                  Review in the placement console
                </ButtonLink>
              </CardBody>
            </Card>
          ) : null}

          {shareWithStudents ? (
            <Card>
              <CardHeader variant="stack">
                <CardTitle as="h2" className="text-md">
                  Share with your students
                </CardTitle>
                <CardDescription>Send it to a class or branch group. They apply here, signed in.</CardDescription>
              </CardHeader>
              <CardBody>
                <ShareActions url={url} whatsappHref={whatsappHref} title={`${job.title} at ${job.company}`} size="sm" />
              </CardBody>
            </Card>
          ) : null}
        </aside>

        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
          {job.skills.length ? (
            <section aria-labelledby="job-skills" className="space-y-2">
              <h2 id="job-skills" className="font-sans text-sm font-semibold text-secondary">
                They screen for
              </h2>
              <ul className="flex flex-wrap gap-1.5">
                {job.skills.map((s) => (
                  <li key={s} className="inline-flex min-h-8 items-center rounded-full bg-brand-soft px-3 text-sm font-medium text-brand-soft-fg">
                    {s}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle as="h2">About the role</CardTitle>
            </CardHeader>
            <CardBody>
              {job.description ? (
                // Line breaks are preserved: posters write these as short
                // paragraphs, and collapsing them turns a readable brief into
                // one grey block.
                <div className="max-w-prose whitespace-pre-line text-md leading-relaxed text-secondary">
                  {job.description}
                </div>
              ) : (
                <p className="text-sm text-secondary">The poster did not write a description.</p>
              )}
            </CardBody>
          </Card>

          {!isAuthor ? (
            <Card>
              <CardHeader variant="stack">
                <CardTitle as="h2" className="text-md">
                  {canApply ? 'Your way in' : 'Posted by'}
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar name={job.postedBy.fullName} src={job.postedBy.photoUrl} size="md" />
                  <div className="min-w-0">
                    <p className="font-medium">
                      {posterFirst}
                      {posterTag ? ` · ${posterTag}` : ''} posted this
                    </p>
                    {posterWork ? <p className="truncate text-sm text-secondary">{posterWork}</p> : null}
                  </div>
                </div>
                {canAskPoster ? (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <ButtonLink href={`/directory/${job.postedBy.slug}`} variant="secondary" className="min-h-11">
                      Ask {posterFirst} about this role
                    </ButtonLink>
                    {quota ? (
                      <p className="text-sm text-secondary">
                        {available > 0
                          ? `You have ${available} ${available === 1 ? 'request' : 'requests'} available.`
                          : quota.reason ?? 'Your requests are all in use.'}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          {live ? (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-secondary">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4 shrink-0 text-muted" aria-hidden="true" />
                Checked by the placement cell before students could see it.
              </span>
              {supportEmail ? (
                <a
                  href={mailto(supportEmail, `Report a job posting: ${job.title} at ${job.company}`, [url, ''])}
                  className="link inline-flex min-h-11 items-center"
                >
                  Report this posting
                </a>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>

      {applyNow ? (
        <StickyActionBar label="Apply">
          <ApplyButton
            jobTitle={job.title}
            company={job.company}
            alreadyApplied={false}
            appliedOn={null}
            appliedNote={null}
            variant="bar"
          />
          {job.applyUrl ? (
            <ButtonLink href={job.applyUrl} variant="secondary" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" aria-hidden="true" />
              Company site
              <span className="sr-only"> (opens in a new tab)</span>
            </ButtonLink>
          ) : null}
        </StickyActionBar>
      ) : null}
    </div>
  );
}
