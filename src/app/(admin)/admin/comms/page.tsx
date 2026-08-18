import { redirect, notFound } from 'next/navigation';
import { Megaphone, Mail, MessageCircle, Users, ShieldCheck, Lock, PenLine } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { searchDirectory, getAuditLog, getDepartments } from '@/lib/data/repo';
import {
  PageHeader,
  Section,
  Alert,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Stat,
  ButtonLink,
  EmptyState,
  Separator,
  TableWrap,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  DefinitionCard,
} from '@/components/ui';
import { formatDate, formatRelative, memberLine } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/navigation';

export const metadata = { title: 'Communications' };

/** Recipient counts live in the audit reason: "Reunion invite — 8,142 recipients". */
function parseSend(reason: string | null): { subject: string; recipients: number | null } {
  if (!reason) return { subject: 'Untitled send', recipients: null };
  const m = /^(.*?)\s*[—-]\s*([\d,]+)\s*recipients?$/i.exec(reason.trim());
  if (!m) return { subject: reason, recipients: null };
  return { subject: m[1]!.trim(), recipients: Number(m[2]!.replace(/,/g, '')) };
}

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
  const sends = canReadAudit ? getAuditLog({ action: 'comms.send', limit: 12 }) : [];
  const whatsapp = pack.features.whatsapp;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Communications"
        description="Broadcasts to a segment of the directory. Everything here is one-to-many and on the record — private member-to-member messages are not readable from this console, by anyone, deliberately."
        actions={
          <ButtonLink href="/admin/comms/new">
            <PenLine className="size-4" aria-hidden="true" />
            New message
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Addressable to you"
          value={reachable.total.toLocaleString('en-IN')}
          hint={
            tier === 'department'
              ? `${myDepartment ?? 'Your branch'} only`
              : can(session, 'directory.search.students')
                ? 'Alumni and students in the directory'
                : 'Alumni only — students are outside your directory scope'
          }
          icon={<Users className="size-4" />}
        />
        <Stat
          label="Your tier"
          value={`comms.send.${tier}`}
          hint={
            tier === 'all'
              ? 'The whole list, unfiltered'
              : tier === 'segment'
                ? 'Any filtered segment'
                : 'Your branch only'
          }
          icon={<Megaphone className="size-4" />}
        />
        <Stat
          label="Channels live"
          value={whatsapp ? '2 of 2' : '1 of 2'}
          hint={whatsapp ? 'Email and WhatsApp' : 'Email only — WhatsApp is not connected'}
          icon={<Mail className="size-4" />}
        />
        <Stat
          label="Sends on record"
          value={canReadAudit ? sends.length : '—'}
          hint={canReadAudit ? 'From the audit log' : 'Needs audit.read'}
          icon={<ShieldCheck className="size-4" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="min-w-0 space-y-1">
              <CardTitle as="h2">Who you may address</CardTitle>
              <CardDescription>
                Three capabilities, three sizes of audience. They are not preferences — the composer will not offer
                you an audience your tier does not cover.
              </CardDescription>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <TierRow
              name="comms.send.department"
              held={tier === 'department'}
              covered={department}
              title="One branch"
              body={
                myDepartmentName
                  ? `${myDepartmentName} only. An HOD writes to their own students and their own alumni; every other branch is out of reach from this console.`
                  : 'A single branch. Held by an HOD, scoped to the department on their role grant.'
              }
            />
            <Separator />
            <TierRow
              name="comms.send.segment"
              held={tier === 'segment'}
              covered={segment}
              title="Any filtered segment"
              body="A batch range, a city, a branch, people open to mentoring — any combination that narrows the list. What it cannot do is address everybody at once; a segment with no filters is refused."
            />
            <Separator />
            <TierRow
              name="comms.send.all"
              held={tier === 'all'}
              covered={all}
              title="The entire list"
              body="Reserved for the college admin. The confirmation asks you to type the recipient count before it will send, because there is no recall."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="min-w-0 space-y-1">
              <CardTitle as="h2">Channels</CardTitle>
              <CardDescription>What a message can actually travel on today.</CardDescription>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-line bg-surface p-4">
              <Mail className="mt-0.5 size-5 shrink-0 text-brand-fg" aria-hidden="true" />
              <div className="min-w-0 space-y-1">
                <p className="flex items-center gap-2 font-semibold">
                  Email
                  <Badge tone="success" dot>
                    Available
                  </Badge>
                </p>
                <p className="text-sm text-secondary">
                  Delivered through the transactional provider with bounce webhooks wired, so an address that stops
                  working is marked rather than retried forever.
                </p>
              </div>
            </div>

            <div
              className={
                whatsapp
                  ? 'flex items-start gap-3 rounded-lg border border-line bg-surface p-4'
                  : 'flex items-start gap-3 rounded-lg border border-dashed border-line bg-surface-sunken p-4'
              }
            >
              <MessageCircle className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden="true" />
              <div className="min-w-0 space-y-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  WhatsApp
                  {whatsapp ? (
                    <Badge tone="success" dot>
                      Available
                    </Badge>
                  ) : (
                    <Badge tone="neutral">
                      <Lock className="size-3" aria-hidden="true" />
                      Not connected
                    </Badge>
                  )}
                </p>
                {whatsapp ? (
                  <p className="text-sm text-secondary">
                    Template messages through the WhatsApp Business API. Templates must be approved by Meta before a
                    send, so a new message type is not same-day.
                  </p>
                ) : (
                  <p className="text-sm text-secondary">
                    Needs a WhatsApp Business API provider account for the college and an approved message template.
                    Until then the option is off — not hidden, because the reason it is off is a procurement decision
                    somebody has to make, not a bug.
                  </p>
                )}
              </div>
            </div>

            <Alert tone="warning" title="Why WhatsApp is in this design at all">
              <p>
                Email open rates on Indian alumni lists are poor — a college mail to a ten-year-old personal address
                is usually never seen. WhatsApp is the channel this audience actually reads, which is why the flows
                are designed around it and why email alone is treated as a fallback, not a plan.
              </p>
            </Alert>
          </CardBody>
        </Card>
      </div>

      <Section
        title="Sent"
        description="Every broadcast writes an audit entry with the actor, the segment and the recipient count. That entry is the record — there is no separate sent-items folder to disagree with it."
      >
        {!canReadAudit ? (
          <Card>
            <CardBody className="space-y-2">
              <p className="font-display text-lg font-semibold">The send history is in the audit log</p>
              <p className="max-w-prose text-sm text-secondary">
                Reading it needs <code className="font-mono text-xs">audit.read</code>, which your roles do not
                include. Your own sends are still recorded there in full — actor, segment, channel and recipient
                count — and the college admin or finance can produce them on request.
              </p>
            </CardBody>
          </Card>
        ) : sends.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="size-5" />}
            title="Nothing has been sent yet"
            description="The first broadcast writes the first audit entry. Until then there is genuinely nothing to show — an empty list here means an empty inbox out there."
          />
        ) : (
          <>
            <TableWrap caption="Broadcasts recorded in the audit log" className="hidden sm:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Sent</TH>
                    <TH>Subject</TH>
                    <TH>Sent by</TH>
                    <TH align="right">Recipients</TH>
                    <TH>Audit ref</TH>
                  </TR>
                </THead>
                <TBody>
                  {sends.map((entry) => {
                    const { subject, recipients } = parseSend(entry.reason);
                    return (
                      <TR key={entry.id} interactive>
                        <TD>
                          <p className="text-sm">{formatDate(entry.createdAt)}</p>
                          <p className="text-xs text-muted">{formatRelative(entry.createdAt)}</p>
                        </TD>
                        <TD>
                          <p className="font-medium">{subject}</p>
                          <p className="text-xs text-secondary">Email</p>
                        </TD>
                        <TD>
                          <p className="text-sm">{entry.actorName ?? 'System'}</p>
                          <p className="text-xs text-muted">
                            {entry.actorRole ? (ROLE_LABELS[entry.actorRole] ?? entry.actorRole) : '—'}
                          </p>
                        </TD>
                        <TD numeric>{recipients !== null ? recipients.toLocaleString('en-IN') : '—'}</TD>
                        <TD>
                          <span className="font-mono text-xs text-muted">{entry.id}</span>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableWrap>

            <div className="space-y-3 sm:hidden">
              {sends.map((entry) => {
                const { subject, recipients } = parseSend(entry.reason);
                return (
                  <DefinitionCard
                    key={entry.id}
                    title={subject}
                    subtitle={memberLine([entry.actorName, formatDate(entry.createdAt)])}
                    rows={[
                      { label: 'Channel', value: 'Email' },
                      {
                        label: 'Recipients',
                        value: recipients !== null ? recipients.toLocaleString('en-IN') : '—',
                      },
                      { label: 'Audit ref', value: <span className="font-mono text-xs">{entry.id}</span> },
                    ]}
                  />
                );
              })}
            </div>
          </>
        )}
      </Section>

      <Alert tone="neutral" title="What this console cannot do" icon={<Lock className="size-4" />}>
        <p>
          There is no way to open a private message between two members from here, and no capability that would
          grant it. Mentorship conversations are the reason alumni answer a student at all; a console that could read
          them would end that on the day somebody found out.
        </p>
      </Alert>
    </div>
  );
}

function TierRow({
  name,
  title,
  body,
  held,
  covered,
}: {
  name: string;
  title: string;
  body: string;
  held: boolean;
  covered: boolean;
}) {
  return (
    <div className={held ? 'space-y-1.5' : 'space-y-1.5 opacity-70'}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{title}</p>
        {held ? (
          <Badge tone="brand" dot>
            You hold this
          </Badge>
        ) : covered ? (
          <Badge tone="neutral">Also granted</Badge>
        ) : (
          <Badge tone="outline">Not granted</Badge>
        )}
      </div>
      <p className="font-mono text-xs text-muted">{name}</p>
      <p className="max-w-prose text-sm text-secondary">{body}</p>
    </div>
  );
}
