import Link from 'next/link';
import {
  Handshake,
  CalendarDays,
  Briefcase,
  ArrowRight,
  MapPin,
  Users,
  Bell,
  Check,
  X,
  UserCheck,
  Heart,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Progress,
  Section,
  Stat,
} from '@/components/ui';
import { Sparkline } from '@/components/charts';
import { MemberCard } from '@/components/members/MemberCard';
import { can, type Session } from '@/lib/auth/guard';
import {
  getCampaigns,
  getConnections,
  getEvents,
  getJobs,
  getNotifications,
  getOwnProfile,
  getStats,
  searchDirectory,
} from '@/lib/data/repo';
import {
  formatCompactINR,
  formatDate,
  formatDateRange,
  formatRelative,
  memberLine,
  yearsOut,
} from '@/lib/format';
import { profileChecks, completenessScore } from '../profile/completeness';
import { AvailabilityCard } from './AvailabilityCard';
import type { BrandPack } from '@/lib/branding/pack';
import type { JobState } from '@/lib/data/types';

/**
 * The alumni home.
 *
 * An alumnus is not here to search. They are here to answer, or to decide
 * they cannot — so the page opens with the people waiting on them, by
 * name, with what was actually asked. Everything else is secondary: their
 * own postings, their batch, the events they might come back for.
 *
 * Faculty and staff who hold no student role land here too. The blocks
 * are individually capability-gated rather than role-gated, so an HOD
 * sees the parts of the member portal they genuinely have, and nothing
 * that would 403 on click.
 */
export function MemberHome({ session, pack }: { session: Session; pack: BrandPack }) {
  const profile = getOwnProfile(session);
  const firstName = (profile?.preferredName ?? profile?.fullName ?? 'there').split(' ')[0]!;

  const canSearch = pack.features.directory && can(session, 'directory.search.alumni');
  const canReceive = pack.features.connections && can(session, 'connection.receive');

  const received = canReceive ? getConnections(session, 'received') : [];
  const waiting = received.filter((c) => c.state === 'pending');
  const accepted = canReceive ? getConnections(session, 'accepted') : [];

  const events =
    pack.features.events && can(session, 'event.register')
      ? getEvents(session, { when: 'upcoming' }).slice(0, 3)
      : [];

  const myJobs = pack.features.jobs && can(session, 'job.post') ? getJobs(session, { mine: true }) : [];
  const liveJobs = myJobs.filter((j) => j.state === 'live');

  const stats = getStats(session);

  const available = Boolean(
    profile?.openToMentoring || profile?.openToReferrals || profile?.openToSpeaking,
  );

  const deptCode = profile?.departmentCode ?? session.departmentId;

  // Something to do when nothing is waiting. An alumnus with an empty
  // inbox and no next step closes the tab and does not come back.
  const active = canSearch
    ? searchDirectory(session, {
        cohort: 'alumni',
        department: deptCode ?? undefined,
        sort: 'recent',
        perPage: 6,
      })
    : null;

  const batch =
    canSearch && session.batchYear
      ? searchDirectory(session, {
          cohort: 'alumni',
          batchFrom: session.batchYear,
          batchTo: session.batchYear,
          sort: 'recent',
          perPage: 6,
        })
      : null;

  const notifications = getNotifications(session).slice(0, 4);

  const checks = profile ? profileChecks(profile) : [];
  const score = completenessScore(checks);
  const nextGap = checks.find((c) => !c.done);

  const isStudent = session.roles.some((r) => r.role === 'student');
  const showGiving = pack.features.donations && can(session, 'donation.give') && !isStudent;
  const campaigns = showGiving ? getCampaigns().filter((c) => c.active).slice(0, 2) : [];

  // A finance or platform account holds none of the member capabilities.
  // Four tiles reading zero would be a lie about what they can do here,
  // so the row is only as long as the things they actually have.
  const tiles = [
    canReceive ? (
      <Stat
        key="waiting"
        label="Waiting on your reply"
        value={waiting.length}
        hint={waiting.length ? 'Oldest first, below' : 'Nothing pending'}
        icon={<Handshake className="size-4" />}
      />
    ) : null,
    canReceive ? (
      <Stat
        key="connected"
        label="People you are connected to"
        value={accepted.length}
        hint="Contact details released both ways"
        icon={<UserCheck className="size-4" />}
      />
    ) : null,
    pack.features.jobs && can(session, 'job.post') ? (
      <Stat
        key="jobs"
        label="Your live job postings"
        value={liveJobs.length}
        hint={
          myJobs.length > liveJobs.length
            ? `${myJobs.length - liveJobs.length} not live yet`
            : 'Moderated before they appear'
        }
        icon={<Briefcase className="size-4" />}
      />
    ) : null,
    <Stat
      key="profile"
      label="Profile completeness"
      value={`${score}%`}
      hint={nextGap ? `Next: ${nextGap.label.toLowerCase()}` : 'Nothing left to add'}
      icon={<Users className="size-4" />}
    />,
  ].filter(Boolean);

  return (
    <>
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-fg">
          {memberLine([
            profile?.departmentCode,
            profile?.batchYear ? `Batch of ${profile.batchYear}` : null,
            yearsOut(profile?.batchYear ?? null),
          ])}
        </p>
        <h1 className="font-display text-display-xs font-bold">Namaste, {firstName}</h1>
        <p className="max-w-prose text-sm text-secondary">
          {!canReceive
            ? 'Your account is a staff account. The member portal is here for your own record; the work your role does lives in the console.'
            : waiting.length
              ? `${waiting.length} ${waiting.length === 1 ? 'person is' : 'people are'} waiting for an answer from you. A reply of two lines is worth more than a reply you never get around to.`
              : 'Nothing is waiting on you. The portal will tell you when a student asks — by email, and on WhatsApp once the college finishes that setup.'}
        </p>
      </header>

      {/* ---- The four numbers that matter ------------------------------ */}

      <section aria-label="Your activity" className={TILE_GRID[tiles.length] ?? TILE_GRID[4]}>
        {tiles}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* ---- Requests waiting on them ------------------------------ */}

          {canReceive ? (
            <Card>
              <CardHeader>
                <div className="space-y-1">
                  <CardTitle as="h2">Waiting on you</CardTitle>
                  <CardDescription>
                    Every request expires by itself. Declining is silent — the student is told the
                    request closed, not that you refused.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardBody className="space-y-0">
                {waiting.length ? (
                  <ul className="divide-y divide-line">
                    {waiting.map((c) => (
                      <li key={c.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                        <div className="flex items-start gap-3">
                          <Avatar name={c.from.fullName} src={c.from.photoUrl} size="md" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              <Link href={`/directory/${c.from.slug}`} className="link-quiet">
                                {c.from.fullName}
                              </Link>
                            </p>
                            <p className="truncate text-xs text-muted">
                              {memberLine([
                                c.from.departmentCode,
                                c.from.batchYear,
                                c.from.isStudent ? 'Final year' : c.from.currentCompany,
                              ])}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <Badge tone="brand">{KIND_LABEL[c.kind] ?? c.kind}</Badge>
                            <span className="text-xs text-muted">
                              {formatRelative(c.createdAt)}
                            </span>
                          </div>
                        </div>

                        {c.message ? (
                          <blockquote className="rounded border-l-2 border-line-strong bg-surface-sunken px-3 py-2 text-sm text-secondary">
                            {c.message}
                          </blockquote>
                        ) : (
                          <p className="text-sm text-muted">
                            No message. You can still accept, or leave it to expire.
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          <ButtonLink
                            href={`/connections?request=${c.id}&respond=accept`}
                            size="sm"
                          >
                            <Check className="size-4" aria-hidden="true" />
                            Accept
                          </ButtonLink>
                          <ButtonLink
                            href={`/connections?request=${c.id}&respond=decline`}
                            variant="secondary"
                            size="sm"
                          >
                            <X className="size-4" aria-hidden="true" />
                            Decline
                          </ButtonLink>
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
                  <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-secondary">
                    {available
                      ? 'Nothing waiting. You are listed as available, so a request can arrive any day — an email goes to you the moment one does.'
                      : 'No open requests, and none can arrive: all three availability switches are off, so students are told not to ask. Turn one on beside this card.'}
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
          ) : null}

          {/* ---- Their postings ---------------------------------------- */}

          {pack.features.jobs && can(session, 'job.post') ? (
            <Card>
              <CardHeader>
                <div className="space-y-1">
                  <CardTitle as="h2">Jobs you have posted</CardTitle>
                  <CardDescription>
                    Postings are reviewed by the placement cell before students see them.
                  </CardDescription>
                </div>
                <ButtonLink href="/jobs/new" size="sm">
                  Post a job
                </ButtonLink>
              </CardHeader>

              <CardBody>
                {myJobs.length ? (
                  <ul className="divide-y divide-line">
                    {myJobs.slice(0, 5).map((j) => (
                      <li key={j.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            <Link href={`/jobs/${j.id}`} className="link-quiet">
                              {j.title}
                            </Link>
                          </p>
                          <p className="truncate text-xs text-muted">
                            {memberLine([
                              j.company,
                              j.location,
                              j.isInternship ? 'Internship' : null,
                            ])}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs tabular text-muted">
                            {j.applicationCount} applied
                          </span>
                          <Badge tone={JOB_TONE[j.state]}>{JOB_LABEL[j.state]}</Badge>
                        </div>
                        {j.state === 'rejected' && j.moderationNote ? (
                          <p className="w-full text-xs text-danger-fg">{j.moderationNote}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-secondary">
                    You have not posted anything. One opening from your own team reaches 96
                    final-years who are looking right now — and you get to see who applied.
                  </p>
                )}
              </CardBody>
            </Card>
          ) : null}
        </div>

        {/* ---- Right rail ---------------------------------------------- */}

        <div className="space-y-6">
          {can(session, 'profile.write.own') && profile ? (
            <AvailabilityCard
              company={profile.currentCompany}
              initial={{
                openToMentoring: profile.openToMentoring,
                openToReferrals: profile.openToReferrals,
                openToSpeaking: profile.openToSpeaking,
              }}
            />
          ) : null}

          {nextGap ? (
            <Card>
              <CardBody className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle as="h2" className="text-md">
                    Your profile
                  </CardTitle>
                  <span className="text-sm font-semibold tabular">{score}%</span>
                </div>
                <Progress value={score} label={`Profile ${score}% complete`} />
                <p className="text-sm text-secondary">
                  <span className="font-medium text-primary">{nextGap.label}.</span> {nextGap.why}
                </p>
                <ButtonLink href={nextGap.href} variant="secondary" size="sm">
                  Fix this one
                </ButtonLink>
              </CardBody>
            </Card>
          ) : null}

          {batch ? (
            <Card>
              <CardHeader>
                <div className="space-y-1">
                  <CardTitle as="h2" className="text-md">
                    Batch of {session.batchYear}
                  </CardTitle>
                  <CardDescription>
                    {batch.total} of your batchmates have claimed an account.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                <ul className="flex flex-wrap gap-1.5">
                  {batch.items.slice(0, 6).map((m) => (
                    <li key={m.id}>
                      <Link href={`/directory/${m.slug}`} title={m.fullName} className="block">
                        <Avatar name={m.fullName} src={m.photoUrl} size="sm" />
                        <span className="sr-only">{m.fullName}</span>
                      </Link>
                    </li>
                  ))}
                </ul>

                <div className="space-y-1">
                  <p className="text-xs text-secondary">New members across all batches, 12 months</p>
                  <Sparkline data={stats.signupTrend} label="New members per month" height={36} />
                </div>

                <ButtonLink
                  href={`/directory?batchFrom=${session.batchYear}&batchTo=${session.batchYear}`}
                  variant="secondary"
                  size="sm"
                >
                  See the whole batch
                </ButtonLink>
              </CardBody>
            </Card>
          ) : null}

          {pack.features.events && can(session, 'event.register') ? (
            <Card>
              <CardHeader>
                <div className="space-y-1">
                  <CardTitle as="h2" className="text-md">
                    Coming up
                  </CardTitle>
                  <CardDescription>On campus and online.</CardDescription>
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                {events.length ? (
                  events.map((e) => (
                    <article
                      key={e.id}
                      className="space-y-1 border-b border-line pb-3 last:border-0 last:pb-0"
                    >
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
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {e.alumniOnly ? <Badge tone="brand">Alumni only</Badge> : null}
                        {e.ticketPrice > 0 ? (
                          <Badge tone="neutral">{formatCompactINR(e.ticketPrice)}</Badge>
                        ) : null}
                        {e.viewerRegistration ? (
                          <Badge tone="success" dot>
                            Registered
                          </Badge>
                        ) : null}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-secondary">
                    Nothing scheduled. Reunions are usually announced eight weeks ahead.
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
          ) : null}

          <Card>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle as="h2" className="text-md">
                  Recent activity
                </CardTitle>
              </div>
            </CardHeader>
            <CardBody>
              <ul className="space-y-3">
                {notifications.map((n) => (
                  <li key={n.id} className="flex gap-2.5">
                    <span
                      className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface-sunken text-muted"
                      aria-hidden="true"
                    >
                      <Bell className="size-3.5" />
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium">
                        {n.href ? (
                          <Link href={n.href} className="link-quiet">
                            {n.title}
                          </Link>
                        ) : (
                          n.title
                        )}
                        {!n.readAt ? (
                          <span className="ml-1.5 align-middle text-xs font-semibold text-brand-fg">
                            new
                          </span>
                        ) : null}
                      </p>
                      {n.body ? <p className="text-xs text-secondary">{n.body}</p> : null}
                      <p className="text-xs text-muted">{formatRelative(n.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ---- Somebody to talk to --------------------------------------- */}

      {active && active.items.length ? (
        <Section
          title={`Active in ${deptCode ?? 'the directory'}`}
          description="Alumni from your branch who have signed in recently. A note from someone who sat in the same lab gets answered; a cold one usually does not."
          actions={
            <ButtonLink
              href={deptCode ? `/directory?department=${deptCode}` : '/directory'}
              variant="secondary"
              size="sm"
            >
              Search the directory
            </ButtonLink>
          }
        >
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {active.items
              .filter((m) => m.id !== session.memberId)
              .slice(0, 3)
              .map((m) => (
                <li key={m.id} className="relative">
                  <MemberCard member={m} className="h-full" />
                </li>
              ))}
          </ul>
        </Section>
      ) : null}

      {/* ---- Giving — only when the college has cleared it ------------- */}

      {showGiving && campaigns.length ? (
        <Section
          title="Giving"
          description="Every contribution is receipted, and foreign contributions are recorded separately from the first rupee."
          actions={
            <ButtonLink href="/giving" variant="secondary" size="sm">
              All campaigns
            </ButtonLink>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {campaigns.map((c) => (
              <Card key={c.id} className="p-card">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-md font-semibold">
                    <Link href={`/giving/${c.slug}`} className="link-quiet">
                      {c.title}
                    </Link>
                  </h3>
                  <Heart className="size-4 shrink-0 text-muted" aria-hidden="true" />
                </div>
                {c.description ? (
                  <p className="mt-1.5 line-clamp-2 text-sm text-secondary">{c.description}</p>
                ) : null}
                <div className="mt-3 space-y-1.5">
                  <Progress
                    value={c.raised}
                    max={c.target ?? c.raised}
                    label={`${c.title} funding progress`}
                  />
                  <p className="text-xs text-secondary">
                    <span className="font-semibold tabular text-primary">
                      {formatCompactINR(c.raised)}
                    </span>{' '}
                    of {c.target ? formatCompactINR(c.target) : 'no fixed target'} · {c.donorCount}{' '}
                    donors
                    {c.endsOn ? ` · closes ${formatDate(c.endsOn)}` : ''}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}

    </>
  );
}

/** Static class strings — Tailwind cannot see a computed column count. */
const TILE_GRID: Record<number, string> = {
  1: 'grid gap-4 sm:max-w-xs',
  2: 'grid gap-4 sm:grid-cols-2',
  3: 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3',
  4: 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4',
};

const KIND_LABEL: Record<string, string> = {
  mentorship: 'Mentorship',
  referral: 'Referral',
  introduction: 'Introduction',
  speaking: 'Speaking',
};

const JOB_LABEL: Record<JobState, string> = {
  draft: 'Draft',
  pending_moderation: 'Awaiting review',
  live: 'Live',
  rejected: 'Not approved',
  closed: 'Closed',
};

const JOB_TONE: Record<JobState, 'neutral' | 'warning' | 'success' | 'danger'> = {
  draft: 'neutral',
  pending_moderation: 'warning',
  live: 'success',
  rejected: 'danger',
  closed: 'neutral',
};
