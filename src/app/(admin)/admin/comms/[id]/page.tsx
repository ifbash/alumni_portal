import { notFound, redirect } from 'next/navigation';
import { Mail, MessageCircle, ScrollText, Send } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { roleHas, type Role } from '@/lib/auth/permissions';
import { getTenantBrand } from '@/lib/tenant';
import { getAuditLog } from '@/lib/data/repo';
import { ROLE_LABELS } from '@/lib/navigation';
import { formatDateTime, formatRelative, memberLine } from '@/lib/format';
import { Logo, LogoMark } from '@/components/brand/Logo';
import {
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DetailRow,
  PageHeader,
} from '@/components/ui';
import { findTierSend, readSend, segmentQuery } from '../sent';

/**
 * One sent message.
 *
 * There is no messages table. A broadcast leaves exactly one durable
 * trace — its audit entry — and this page is that entry read back as a
 * message: who wrote to whom, on which channel, when, and how many.
 * Delivery figures are not shown at all rather than estimated.
 */

export const metadata = { title: 'Message · Staff console' };

type Tier = 'all' | 'segment' | 'department';

/**
 * Which of the three send grants the recorded role carries.
 *
 * Read out of the capability matrix rather than stored on the entry, so a
 * grant that is narrowed later reads correctly against old sends instead
 * of preserving a claim the matrix no longer makes.
 */
function tierForRole(role: Role | null): Tier | null {
  if (!role) return null;
  if (roleHas(role, 'comms.send.all')) return 'all';
  if (roleHas(role, 'comms.send.segment')) return 'segment';
  if (roleHas(role, 'comms.send.department')) return 'department';
  return null;
}

export default async function SentMessagePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const pack = resolved.brand.pack;

  // Same gate as the messages console: three capabilities, any one of
  // which puts a person in this module. `requireCap` names the narrowest so
  // the 403 says something useful.
  const all = can(session, 'comms.send.all');
  const segment = can(session, 'comms.send.segment');
  const department = can(session, 'comms.send.department');
  if (!all && !segment && !department) requireCap(session, 'comms.send.department');

  /**
   * The send record is an audit row, so reading one needs `audit.read`.
   * The answer is 404 rather than 403 on purpose: a 403 for the right id
   * and a 404 for a wrong one is a way to enumerate what was sent.
   */
  if (!can(session, 'audit.read')) notFound();

  const { id } = await params;
  const entry =
    getAuditLog({ action: 'comms.send', limit: 10000 }).find((e) => e.id === id || e.resourceId === id) ??
    // Sends written by the composer's API carry their tier in the action.
    findTierSend(id);
  if (!entry) notFound();

  const send = readSend(entry);
  const roleLabel = entry.actorRole ? (ROLE_LABELS[entry.actorRole] ?? entry.actorRole) : null;
  const tier = tierForRole(entry.actorRole);
  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };

  const whatsapp = send.channel === 'whatsapp';
  const ChannelIcon = whatsapp ? MessageCircle : Mail;
  const channelLabel = whatsapp ? 'WhatsApp' : 'Email';
  const recipients = send.recipients !== null ? send.recipients.toLocaleString('en-IN') : null;
  const body = send.bodyPreview ? `${send.bodyPreview}${send.bodyTruncated ? '…' : ''}` : null;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Staff console', href: '/admin' },
              { label: 'Messages', href: '/admin/comms' },
              { label: send.subject },
            ]}
          />
        }
        eyebrow="Messages"
        title={send.subject}
        meta={
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-secondary">
            <Badge tone="neutral">
              <ChannelIcon className="size-3.5" aria-hidden="true" />
              {channelLabel}
            </Badge>
            <span>
              {memberLine([
                send.audience,
                recipients ? `${recipients} recipients` : null,
                send.sender,
                formatDateTime(send.sentAt, timing),
              ])}
            </span>
          </p>
        }
        actions={
          <>
            <ButtonLink href={`/admin/audit/${entry.id}`} variant="secondary">
              <ScrollText className="size-4" aria-hidden="true" />
              Open audit entry
            </ButtonLink>
            <ButtonLink href={`/admin/comms/new${segmentQuery(send.segment)}`}>
              <Send className="size-4" aria-hidden="true" />
              Send a follow-up
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2">The message</CardTitle>
            </CardHeader>
            <CardBody>
              {whatsapp ? (
                <div className="rounded-lg bg-surface-sunken p-4">
                  <div className="flex items-start gap-2.5">
                    <LogoMark pack={pack} size={32} className="shrink-0" />
                    <div className="min-w-0 max-w-md space-y-1.5 rounded-lg rounded-tl-none border border-line bg-surface-raised p-3 text-sm shadow-sm">
                      <p className="text-xs font-semibold text-brand-fg">{pack.copy.portalName}</p>
                      {body ? (
                        <p className="whitespace-pre-line leading-relaxed text-primary">{body}</p>
                      ) : (
                        <p className="text-secondary">Only the template name and the count were kept.</p>
                      )}
                      <p className="text-xs text-secondary">Template: {send.subject}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-line bg-surface">
                  <div className="border-b border-line bg-surface-raised px-4 py-3">
                    <Logo pack={pack} height={24} />
                  </div>
                  <div className="space-y-3 p-4">
                    <p className="font-display text-md font-semibold">{send.subject}</p>
                    {body ? (
                      <p className="whitespace-pre-line text-sm leading-relaxed text-secondary">{body}</p>
                    ) : (
                      <p className="text-sm text-secondary">Only the subject and the count were kept.</p>
                    )}
                  </div>
                  <p className="border-t border-line px-4 py-3 text-xs text-secondary">{pack.copy.institutionName}</p>
                </div>
              )}
              {body && send.bodyTruncated ? (
                <p className="mt-2 text-xs text-secondary">The record keeps the opening of the message only.</p>
              ) : null}
            </CardBody>
          </Card>

        </div>

        <aside aria-label="Dispatch record" className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-md">
                Dispatch record
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-2">
              <dl className="divide-y divide-line">
                <DetailRow className="grid-cols-[6rem_1fr]" label="Sent by">{send.sender ?? 'Not recorded'}</DetailRow>
                <DetailRow className="grid-cols-[6rem_1fr]" label="Role">{roleLabel ?? 'Not recorded'}</DetailRow>
                <DetailRow className="grid-cols-[6rem_1fr]" label="When">
                  <span className="tabular">{formatDateTime(send.sentAt, timing)}</span>
                  <span className="block text-xs font-normal text-secondary">{formatRelative(send.sentAt, timing)}</span>
                </DetailRow>
                <DetailRow className="grid-cols-[6rem_1fr]" label="Channel">{channelLabel}</DetailRow>
                {send.audience ? (
                  <DetailRow className="grid-cols-[6rem_1fr]" label="Audience">
                    {send.audience}
                  </DetailRow>
                ) : null}
                {recipients ? (
                  <DetailRow className="grid-cols-[6rem_1fr]" label="Queued for">
                    <span className="tabular">{recipients} recipients</span>
                  </DetailRow>
                ) : null}
              </dl>
              {tier === null ? (
                <p className="mt-3 rounded border border-line bg-surface-sunken p-3 text-sm text-secondary">
                  The role on this record does not send messages. The sender may also hold a role that does.
                </p>
              ) : null}
            </CardBody>
          </Card>

          <p className="px-1 text-sm text-secondary">No role can read private messages between members.</p>
        </aside>
      </div>
    </div>
  );
}
