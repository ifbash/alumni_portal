import Link from 'next/link';
import { Briefcase, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui';
import { memberLine } from '@/lib/format';
import { firstNameOf } from '@/lib/identity';
import type { EducationEntry, EmploymentEntry } from '@/lib/data/types';

/**
 * Work history and education.
 *
 * Both are rendered as a rail because the shape of a career is the point:
 * a student looking at "Infosys → PhonePe" learns something the current
 * job alone does not tell them, and that is most of why they opened the
 * profile.
 *
 * A record with one line, or none, is the normal case for anyone who
 * graduated before about 2018. Neither list is allowed to look broken
 * when it is empty: it says so in one neutral line, and on the owner's
 * own view it offers the edit that fills it (`addHref`).
 */

interface Timing {
  locale: string;
  timeZone: string;
}

export function ExperienceTimeline({
  entries,
  ownerName,
  timing,
  addHref,
}: {
  entries: EmploymentEntry[];
  ownerName: string;
  timing: Timing;
  /** The owner's own view: where to add the first entry. */
  addHref?: string;
}) {
  if (entries.length === 0) {
    return (
      <EmptyLine
        icon={<Briefcase className="size-4" />}
        text={addHref ? 'You have not added work history.' : `${firstNameOf(ownerName)} has not added work history.`}
        add={addHref ? { href: addHref, label: 'Add work history' } : undefined}
      />
    );
  }

  return (
    <ol className="space-y-0">
      {entries.map((entry, i) => (
        <li key={entry.id} className="relative flex gap-4 pb-5 last:pb-0">
          {i < entries.length - 1 ? (
            <span
              aria-hidden="true"
              className="absolute bottom-0 left-[0.4375rem] top-5 w-px bg-line"
            />
          ) : null}

          <span
            aria-hidden="true"
            className={cn(
              'mt-1.5 size-3.5 shrink-0 rounded-full border-2',
              entry.isCurrent
                ? 'border-[var(--button-primary-bg)] bg-brand-soft'
                : 'border-line-strong bg-surface-raised',
            )}
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="font-medium">{entry.designation ?? 'Role not stated'}</p>
              {entry.isCurrent ? <Badge tone="outline">Current</Badge> : null}
            </div>
            <p className="text-sm text-secondary">{entry.company}</p>
            <p className="mt-0.5 text-xs text-secondary">
              {memberLine([period(entry.startedOn, entry.endedOn, entry.isCurrent, timing), entry.location])}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function EducationTimeline({
  entries,
  ownerName,
  timing,
  addHref,
}: {
  entries: EducationEntry[];
  ownerName: string;
  timing: Timing;
  addHref?: string;
}) {
  if (entries.length === 0) {
    return (
      <EmptyLine
        icon={<GraduationCap className="size-4" />}
        text={addHref ? 'You have not added education history.' : `${firstNameOf(ownerName)} has not added education history.`}
        add={addHref ? { href: addHref, label: 'Add education' } : undefined}
      />
    );
  }

  return (
    <ul className="space-y-4">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3">
          <GraduationCap className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium">{entry.institution}</p>
            <p className="text-sm text-secondary">
              {memberLine([entry.qualification, entry.field]) || 'Programme not stated'}
            </p>
            <p className="mt-0.5 text-xs text-secondary">
              {period(entry.startedOn, entry.endedOn, !entry.endedOn, timing)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyLine({
  icon,
  text,
  add,
}: {
  icon: React.ReactNode;
  text: string;
  add?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-secondary">
      <p className="flex gap-3">
        <span className="mt-0.5 shrink-0 text-muted" aria-hidden="true">
          {icon}
        </span>
        <span className="min-w-0">{text}</span>
      </p>
      {add ? (
        <Link href={add.href} className="link inline-flex min-h-11 items-center font-medium sm:min-h-0">
          {add.label}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * "Apr 2022 – Present".
 *
 * Month precision on purpose: `formatDate` gives a day, and nobody states
 * the day they joined a company. The tenant's locale and time zone are
 * still respected — a college outside India gets its own conventions.
 */
function period(
  startedOn: string | null,
  endedOn: string | null,
  isCurrent: boolean,
  timing: Timing,
): string | null {
  const start = monthYear(startedOn, timing);
  const end = endedOn ? monthYear(endedOn, timing) : isCurrent ? 'Present' : null;

  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (end) return `Until ${end}`;
  return null;
}

function monthYear(iso: string | null, timing: Timing): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(timing.locale, {
    month: 'short',
    year: 'numeric',
    timeZone: timing.timeZone,
  }).format(d);
}
