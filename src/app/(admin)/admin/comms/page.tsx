import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import {
  CalendarPlus,
  ChevronRight,
  Circle,
  Lock,
  Mail,
  MessageCircle,
  Newspaper,
  PenLine,
} from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { searchDirectory, getDepartments } from '@/lib/data/repo';
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Section, TrustChip } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDate, memberLine } from '@/lib/format';
import { listSends, type SentMessage } from './sent';

export const metadata = { title: 'Messages · Staff console' };

export default async function AdminCommsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { brand } = resolved;
  const pack = brand.pack;

  const all = can(session, 'comms.send.all');
  const segment = can(session, 'comms.send.segment');
  const department = can(session, 'comms.send.department');
  if (!all && !segment && !department) requireCap(session, 'comms.send.department');

  const tier: 'all' | 'segment' | 'department' = all ? 'all' : segment ? 'segment' : 'department';

  const myDepartment = session.roles.find((r) => r.role === 'hod')?.departmentId ?? session.departmentId;
  const departments = getDepartments();
  const myDepartmentName = myDepartment
    ? (departments.find((d) => d.code === myDepartment)?.name ?? myDepartment)
    : null;

  // The largest audience this viewer could address, computed the same way the
  // composer computes it — through the directory, with their own scope.
  const reachable = searchDirectory(session, {
    ...(tier === 'department' && myDepartment ? { department: myDepartment } : {}),
    perPage: 1,
  });

  const canReadAudit = can(session, 'audit.read');
  const sends = canReadAudit ? listSends(12) : [];
  const whatsapp = pack.features.whatsapp;
  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };

  const reach = `${reachable.total.toLocaleString('en-IN')} ${
    can(session, 'directory.search.students') ? 'members' : 'alumni'
  } within reach`;
  const scopeLine =
    tier === 'all'
      ? 'You can write to everyone, or to any group you can filter'
      : tier === 'segment'
        ? 'You can write to any group you can filter'
        : `You can write to ${myDepartmentName ?? 'your branch'}`;

  const starts: Array<{ href: string; title: string; line: string; icon: ReactNode; tone?: 'accent' }> = [
    ...(pack.features.events
      ? [
          {
            href: '/admin/comms/new?start=event',
            title: 'Invite people to an event',
            line: 'Starts from the event’s date, venue and link.',
            icon: <CalendarPlus className="size-5" />,
          },
        ]
      : []),
    ...(pack.features.news
      ? [
          {
            href: '/admin/comms/new?start=story',
            title: 'Share a story',
            line: 'Starts from a published story and its link.',
            icon: <Newspaper className="size-5" />,
          },
        ]
      : []),
    {
      href: '/admin/comms/new',
      title: 'Write to a group',
      line: 'Pick who by branch, batch, city or availability.',
      icon: <PenLine className="size-5" />,
    },
    {
      href: '/admin/comms/new?channel=whatsapp-draft',
      title: 'Draft for WhatsApp groups',
      line: 'Copy-ready text and a link to post in batch groups.',
      icon: <MessageCircle className="size-5" />,
      tone: 'accent',
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Engagement"
        title="Messages"
        description="Write to alumni and students, and see what went out."
        meta={
          <>
            <p className="text-sm text-secondary">
              {scopeLine} · <span className="tabular">{reach}</span>
            </p>
            <TrustChip icon={<Lock />}>No role reads private messages</TrustChip>
          </>
        }
        actions={
          <ButtonLink href="/admin/comms/new">
            <PenLine className="size-4" aria-hidden="true" />
            New message
          </ButtonLink>
        }
      />

      <section aria-labelledby="start-heading" className="space-y-3">
        <h2 id="start-heading" className="text-sm font-semibold text-secondary">
          Start a message
        </h2>
        <ul className={cn('grid gap-3 sm:grid-cols-2', starts.length > 3 && 'xl:grid-cols-4')}>
          {starts.map((s) => (
            <li key={s.href} className="min-w-0">
              <Link
                href={s.href}
                className={cn(
                  'group flex h-full min-h-11 items-start gap-3 rounded-lg border border-line bg-surface-raised p-4 shadow-sm',
                  'transition-colors duration-fast ease-brand hover:border-line-strong',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-full',
                    s.tone === 'accent' ? 'bg-accent-soft text-accent-soft-fg' : 'bg-brand-soft text-brand-soft-fg',
                  )}
                >
                  {s.icon}
                </span>
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="block font-semibold text-primary">{s.title}</span>
                  <span className="block text-sm text-secondary">{s.line}</span>
                </span>
                <ChevronRight
                  className="mt-0.5 size-4 shrink-0 text-muted transition-transform duration-fast ease-brand group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="channels-heading" className="space-y-3">
        <h2 id="channels-heading" className="text-sm font-semibold text-secondary">
          Channels
        </h2>
        <div className="grid gap-3 md:grid-cols-2 md:items-start">
          <div className="rounded-lg border border-line bg-surface-raised p-4">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              <MessageCircle className="size-4 text-muted" aria-hidden="true" />
              WhatsApp
              {whatsapp ? (
                <Badge tone="success" dot>
                  Switched on
                </Badge>
              ) : (
                <Badge tone="neutral">Not set up yet</Badge>
              )}
            </p>
            {whatsapp ? (
              <p className="mt-1.5 text-sm text-secondary">Where alumni read. Choose it first in the composer.</p>
            ) : (
              <>
                <p className="mt-1.5 text-sm text-secondary">Where alumni read. Three things switch it on:</p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {['A WhatsApp Business provider account', 'A sender name for the college', 'The first message template approved'].map(
                    (item) => (
                      <li key={item} className="flex items-center gap-2 text-primary">
                        <Circle className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                        {item}
                      </li>
                    ),
                  )}
                </ul>
                <p className="mt-3 text-sm text-secondary">
                  Until then,{' '}
                  <Link href="/admin/comms/new?channel=whatsapp-draft" className="link">
                    draft a message for WhatsApp groups
                  </Link>
                  .
                </p>
              </>
            )}
          </div>

          <div className="rounded-lg border border-line bg-surface-raised p-4">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              <Mail className="size-4 text-muted" aria-hidden="true" />
              Email
              <Badge tone="neutral">From the portal</Badge>
            </p>
            <p className="mt-1.5 text-sm text-secondary">
              Queued for each member at the address they sign in with.
            </p>
          </div>
        </div>
      </section>

      <Section title="Sent">
        {!canReadAudit ? (
          <p className="text-sm text-secondary">The college admin keeps the full send history.</p>
        ) : sends.length === 0 ? (
          <EmptyState
            variant="inline"
            title="Nothing has been sent yet."
            description="Each message you send is listed here."
          />
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {sends.map((s) => (
                <li key={s.id}>
                  <SentRow send={s} timing={timing} />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </Section>
    </div>
  );
}

function SentRow({ send, timing }: { send: SentMessage; timing: { locale: string; timeZone: string } }) {
  const Icon = send.channel === 'whatsapp' ? MessageCircle : Mail;
  // A send that kept only its subject and count says everything in this
  // row; it opens a page of its own only when there is more to read.
  const hasDetail = Boolean(send.bodyPreview || send.audience);
  const content = (
    <>
      <span
        className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-sunken text-secondary"
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-primary">{send.subject}</span>
        <span className="block truncate text-sm text-secondary">
          <span className="sr-only">{send.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}, </span>
          {memberLine([send.audience, send.sender, formatDate(send.sentAt, timing)])}
        </span>
      </span>
      {send.recipients !== null ? (
        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold tabular text-primary">
            {send.recipients.toLocaleString('en-IN')}
          </span>
          <span className="block text-xs text-secondary">recipients</span>
        </span>
      ) : null}
    </>
  );
  if (!hasDetail) return <div className="flex min-h-11 items-center gap-3 px-4 py-3">{content}</div>;
  return (
    <Link
      href={`/admin/comms/${send.id}`}
      className="group flex min-h-11 items-center gap-3 px-4 py-3 transition-colors duration-fast ease-brand hover:bg-surface-sunken"
    >
      {content}
      <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
    </Link>
  );
}
