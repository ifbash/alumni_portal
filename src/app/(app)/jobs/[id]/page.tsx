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
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
  ShareActions,
  StickyActionBar,
} from '@/components/ui';
import { closesLabel } from '@/components/content';
import { cn } from '@/lib/cn';
import { jobReviewLine } from '@/lib/branding/copy';
import { isFresherFriendly } from '@/lib/event-status';
import { displayNow, formatDate, formatRelative, memberLine } from '@/lib/format';
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

  // How much of the application window has gone, for the rail's bar. Read
  // against the display clock like every other date on the portal.
  const windowSpan = job.closesOn ? Date.parse(job.closesOn) - Date.parse(job.createdAt) : 0;
  const windowGone = windowSpan > 0 ? displayNow().getTime() - Date.parse(job.createdAt) : 0;

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

  // The fact strip: what a student weighs before reading a word of the brief.
  const facts: Array<{ label: string; value: string; icon: React.ReactNode; warn?: boolean }> = [];
  if (job.salaryRange) facts.push({ label: 'Pay', value: job.salaryRange, icon: <Wallet /> });
  const level = job.isInternship ? 'Internship' : job.experienceYears;
  if (level) {
    facts.push({ label: 'Experience', value: level, icon: job.isInternship ? <GraduationCap /> : <Briefcase /> });
  }
  if (job.location) facts.push({ label: 'Where', value: job.location, icon: <MapPin /> });
  if (live) {
    facts.push({
      label: 'Closes',
      value: closes ? closes.text.replace(/^Closes /, '') : 'Open until filled',
      icon: <CalendarClock />,
      warn: closes?.soon,
    });
  } else if (job.state === 'closed' && job.closesOn) {
    facts.push({ label: 'Closed', value: formatDate(job.closesOn, timing), icon: <CalendarClock /> });
  }

  const shareCard = (
    <div className="space-y-2 border-t border-line p-card">
      <p className="text-sm font-semibold">Pass it on</p>
      <ShareActions url={url} whatsappHref={whatsappHref} title={`${job.title} at ${job.company}`} size="sm" />
    </div>
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Jobs', href: '/jobs' }, { label: job.title }]} />

      <header className="ring-hairline relative isolate animate-fade-up overflow-hidden rounded-xl border border-line bg-surface-raised shadow-md">
        {/* A wash of the college's tint behind the monogram, fading to the card. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--brand-soft)_85%,transparent),transparent)]"
        />
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:gap-6 sm:p-7">
          <Avatar
            name={job.company}
            size="lg"
            shape="square"
            className="size-16 rounded-xl text-xl shadow-sm sm:size-20 sm:text-2xl"
          />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1.5">
              <p className="eyebrow text-xs text-brand-fg">{job.company}</p>
              <h1 className="font-display text-display-sm font-bold tracking-tight">{job.title}</h1>
            </div>

            <ul className="flex flex-wrap items-center gap-1.5" aria-label="About this role">
              {job.state !== 'live' ? (
                <li className="flex">
                  <JobStateBadge state={job.state} />
                </li>
              ) : null}
              {fresher ? (
                <li>
                  <Badge tone="accent">Open to freshers</Badge>
                </li>
              ) : null}
              {job.isInternship ? (
                <li>
                  <Badge tone="outline">Internship</Badge>
                </li>
              ) : null}
              <li className="text-sm text-secondary">
                Posted {formatDate(job.createdAt, timing)}
                {job.isInternship ? null : ' · Full-time'}
              </li>
            </ul>
          </div>
        </div>

        {facts.length > 0 ? (
          <dl className="divide-y divide-line border-t border-line bg-surface-raised sm:flex sm:divide-x sm:divide-y-0">
            {facts.map((f) => (
              <div
                key={f.label}
                className="flex min-w-0 items-baseline justify-between gap-4 px-5 py-3 sm:block sm:flex-1 sm:px-6 sm:py-4"
              >
                <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                  <span aria-hidden="true" className="grid place-items-center">
                    {f.icon}
                  </span>
                  {f.label}
                </dt>
                <dd
                  className={cn(
                    'font-display text-md font-semibold leading-snug tabular sm:mt-1 sm:text-lg',
                    f.warn ? 'text-warning-fg' : 'text-primary',
                  )}
                >
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
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
            <Card className="hidden overflow-hidden lg:block">
              <CardBody className="space-y-4">
                {job.salaryRange ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">Pay</p>
                    <p className="font-display text-xl font-bold leading-tight tabular">{job.salaryRange}</p>
                  </div>
                ) : null}

                {job.closesOn ? (
                  <div className="space-y-1.5">
                    <p className={cn('text-sm font-semibold', closes?.soon ? 'text-warning-fg' : 'text-primary')}>
                      {closes ? closes.text : `Closed ${formatDate(job.closesOn, timing)}`}
                    </p>
                    {windowSpan > 0 ? (
                      <Progress
                        value={windowGone}
                        max={windowSpan}
                        tone={closes?.soon ? 'warning' : 'brand'}
                        label="How much of the application window has passed"
                      />
                    ) : null}
                    <p className="flex justify-between gap-2 text-xs text-secondary">
                      <span>Posted {formatDate(job.createdAt, timing)}</span>
                      <span>Closes {formatDate(job.closesOn, timing)}</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-secondary">Open until filled.</p>
                )}

                <div className="space-y-2.5">
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
                </div>

                <p className="flex gap-2 text-sm text-secondary">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-fg" aria-hidden="true" />
                  <span>The poster sees your name, branch, batch and note — never your phone or email.</span>
                </p>
              </CardBody>
              {shareCard}
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
              {live ? shareCard : null}
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
                    <p className="flex items-baseline gap-2 text-sm text-secondary">
                      <span className="font-display text-display-xs font-bold leading-none tabular text-primary">
                        {count.toLocaleString('en-IN')}
                      </span>
                      {count > 0
                        ? `${count === 1 ? 'person has' : 'people have'} applied through the portal.`
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
              {live ? shareCard : null}
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

        <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-1">
          <section aria-labelledby="job-about" className="space-y-3">
            <h2 id="job-about" className="font-display text-xl font-semibold tracking-tight">
              About the role
            </h2>
            {job.description ? (
              // Line breaks are preserved: posters write these as short
              // paragraphs, and collapsing them turns a readable brief into
              // one grey block.
              <div className="max-w-prose whitespace-pre-line text-md leading-relaxed text-primary">
                {job.description}
              </div>
            ) : (
              <p className="text-sm text-secondary">The poster did not write a description.</p>
            )}
          </section>

          {job.skills.length ? (
            <section aria-labelledby="job-skills" className="space-y-2.5">
              <h2 id="job-skills" className="eyebrow text-xs text-secondary">
                They screen for
              </h2>
              <ul className="flex flex-wrap gap-2">
                {job.skills.map((s) => (
                  <li
                    key={s}
                    className="inline-flex min-h-9 items-center rounded-full bg-brand-soft px-3.5 text-sm font-medium text-brand-soft-fg"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {!isAuthor ? (
            <Card as="section" aria-labelledby="job-poster">
              <CardBody className="space-y-4">
                <p id="job-poster" className="eyebrow text-xs text-secondary">
                  {canApply ? 'Your way in' : 'Posted by'}
                </p>
                <div className="flex items-center gap-4">
                  <Avatar name={job.postedBy.fullName} src={job.postedBy.photoUrl} size="lg" />
                  <div className="min-w-0">
                    <p className="font-display text-md font-semibold leading-snug">
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
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-4 text-sm text-secondary">
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
