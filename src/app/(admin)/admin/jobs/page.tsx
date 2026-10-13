import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { Building2, CheckCircle2, ChevronRight, TriangleAlert } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getJobs } from '@/lib/data/repo';
import type { JobPosting } from '@/lib/data/types';
import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  ChipNav,
  HowThisWorks,
  PageHeader,
  Section,
  SummaryLine,
} from '@/components/ui';
import { JobSummary } from '@/components/content';
import { formatDate, formatRelative, memberLine } from '@/lib/format';
import { ModerationActions, ModerationPolicy } from './ModerationActions';

export const metadata = { title: 'Jobs · Staff console' };

type Decided = 'all' | 'approved' | 'rejected' | 'closed';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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

  const params = await searchParams;
  const decided: Decided = ((v) => (v === 'approved' || v === 'rejected' || v === 'closed' ? v : 'all'))(
    one(params.decided),
  );
  const pool = decided === 'approved' ? live : decided === 'rejected' ? rejected : decided === 'closed' ? closed : [...rejected, ...live, ...closed];
  const moderated = [...pool].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12);

  const canReadAudit = can(session, 'audit.read');
  const canOpenProfiles = can(session, 'profile.read.any');

  const pack = resolved.brand.pack;
  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };
  const oldest = [...pending].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] ?? null;
  const rejectionNote = rejected.find((j) => j.moderationNote)?.moderationNote ?? null;

  const posterHref = (p: JobPosting['postedBy']) =>
    canOpenProfiles ? `/admin/members/${p.id}` : `/directory/${p.slug}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Jobs"
        description={
          oldest
            ? `${pending.length} waiting · oldest submitted ${formatRelative(oldest.createdAt, timing)}`
            : 'Nothing is waiting for a decision.'
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <SummaryLine
          className="md:pt-3"
          items={[
            { value: live.length, label: 'live', href: '/admin/jobs?decided=approved#decided' },
            { value: applications, label: applications === 1 ? 'application' : 'applications' },
            { value: rejected.length, label: 'rejected', href: '/admin/jobs?decided=rejected#decided' },
          ]}
        />
        <HowThisWorks summary="Moderation policy" className="md:w-96">
          <ModerationPolicy />
          <p>Approving publishes the posting to students straight away. A rejection always carries a reason.</p>
        </HowThisWorks>
      </div>

      <Section title="Waiting for a decision">
        {pending.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-secondary">
            <CheckCircle2 className="size-4 shrink-0 text-success-fg" aria-hidden="true" />
            Nothing is waiting. New postings appear here first.
          </p>
        ) : (
          <ul className="grid gap-4 xl:grid-cols-2">
            {pending.map((job) => (
              <li key={job.id} className="min-w-0">
                <QueueCard
                  job={job}
                  locale={pack.locale}
                  timing={timing}
                  livePostings={livePerPoster.get(job.postedBy.id) ?? 0}
                  posterHref={posterHref(job.postedBy)}
                  precedent={rejectionNote}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        id="decided"
        title="Decided"
        actions={
          canReadAudit ? (
            <Link href="/admin/audit" className="inline-flex min-h-11 items-center text-sm font-medium text-brand-fg hover:underline sm:min-h-0">
              Open the audit log
            </Link>
          ) : undefined
        }
      >
        <ChipNav
          ariaLabel="Decided postings"
          items={[
            { label: 'All', href: '/admin/jobs#decided', active: decided === 'all' },
            { label: 'Approved', href: '/admin/jobs?decided=approved#decided', active: decided === 'approved', count: live.length },
            { label: 'Rejected', href: '/admin/jobs?decided=rejected#decided', active: decided === 'rejected', count: rejected.length },
            { label: 'Closed', href: '/admin/jobs?decided=closed#decided', active: decided === 'closed', count: closed.length },
          ]}
        />

        {moderated.length === 0 ? (
          <p className="text-sm text-secondary">Nothing here yet. Decisions appear as they are made.</p>
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {moderated.map((j) => (
                <li key={j.id}>
                  <Link
                    href={`/admin/jobs/${j.id}`}
                    className="flex min-h-11 items-start gap-3 px-4 py-3 transition-colors duration-fast ease-brand hover:bg-surface-sunken"
                  >
                    <Avatar name={j.company} size="sm" shape="square" />
                    <span className="min-w-0 flex-1 space-y-0.5">
                      <span className="block truncate font-medium text-primary">{j.title}</span>
                      <span className="block truncate text-sm text-secondary">
                        {memberLine([j.company, j.postedBy.fullName, formatDate(j.createdAt, timing)])}
                      </span>
                      {j.state === 'rejected' && j.moderationNote ? (
                        <span className="line-clamp-2 block text-sm text-secondary">{j.moderationNote}</span>
                      ) : null}
                    </span>
                    <DecisionBadge state={j.state} />
                    <ChevronRight className="mt-1 size-4 shrink-0 text-muted" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {!canReadAudit ? (
          <p className="text-sm text-secondary">
            Who decided each posting is in the audit log, which the college admin can open.
          </p>
        ) : null}
      </Section>
    </div>
  );
}

function DecisionBadge({ state }: { state: JobPosting['state'] }) {
  if (state === 'live') return <Badge tone="success">Approved</Badge>;
  if (state === 'rejected') return <Badge tone="danger">Rejected</Badge>;
  return <Badge tone="neutral">Closed</Badge>;
}

function QueueCard({
  job,
  locale,
  timing,
  livePostings,
  posterHref,
  precedent,
}: {
  job: JobPosting;
  locale: Parameters<typeof JobSummary>[0]['locale'];
  timing: { locale: string; timeZone: string };
  livePostings: number;
  posterHref: string;
  precedent: string | null;
}) {
  const poster = job.postedBy;
  const employerMatch = Boolean(
    poster.currentCompany && poster.currentCompany.toLowerCase() === job.company.toLowerCase(),
  );
  const yy = poster.batchYear ? `’${String(poster.batchYear).slice(-2)}` : null;

  return (
    <JobSummary
      job={job}
      href={`/admin/jobs/${job.id}`}
      locale={locale}
      footer={
        <div className="space-y-3">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-secondary">
            <Avatar name={poster.fullName} src={poster.photoUrl} size="xs" />
            <Link href={posterHref} className="font-medium text-primary hover:text-brand-fg hover:underline">
              {poster.fullName}
            </Link>
            <span>{memberLine([[poster.departmentCode, yy].filter(Boolean).join(' '), `submitted ${formatRelative(job.createdAt, timing)}`])}</span>
          </p>

          {poster.currentCompany ? (
            <p className="flex items-start gap-2 text-sm text-secondary">
              <Building2 className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
              <span>
                {employerMatch
                  ? `Works at ${poster.currentCompany}`
                  : `Works at ${poster.currentCompany} · posting is for ${job.company}`}
                {livePostings > 0 ? ` · ${livePostings} of their postings already live` : ''}
              </span>
            </p>
          ) : (
            <p className="flex items-start gap-2 text-sm text-warning-fg">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              No employer on their profile, so there is nothing to check this against.
            </p>
          )}

          {job.description ? (
            <div className="rounded border border-line bg-surface p-3">
              <p className="line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-secondary">{job.description}</p>
              <Link href={`/admin/jobs/${job.id}`} className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-brand-fg hover:underline sm:min-h-0">
                Read the full posting
              </Link>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <ButtonLink href={`/admin/jobs/${job.id}`} variant="ghost" size="sm" className="min-h-11 sm:min-h-0">
              Open
            </ButtonLink>
            <ModerationActions
              jobId={job.id}
              jobTitle={job.title}
              company={job.company}
              posterName={poster.fullName}
              precedent={precedent}
            />
          </div>
        </div>
      }
    />
  );
}
