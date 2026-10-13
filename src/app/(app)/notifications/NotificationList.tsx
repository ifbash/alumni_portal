'use client';

import * as React from 'react';
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
import { Alert, Button, ButtonLink, Card, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { NotificationItem } from '@/lib/data/types';

/**
 * The inbox: read state, the "Mark all as read" control and the rows.
 *
 * Read state is held here, in one provider, because two places change it:
 * the header's "Mark all as read" and each row's own control. The page
 * stays a server component and renders both inside `InboxProvider`.
 *
 *  - **Unread is said three ways.** A brand dot, a bold title and the word
 *    "Unread", so nobody has to tell a tint from the ground.
 *  - **A row is marked read where it sits.** It does not jump or vanish,
 *    so a reader working down the list keeps their place.
 *  - **A failed write says so and stays visible,** and the row goes back
 *    to unread rather than pretending the server agreed.
 */

export type NotificationKind = NotificationItem['kind'];

/** The row's own word for its kind, in the filter's vocabulary. */
const KIND_LABEL: Record<NotificationKind, string> = {
  connection: 'Request',
  event: 'Event',
  job: 'Job',
  verification: 'Account',
  system: 'Account',
};

const KIND_ICON: Record<NotificationKind, React.ComponentType<{ className?: string }>> = {
  connection: Handshake,
  event: CalendarDays,
  job: Briefcase,
  verification: BadgeCheck,
  system: Megaphone,
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
  /** "5 hours ago", for today's rows. Formatted on the server against the fixture clock. */
  relative?: string | null;
  /** The verb on the row's link ("Reply", "See event"); null when there is no link. */
  action?: string | null;
}

export interface NotificationGroupView {
  key: 'today' | 'yesterday' | 'earlier';
  label: string;
  items: NotificationView[];
}

type FailureReason = 'offline' | 'missing' | 'refused';

interface Failure {
  reason: FailureReason;
  status?: number;
}

interface InboxState {
  unread: number;
  busy: string | null;
  failure: Failure | null;
  isRead: (n: NotificationView) => boolean;
  markOne: (n: NotificationView) => Promise<void>;
  markAll: () => Promise<void>;
}

const InboxContext = React.createContext<InboxState | null>(null);

function useInbox(): InboxState {
  const ctx = React.useContext(InboxContext);
  if (!ctx) throw new Error('Inbox controls must sit inside <InboxProvider>.');
  return ctx;
}

export function InboxProvider({
  initialUnread,
  children,
}: {
  /** Unread across the whole inbox, not just the rows in view. */
  initialUnread: number;
  children: React.ReactNode;
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

  const markOne = React.useCallback(
    async (n: NotificationView) => {
      setBusy(n.id);
      setReadIds((prev) => new Set(prev).add(n.id));

      const result = await postRead({ action: 'mark_read', ids: [n.id] });
      setBusy(null);

      if (result.ok) {
        setFailure(null);
        return;
      }
      // Roll the row back: the server did not record it.
      setReadIds((prev) => {
        const next = new Set(prev);
        next.delete(n.id);
        return next;
      });
      setFailure(result);
      toast.error(FAILURE_COPY[result.reason].title, FAILURE_COPY[result.reason].body);
    },
    [toast],
  );

  const markAll = React.useCallback(async () => {
    setBusy('all');
    setAllRead(true);

    const result = await postRead({ action: 'mark_all_read' });
    setBusy(null);

    if (result.ok) {
      setFailure(null);
      return;
    }
    setAllRead(false);
    setFailure(result);
    toast.error(FAILURE_COPY[result.reason].title, FAILURE_COPY[result.reason].body);
  }, [toast]);

  const value = React.useMemo(
    () => ({ unread, busy, failure, isRead, markOne, markAll }),
    [unread, busy, failure, isRead, markOne, markAll],
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

/** The header action. Disabled, not hidden, when nothing is unread. */
export function MarkAllButton() {
  const { unread, busy, markAll } = useInbox();
  return (
    <>
      <Button
        variant="secondary"
        className="min-h-11"
        onClick={() => void markAll()}
        disabled={unread === 0}
        loading={busy === 'all'}
      >
        {busy === 'all' ? null : <CheckCheck className="size-4" aria-hidden="true" />}
        Mark all as read
      </Button>
      <span className="sr-only" role="status">
        {unread === 0 ? 'Everything is read.' : `${unread} unread.`}
      </span>
    </>
  );
}

export function NotificationList({ groups }: { groups: NotificationGroupView[] }) {
  const { failure, isRead, busy, markOne } = useInbox();

  return (
    <div className="space-y-6">
      {failure ? (
        <Alert
          tone={failure.reason === 'refused' ? 'danger' : 'warning'}
          title={FAILURE_COPY[failure.reason].title}
          icon={<Bell className="size-4" />}
        >
          <p>{FAILURE_COPY[failure.reason].body}</p>
        </Alert>
      ) : null}

      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`group-${group.key}`} className="space-y-2">
          <h2 id={`group-${group.key}`} className="text-sm font-semibold text-secondary">
            {group.label}
          </h2>

          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {group.items.map((n) => (
                <Row
                  key={n.id}
                  notification={n}
                  read={isRead(n)}
                  busy={busy === n.id}
                  onMarkRead={() => void markOne(n)}
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
  const when = n.relative ?? n.stamp;

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-4 sm:px-card">
      <span className="relative mt-0.5" aria-hidden="true">
        <span className="grid size-9 place-items-center rounded-full bg-surface-sunken text-secondary">
          <Icon className="size-4" />
        </span>
        {read ? null : (
          <span className="absolute -left-0.5 -top-0.5 size-2.5 rounded-full bg-[var(--button-primary-bg)] ring-2 ring-[var(--surface-raised)]" />
        )}
      </span>

      <div className="min-w-0 space-y-1">
        <p className={cn('text-sm', read ? 'text-primary' : 'font-semibold text-primary')}>{n.title}</p>
        {n.body ? <p className="text-sm text-secondary">{n.body}</p> : null}
        <p className="text-xs text-secondary">
          {KIND_LABEL[n.kind]}
          <span aria-hidden="true"> · </span>
          <span className="tabular">{when}</span>
          {read ? null : (
            <>
              <span aria-hidden="true"> · </span>
              <span className="font-semibold text-brand-fg">Unread</span>
            </>
          )}
        </p>
        {n.hrefNote ? <p className="text-xs text-secondary">{n.hrefNote}</p> : null}
      </div>

      {n.href && n.action ? (
        <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-3 sm:row-start-1 sm:self-center">
          <ButtonLink
            href={n.href}
            variant="secondary"
            size="sm"
            className="min-h-11"
            onClick={read ? undefined : onMarkRead}
          >
            {n.action}
          </ButtonLink>
          {read ? null : (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11"
              onClick={onMarkRead}
              loading={busy}
              aria-label={`Mark “${n.title}” as read`}
            >
              {busy ? null : <Check className="size-4" aria-hidden="true" />}
              <span className="sm:sr-only">Mark read</span>
            </Button>
          )}
        </div>
      ) : read ? null : (
        <div className="col-start-2 sm:col-start-3 sm:row-start-1 sm:self-center">
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11"
            onClick={onMarkRead}
            loading={busy}
            aria-label={`Mark “${n.title}” as read`}
          >
            {busy ? null : <Check className="size-4" aria-hidden="true" />}
            Mark read
          </Button>
        </div>
      )}
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
    title: 'Read state was not saved',
    body: 'Nothing changed on your account. Reload the page to see the true state.',
  },
  offline: {
    title: 'Nothing reached the server',
    body: 'Your device looks to be offline. Reconnect and mark them again.',
  },
  refused: {
    title: 'The server refused that',
    body: 'Nothing changed on your account. Reload the page to see the true state.',
  },
};
