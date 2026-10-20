import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Clock, Send } from 'lucide-react';
import {
  Alert,
  Avatar,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from '@/components/ui';
import { BandChip } from '@/components/brand/PageBand';
import { BarList } from '@/components/charts';
import { JobSummary } from '@/components/content';
import { MemberCard } from '@/components/members/MemberCard';
import { can, isActive, type Session } from '@/lib/auth/guard';
import { REQUEST_EXPIRY_DAYS } from '@/lib/availability-copy';
import { cn } from '@/lib/cn';
import {
  getConnections,
  getConnectionQuota,
  getDepartments,
  getEvents,
  getJobs,
  getOwnProfile,
  searchDirectory,
} from '@/lib/data/repo';
import { daysUntil, formatRelative } from '@/lib/format';
import { firstNameOf, identityLine } from '@/lib/identity';
import { greetingFor } from '@/lib/branding/copy';
import type { BrandPack } from '@/lib/branding/pack';
import { HomeBand, type BandAction } from './HomeBand';
import { HappeningAt, SNAP_ITEM, SNAP_ROW } from './HappeningAt';

/**
 * The student home.
 *
 * A final-year has exactly one job on this portal — reach the right
 * alumnus before the placement season closes. So the page leads with who
 * in their own branch has already agreed to be asked, and one line on how
 * many requests they have left. The quota is not a punishment; it is the
 * reason the alumni on the other side are still answering.
 *
 * There is no donations block here, and there is no route to one. See
 * CLAUDE.md — asking a final-year for money on the portal meant to help
 * them find work poisons the whole product.
 */
export function StudentHome({ session, pack }: { session: Session; pack: BrandPack }) {
  const profile = getOwnProfile(session);
  const quota = getConnectionQuota(session);
  const { copy, locale } = pack;
  const tz = locale.timeZone;
  const fmt = { locale: locale.locale, timeZone: tz };

  const deptCode = session.departmentId;
  const deptName =
    getDepartments().find((d) => d.code === deptCode)?.name ?? profile?.departmentName ?? null;

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

  // Where the whole branch works, not only its mentors: the same guarded
  // search, one row, read for its facets. The college itself is not an
  // employer a student is looking for.
  const branchAlumni =
    canSearch && deptCode ? searchDirectory(session, { cohort: 'alumni', department: deptCode, perPage: 1 }) : null;
  const topCompanies = (branchAlumni?.facets.companies ?? [])
    .filter((f) => f.label !== copy.institutionName)
    .slice(0, 5)
    .map((f) => ({
      label: f.label,
      value: f.count,
      href: `/directory?department=${deptCode}&company=${encodeURIComponent(f.value)}`,
    }));
  const showBars = (topCompanies[0]?.value ?? 0) >= 3;

  const sent = can(session, 'connection.send') ? getConnections(session, 'sent') : [];
  const open = sent.filter((c) => c.state === 'pending');
  const answered = sent.filter((c) => c.state === 'accepted');

  const events = can(session, 'event.register') && pack.features.events
    ? getEvents(session, { when: 'upcoming' }).slice(0, 3)
    : [];

  const jobs = pack.features.jobs ? getJobs(session, { state: 'live' }) : [];
  // Soonest deadline first; a posting with no closing date after them,
  // and one that has already closed not at all.
  const closing = jobs
    .filter((j) => !j.closesOn || daysUntil(j.closesOn, tz) >= 0)
    .sort((a, b) => (a.closesOn ?? '9999').localeCompare(b.closesOn ?? '9999'))
    .slice(0, 5);

  const mentorHref = `/directory?mentoring=1${deptCode ? `&department=${deptCode}` : ''}`;
  const findHref =
    pack.features.mentorship && can(session, 'connection.send') ? '/mentorship' : mentorHref;

  // ---- Band ---------------------------------------------------------
  const first = profile ? firstNameOf(profile.fullName, profile.preferredName) : null;
  const unverified = Boolean(profile && !profile.verifiedAt);
  const blocked = !quota.canSend && Boolean(quota.reason);
  const branchLabel = deptCode ?? copy.shortName;

  let lead: string;
  const actions: BandAction[] = [];
  if (unverified) {
    lead = `The ${copy.officeName} is checking your record.`;
    if (canSearch) actions.push({ href: '/directory', label: 'Browse the directory' });
  } else if (blocked) {
    lead = quota.reason!;
    actions.push({ href: '/connections', label: 'See your requests' });
  } else if (mentorTotal > 0) {
    lead = widened
      ? `${mentorTotal} alumni are open to mentoring. Ask before you apply.`
      : `${mentorTotal} ${branchLabel} alumni are open to mentoring. Ask before you apply.`;
    actions.push({ href: findHref, label: 'Find a mentor' });
  } else {
    lead = `Find ${branchLabel} alumni before you apply.`;
    if (canSearch) actions.push({ href: '/directory', label: 'Open the directory' });
  }

  // ---- Quota, as what is available ----------------------------------
  const showQuota = pack.features.connections && can(session, 'connection.send');
  const available = Math.max(
    0,
    Math.min(quota.openLimit - quota.openRequests, quota.monthlyLimit - quota.usedThisMonth),
  );
  const monthLeft = Math.max(0, quota.monthlyLimit - quota.usedThisMonth);
  const quotaLine = [
    available > 0
      ? `${available} ${available === 1 ? 'request' : 'requests'} available`
      : 'No requests available right now',
    monthLeft > 0 ? `${monthLeft} left this month` : 'none left this month',
    answered.length > 0 ? `${answered.length} replied yes` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-6 lg:space-y-8">
      <HomeBand
        pack={pack}
        eyebrow={identityLine({
          roles: session.roles,
          departmentCode: deptCode,
          batchYear: null,
          isStudent: true,
        })}
        title={first ? `${greetingFor(copy)}, ${first}` : greetingFor(copy)}
        lead={lead}
        meta={unverified ? <BandChip icon={<Clock />}>Being checked</BandChip> : undefined}
        actions={actions}
      />

      {showQuota ? (
        <Link
          href="/connections"
          className="group lift ring-hairline flex min-h-14 items-center gap-3 rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        >
          <span
            className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-soft-fg"
            aria-hidden="true"
          >
            <Send className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1 font-medium text-primary">{quotaLine}</span>
          {/* One dot per open-request slot: filled when it is free. The
              sentence beside it says the same; the dots are only a glance. */}
          <span className="hidden shrink-0 items-center gap-1 sm:flex" aria-hidden="true">
            {Array.from({ length: Math.min(quota.openLimit, 8) }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'size-2 rounded-full',
                  i >= quota.openRequests && available > 0 ? 'bg-[var(--button-primary-bg)]' : 'bg-line-strong',
                )}
              />
            ))}
          </span>
          <ArrowRight
            className="size-4 shrink-0 text-brand-fg transition-transform duration-fast ease-brand group-hover:translate-x-1"
            aria-hidden="true"
          />
          <span className="sr-only">, see your requests</span>
        </Link>
      ) : null}

      {!quota.canSend && quota.reason ? (
        <Alert tone="warning" title="You cannot send another request yet">
          {quota.reason}{' '}
          {quota.openRequests > 0
            ? `A request expires on its own after ${REQUEST_EXPIRY_DAYS} days, which frees the slot.`
            : null}
        </Alert>
      ) : null}

      {/* ---- Requests still open -------------------------------------- */}

      {open.length ? (
        <Card as="section" aria-labelledby="requests-title">
          <CardHeader className="items-center">
            <CardTitle as="h2" id="requests-title" className="text-md">
              Waiting for a reply
            </CardTitle>
            <Link
              href="/connections"
              className="-my-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-fg hover:underline"
            >
              All requests
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </CardHeader>
          <CardBody className="pt-2">
            <ul className="divide-y divide-line">
              {open.map((c) => (
                <li key={c.id} className="relative flex min-h-11 items-center gap-3 py-2.5">
                  <Avatar name={c.to.fullName} src={c.to.photoUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {/* The whole row is the target: the name alone is 17px tall. */}
                      <Link href={`/directory/${c.to.slug}`} className="link-quiet after:absolute after:inset-0">
                        {c.to.fullName}
                      </Link>
                    </p>
                    <p className="text-xs text-secondary">
                      Sent {formatRelative(c.createdAt, fmt)}
                      {c.expiresAt ? ` · closes ${formatRelative(c.expiresAt, fmt)}` : ''}
                    </p>
                  </div>
                  <Badge tone="brand">{kindLabel(c.kind)}</Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {/* ---- Mentors in the branch ------------------------------------ */}

      {canSearch ? (
        <section aria-labelledby="mentors-title" className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-x-4">
              <h2 id="mentors-title" className="min-w-0 font-display text-display-xs font-bold tracking-tight">
                {widened ? 'Alumni open to mentoring' : `${deptCode ?? copy.shortName} alumni open to mentoring`}
              </h2>
              {mentorTotal > 0 ? (
                <Link
                  href={mentorHref}
                  className="-my-2 inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-brand-fg hover:underline"
                >
                  See all {mentorTotal}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
            <p className="text-sm text-secondary">
              {widened
                ? `Nobody from ${deptName ?? 'your branch'} has switched mentoring on yet, so this is every branch.`
                : 'They have each set this themselves. It is a standing yes to being asked.'}
            </p>
          </div>

          {mentors.length ? (
            <ul className={SNAP_ROW}>
              {mentors.slice(0, 3).map((m, i) => (
                <li key={m.id} className={cn(SNAP_ITEM, i === 2 && 'sm:hidden xl:block')}>
                  <MemberCard
                    member={m}
                    className="h-full"
                    action={
                      <ButtonLink
                        href={`/directory/${m.slug}`}
                        variant="secondary"
                        size="sm"
                        className="min-h-11 w-full"
                      >
                        Ask for help
                        <span className="sr-only">: {m.fullName}</span>
                      </ButtonLink>
                    }
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              variant="inline"
              title="No alumni have switched mentoring on yet. The ones who do appear here."
              action={
                <Link href="/directory" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-fg hover:underline">
                  Browse the directory
                </Link>
              }
            />
          )}
        </section>
      ) : null}

      {/* ---- The college, then jobs ----------------------------------- */}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        <div className="min-w-0">
          <HappeningAt
            pack={pack}
            events={can(session, 'event.register') ? events : null}
            showPhotos={isActive(session)}
          />
        </div>

        <aside aria-label="Jobs and where alumni work" className="min-w-0 space-y-6">
          {pack.features.jobs ? (
            <Card as="section" aria-labelledby="jobs-title">
              <CardHeader className="items-center">
                <CardTitle as="h2" id="jobs-title" className="text-md">
                  Jobs closing soon
                </CardTitle>
                {jobs.length ? (
                  <Link
                    href="/jobs"
                    className="-my-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-fg hover:underline"
                  >
                    All {jobs.length}
                    <span className="sr-only"> openings</span>
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                ) : null}
              </CardHeader>
              <CardBody className="pt-1">
                {closing.length ? (
                  <ul className="divide-y divide-line">
                    {closing.map((j, i) => (
                      // Three on a phone, where this list sits under
                      // everything else; five beside the news on a desktop.
                      <li key={j.id} className={i > 2 ? 'hidden sm:block' : undefined}>
                        <JobSummary job={j} href={`/jobs/${j.id}`} locale={locale} variant="row" />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    variant="inline"
                    title="No openings are live today. Alumni and the placement cell post them here."
                  />
                )}
              </CardBody>
            </Card>
          ) : null}

          {topCompanies.length ? (
            <Card as="section" aria-labelledby="companies-title">
              <CardHeader variant="stack">
                <CardTitle as="h2" id="companies-title" className="text-md">
                  Where {deptCode ?? copy.shortName} alumni work
                </CardTitle>
                <CardDescription>From profiles on this portal.</CardDescription>
              </CardHeader>
              <CardBody className="min-w-0">
                {showBars ? (
                  <BarList
                    label={`Companies employing ${deptCode ?? copy.shortName} alumni on the portal`}
                    data={topCompanies}
                  />
                ) : (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Companies">
                    {topCompanies.map((c) => (
                      <li key={c.label}>
                        <Badge tone="outline">{c.label}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
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
