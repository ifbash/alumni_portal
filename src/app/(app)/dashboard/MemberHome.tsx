import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Briefcase,
  Handshake,
  HeartHandshake,
  LayoutDashboard,
  Mic,
  UserRoundPen,
} from 'lucide-react';
import {
  Avatar,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  NeedsYou,
  ShareActions,
  type TaskItem,
} from '@/components/ui';
import { EventSummary, JobSummary } from '@/components/content';
import { MemberCard } from '@/components/members/MemberCard';
import { can, isActive, type Session } from '@/lib/auth/guard';
import { cn } from '@/lib/cn';
import {
  getCampaigns,
  getConnections,
  getDepartments,
  getEvents,
  getJobs,
  getNotifications,
  getOwnProfile,
  getStats,
  searchDirectory,
} from '@/lib/data/repo';
import { getNews } from '@/lib/data/content';
import { formatRelative } from '@/lib/format';
import { firstNameOf, identityLine, viewerBatchYear, viewerBranch } from '@/lib/identity';
import { deskFor, greetingFor, inSentence } from '@/lib/branding/copy';
import { availabilityEntries } from '@/lib/availability-copy';
import { batchShareText, portalShareText } from '@/lib/share-text';
import { siteOrigin, whatsappShareUrl } from '@/lib/share';
import { notificationAction } from '@/lib/notifications-view';
import { staffTasks } from '@/lib/staff-tasks';
import { seatStatus, isOnlineVenue } from '@/lib/event-status';
import { hasStaffConsole } from '@/lib/navigation';
import { CONNECTION_LIMITS } from '@/lib/config';
import { profileChecks, completenessScore } from '../profile/completeness';
import { AvailabilityCard } from './AvailabilityCard';
import { HomeBand, type BandAction } from './HomeBand';
import { BlockHead, HappeningAt, SNAP_ITEM, SNAP_ROW } from './HappeningAt';
import type { BrandPack } from '@/lib/branding/pack';
import type { EventItem } from '@/lib/data/types';

/**
 * The home for everyone who is not a final-year student: alumni, faculty
 * and every staff role.
 *
 * It opens on the college band with one next step, then the things that
 * need the viewer (requests, their own posting under review, and the staff
 * queues from `staffTasks`), then what the college is running and the
 * viewer's own people. The rail holds what they can offer (or, for staff,
 * their department or review queue) and their recent activity.
 *
 * Every block is gated on a capability, not a role, so a viewer never sees
 * a door that would refuse them. Roles only choose the *shape*:
 *
 *  - Holders of the alumni role (including the Dean and the alumni cell,
 *    who are graduates) get their batch and "Give back".
 *  - Faculty without the alumni role get "Your department" instead of
 *    "Give back", and are never shown a batch.
 *  - The placement officer also gets the postings waiting for review.
 *  - An account with no member capabilities at all (finance) gets the
 *    band, its queues, the way into the staff console, and the news.
 */
export async function MemberHome({ session, pack }: { session: Session; pack: BrandPack }) {
  const profile = getOwnProfile(session);
  const { copy, locale } = pack;
  const fmt = { locale: locale.locale, timeZone: locale.timeZone };

  const canSearch = pack.features.directory && can(session, 'directory.search.alumni');
  const canReceive = pack.features.connections && can(session, 'connection.receive');

  const received = canReceive ? getConnections(session, 'received') : [];
  const waiting = received.filter((c) => c.state === 'pending');

  const events =
    pack.features.events && can(session, 'event.register')
      ? getEvents(session, { when: 'upcoming' }).slice(0, 3)
      : [];

  const myJobs = pack.features.jobs && can(session, 'job.post') ? getJobs(session, { mine: true }) : [];
  const postsUnderReview = myJobs.filter((j) => j.state === 'pending_moderation');

  const stats = getStats(session);

  // The viewer's own branch: their record's for alumni, their grant's for
  // faculty, none for a college-wide officer.
  const deptCode = viewerBranch(session);
  const batchYear = viewerBatchYear(session);

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
    canSearch && batchYear
      ? searchDirectory(session, {
          cohort: 'alumni',
          batchFrom: batchYear,
          batchTo: batchYear,
          sort: 'recent',
          perPage: 6,
        })
      : null;

  const notifications = getNotifications(session).slice(0, 3);

  const checks = profile ? profileChecks(profile) : [];
  const score = completenessScore(checks);

  const isStudent = session.roles.some((r) => r.role === 'student');
  const showGiving = pack.features.donations && can(session, 'donation.give') && !isStudent;
  const campaigns = showGiving ? getCampaigns().filter((c) => c.active).slice(0, 2) : [];

  // ---- Shape --------------------------------------------------------
  const held = new Set(session.roles.map((r) => r.role));
  const alumnus = held.has('alumni');
  const canRegister = pack.features.events && can(session, 'event.register');
  const canWrite = can(session, 'profile.write.own');
  const canPost = pack.features.jobs && can(session, 'job.post');
  const memberShaped = canSearch || canReceive || canRegister || canWrite;
  const facultyShaped = !alumnus && (held.has('faculty') || held.has('hod'));
  const moderator = pack.features.jobs && can(session, 'job.moderate') && !alumnus;

  const departments = getDepartments();
  const deptName = departments.find((d) => d.code === deptCode)?.name ?? null;

  // ---- Band ---------------------------------------------------------
  const first = profile ? firstNameOf(profile.fullName, profile.preferredName) : null;
  const eyebrow = identityLine({
    roles: session.roles,
    departmentCode: deptCode,
    departmentName: deptName,
    batchYear,
    designation: profile?.designation ?? null,
    isStudent: false,
  });

  const nextEvent = events.find((e) => e.viewerRegistration || !seatStatus(e).full) ?? null;
  const pinned = pack.features.news ? (getNews().find((n) => n.pinned && n.kind !== 'obituary') ?? null) : null;

  let lead: string | null = null;
  const actions: BandAction[] = [];

  // The staff queues this person works, read behind their own can() checks.
  const staff = staffTasks(session, pack).filter((t) => t.count > 0);
  const topStaff = staff.find((t) => t.tone === 'attention') ?? staff[0] ?? null;
  /** The task the band already leads with, so Needs you does not repeat it. */
  let bandTask: string | null = null;

  if (waiting.length === 1) {
    const c = waiting[0]!;
    const yy = c.from.batchYear ? `’${String(c.from.batchYear).slice(-2)}` : null;
    const tag = [c.from.departmentCode, yy].filter(Boolean).join(' ');
    lead = `${firstNameOf(c.from.fullName)}${tag ? ` (${tag})` : ''} asked you about ${KIND_WORDS[c.kind] ?? 'a request'}.`;
    actions.push({ href: '/connections', label: 'Reply' });
    bandTask = 'requests';
  } else if (waiting.length > 1) {
    lead = `${waiting.length} people are waiting for your reply.`;
    actions.push({ href: '/connections', label: 'Reply' });
    bandTask = 'requests';
  } else if (topStaff) {
    // Staff work outranks the next event: it is what this person came for.
    lead = `${topStaff.count.toLocaleString('en-IN')} ${topStaff.label}${topStaff.detail ? ` · ${topStaff.detail}` : ''}.`;
    actions.push({ href: topStaff.href, label: topStaff.action });
    bandTask = topStaff.key;
  } else if (nextEvent) {
    lead = [nextEvent.title, bandDate(nextEvent.startsAt, pack), venueWords(nextEvent)].filter(Boolean).join(' · ');
    actions.push(
      nextEvent.viewerRegistration
        ? { href: `/events/${nextEvent.slug}/ticket`, label: 'Show my ticket' }
        : { href: `/events/${nextEvent.slug}`, label: 'Register' },
    );
  } else if (pinned) {
    lead = pinned.title;
    actions.push({ href: `/news/${pinned.slug}`, label: 'Read the story' });
  } else if (canSearch) {
    lead = `Find your batchmates and see what ${copy.shortName} is running.`;
    actions.push({ href: '/directory', label: 'Open the directory' });
  }

  if (batchYear && canSearch) {
    actions.push({ href: `/directory/batch/${batchYear}`, label: 'See your batch', variant: 'band-outline' });
  }

  // ---- Needs you ----------------------------------------------------
  const tasks: TaskItem[] = [];
  if (canReceive && waiting.length) {
    const oldest = waiting.reduce((a, c) => (c.createdAt < a ? c.createdAt : a), waiting[0]!.createdAt);
    tasks.push({
      key: 'requests',
      count: waiting.length,
      label: waiting.length === 1 ? 'request waiting for your reply' : 'requests waiting for your reply',
      detail: `oldest ${formatRelative(oldest, fmt)}`,
      href: '/connections',
      action: 'Reply',
      icon: <Handshake />,
    });
  }
  if (canPost && postsUnderReview.length) {
    const desk = inSentence(deskFor(copy, 'placement_officer'));
    tasks.push({
      key: 'postings',
      count: postsUnderReview.length,
      label: `${postsUnderReview.length === 1 ? 'posting' : 'postings'} with the ${desk}`,
      href: '/jobs?tab=mine',
      action: postsUnderReview.length === 1 ? 'See it' : 'See them',
      icon: <Briefcase />,
    });
  }
  tasks.push(...staff);
  const needs = tasks.filter((t) => t.count > 0 && t.key !== bandTask);

  // ---- Profile nudge ------------------------------------------------
  // Counted in the welcome wizard's own steps, not in checks: "3 short
  // steps" has to be three screens, not three fields.
  const gaps = new Set(checks.filter((c) => !c.done).map((c) => c.id));
  const stepsLeft = WIZARD_STEPS.filter((ids) => ids.some((id) => gaps.has(id))).length;
  const showNudge = canWrite && profile !== null && score < 80 && stepsLeft > 0;

  // ---- People -------------------------------------------------------
  const origin = await siteOrigin();
  const shareUrl = batchYear ? `${origin}/claim?year=${batchYear}` : `${origin}/`;
  const shareText = batchYear ? batchShareText(pack, batchYear) : portalShareText(pack);
  const batchmates = batch ? batch.items.filter((m) => m.id !== session.memberId).slice(0, 5) : [];
  const activeNow = active ? active.items.filter((m) => m.id !== session.memberId).slice(0, 3) : [];

  // ---- Your department (faculty) ------------------------------------
  const deptEvents =
    facultyShaped && canRegister && deptCode
      ? getEvents(session, { when: 'upcoming', department: deptCode })
          .filter((e) => e.departmentCode === deptCode)
          .slice(0, 2)
      : [];
  const speakers =
    facultyShaped && canSearch && deptCode
      ? searchDirectory(session, { department: deptCode, speaking: true, cohort: 'alumni', perPage: 3 })
      : null;

  // ---- Postings to review (placement officer) -----------------------
  const toReview = moderator ? getJobs(session, { state: 'pending_moderation' }).slice(0, 3) : [];

  // ---- Give back ----------------------------------------------------
  const entries =
    canWrite && profile
      ? availabilityEntries({
          audience: alumnus ? 'alumni' : 'faculty',
          company: profile.currentCompany,
          officeName: copy.officeName,
          openLimit: CONNECTION_LIMITS.studentOpenRequests,
        })
      : [];
  const showGiveBack = !facultyShaped && memberShaped && (canWrite || canPost || showGiving);

  const consoleCard =
    !memberShaped && hasStaffConsole(session, pack) ? (
      <Card>
        <CardBody className="space-y-4">
          <span
            className="grid size-10 place-items-center rounded-full bg-brand-soft text-brand-soft-fg"
            aria-hidden="true"
          >
            <LayoutDashboard className="size-5" />
          </span>
          <h2 className="font-display text-md font-semibold">Your work is in the staff console</h2>
          <ButtonLink href="/admin" className="min-h-11">
            Open the staff console
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        </CardBody>
      </Card>
    ) : null;

  // ---- Render -------------------------------------------------------
  const rail: React.ReactNode[] = [];

  if (consoleCard) rail.push(<div key="console" className="hidden lg:block">{consoleCard}</div>);

  // Your people sits in the main column, after what the college is
  // running: on a phone that is its place in the order, and on a desktop
  // it keeps the main column the longer of the two.
  const people =
    canSearch && (batch || activeNow.length) ? (
      <section aria-labelledby="people-title" className="space-y-4">
        <h2 id="people-title" className="font-display text-xl font-semibold">
          Your people
        </h2>

        <Card className="grid grid-cols-1 divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
          {batch && batchYear ? (
            <div className="min-w-0 space-y-1 p-4">
              <div className="flex items-center gap-3">
                {batchmates.length ? (
                  <ul className="flex shrink-0 -space-x-2" aria-label={`Some of the ${batchYear} batch`}>
                    {batchmates.map((m) => (
                      <li key={m.id}>
                        <Avatar name={m.fullName} src={m.photoUrl} size="sm" className="ring-2 ring-[var(--surface-raised)]" />
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="min-w-0 text-sm text-secondary">
                  <span className="font-semibold tabular text-primary">{batch.total.toLocaleString('en-IN')}</span> of
                  the {batchYear} batch {batch.total === 1 ? 'is' : 'are'} here
                </p>
              </div>
              <RailLink href={`/directory/batch/${batchYear}`}>See your batch</RailLink>
            </div>
          ) : null}

          <div className={cn('min-w-0 space-y-2 p-4', !(batch && batchYear) && 'md:col-span-2')}>
            <h3 className="text-sm font-semibold text-primary">
              {batchYear ? 'Invite your batch on WhatsApp' : 'Invite graduates on WhatsApp'}
            </h3>
            <ShareActions
              url={shareUrl}
              whatsappHref={whatsappShareUrl(shareText, shareUrl)}
              title={batchYear ? `Batch of ${batchYear} on ${copy.portalName}` : copy.portalName}
              size="sm"
            />
          </div>
        </Card>

        {activeNow.length ? (
          <div className="space-y-3">
            <BlockHead
              title={deptCode ? `Active in ${deptCode}` : 'Recently active'}
              href={deptCode ? `/directory?department=${deptCode}` : '/directory'}
              linkLabel="Search the directory"
            />
            {/* Compact rows: one per swipe on a phone, stacked from sm. */}
            <ul className={cn(SNAP_ROW, 'sm:grid-cols-1 sm:gap-3 xl:grid-cols-1')}>
              {activeNow.map((m) => (
                <li key={m.id} className={SNAP_ITEM}>
                  <MemberCard member={m} variant="row" className="h-full" />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    ) : null;

  if (moderator && toReview.length) {
    rail.push(
      <Card key="review" as="section" aria-labelledby="review-title">
        <CardHeader variant="stack">
          <CardTitle as="h2" id="review-title" className="text-md">
            Postings to review
          </CardTitle>
        </CardHeader>
        <CardBody className="pt-1">
          <ul className="divide-y divide-line">
            {toReview.map((j) => (
              <li key={j.id}>
                <JobSummary job={j} href={`/admin/jobs/${j.id}`} locale={locale} variant="row" />
              </li>
            ))}
          </ul>
          {canPost ? (
            <div className="border-t border-line pt-3">
              <RailLink href="/jobs/new">Post a job</RailLink>
            </div>
          ) : null}
        </CardBody>
      </Card>,
    );
  }

  if (facultyShaped && deptCode && (deptEvents.length || speakers)) {
    rail.push(
      <Card key="department" as="section" aria-labelledby="department-title">
        <CardHeader variant="stack">
          <CardTitle as="h2" id="department-title" className="text-md">
            Your department
          </CardTitle>
          {deptName ? <CardDescription>{deptName}</CardDescription> : null}
        </CardHeader>
        <CardBody className="space-y-5">
          {deptEvents.length ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-secondary">Coming up in {deptCode}</h3>
              <ul className="space-y-2">
                {deptEvents.map((e) => (
                  <li key={e.id}>
                    <EventSummary event={e} href={`/events/${e.slug}`} locale={locale} variant="compact" />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {speakers ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-secondary">
                {speakers.total
                  ? `${speakers.total.toLocaleString('en-IN')} ${deptCode} ${speakers.total === 1 ? 'graduate is' : 'graduates are'} open to speaking`
                  : `No ${deptCode} graduate has offered to speak yet`}
              </h3>
              {speakers.items.length ? (
                <ul className={cn(SNAP_ROW, 'lg:flex lg:flex-col')}>
                  {speakers.items.map((m) => (
                    <li key={m.id} className={SNAP_ITEM}>
                      <MemberCard member={m} variant="row" className="h-full" />
                    </li>
                  ))}
                </ul>
              ) : null}
              <ButtonLink
                href={`/directory?department=${deptCode}&speaking=1`}
                variant="secondary"
                size="sm"
                className="min-h-11"
              >
                <Mic className="size-4" aria-hidden="true" />
                Invite an alumnus to speak
              </ButtonLink>
            </div>
          ) : null}
        </CardBody>
      </Card>,
    );
  }

  if (showGiveBack) {
    rail.push(
      <Card key="give" as="section" aria-labelledby="give-title">
        <CardHeader variant="stack">
          <CardTitle as="h2" id="give-title" className="text-md">
            Give back to {copy.shortName}
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          {can(session, 'profile.write.own') && profile ? (
            <AvailabilityCard
              company={profile.currentCompany}
              entries={entries}
              officeName={copy.officeName}
              initial={{
                openToMentoring: profile.openToMentoring,
                openToReferrals: profile.openToReferrals,
                openToSpeaking: profile.openToSpeaking,
              }}
            />
          ) : null}

          {canPost ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
              {stats.students > 0 ? (
                <p className="min-w-0 flex-1 basis-52 text-sm text-secondary">
                  One opening from your team reaches {stats.students.toLocaleString('en-IN')} final-year students.
                </p>
              ) : null}
              <ButtonLink href="/jobs/new" variant="secondary" size="sm" className="min-h-11">
                <Briefcase className="size-4" aria-hidden="true" />
                Post a job
              </ButtonLink>
            </div>
          ) : null}

          {showGiving ? (
            <div className="space-y-2 border-t border-line pt-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                <HeartHandshake className="size-4 text-muted" aria-hidden="true" />
                Giving
              </p>
              {campaigns.length ? (
                <ul className="space-y-1">
                  {campaigns.map((c) => (
                    <li key={c.id}>
                      <Link href={`/giving/${c.slug}`} className="inline-flex min-h-11 items-center text-sm font-medium link-quiet">
                        {c.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              <RailLink href="/giving">See every campaign</RailLink>
            </div>
          ) : null}
        </CardBody>
      </Card>,
    );
  }

  if (memberShaped && notifications.length) {
    rail.push(
      <Card key="activity" as="section" aria-labelledby="activity-title">
        <CardHeader className="items-center">
          <CardTitle as="h2" id="activity-title" className="text-md">
            Recent activity
          </CardTitle>
          <Link
            href="/notifications"
            className="-my-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-fg hover:underline"
          >
            See all
            <span className="sr-only"> notifications</span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </CardHeader>
        <CardBody className="pt-1">
          <ul className="divide-y divide-line">
            {notifications.map((n) => {
              const verb = notificationAction(n);
              return (
                <li key={n.id} className="flex items-center gap-3 py-1.5">
                  <span
                    className={
                      n.readAt
                        ? 'size-2 shrink-0 rounded-full bg-line-strong'
                        : 'size-2 shrink-0 rounded-full bg-[var(--button-primary-bg)]'
                    }
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium text-primary lg:line-clamp-2">
                      {n.title}
                      {!n.readAt ? <span className="sr-only"> (new)</span> : null}
                    </p>
                    <p className="text-xs text-secondary">{formatRelative(n.createdAt, fmt)}</p>
                  </div>
                  {verb && n.href ? (
                    <Link
                      href={n.href}
                      className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-brand-fg hover:underline"
                    >
                      {verb}
                      <span className="sr-only">: {n.title}</span>
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>,
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <HomeBand
        pack={pack}
        eyebrow={eyebrow}
        title={first ? `${greetingFor(copy)}, ${first}` : greetingFor(copy)}
        lead={lead}
        actions={actions}
      />

      <div className={rail.length ? 'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8' : 'space-y-6'}>
        <div className="min-w-0 space-y-6 lg:space-y-8">
          {/* The band already carries the lead task. What is left is a
              list, a single slim row, or, when the band took the only task,
              nothing: "all caught up" under "3 people are waiting" would
              contradict it. */}
          {needs.length > 1 || (needs.length === 0 && !bandTask) ? (
            <NeedsYou items={needs} />
          ) : needs.length === 1 ? (
            <TaskRow task={needs[0]!} />
          ) : null}

          {consoleCard ? <div className="lg:hidden">{consoleCard}</div> : null}

          {showNudge ? (
            <section
              aria-label="Finish setting up"
              className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-line bg-surface-raised p-4 shadow-sm"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-soft-fg" aria-hidden="true">
                <UserRoundPen className="size-5" />
              </span>
              <p className="min-w-0 flex-1 text-sm font-medium text-primary">
                Finish setting up — {stepsLeft} short {stepsLeft === 1 ? 'step' : 'steps'}
              </p>
              <ButtonLink href="/welcome" variant="secondary" size="sm" className="min-h-11">
                Continue
              </ButtonLink>
            </section>
          ) : null}

          <HappeningAt pack={pack} events={canRegister ? events : null} showPhotos={isActive(session)} />

          {people}
        </div>

        {rail.length ? (
          <aside aria-label="What you can do" className="min-w-0 space-y-6">
            {rail}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

/** One task on its own: a full-width slim row rather than a lone grid tile. */
function TaskRow({ task }: { task: TaskItem }) {
  const attention = task.tone === 'attention';
  return (
    <section aria-label="Needs you">
      <Link
        href={task.href}
        className={cn(
          'group flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-surface-raised px-4 py-3 shadow-sm',
          'transition-colors duration-fast ease-brand hover:border-line-strong',
          attention && 'border-l-4 border-l-warning',
        )}
      >
        {task.icon ? (
          <span className="text-muted [&>svg]:size-5" aria-hidden="true">
            {task.icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 text-sm">
          <span className="font-semibold tabular text-primary">{task.count.toLocaleString('en-IN')}</span>{' '}
          <span className="font-medium text-primary">{task.label}</span>
          {task.detail ? (
            <span className={attention ? 'text-warning-fg' : 'text-secondary'}> · {task.detail}</span>
          ) : null}
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-fg">
          {task.action}
          <ArrowRight
            className="size-4 transition-transform duration-fast ease-brand group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </Link>
    </section>
  );
}

function RailLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-fg hover:underline"
    >
      {children}
      <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  );
}

/** "Fri 21 Aug", in the college's time zone. */
function bandDate(iso: string, pack: BrandPack): string {
  const parts = new Intl.DateTimeFormat(pack.locale.locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: pack.locale.timeZone,
  }).formatToParts(new Date(iso));
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '';
  return [get('weekday'), get('day'), get('month')].filter(Boolean).join(' ');
}

function venueWords(e: Pick<EventItem, 'venue'>): string | null {
  if (isOnlineVenue(e.venue)) return 'Online';
  return e.venue;
}

/** What a request is about, as the band says it: "asked you about a referral". */
const KIND_WORDS: Record<string, string> = {
  mentorship: 'mentoring',
  referral: 'a referral',
  introduction: 'an introduction',
  speaking: 'speaking',
};

/** The welcome wizard's first three screens, as the completeness checks they fill. */
const WIZARD_STEPS: ReadonlyArray<readonly string[]> = [['work', 'photo'], ['city'], ['skills', 'availability']];
