import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { CalendarClock, GraduationCap, Inbox, Lock, Share2 } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getJobApplications, getJobById } from '@/lib/data/repo';
import type { JobApplication } from '@/lib/data/types';
import { MemberRow } from '@/components/members/MemberCard';
import {
  Alert,
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  ChipNav,
  EmptyState,
  PageHeader,
  ShareActions,
} from '@/components/ui';
import { ProportionBar } from '@/components/charts';
import { jobReviewLine, joinList } from '@/lib/branding/copy';
import { isFresherFriendly } from '@/lib/event-status';
import { formatDate, formatRelative } from '@/lib/format';
import { siteOrigin, whatsappShareUrl } from '@/lib/share';
import { jobShareText } from '@/lib/share-text';
import { JobStateBadge } from '../../JobCard';
import { ExportApplicantsDialog } from './ExportApplicantsDialog';

/**
 * Who applied.
 *
 * Two entirely separate reasons to be on this page, and the guard is an
 * explicit OR rather than one capability check:
 *
 *  - **You posted the role.** An alumnus with no moderation capability
 *    must be able to see who answered their own posting — otherwise the
 *    board is a place you shout into.
 *  - **You hold `job.applicants.export`.** The placement cell shortlists
 *    across every posting.
 *
 * A *different* alumnus holds neither and gets a 403, and so does a
 * student: `job.post` is not granted to the student role, so no student
 * can ever be the poster, and `job.applicants.export` sits with the
 * placement cell. Nothing on this page is reachable by the cohort being
 * listed on it.
 */

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
    title: `Applicants · ${job.title}`,
    description: `Everyone who applied to ${job.title} at ${job.company} through the portal.`,
  };
}

const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default async function JobApplicantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const pack = resolved.brand.pack;
  if (!pack.features.jobs) notFound();

  const { id } = await params;

  // `getJobById` refuses anything that is not live to anyone who is neither
  // the author nor a moderator, so a 404 here is already an authorisation
  // outcome and not only a missing row.
  const job = getJobById(session, id);
  if (!job) notFound();

  const isPoster = job.postedBy.id === session.memberId;
  const canExport = can(session, 'job.applicants.export');
  // Applicants are students, and only a viewer who may enumerate students
  // can open their profile. Everyone else sees the name without a link
  // rather than a link into a not-found page.
  const canViewStudents = can(session, 'directory.search.students');
  // The OR, written out. Being able to read the posting — which every
  // member can — is not being able to read who answered it.
  if (!isPoster && !canExport) requireCap(session, 'job.applicants.export');

  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };

  const applications = getJobApplications(job.id);
  const total = applications.length;
  const withNote = applications.filter((a) => a.note).length;
  const latest = applications[0] ?? null;

  // Branches present, most applicants first. A filter over the fetched
  // list only; it changes nothing about who may see it.
  const byBranch = new Map<string, number>();
  for (const a of applications) {
    const code = a.applicant.departmentCode;
    if (code) byBranch.set(code, (byBranch.get(code) ?? 0) + 1);
  }
  const branches = [...byBranch.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const sp = await searchParams;
  const requestedFilter = one(sp.filter);
  const requestedBranch = one(sp.branch)?.toUpperCase();
  const noteOnly = requestedFilter === 'note';
  const branch = !noteOnly && requestedBranch && byBranch.has(requestedBranch) ? requestedBranch : null;
  const shown: JobApplication[] = noteOnly
    ? applications.filter((a) => a.note)
    : branch
      ? applications.filter((a) => a.applicant.departmentCode === branch)
      : applications;

  const base = `/jobs/${job.id}/applicants`;
  const isLive = job.state === 'live';
  const reviewLine = jobReviewLine(pack.copy);

  const url = `${await siteOrigin()}/jobs/${job.id}`;
  const whatsappHref = whatsappShareUrl(jobShareText(pack, job), url);

  const title =
    total > 0
      ? `${total.toLocaleString('en-IN')} ${total === 1 ? 'person' : 'people'} applied to ${job.title}`
      : isLive
        ? `Nobody has applied to ${job.title} yet`
        : `No applications to ${job.title}`;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Jobs', href: '/jobs' },
              { label: job.title, href: `/jobs/${job.id}` },
              { label: 'Applicants' },
            ]}
          />
        }
        eyebrow={job.company}
        title={title}
        meta={
          <>
            <JobStateBadge state={job.state} />
            {isPoster ? <Badge tone="brand">Your posting</Badge> : null}
          </>
        }
        actions={
          <ButtonLink href={`/jobs/${job.id}`} variant="secondary" className="min-h-11">
            Open posting
          </ButtonLink>
        }
      />

      {job.state === 'pending_moderation' ? (
        <Alert tone="warning">
          <p>
            Students cannot see this posting yet. It is with the placement cell{reviewLine ? `, ${reviewLine}` : ''}.
          </p>
        </Alert>
      ) : null}

      {job.state === 'rejected' ? (
        <Alert tone="warning" title="The placement cell sent this posting back">
          <p>{job.moderationNote ?? 'No reason was recorded against the decision.'} Students never saw it.</p>
        </Alert>
      ) : null}

      {job.state === 'closed' ? (
        <Alert tone="neutral">
          <p>
            {job.closesOn ? `Applications closed on ${formatDate(job.closesOn, timing)}.` : 'Applications are closed.'}{' '}
            This list is final.
          </p>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {total > 0 ? (
            <>
              <Card>
                <CardBody className="space-y-4">
                  <p className="text-sm text-secondary">
                    <span className="font-semibold tabular text-primary">{total.toLocaleString('en-IN')}</span> applied
                    <span aria-hidden="true"> · </span>
                    <span className="sr-only">, </span>
                    <span className="font-semibold tabular text-primary">{withNote.toLocaleString('en-IN')}</span> wrote a note
                    {total > 0 ? <span className="tabular"> ({Math.round((withNote / total) * 100)}%)</span> : null}
                    {latest ? (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span className="sr-only">, </span>
                        most recent {formatRelative(latest.createdAt, timing)}
                      </>
                    ) : null}
                  </p>
                  <BranchMix branches={branches} />
                </CardBody>
              </Card>

              <ChipNav
                ariaLabel="Filter applicants"
                items={[
                  { label: 'All', href: base, active: !noteOnly && !branch, count: total },
                  { label: 'Wrote a note', href: `${base}?filter=note`, active: noteOnly, count: withNote },
                  ...branches.map(([code, n]) => ({
                    label: code,
                    href: `${base}?branch=${encodeURIComponent(code)}`,
                    active: branch === code,
                    count: n,
                  })),
                ]}
              />

              <section aria-labelledby="applicant-list" className="space-y-3">
                <div className="space-y-1">
                  <h2 id="applicant-list" className="font-display text-xl font-semibold">
                    {noteOnly ? 'Wrote a note' : branch ? `From ${branch}` : 'Everyone who applied'}
                    <span className="font-sans text-md font-normal text-secondary"> · newest first</span>
                  </h2>
                  {!noteOnly && shown.some((a) => !a.note) ? (
                    <p className="text-sm text-secondary">Many people apply from a phone without a note.</p>
                  ) : null}
                </div>

                <Card as="ul" className="divide-y divide-line px-card">
                  {shown.map((a) => (
                    <li key={a.id} className="py-3">
                      <MemberRow
                        member={a.applicant}
                        // Applicants are students. An alumni poster may
                        // not enumerate students in the directory, so
                        // linking each name would land them on a
                        // not-found page. Staff who can reach the
                        // profile get the link.
                        linkProfile={canViewStudents}
                        className="py-0"
                        action={
                          <span className="whitespace-nowrap text-sm text-secondary">
                            {formatDate(a.createdAt, timing)}
                          </span>
                        }
                      />
                      {a.note ? (
                        <blockquote className="ml-11 mt-2 whitespace-pre-line border-l-2 border-line-strong pl-3 text-sm text-secondary">
                          {a.note}
                        </blockquote>
                      ) : null}
                    </li>
                  ))}
                </Card>
              </section>
            </>
          ) : isLive ? (
            <Card>
              <CardHeader variant="stack">
                <CardTitle as="h2">Three things fill this list</CardTitle>
                <CardDescription>A new posting often sits quiet until somebody passes the link on.</CardDescription>
              </CardHeader>
              <CardBody className="space-y-5">
                <Lever icon={<Share2 className="size-4" />} title="Send the link to a branch group">
                  <p>Students apply here, signed in. A forward from someone they know gets it opened.</p>
                  <ShareActions url={url} whatsappHref={whatsappHref} title={`${job.title} at ${job.company}`} size="sm" className="pt-1" />
                </Lever>
                <Lever icon={<GraduationCap className="size-4" />} title={isFresherFriendly(job) ? 'It is open to freshers' : 'Say whether freshers can apply'}>
                  <p>
                    {isFresherFriendly(job)
                      ? 'That is the filter most final-years use first, so the posting already shows it.'
                      : job.experienceYears
                        ? `“${job.experienceYears}” rules out final-year students unless the team would take a fresher.`
                        : 'No experience level is stated, so students cannot tell whether they are wanted.'}
                  </p>
                </Lever>
                <Lever icon={<CalendarClock className="size-4" />} title={job.closesOn ? 'Mind the closing date' : 'Set a closing date'}>
                  <p>
                    {job.closesOn
                      ? `It closes on ${formatDate(job.closesOn, timing)} (${formatRelative(job.closesOn, timing)}). A near deadline is what gets an application sent tonight.`
                      : 'A stated deadline is what gets an application sent tonight instead of bookmarked.'}
                  </p>
                </Lever>
              </CardBody>
            </Card>
          ) : (
            <EmptyState
              icon={<Inbox className="size-5" />}
              title="No applications on file"
              description={
                job.state === 'closed'
                  ? 'The posting closed without an application through the portal.'
                  : 'Students never saw this posting, so nobody could apply to it.'
              }
              action={
                <ButtonLink href={`/jobs/${job.id}`} variant="secondary">
                  Back to the posting
                </ButtonLink>
              }
            />
          )}
        </div>

        <aside aria-label="About this list" className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
          {/* Only `job.applicants.export`. Posting the role does not carry
              the right to walk away with the list of people who answered it. */}
          {canExport && total > 0 ? (
            <Card>
              <CardHeader variant="stack">
                <CardTitle as="h2" className="text-md">
                  Export the list
                </CardTitle>
                <CardDescription>
                  For the placement cell&rsquo;s own shortlisting. Each export is recorded with your name and the reason
                  you give. Email and mobile are never in the file.
                </CardDescription>
              </CardHeader>
              <CardBody>
                <ExportApplicantsDialog
                  jobId={job.id}
                  jobTitle={job.title}
                  company={job.company}
                  applicantCount={applications.length}
                />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardBody>
              <p className="flex gap-2.5 text-sm text-secondary">
                <Lock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                <span>
                  {isPoster
                    ? 'Only you and the placement cell see this list. Contact details are never shared.'
                    : 'Only the poster and the placement cell see this list. Contact details are never shared.'}
                </span>
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------

/**
 * Where the applicants come from. A bar only when a branch has three or
 * more; below that, a sentence says it better than a chart.
 */
function BranchMix({ branches }: { branches: Array<[string, number]> }) {
  if (branches.length === 0) return null;
  const largest = branches[0]![1];

  if (largest < 3) {
    return <p className="text-sm text-secondary">From {joinList(branches.map(([code]) => code))}.</p>;
  }

  const [first, second, ...rest] = branches;
  const other = rest.reduce((n, [, v]) => n + v, 0);
  const segments: Array<{ label: string; value: number; tone: 'brand' | 'accent' | 'neutral' }> = [
    { label: first![0], value: first![1], tone: 'brand' },
  ];
  if (second) segments.push({ label: second[0], value: second[1], tone: 'accent' });
  if (rest.length === 1) segments.push({ label: rest[0]![0], value: rest[0]![1], tone: 'neutral' });
  else if (other > 0) segments.push({ label: `${rest.length} other branches`, value: other, tone: 'neutral' });

  return <ProportionBar label="Applicants by branch" segments={segments} />;
}

function Lever({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-brand-fg" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 space-y-1 text-sm text-secondary">
        <h3 className="font-sans text-sm font-semibold text-primary">{title}</h3>
        {children}
      </div>
    </div>
  );
}
