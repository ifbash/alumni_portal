import Link from 'next/link';
import {
  ShieldCheck,
  Handshake,
  CalendarDays,
  Briefcase,
  ArrowRight,
  Clock,
  MapPin,
  Building2,
  GraduationCap,
  Send,
} from 'lucide-react';
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
  EmptyState,
  Section,
  Stat,
} from '@/components/ui';
import { BarList, ProportionBar } from '@/components/charts';
import { MemberCard } from '@/components/members/MemberCard';
import { can, type Session } from '@/lib/auth/guard';
import {
  getConnections,
  getConnectionQuota,
  getDepartments,
  getEvents,
  getJobs,
  getOwnProfile,
  searchDirectory,
} from '@/lib/data/repo';
import { formatDate, formatDateRange, formatRelative, memberLine } from '@/lib/format';
import type { BrandPack } from '@/lib/branding/pack';
import type { JobPosting } from '@/lib/data/types';

/**
 * The student home.
 *
 * A final-year has exactly one job on this portal — reach the right
 * alumnus before the placement season closes — and about four weeks in
 * which to do it. So the page leads with who in their own branch has
 * already agreed to be contacted, and immediately after it, how many
 * requests they have left. The quota is not a punishment; it is the
 * reason the alumni on the other side are still answering.
 *
 * There is no donations block here, and there is no route to one. See
 * CLAUDE.md — asking a final-year for money on the portal meant to help
 * them find work poisons the whole product.
 */
export function StudentHome({ session, pack }: { session: Session; pack: BrandPack }) {
  const profile = getOwnProfile(session);
  const quota = getConnectionQuota(session);

  const deptCode = session.departmentId;
  const deptName =
    getDepartments().find((d) => d.code === deptCode)?.name ?? profile?.departmentName ?? null;

  const firstName = (profile?.preferredName ?? profile?.fullName ?? 'there').split(' ')[0]!;

  const canSearch = pack.features.directory && can(session, 'directory.search.alumni');

  // Their own branch first. A CSE final-year does not want the general
  // list; they want the four people who sat in the same lab.
  const inBranch = canSearch
    ? searchDirectory(session, {
        mentoring: true,
        cohort: 'alumni',
        department: deptCode ?? undefined,
        sort: 'relevance',
        perPage: 6,
      })
    : null;

  // A branch with nobody signed up yet is a real state, not an error.
  // Widening the search beats an empty grid, as long as it says so.
  const widened =
    canSearch && inBranch && inBranch.items.length === 0
      ? searchDirectory(session, { mentoring: true, cohort: 'alumni', sort: 'relevance', perPage: 6 })
      : null;

  const mentors = (widened ?? inBranch)?.items ?? [];
  const mentorTotal = (widened ?? inBranch)?.total ?? 0;

  const topCompanies = (inBranch?.facets.companies ?? []).slice(0, 6).map((f) => ({
    label: f.label,
    value: f.count,
  }));

  const sent = can(session, 'connection.send') ? getConnections(session, 'sent') : [];
  const open = sent.filter((c) => c.state === 'pending');
  const answered = sent.filter((c) => c.state === 'accepted');

  const events = can(session, 'event.register') && pack.features.events
    ? getEvents(session, { when: 'upcoming' }).slice(0, 3)
    : [];

  const jobs = pack.features.jobs ? getJobs(session, { state: 'live' }) : [];
  const internships = jobs.filter((j) => j.isInternship).slice(0, 4);
  const fullTime = jobs.filter((j) => !j.isInternship).slice(0, 4);

  const mentorHref = `/directory?mentoring=1${deptCode ? `&department=${deptCode}` : ''}`;

  return (
    <>
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-fg">
          {memberLine([deptCode, profile?.batchYear ? `Batch of ${profile.batchYear}` : null, 'Final year'])}
        </p>
        <h1 className="font-display text-display-xs font-bold">Namaste, {firstName}</h1>
        <p className="max-w-prose text-sm text-secondary">
          {mentorTotal > 0
            ? `${mentorTotal} ${deptName ?? 'DIET'} alumni have said they are open to mentoring. Ask before you apply, not after — most of them answer within a week.`
            : 'Alumni who agree to mentor appear here. Until then the directory is still the fastest way to find someone from your branch.'}
        </p>
      </header>

      {/* ---- Standing: verification, quota, replies -------------------- */}

      <section aria-label="Your standing" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-card">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-secondary">Account</p>
            <ShieldCheck className="size-4 text-muted" aria-hidden="true" />
          </div>
          {profile?.verifiedAt ? (
            <>
              <p className="mt-2 flex items-center gap-2">
                <Badge tone="success" dot>
                  Verified
                </Badge>
              </p>
              <p className="mt-1.5 text-xs text-muted">
                {profile.verificationMethod === 'placement_cell_import'
                  ? 'Loaded from the placement cell roll list'
                  : 'Matched against the college register'}{' '}
                on {formatDate(profile.verifiedAt)}
              </p>
            </>
          ) : (
            <>
              <p className="mt-2">
                <Badge tone="warning" dot>
                  Waiting on the college
                </Badge>
              </p>
              <p className="mt-1.5 text-xs text-muted">
                The alumni cell has your claim. Until it clears you can browse but not send requests.
              </p>
            </>
          )}
        </Card>

        <Stat
          label="Requests waiting for a reply"
          value={quota.openRequests}
          hint={`${quota.openLimit} can be open at once`}
          icon={<Clock className="size-4" />}
        />
        <Stat
          label="Sent this month"
          value={`${quota.usedThisMonth} / ${quota.monthlyLimit}`}
          hint="Resets on the 1st"
          icon={<Send className="size-4" />}
        />
        <Stat
          label="Alumni who replied yes"
          value={answered.length}
          hint={answered.length ? 'Their contact details are open to you' : 'None yet'}
          icon={<Handshake className="size-4" />}
        />
      </section>

      {!quota.canSend && quota.reason ? (
        <Alert tone="warning" title="You cannot send another request yet">
          {quota.reason}{' '}
          {quota.openRequests > 0
            ? 'A request expires on its own after three weeks, which frees the slot.'
            : null}
        </Alert>
      ) : null}

      {/* ---- Mentors in the branch ------------------------------------- */}

      {canSearch ? (
        <Section
          title={
            widened
              ? 'Alumni open to mentoring'
              : `${deptCode ?? 'DIET'} alumni open to mentoring`
          }
          description={
            widened
              ? `Nobody from ${deptName ?? 'your branch'} has switched mentoring on yet, so this is every branch.`
              : 'They have each set this themselves. It is a standing yes to being asked.'
          }
          actions={
            <ButtonLink href={mentorHref} variant="secondary" size="sm">
              See all {mentorTotal}
            </ButtonLink>
          }
        >
          {mentors.length ? (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {mentors.map((m) => (
                <li key={m.id} className="relative">
                  <MemberCard member={m} className="h-full" />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<GraduationCap className="size-5" />}
              title="No alumni have offered to mentor yet"
              description="Mentoring is opt-in. As the 2013–2020 batches finish claiming their accounts this list fills up — the alumni cell is chasing the degree register now."
              action={
                <ButtonLink href="/directory" variant="secondary" size="sm">
                  Browse the directory anyway
                </ButtonLink>
              }
            />
          )}
        </Section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---- Open requests ------------------------------------------- */}

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle as="h2">Your requests</CardTitle>
                <CardDescription>
                  Alumni answer on their own time. Chasing the same person twice does not speed it up.
                </CardDescription>
              </div>
            </CardHeader>

            <CardBody className="space-y-4">
              <ProportionBar
                label="Connection request slots"
                segments={[
                  { label: 'Waiting for a reply', value: quota.openRequests, tone: 'warning' },
                  {
                    label: 'Free slots',
                    value: Math.max(0, quota.openLimit - quota.openRequests),
                    tone: 'neutral',
                  },
                ]}
              />

              {open.length ? (
                <ul className="divide-y divide-line">
                  {open.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-start gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          <Link href={`/directory/${c.to.slug}`} className="link-quiet">
                            {c.to.fullName}
                          </Link>
                        </p>
                        <p className="truncate text-xs text-muted">
                          {memberLine([
                            c.to.departmentCode,
                            c.to.batchYear,
                            c.to.currentCompany ?? 'No company on file',
                          ])}
                        </p>
                        {c.message ? (
                          <p className="mt-1.5 line-clamp-2 text-xs text-secondary">{c.message}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge tone="warning">{kindLabel(c.kind)}</Badge>
                        <span className="text-xs text-muted">
                          Sent {formatRelative(c.createdAt)}
                        </span>
                        {c.expiresAt ? (
                          <span className="text-xs text-muted">
                            Expires {formatRelative(c.expiresAt)}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-secondary">
                  Nothing waiting. You have {quota.openLimit - quota.openRequests} of{' '}
                  {quota.openLimit} slots free — pick someone from your branch and say what you
                  actually need help with.
                </p>
              )}
            </CardBody>

            <CardFooter>
              <ButtonLink href="/connections" variant="ghost" size="sm">
                All connections
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
            </CardFooter>
          </Card>
        </div>

        {/* ---- Events -------------------------------------------------- */}

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle as="h2">Coming up</CardTitle>
                <CardDescription>Events you are eligible to attend.</CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              {events.length ? (
                events.map((e) => (
                  <article key={e.id} className="space-y-1 border-b border-line pb-3 last:border-0 last:pb-0">
                    <p className="text-sm font-medium">
                      <Link href={`/events/${e.slug}`} className="link-quiet">
                        {e.title}
                      </Link>
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-secondary">
                      <CalendarDays className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                      {formatDateRange(e.startsAt, e.endsAt)}
                    </p>
                    {e.venue ? (
                      <p className="flex items-center gap-1.5 text-xs text-muted">
                        <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                        {e.venue}
                      </p>
                    ) : null}
                    {e.viewerRegistration ? (
                      <Badge tone="success" dot>
                        You are registered
                      </Badge>
                    ) : e.capacity && e.registeredCount >= e.capacity ? (
                      <Badge tone="danger">Full — {e.registeredCount} registered</Badge>
                    ) : e.capacity ? (
                      <Badge tone="neutral">
                        {e.capacity - e.registeredCount} of {e.capacity} seats left
                      </Badge>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="text-sm text-secondary">
                  No events open to students right now. Alumni-only events — reunions and batch
                  meets — are not listed here at all.
                </p>
              )}
            </CardBody>
            <CardFooter>
              <ButtonLink href="/events" variant="ghost" size="sm">
                All events
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
            </CardFooter>
          </Card>

          {topCompanies.length ? (
            <Card>
              <CardHeader>
                <div className="space-y-1">
                  <CardTitle as="h2">Where {deptCode ?? 'DIET'} alumni work</CardTitle>
                  <CardDescription>
                    Counted from profiles on this portal, not from a placement brochure.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardBody>
                <BarList
                  label={`Companies employing ${deptCode ?? 'DIET'} alumni on the portal`}
                  data={topCompanies}
                />
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      {/* ---- Jobs ------------------------------------------------------ */}

      {pack.features.jobs ? (
        <Section
          title="Jobs and internships"
          description="Posted by alumni and by the placement cell. Every listing is moderated before it appears."
          actions={
            <ButtonLink href="/jobs" variant="secondary" size="sm">
              All {jobs.length} openings
            </ButtonLink>
          }
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <JobColumn
              title="Internships"
              empty="No internships are live today. Alumni post them in bursts around January and June."
              jobs={internships}
            />
            <JobColumn
              title="Full-time roles"
              empty="No full-time roles are live today."
              jobs={fullTime}
            />
          </div>
        </Section>
      ) : null}
    </>
  );
}

function JobColumn({
  title,
  jobs,
  empty,
}: {
  title: string;
  jobs: JobPosting[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3" className="text-md">
          {title}
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        {jobs.length ? (
          jobs.map((j) => (
            <article key={j.id} className="flex items-start gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
              <span
                className="mt-0.5 grid size-8 shrink-0 place-items-center rounded bg-surface-sunken text-muted"
                aria-hidden="true"
              >
                <Briefcase className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  <Link href={`/jobs/${j.id}`} className="link-quiet">
                    {j.title}
                  </Link>
                </p>
                <p className="flex items-center gap-1.5 truncate text-xs text-secondary">
                  <Building2 className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                  {memberLine([j.company, j.location ?? 'Location not stated'])}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {j.closesOn ? `Closes ${formatDate(j.closesOn)}` : 'No closing date'} ·{' '}
                  {j.applicationCount} applied
                </p>
              </div>
              {j.viewerHasApplied ? (
                <Badge tone="success">Applied</Badge>
              ) : null}
            </article>
          ))
        ) : (
          <p className="text-sm text-secondary">{empty}</p>
        )}
      </CardBody>
    </Card>
  );
}

function kindLabel(kind: string): string {
  return (
    {
      mentorship: 'Mentorship',
      referral: 'Referral',
      introduction: 'Introduction',
      speaking: 'Speaking',
    }[kind] ?? kind
  );
}
