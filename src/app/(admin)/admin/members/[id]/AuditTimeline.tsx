import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui';
import type { AuditEntry } from '@/lib/data/types';
import { formatDateTime, formatRelative } from '@/lib/format';
import { actionLabel, isFlagged, roleLabel } from '../../audit/audit-taxonomy';

/**
 * Everything the audit log says about one record, newest first, on a rail.
 *
 * The caller decides whether the viewer may see it (`audit.read`); this
 * component only lays the entries out. Each entry links to its own page,
 * where the before-and-after is.
 */
export function AuditTimeline({
  entries,
  fmt,
}: {
  entries: AuditEntry[];
  fmt: { locale?: string; timeZone?: string };
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-secondary">Nothing has been recorded against this record yet.</p>;
  }

  return (
    <ol className="relative space-y-4 before:absolute before:inset-y-1 before:left-[5px] before:w-px before:bg-line-strong before:content-['']">
      {entries.map((e) => {
        const flagged = isFlagged(e.action);
        const role = roleLabel(e.actorRole);
        return (
          <li key={e.id} className="relative pl-6">
            <span
              aria-hidden="true"
              className={
                flagged
                  ? 'absolute left-0 top-1.5 size-[11px] rounded-full border-2 border-surface-raised bg-warning'
                  : 'absolute left-0 top-1.5 size-[11px] rounded-full border-2 border-surface-raised bg-line-strong'
              }
            />
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <Link
                href={`/admin/audit/${e.id}`}
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium hover:text-brand-fg hover:underline sm:min-h-0"
              >
                {flagged ? <ShieldAlert className="size-3.5 text-warning-fg" aria-hidden="true" /> : null}
                {actionLabel(e.action)}
              </Link>
              {flagged ? <Badge tone="warning">Flagged</Badge> : null}
              <time
                dateTime={e.createdAt}
                title={formatDateTime(e.createdAt, fmt)}
                className="text-xs text-secondary tabular"
              >
                {formatRelative(e.createdAt, fmt)}
              </time>
            </div>
            <p className="text-xs text-secondary">
              {e.actorName ?? 'Unattributed'}
              {role ? ` · ${role}` : ''}
              {e.reason ? ` · ${e.reason}` : ''}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
