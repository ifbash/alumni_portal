import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import type { JobPosting } from '@/lib/data/types';
import { Avatar, Badge, Card, CardBody, DetailRow } from '@/components/ui';
import { closesLabel } from '@/components/content';
import { formatDate, formatRelative, memberLine } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ModerationActions } from './ModerationActions';
import { CheckList, buildJobChecks, checksNeedingEye, hostOf } from './checks';

/**
 * The moderation desk at lg+: the queue on the left, the selected posting on
 * the right with its checks, and the decision pinned under it. One tap
 * approves; a rejection opens the reason dialog. The selection is a query
 * parameter, so it is a link, not client state, and survives a refresh.
 *
 * Phones and tablets get the stacked cards instead (see the page): a
 * two-pane layout is a desk tool.
 */
export function ReviewDesk({
  jobs,
  selectedId,
  timing,
  posterHref,
  precedent,
  livePerPoster,
}: {
  jobs: JobPosting[];
  selectedId: string;
  timing: { locale: string; timeZone: string };
  posterHref: (p: JobPosting['postedBy']) => string;
  precedent: string | null;
  livePerPoster: Map<string, number>;
}) {
  const selected = jobs.find((j) => j.id === selectedId) ?? jobs[0]!;
  const checks = buildJobChecks(selected);
  const poster = selected.postedBy;
  const closes = closesLabel(selected.closesOn, timing.timeZone);
  const host = selected.applyUrl ? hostOf(selected.applyUrl) : null;
  const yy = poster.batchYear ? `’${String(poster.batchYear).slice(-2)}` : null;
  const live = livePerPoster.get(poster.id) ?? 0;

  return (
    <div className="hidden items-start gap-gutter lg:grid lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
      <nav aria-label="Postings waiting for a decision">
        <ul className="space-y-2">
          {jobs.map((j) => {
            const active = j.id === selected.id;
            const eye = checksNeedingEye(buildJobChecks(j));
            return (
              <li key={j.id}>
                <Link
                  href={`/admin/jobs?review=${j.id}`}
                  scroll={false}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'flex min-h-11 items-start gap-3 rounded-lg border p-3 transition-colors duration-fast ease-brand',
                    active
                      ? 'border-line-strong bg-brand-soft text-brand-soft-fg'
                      : 'border-line bg-surface-raised hover:border-line-strong hover:bg-surface-sunken',
                  )}
                >
                  <Avatar name={j.company} size="sm" shape="square" />
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className={cn('block truncate font-medium', active ? 'text-brand-soft-fg' : 'text-primary')}>
                      {j.title}
                    </span>
                    <span className={cn('block truncate text-sm', active ? 'text-brand-soft-fg' : 'text-secondary')}>
                      {memberLine([j.company, j.postedBy.fullName])}
                    </span>
                    <span className={cn('flex flex-wrap items-center gap-x-2 text-xs', active ? 'text-brand-soft-fg' : 'text-secondary')}>
                      <span>{formatRelative(j.createdAt, timing)}</span>
                      {eye > 0 ? (
                        <span className={cn('font-medium', !active && 'text-warning-fg')}>
                          {eye === 1 ? '1 check needs a look' : `${eye} checks need a look`}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <section aria-label="Selected posting" className="min-w-0">
        <Card className="overflow-hidden">
          <CardBody className="space-y-5">
            <div className="flex items-start gap-4">
              <Avatar name={selected.company} size="lg" shape="square" />
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="font-display text-xl font-semibold leading-snug">{selected.title}</h3>
                <p className="text-sm text-secondary">{memberLine([selected.company, selected.location])}</p>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {selected.salaryRange ? <Badge tone="outline">{selected.salaryRange}</Badge> : null}
                  {selected.isInternship ? (
                    <Badge tone="accent">Internship</Badge>
                  ) : selected.experienceYears ? (
                    <Badge tone="outline">{selected.experienceYears}</Badge>
                  ) : null}
                  {closes ? <Badge tone="neutral">{closes.text}</Badge> : null}
                </div>
              </div>
              <Link
                href={`/admin/jobs/${selected.id}`}
                className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-fg hover:underline"
              >
                Full page
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]">
              <div className="min-w-0 space-y-4">
                {selected.description ? (
                  <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed text-primary">
                    {selected.description}
                  </p>
                ) : (
                  <p className="text-sm text-secondary">No description was submitted.</p>
                )}
                {selected.skills.length ? (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Skills">
                    {selected.skills.map((s) => (
                      <li key={s}>
                        <Badge tone="outline">{s}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <dl className="divide-y divide-line border-t border-line">
                  <DetailRow label="How to apply">
                    {selected.applyUrl ? <span className="break-all">{host ?? selected.applyUrl}</span> : 'Through the portal'}
                  </DetailRow>
                  <DetailRow label="Closes">
                    {selected.closesOn ? formatDate(selected.closesOn, timing) : 'No closing date'}
                  </DetailRow>
                </dl>
              </div>

              <div className="min-w-0 space-y-4 rounded-lg border border-line bg-surface p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Posted by</p>
                  <p className="mt-2 flex items-center gap-2 text-sm">
                    <Avatar name={poster.fullName} src={poster.photoUrl} size="xs" />
                    <Link href={posterHref(poster)} className="font-medium text-primary hover:text-brand-fg hover:underline">
                      {poster.fullName}
                    </Link>
                  </p>
                  <p className="mt-1 text-sm text-secondary">
                    {memberLine([
                      [poster.departmentCode, yy].filter(Boolean).join(' '),
                      `submitted ${formatRelative(selected.createdAt, timing)}`,
                      live > 0 ? `${live} already live` : 'first on the board',
                    ])}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Checks</p>
                  <CheckList checks={checks} className="mt-2" />
                </div>
              </div>
            </div>
          </CardBody>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-sunken px-card py-3">
            <p className="text-sm text-secondary">Students cannot see this posting until you decide.</p>
            <ModerationActions
              key={selected.id}
              jobId={selected.id}
              jobTitle={selected.title}
              company={selected.company}
              posterName={poster.fullName}
              precedent={precedent}
              rejectLabel="Reject with reason"
            />
          </div>
        </Card>
      </section>
    </div>
  );
}
