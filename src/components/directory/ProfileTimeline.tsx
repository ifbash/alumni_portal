import { Briefcase, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui';
import { memberLine } from '@/lib/format';
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
 * when it is empty.
 */

interface Timing {
  locale: string;
  timeZone: string;
}

export function ExperienceTimeline({
  entries,
  ownerName,
  timing,
}: {
  entries: EmploymentEntry[];
  ownerName: string;
  timing: Timing;
}) {
  if (entries.length === 0) {
    return (
      <EmptyLine
        icon={<Briefcase className="size-4" />}
        text={`${firstName(ownerName)} has not added any work history. What they do now, if anything, is only on their profile if they put it there.`}
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
              {entry.isCurrent ? <Badge tone="success">Current</Badge> : null}
            </div>
            <p className="text-sm text-secondary">{entry.company}</p>
            <p className="mt-0.5 text-xs text-muted">
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
}: {
  entries: EducationEntry[];
  ownerName: string;
  timing: Timing;
}) {
  if (entries.length === 0) {
    return (
      <EmptyLine
        icon={<GraduationCap className="size-4" />}
        text={`No education history beyond the degree register entry for ${firstName(ownerName)}.`}
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
            <p className="mt-0.5 text-xs text-muted">
              {period(entry.startedOn, entry.endedOn, !entry.endedOn, timing)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <p className="flex gap-3 text-sm text-secondary">
      <span className="mt-0.5 shrink-0 text-muted" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">{text}</span>
    </p>
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

function firstName(name: string): string {
  return name.split(' ')[0] ?? name;
}
