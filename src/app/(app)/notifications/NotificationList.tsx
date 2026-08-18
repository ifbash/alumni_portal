'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  BadgeCheck,
  Bell,
  Briefcase,
  CalendarDays,
  Check,
  CheckCheck,
  Handshake,
  Megaphone,
} from 'lucide-react';
import { Alert, Badge, Button, Card, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { NotificationItem } from '@/lib/data/types';

/**
 * The inbox list — the only interactive leaf on the notifications screen.
 *
 * Read state is the whole point of this component, so three things are
 * deliberate:
 *
 *  1. **Unread is a change of substance, not a dot.** A tinted ground, a
 *     brand rule down the left edge, a heavier title *and* the word
 *     "Unread" in a badge. Somebody who cannot separate the tint from the
 *     ground still reads the word.
 *  2. **The row is marked read where it sits.** It does not vanish from
 *     under the cursor, because a list that reorders itself as you work
 *     down it is a list you lose your place in — and because the "Unread"
 *     filter would otherwise empty itself one row at a time.
 *  3. **A failed write says so and stays visible.** The notifications
 *     write API is not connected in this build. Rather than pretending the
 *     server agreed, the banner names what happened and what reloading
 *     will show.
 */

export type NotificationKind = NotificationItem['kind'];

/**
 * The word that sits in the badge on a single row — singular, and
 * deliberately not the plural tab label the page uses. A server component
 * cannot dot into a `'use client'` module, so the tab labels live in
 * `page.tsx`; these are the row's own.
 */
const KIND_BADGE: Record<NotificationKind, string> = {
  connection: 'Connection',
  event: 'Event',
  job: 'Job',
  verification: 'Verification',
  system: 'Portal notice',
};

const KIND_ICON: Record<NotificationKind, React.ComponentType<{ className?: string }>> = {
  connection: Handshake,
  event: CalendarDays,
  job: Briefcase,
  verification: BadgeCheck,
  system: Megaphone,
};

const KIND_TONE: Record<NotificationKind, React.ComponentProps<typeof Badge>['tone']> = {
  connection: 'brand',
  event: 'accent',
  job: 'info',
  verification: 'success',
  system: 'neutral',
};

export interface NotificationView {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  /** Null when there is nowhere to send the reader — see `hrefNote`. */
  href: string | null;
  /** Why `href` is null, when the reason is worth saying out loud. */
  hrefNote: string | null;
  read: boolean;
  /** Already formatted on the server, in the tenant's time zone. */
  stamp: string;
}

export interface NotificationGroupView {
  key: 'today' | 'yesterday' | 'earlier';
  label: string;
  hint: string;
  items: NotificationView[];
}

type FailureReason = 'offline' | 'missing' | 'refused';

interface Failure {
  reason: FailureReason;
  status?: number;
}

export function NotificationList({
  groups,
  initialUnread,
}: {
  groups: NotificationGroupView[];
  /** Unread across the whole inbox, not just the rows in view. */
  initialUnread: number;
}) {
  const toast = useToast();
  const [readIds, setReadIds] = React.useState<ReadonlySet<string>>(() => new Set<string>());
  const [allRead, setAllRead] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [failure, setFailure] = React.useState<Failure | null>(null);

  const isRead = React.useCallback(
    (n: NotificationView) => n.read || allRead || readIds.has(n.id),
    [allRead, readIds],
  );

  const unread = allRead ? 0 : Math.max(0, initialUnread - readIds.size);

  const markOne = async (n: NotificationView) => {
    setBusy(n.id);
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(n.id);
      return next;
    });

    const result = await postRead({ action: 'mark_read', ids: [n.id] });
    setBusy(null);

    if (result.ok) {
      setFailure(null);
      return;
    }
    setFailure(result);
    toast.error(FAILURE_COPY[result.reason].title, FAILURE_COPY[result.reason].body);
  };

  const markAll = async () => {
    setBusy('all');
    setAllRead(true);

    const result = await postRead({ action: 'mark_all_read' });
    setBusy(null);

    if (result.ok) {
      setFailure(null);
      toast.success(
        'Inbox cleared',
        'Everything is marked read. New notifications still arrive here and by email.',
      );
      return;
    }
    setFailure(result);
    toast.error(FAILURE_COPY[result.reason].title, FAILURE_COPY[result.reason].body);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-secondary" role="status">
          {unread === 0 ? (
            'Everything in your inbox is read.'
          ) : (
            <>
              <span className="tabular font-semibold text-primary">{unread}</span> unread
            </>
          )}
        </p>

        <Button
          variant="secondary"
          size="sm"
          onClick={markAll}
          disabled={unread === 0}
          loading={busy === 'all'}
        >
          {busy === 'all' ? null : <CheckCheck className="size-4" aria-hidden="true" />}
          Mark all as read
        </Button>
      </div>

      {failure ? (
        <Alert
          tone={failure.reason === 'refused' ? 'danger' : 'warning'}
          title={
            failure.reason === 'refused'
              ? `The server refused that (HTTP ${failure.status ?? 'error'})`
              : FAILURE_COPY[failure.reason].title
          }
          icon={<Bell className="size-4" />}
        >
          <p>{FAILURE_COPY[failure.reason].body}</p>
        </Alert>
      ) : null}

      {groups.map((group) => (
        <section key={group.key} aria-label={group.label} className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="font-display text-lg font-semibold">{group.label}</h2>
            <p className="text-xs text-muted">
              <span className="tabular">{group.items.length}</span>
              {group.items.length === 1 ? ' notification · ' : ' notifications · '}
              {group.hint}
            </p>
          </div>

          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {group.items.map((n) => (
                <Row
                  key={n.id}
                  notification={n}
                  read={isRead(n)}
                  busy={busy === n.id}
                  onMarkRead={() => markOne(n)}
                />
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------

function Row({
  notification: n,
  read,
  busy,
  onMarkRead,
}: {
  notification: NotificationView;
  read: boolean;
  busy: boolean;
  onMarkRead: () => void;
}) {
  const Icon = KIND_ICON[n.kind];

  return (
    <li
      className={cn(
        'flex gap-3 border-l-2 p-4 transition-colors duration-fast ease-brand sm:gap-4 sm:p-card',
        read
          ? 'border-l-transparent bg-surface-raised'
          : 'border-l-[var(--button-primary-bg)] bg-brand-soft',
      )}
    >
      <span
        className={cn(
          'mt-0.5 grid size-9 shrink-0 place-items-center rounded-full',
          read ? 'bg-surface-sunken text-muted' : 'bg-surface-raised text-brand-fg',
        )}
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </span>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge tone={KIND_TONE[n.kind]}>{KIND_BADGE[n.kind]}</Badge>
          {read ? null : (
            <Badge tone="brand" dot>
              Unread
            </Badge>
          )}
          <span className="tabular text-xs text-muted">{n.stamp}</span>
        </div>

        {n.href ? (
          <Link
            href={n.href}
            className={cn('link-quiet block text-sm', read ? 'font-medium text-secondary' : 'font-semibold')}
          >
            {n.title}
          </Link>
        ) : (
          <p className={cn('text-sm', read ? 'font-medium text-secondary' : 'font-semibold')}>
            {n.title}
          </p>
        )}

        {n.body ? <p className="text-sm text-secondary">{n.body}</p> : null}
        {n.hrefNote ? <p className="text-xs text-muted">{n.hrefNote}</p> : null}
      </div>

      <div className="flex shrink-0 items-start">
        {read ? (
          <span className="inline-flex h-control-sm items-center gap-1.5 px-2 text-xs text-muted">
            <Check className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Read</span>
          </span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkRead}
            loading={busy}
            aria-label={`Mark “${n.title}” as read`}
          >
            {busy ? null : <Check className="size-4" aria-hidden="true" />}
            <span className="hidden sm:inline">Mark read</span>
          </Button>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------

type PostResult = { ok: true } | ({ ok: false } & Failure);

/**
 * One endpoint, two actions. Written against the route the portal will
 * have; until it exists the 404 is reported as what it is rather than
 * being swallowed into a green tick.
 */
async function postRead(body: Record<string, unknown>): Promise<PostResult> {
  let res: Response;
  try {
    res = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, reason: 'offline' };
  }

  if (res.status === 404) return { ok: false, reason: 'missing' };
  if (!res.ok) return { ok: false, reason: 'refused', status: res.status };
  return { ok: true };
}

const FAILURE_COPY: Record<FailureReason, { title: string; body: string }> = {
  missing: {
    title: 'Read state is not saved on the server yet',
    body:
      'The notifications write endpoint is not connected in this build, so this is recorded on this screen only. Reload the page and everything comes back unread. Nothing else about your account has changed.',
  },
  offline: {
    title: 'Nothing reached the server',
    body:
      'Your device looks to be offline. The rows are marked read here so you can keep reading, but reconnect and mark them again to make it stick.',
  },
  refused: {
    title: 'The server refused that',
    body:
      'Nothing was changed on the server, so reload the page to see the true state. If it keeps happening, tell the alumni cell what you were doing and roughly when.',
  },
};
