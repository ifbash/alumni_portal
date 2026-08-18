import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { BellRing, Inbox, MailCheck, SlidersHorizontal } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { requireSession } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getNotifications } from '@/lib/data/repo';
import type { NotificationItem } from '@/lib/data/types';
import {
  ButtonLink,
  Card,
  CardBody,
  EmptyState,
  PageHeader,
  SegmentedNav,
  Tabs,
  type TabItem,
} from '@/components/ui';
import { MarginNote } from '@/components/brand/Marks';
import { formatDate, formatDateTime, formatTime } from '@/lib/format';
import {
  NotificationList,
  type NotificationGroupView,
  type NotificationKind,
  type NotificationView,
} from './NotificationList';

/**
 * The full inbox — the dropdown in the top bar, unabridged.
 *
 * The dropdown shows the last few and nothing else; this page is where a
 * member goes when they know something arrived and cannot find it. So the
 * two axes people actually search on are in the URL: what kind of thing it
 * was, and whether they have read it. A filtered inbox is a link that can
 * be pasted into a message to the alumni cell.
 *
 * Read state itself is client-held — see `NotificationList`. Everything
 * else, including which rows a viewer may see and which targets are even
 * reachable for this college, is decided here on the server.
 */

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'Everything the portal has told you, newest first.',
};

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

/**
 * Tab order and tab labels.
 *
 * They live here rather than beside the row icons in `NotificationList`
 * because a server component may not read a value out of a `'use client'`
 * module — only pass props into one. The row badges are the singular form
 * and are that file's business.
 */
const KIND_ORDER: NotificationKind[] = ['connection', 'event', 'job', 'verification', 'system'];

const KIND_LABEL: Record<NotificationKind, string> = {
  connection: 'Connections',
  event: 'Events',
  job: 'Jobs',
  verification: 'Verification',
  system: 'Portal notices',
};

const STATES = [
  { value: 'all', label: 'Everything' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
] as const;

type StateFilter = (typeof STATES)[number]['value'];

function buildHref(q: { kind?: string; state?: string }): string {
  const sp = new URLSearchParams();
  if (q.kind && q.kind !== 'all') sp.set('kind', q.kind);
  if (q.state && q.state !== 'all') sp.set('state', q.state);
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

  const params = await searchParams;
  const kindParam = first(params.kind) ?? 'all';
  const kind: NotificationKind | 'all' = (KIND_ORDER as string[]).includes(kindParam)
    ? (kindParam as NotificationKind)
    : 'all';
  const stateParam = first(params.state) ?? 'all';
  const state: StateFilter = STATES.some((s) => s.value === stateParam)
    ? (stateParam as StateFilter)
    : 'all';

  // Newest first. A notification inbox ordered any other way is a log.
  const all = [...getNotifications(session)].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  const unread = all.filter((n) => !n.readAt).length;

  const matchesState = (n: NotificationItem) =>
    state === 'unread' ? !n.readAt : state === 'read' ? Boolean(n.readAt) : true;

  const byState = all.filter(matchesState);
  const items = kind === 'all' ? byState : byState.filter((n) => n.kind === kind);

  // Counts describe the list the reader is looking at, so switching kind
  // inside "Unread" never lands on a tab that turns out to be empty.
  const tabs: TabItem[] = [
    {
      label: 'All',
      href: buildHref({ state }),
      count: byState.length,
      active: kind === 'all',
    },
    ...KIND_ORDER.map((k) => ({
      label: KIND_LABEL[k],
      href: buildHref({ kind: k, state }),
      count: byState.filter((n) => n.kind === k).length,
      active: kind === k,
    })),
  ];

  const groups = groupByDay(items, pack.features);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={pack.copy.shortName}
        title="Notifications"
        description={
          unread === 0
            ? 'Everything the portal has told you, newest first. Nothing is waiting on you right now.'
            : `Everything the portal has told you, newest first. ${unread} of these have not been opened yet.`
        }
        actions={
          <ButtonLink href="/settings/notifications" variant="secondary">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Choose what you are sent
          </ButtonLink>
        }
      />

      <Tabs items={tabs} ariaLabel="Notification kinds" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedNav
          items={STATES.map((s) => ({
            label: s.label,
            href: buildHref({ kind, state: s.value }),
            active: state === s.value,
          }))}
        />
        {state !== 'all' || kind !== 'all' ? (
          <ButtonLink href="/notifications" variant="ghost" size="sm">
            Clear filters
          </ButtonLink>
        ) : null}
      </div>

      {items.length === 0 ? (
        <Empty
          hasAny={all.length > 0}
          kind={kind}
          state={state}
          collegeName={pack.copy.shortName}
        />
      ) : (
        <NotificationList groups={groups} initialUnread={unread} />
      )}

      <Card>
        <CardBody className="space-y-3">
          <p className="text-sm text-secondary">
            The same notices go to the email address you sign in with. Nothing here is a marketing
            list — a connection request, an event you registered for and a decision on your account
            are all things the portal owes you an answer about.
          </p>
          {!pack.features.whatsapp ? (
            <p className="text-sm text-secondary">
              WhatsApp is not connected for {pack.copy.shortName} yet, so this page and email are the
              only two places these appear today.
            </p>
          ) : null}
          <MarginNote className="border-t border-line pt-3">
            Read state lives on your account, not on the sender&rsquo;s. Nobody is told whether you
            opened a notification — an alumnus who ignores a request is not distinguishable here
            from one who never saw it, and that is deliberate.
          </MarginNote>
        </CardBody>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------

/**
 * Three buckets, keyed on the calendar day in the tenant's time zone.
 *
 * The day key is `formatDate` rather than anything computed off the
 * server's own offset: a portal rendered in `ap-south-1` and read in
 * Vijayawada must agree about when "today" started, and the formatter
 * already carries the tenant's zone.
 */
function groupByDay(
  items: NotificationItem[],
  features: { connections: boolean; events: boolean; jobs: boolean },
): NotificationGroupView[] {
  const now = new Date();
  const today = formatDate(now);
  const yesterday = formatDate(new Date(now.getTime() - 86400000));

  const buckets: Record<NotificationGroupView['key'], NotificationView[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  };

  for (const n of items) {
    const day = formatDate(n.createdAt);
    const key: NotificationGroupView['key'] =
      day === today ? 'today' : day === yesterday ? 'yesterday' : 'earlier';

    buckets[key].push(toView(n, key, features));
  }

  const meta: Array<{ key: NotificationGroupView['key']; label: string; hint: string }> = [
    { key: 'today', label: 'Today', hint: 'since midnight' },
    { key: 'yesterday', label: 'Yesterday', hint: `${yesterday}` },
    { key: 'earlier', label: 'Earlier', hint: 'newest first' },
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

/**
 * An empty inbox is good news, and the copy says so. "No notifications"
 * with a sad face reads as a fault; this is a portal telling somebody that
 * nothing needs them.
 */
function Empty({
  hasAny,
  kind,
  state,
  collegeName,
}: {
  hasAny: boolean;
  kind: NotificationKind | 'all';
  state: StateFilter;
  collegeName: string;
}) {
  if (!hasAny) {
    return (
      <EmptyState
        icon={<Inbox className="size-5" />}
        title="Your inbox starts here"
        description={`Nothing has needed you yet. When a student asks to connect, when an event you registered for is close, or when ${collegeName} makes a decision on your account, it lands on this page and in your email.`}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/directory" variant="secondary">
              Search the directory
            </ButtonLink>
            <ButtonLink href="/settings/notifications" variant="ghost">
              Choose what you are sent
            </ButtonLink>
          </div>
        }
      />
    );
  }

  if (state === 'unread') {
    return (
      <EmptyState
        icon={<MailCheck className="size-5" />}
        title={kind === 'all' ? 'You are up to date' : `Nothing unread under ${KIND_LABEL[kind]}`}
        description={
          kind === 'all'
            ? 'Every notification on your account has been opened. New ones appear at the top of this page as they arrive.'
            : 'Everything of this kind has been read. The others may not have been.'
        }
        action={
          <ButtonLink href={buildHref({ kind })} variant="secondary">
            Show everything, read included
          </ButtonLink>
        }
      />
    );
  }

  if (state === 'read') {
    return (
      <EmptyState
        icon={<BellRing className="size-5" />}
        title={kind === 'all' ? 'Nothing has been read yet' : `Nothing read under ${KIND_LABEL[kind]}`}
        description={
          kind === 'all'
            ? 'Every notification on your account is still unread. Open one, or mark the lot as read once you have caught up.'
            : 'Everything of this kind is still unread. Other kinds may already have been read.'
        }
        action={
          <ButtonLink href={buildHref({ kind, state: 'unread' })} variant="secondary">
            Go to the unread ones
          </ButtonLink>
        }
      />
    );
  }

  return (
    <EmptyState
      icon={<Inbox className="size-5" />}
      title={`No ${KIND_LABEL[kind as NotificationKind].toLowerCase()} yet`}
      description="Nothing of this kind has reached your account. Other notifications may still be waiting under the other tabs."
      action={
        <ButtonLink href="/notifications" variant="secondary">
          Show every kind
        </ButtonLink>
      }
    />
  );
}
