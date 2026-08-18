import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  CalendarClock,
  GraduationCap,
  Inbox,
  LinkIcon,
  Lock,
  ScrollText,
  ShieldCheck,
  Timer,
  Users,
} from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getJobApplications, getJobById } from '@/lib/data/repo';
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
  DetailRow,
  EmptyState,
  PageHeader,
  Section,
  Stat,
} from '@/components/ui';
import { formatDate, formatRelative, memberLine } from '@/lib/format';
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

export default async function JobApplicantsPage({
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
  const withNote = applications.filter((a) => a.note).length;
  const branches = new Set(
    applications.map((a) => a.applicant.departmentCode).filter(Boolean),
  ).size;
  const latest = applications[0] ?? null;

  const isLive = job.state === 'live';
  const supportEmail = pack.copy.supportEmail ?? null;

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
        title={`Applicants for ${job.title}`}
        description={
          applications.length
            ? memberLine([
                `${applications.length} application${applications.length === 1 ? '' : 's'} through the portal`,
                latest ? `most recent ${formatRelative(latest.createdAt, timing)}` : null,
              ])
            : 'Nobody has applied through the portal yet. Applications appear here the moment a student sends one.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isPoster ? <Badge tone="brand">Your posting</Badge> : null}
            <ButtonLink href={`/jobs/${job.id}`} variant="secondary" size="sm">
              Open the posting
            </ButtonLink>
          </div>
        }
      />

      {job.state === 'pending_moderation' ? (
        <Alert
          tone="warning"
          title="No student can see this posting yet"
          icon={<Timer className="size-4" />}
        >
          <p>
            It is with the placement cell for review. Nothing reaches the jobs board — and so
            nothing reaches this list — until they approve it, usually within two working days.
          </p>
        </Alert>
      ) : null}

      {job.state === 'rejected' ? (
        <Alert tone="danger" title="This posting was sent back" icon={<ScrollText className="size-4" />}>
          <p>{job.moderationNote ?? 'No reason was recorded against the decision.'}</p>
          <p className="mt-2">
            It was never visible to students, which is why there is nothing below. Correct it and
            submit again.
          </p>
        </Alert>
      ) : null}

      {job.state === 'closed' ? (
        <Alert tone="neutral" title="Applications are closed" icon={<CalendarClock className="size-4" />}>
          <p>
            {job.closesOn
              ? `The posting shut on ${formatDate(job.closesOn, timing)}.`
              : 'The posting is shut.'}{' '}
            The list below is final — nobody can be added to it now.
          </p>
        </Alert>
      ) : null}

      {applications.length ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="Applications"
            value={applications.length}
            hint="Sent through the portal, not the careers page"
            icon={<Users className="size-4" />}
          />
          <Stat
            label="Wrote a note"
            value={withNote}
            hint="A note is the difference between a click and an application"
            icon={<ScrollText className="size-4" />}
          />
          <Stat
            label="Branches"
            value={branches}
            hint="Departments represented in the list"
            icon={<GraduationCap className="size-4" />}
          />
        </div>
      ) : null}

      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <Section
            title={applications.length ? 'Everyone who applied' : 'Applications'}
            description={
              applications.length
                ? 'Newest first. Each person is a verified member of the portal — there are no anonymous applications on this board.'
                : undefined
            }
          >
            {applications.length === 0 ? (
              isLive ? (
                <div className="space-y-4">
                  <EmptyState
                    icon={<Inbox className="size-5" />}
                    title="Nobody has applied yet"
                    description="A live posting with no applications in its first week is ordinary. Final-years open the jobs board on a Sunday evening, not on the day a role goes up."
                  />

                  <Card>
                    <CardHeader className="flex-col items-start gap-1">
                      <CardTitle as="h3">Three things that fill this list</CardTitle>
                      <CardDescription>
                        In that order. The first one accounts for most applications this board sees.
                      </CardDescription>
                    </CardHeader>
                    <CardBody className="space-y-4 pt-4 text-sm">
                      <NextStep
                        icon={<LinkIcon className="size-4" />}
                        title="Send the link into a branch group"
                        body={
                          <>
                            Paste{' '}
                            <Link href={`/jobs/${job.id}`} className="link font-mono text-xs">
                              /jobs/{job.id}
                            </Link>{' '}
                            into the {job.postedBy.departmentCode ?? 'branch'} WhatsApp group or send
                            it to a lecturer you still know. Most applications here arrive within a
                            day of somebody forwarding the link — the board itself is the slower half.
                          </>
                        }
                      />
                      <NextStep
                        icon={<GraduationCap className="size-4" />}
                        title="Lower the experience bar"
                        body={
                          job.experienceYears ? (
                            <>
                              &ldquo;{job.experienceYears}&rdquo; rules out the entire final-year
                              cohort if it asks for years they have not had yet. If the team would
                              take a fresher who can build, edit the posting to say so — that one
                              change moves a role from four applications to forty.
                            </>
                          ) : (
                            <>
                              No experience band is stated, so students cannot tell whether they are
                              wanted. Saying &ldquo;Fresher&rdquo; or &ldquo;0–2 years&rdquo; out
                              loud is worth more than another week on the board.
                            </>
                          )
                        }
                      />
                      <NextStep
                        icon={<CalendarClock className="size-4" />}
                        title="Check how long it stays up"
                        body={
                          job.closesOn ? (
                            <>
                              This posting closes on {formatDate(job.closesOn, timing)} (
                              {formatRelative(job.closesOn, timing)}). Placement season at DIET runs
                              August to November; a window that shuts before the semester exams end
                              will be quiet whatever else you change.
                            </>
                          ) : (
                            <>
                              No closing date is set, so it stays up until you close it. That is
                              fine, but a stated deadline is what makes a student apply tonight
                              instead of bookmarking it.
                            </>
                          )
                        }
                      />
                    </CardBody>
                  </Card>
                </div>
              ) : (
                <EmptyState
                  icon={<Inbox className="size-5" />}
                  title="No applications on file"
                  description={
                    job.state === 'closed'
                      ? 'The posting closed without an application through the portal. Anyone who used the company careers link instead is not counted here.'
                      : 'Students never saw this posting, so nobody could apply to it.'
                  }
                  action={
                    <ButtonLink href={`/jobs/${job.id}`} variant="secondary">
                      Back to the posting
                    </ButtonLink>
                  }
                />
              )
            ) : (
              <Card>
                <CardBody>
                  <ul className="divide-y divide-line">
                    {applications.map((a) => (
                      <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                        <MemberRow
                          member={a.applicant}
                          // Applicants are students. An alumni poster may
                          // not enumerate students in the directory, so
                          // linking each name would land them on a
                          // not-found page. Staff who can reach the
                          // profile get the link.
                          linkProfile={canViewStudents}
                          action={
                            <span className="whitespace-nowrap text-xs text-muted">
                              {formatDate(a.createdAt, timing)}
                            </span>
                          }
                        />

                        <div className="mt-1 sm:pl-11">
                          {a.note ? (
                            <p className="whitespace-pre-line rounded border border-line bg-surface-sunken p-3 text-sm text-secondary">
                              {a.note}
                            </p>
                          ) : (
                            <p className="text-xs text-muted">
                              Applied without a note. Common on a phone — it is not a signal about
                              how much they want the role.
                            </p>
                          )}
                          <p className="mt-1.5 text-xs text-muted">
                            Applied {formatRelative(a.createdAt, timing)}
                            {a.applicant.skills.length
                              ? ` · lists ${a.applicant.skills.slice(0, 3).join(', ')}`
                              : ''}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}
          </Section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {/* Only `job.applicants.export`. Posting the role does not carry
              the right to walk away with the list of people who answered it. */}
          {canExport ? (
            <Card>
              <CardHeader className="flex-col items-start gap-1">
                <CardTitle as="h2" className="text-md">
                  Export the list
                </CardTitle>
                <CardDescription>
                  For the placement cell&rsquo;s own shortlisting, and recorded against your name.
                </CardDescription>
              </CardHeader>
              <CardBody className="space-y-3 pt-4">
                <ExportApplicantsDialog
                  jobId={job.id}
                  jobTitle={job.title}
                  company={job.company}
                  applicantCount={applications.length}
                />

                <dl className="divide-y divide-line">
                  <DetailRow label="Audited as">
                    <span className="font-mono text-xs">job.applicants.export</span>
                  </DetailRow>
                  <DetailRow label="Columns">
                    <span className="text-xs font-normal text-secondary">
                      Name, roll number, branch, year of passing, applied on, the note
                    </span>
                  </DetailRow>
                  <DetailRow label="Never in the file">
                    <span className="text-xs font-normal text-secondary">
                      Email and mobile. Bulk contact data is <span className="font-mono">member.export</span>,
                      college admin only, and it does not ride along here.
                    </span>
                  </DetailRow>
                </dl>

                <Alert tone="warning" icon={<ShieldCheck className="size-4" />}>
                  <p>
                    Every export writes an audit row — your name, this posting, the row count and
                    the reason you type — <em>before</em> the file is built. Audit rows are
                    append-only; you cannot remove your own.
                  </p>
                </Alert>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h2" className="text-md">
                Who can see this list
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3 pt-4 text-xs text-secondary">
              <p className="flex gap-2">
                <Lock className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
                <span>
                  {isPoster
                    ? 'You, because you posted this role, and the placement cell. No other member of the portal can open it — not another alumnus, and not a student.'
                    : 'The alumnus who posted this role, and holders of job.applicants.export. Reading a posting is public to members; reading who answered it is not.'}
                </span>
              </p>

              {!canExport ? (
                <p>
                  You see each applicant&rsquo;s name, branch, batch and note. Opening a student&rsquo;s
                  full profile needs <span className="font-mono">directory.search.students</span>,
                  which the placement cell holds and an alumni account does not — students are never
                  listable by alumni, and this page is the one narrow exception, scoped to your own
                  posting.
                </p>
              ) : null}

              <p>
                Contact details are not attached to an application, however it was sent. To reach
                someone here, message them from the posting
                {supportEmail ? (
                  <>
                    {' '}or ask the alumni cell at{' '}
                    <a href={`mailto:${supportEmail}`} className="link">
                      {supportEmail}
                    </a>
                  </>
                ) : null}
                .
              </p>
            </CardBody>
          </Card>

          <ButtonLink href="/jobs" variant="secondary" size="sm" className="w-full">
            Back to the jobs board
          </ButtonLink>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------

function NextStep({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-brand-fg" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium">{title}</p>
        <p className="text-secondary">{body}</p>
      </div>
    </div>
  );
}
