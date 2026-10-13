import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Check, Inbox, MailCheck, SlidersHorizontal } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { requireSession } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getNotifications } from '@/lib/data/repo';
import type { NotificationItem } from '@/lib/data/types';
import { ButtonLink, ChipNav, EmptyState, PageHeader } from '@/components/ui';
import { cn } from '@/lib/cn';
import { dayBucket, formatDateTime, formatRelative, formatTime } from '@/lib/format';
import { notificationAction } from '@/lib/notifications-view';
import {
  InboxProvider,
  MarkAllButton,
  NotificationList,
  type NotificationGroupView,
  type NotificationKind,
  type NotificationView,
} from './NotificationList';

/**
 * The full inbox — the bell in the top bar, unabridged.
 *
 * The two things people filter on are in the URL: what kind of thing it
 * was, and whether it is still unread. Rows are grouped by the calendar
 * day in the college's time zone, measured against the same clock every
 * other screen reads, so "Today" means today in the demo too.
 *
 * Read state itself is client-held — see `NotificationList`. Everything
 * else, including which rows a viewer may see and which targets are even
 * reachable for this college, is decided here on the server.
 */

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'Requests, events, jobs and account notices, newest first.',
};

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

/** The filter chips, in the words the rest of the portal uses. */
type KindFilter = 'requests' | 'events' | 'jobs' | 'account';

const FILTERS: Array<{ value: KindFilter; label: string; kinds: NotificationKind[] }> = [
  { value: 'requests', label: 'Requests', kinds: ['connection'] },
  { value: 'events', label: 'Events', kinds: ['event'] },
  { value: 'jobs', label: 'Jobs', kinds: ['job'] },
  { value: 'account', label: 'Account', kinds: ['verification', 'system'] },
];

/** Links written before the filters were renamed still land on the right chip. */
const LEGACY: Record<string, KindFilter | undefined> = {
  connection: 'requests',
  event: 'events',
  job: 'jobs',
  verification: 'account',
  system: 'account',
};

function buildHref(q: { kind?: KindFilter | 'all'; unread?: boolean }): string {
  const sp = new URLSearchParams();
  if (q.kind && q.kind !== 'all') sp.set('kind', q.kind);
  if (q.unread) sp.set('state', 'unread');
  const s = sp.toString();
  return s ? `/notifications?${s}` : '/notifications';
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  // The shell already refuses an anonymous viewer. This is the guard.
  requireSession(session);

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const pack = resolved.brand.pack;
  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };

  const params = await searchParams;
  const kindParam = first(params.kind) ?? 'all';
  const kind: KindFilter | 'all' =
    FILTERS.find((f) => f.value === kindParam)?.value ?? LEGACY[kindParam] ?? 'all';
  const unreadOnly = first(params.state) === 'unread';

  // Newest first. A notification inbox ordered any other way is a log.
  const all = [...getNotifications(session)].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  const unread = all.filter((n) => !n.readAt).length;

  const byState = unreadOnly ? all.filter((n) => !n.readAt) : all;
  const inKind = (n: NotificationItem, f: KindFilter) =>
    FILTERS.find((x) => x.value === f)!.kinds.includes(n.kind);
  const items = kind === 'all' ? byState : byState.filter((n) => inKind(n, kind));

  // A chip for each kind the inbox holds at all, plus the one in use.
  // Counts describe the list in view, and a count of 0 is never drawn.
  const chips = [
    { label: 'All', href: buildHref({ unread: unreadOnly }), active: kind === 'all', count: byState.length },
    ...FILTERS.filter((f) => f.value === kind || all.some((n) => inKind(n, f.value))).map((f) => ({
      label: f.label,
      href: buildHref({ kind: f.value, unread: unreadOnly }),
      active: kind === f.value,
      count: byState.filter((n) => inKind(n, f.value)).length,
    })),
  ];

  const groups = groupByDay(items, pack.features, timing);

  return (
    <InboxProvider initialUnread={unread}>
      <div className="space-y-6">
        <PageHeader
          title="Notifications"
          description="Requests, events, jobs and account notices, newest first."
          actions={all.length ? <MarkAllButton /> : null}
        />

        {all.length ? (
          <div className="flex items-center gap-3">
            <ChipNav items={chips} ariaLabel="Notification kinds" className="flex-1" />
            <Link
              href={buildHref({ kind, unread: !unreadOnly })}
              aria-current={unreadOnly ? 'true' : undefined}
              className={cn(
                '-mt-1 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-sm sm:min-h-9',
                'transition-colors duration-fast ease-brand',
                unreadOnly
                  ? 'border-line-strong bg-surface-raised font-medium text-primary'
                  : 'border-line bg-surface-raised text-secondary hover:border-line-strong hover:text-primary',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-4 place-items-center rounded-sm border',
                  unreadOnly
                    ? 'border-[var(--button-primary-bg)] bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)]'
                    : 'border-line-strong',
                )}
              >
                {unreadOnly ? <Check className="size-3" /> : null}
              </span>
              Unread only
            </Link>
          </div>
        ) : null}

        {items.length === 0 ? (
          <Empty hasAny={all.length > 0} kind={kind} unreadOnly={unreadOnly} />
        ) : (
          <NotificationList groups={groups} />
        )}

        <p>
          <Link
            href="/settings/notifications"
            className="link inline-flex min-h-11 items-center gap-2 text-sm"
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Notification settings
          </Link>
        </p>
      </div>
    </InboxProvider>
  );
}

// ---------------------------------------------------------------

/**
 * Three buckets, keyed on the calendar day in the college's time zone and
 * measured from `displayNow()` (inside `dayBucket`), never from the
 * server's own clock. Today's rows also carry a relative time.
 */
function groupByDay(
  items: NotificationItem[],
  features: { connections: boolean; events: boolean; jobs: boolean },
  timing: { locale: string; timeZone: string },
): NotificationGroupView[] {
  const buckets: Record<NotificationGroupView['key'], NotificationView[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  };

  for (const n of items) {
    const key = dayBucket(n.createdAt, timing.timeZone);
    const view = toView(n, key, features);
    buckets[key].push({
      ...view,
      relative: key === 'today' ? formatRelative(n.createdAt, timing) : null,
      // The verb follows the reachable link, so a module that is switched
      // off gets no dead button.
      action: notificationAction({ kind: view.kind, href: view.href }),
    });
  }

  const meta: Array<{ key: NotificationGroupView['key']; label: string }> = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'earlier', label: 'Earlier' },
  ];

  return meta
    .filter((m) => buckets[m.key].length > 0)
    .map((m) => ({ ...m, items: buckets[m.key] }));
}

/**
 * A notification can outlive the module it points at — a college that
 * turns off the jobs board still has last month's "your posting was
 * approved" sitting in inboxes. The link is dropped and the reason is
 * given, rather than sending the reader to a 404.
 */
function toView(
  n: NotificationItem,
  bucket: NotificationGroupView['key'],
  features: { connections: boolean; events: boolean; jobs: boolean },
): NotificationView {
  const moduleOn: Record<NotificationKind, boolean> = {
    connection: features.connections,
    event: features.events,
    job: features.jobs,
    verification: true,
    system: true,
  };

  const reachable = moduleOn[n.kind];

  return {
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    href: reachable ? n.href : null,
    hrefNote: !reachable
      ? 'That part of the portal is switched off for your college, so there is nothing to open.'
      : n.href
        ? null
        : 'For information only — there is no page behind this one.',
    read: Boolean(n.readAt),
    // Same-day rows get the clock; older ones get the date, because "9:30
    // AM" on its own is useless once it is not today.
    stamp: bucket === 'earlier' ? formatDateTime(n.createdAt) : formatTime(n.createdAt),
  };
}

// ---------------------------------------------------------------

/** One sentence on why the list is empty, and at most one way out. */
function Empty({
  hasAny,
  kind,
  unreadOnly,
}: {
  hasAny: boolean;
  kind: KindFilter | 'all';
  unreadOnly: boolean;
}) {
  if (!hasAny) {
    return (
      <EmptyState
        icon={<Inbox className="size-5" />}
        title="Nothing here yet"
        description="Requests, event reminders and notices about your account appear here."
      />
    );
  }

  const label = kind === 'all' ? null : FILTERS.find((f) => f.value === kind)!.label.toLowerCase();

  if (unreadOnly) {
    return (
      <EmptyState
        icon={<MailCheck className="size-5" />}
        title={label ? `No unread ${label}` : 'Nothing unread'}
        description="You have read everything here."
        action={
          <ButtonLink href={buildHref({ kind })} variant="secondary" className="min-h-11">
            Show all
          </ButtonLink>
        }
      />
    );
  }

  return (
    <EmptyState
      icon={<Inbox className="size-5" />}
      title={`No ${label ?? 'notifications'} yet`}
      description="Other kinds may still be waiting."
      action={
        <ButtonLink href="/notifications" variant="secondary" className="min-h-11">
          Show every kind
        </ButtonLink>
      }
    />
  );
}
