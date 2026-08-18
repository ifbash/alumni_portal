import { notFound, redirect } from 'next/navigation';
import {
  BarChartBig,
  Lock,
  Mail,
  Megaphone,
  MessageCircle,
  ScrollText,
  ShieldCheck,
  TriangleAlert,
  Users,
} from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { roleHas, type Role } from '@/lib/auth/permissions';
import { getTenantBrand } from '@/lib/tenant';
import { getAuditLog } from '@/lib/data/repo';
import { ROLE_LABELS } from '@/lib/navigation';
import { formatDate, formatDateTime, formatRelative } from '@/lib/format';
import {
  Alert,
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  DetailRow,
  PageHeader,
  Separator,
} from '@/components/ui';

/**
 * One campaign.
 *
 * There is no campaigns table. A broadcast leaves exactly one durable
 * trace — the `comms.send` row in the audit log — and this page is that
 * row read back as a message: who addressed whom, with what, when, under
 * which capability. Building a second record that could disagree with the
 * audit entry would mean two answers to "what went out", and the wrong one
 * would be the one somebody quotes.
 *
 * The delivery panel is the point of the screen. Bounce webhooks are not
 * wired to a provider yet, so delivered/opened/bounced are not merely
 * missing — they are unknowable from here, and the page says so instead of
 * rendering a plausible percentage.
 */

export const metadata = { title: 'Campaign' };

// ---------------------------------------------------------------
// Reading a send out of its audit entry
// ---------------------------------------------------------------

/**
 * Recipient counts live in the audit reason: "Reunion invite — 8,142
 * recipients". Same parse as the list, kept local to the two routes that
 * need it rather than pushed into `src/lib` for two callers.
 */
function parseSend(reason: string | null): { subject: string; recipients: number | null } {
  if (!reason) return { subject: 'Untitled send', recipients: null };
  const m = /^(.*?)\s*[—-]\s*([\d,]+)\s*recipients?$/i.exec(reason.trim());
  if (!m) return { subject: reason, recipients: null };
  return { subject: m[1]!.trim(), recipients: Number(m[2]!.replace(/,/g, '')) };
}

/**
 * The message bodies this tenant has actually sent.
 *
 * Fixture mode has no message store, so the copy lives beside the screen
 * that renders it, keyed on the subject the audit entry carries. A body
 * that is not held is drawn as absent rather than filled in with
 * something — on a page whose whole argument is that invented figures are
 * worse than blanks, an invented message body would be the worst of them.
 */
const SENT_BODIES: Record<string, string> = {
  'reunion invite':
    'Dear {{first_name}},\n\n' +
    'The Annual Alumni Meet is on Saturday 24 September, on campus at Ganguru.\n\n' +
    'The day runs from 9:30am. Department sessions in the morning, the general body meeting after lunch, and the cultural evening in the open-air auditorium from 6pm.\n\n' +
    'Tables are organised by year of passing. If your batch has a coordinator, they will have your table number at the registration desk; if it does not, tell us and we will make one of you responsible for it.\n\n' +
    'Registration is ₹500 and covers one lunch. Additional guests can be added when you register, and registration closes on 15 September.\n\n' +
    'Alumni Cell',
};

type Tier = 'all' | 'segment' | 'department';

const TIER_AUDIENCE: Record<Tier, { label: string; body: string }> = {
  all: {
    label: 'The entire verified list',
    body: 'Everybody the directory holds — alumni and students, every branch, every batch. The confirmation asks the sender to type the recipient count before it will go, because there is no recall.',
  },
  segment: {
    label: 'A filtered slice of the list',
    body: 'A batch range, a branch, a city, people who have said they are open to mentoring — any combination that narrows the list. A segment with no filters at all is refused; that is what separates this grant from the one above it.',
  },
  department: {
    label: 'One branch',
    body: 'The branch on the sender’s role grant, and nothing else. An HOD writes to their own students and their own alumni; every other branch is out of reach from the composer, not merely hidden in it.',
  },
};

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

// ---------------------------------------------------------------
// Page
// ---------------------------------------------------------------

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const pack = resolved.brand.pack;

  // Same gate as the communications console: three capabilities, any one of
  // which puts a person in this module. `requireCap` names the narrowest so
  // the 403 says something useful.
  const all = can(session, 'comms.send.all');
  const segment = can(session, 'comms.send.segment');
  const department = can(session, 'comms.send.department');
  if (!all && !segment && !department) requireCap(session, 'comms.send.department');

  /**
   * The send record is an audit row, so reading one needs `audit.read` —
   * which an HOD does not hold, and which the console already tells them.
   * The answer is 404 rather than 403 on purpose: a 403 for the right id
   * and a 404 for a wrong one is a way to enumerate what was sent.
   */
  if (!can(session, 'audit.read')) notFound();

  const { id } = await params;
  const entry = getAuditLog({ action: 'comms.send', limit: 10000 }).find(
    (e) => e.id === id || e.resourceId === id,
  );
  if (!entry) notFound();

  const { subject, recipients } = parseSend(entry.reason);
  const body = SENT_BODIES[subject.trim().toLowerCase()] ?? null;

  const roleLabel = entry.actorRole ? (ROLE_LABELS[entry.actorRole] ?? entry.actorRole) : null;
  const tier = tierForRole(entry.actorRole);
  const audience = tier ? TIER_AUDIENCE[tier] : null;

  const whatsapp = pack.features.whatsapp;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Console', href: '/admin' },
              { label: 'Communications', href: '/admin/comms' },
              { label: subject },
            ]}
          />
        }
        eyebrow="Campaign"
        title={subject}
        description={`Sent by ${entry.actorName ?? 'an unattributed account'} on ${formatDate(entry.createdAt)}. Everything below is read back from the one audit entry the send wrote — there is no separate sent-items folder that could disagree with it.`}
        actions={
          <>
            <ButtonLink href={`/admin/audit/${entry.id}`} variant="secondary">
              <ScrollText className="size-4" aria-hidden="true" />
              Open the audit entry
            </ButtonLink>
            <ButtonLink href="/admin/comms" variant="ghost">
              Back to communications
            </ButtonLink>
          </>
        }
      />

      {tier === null ? (
        <Alert
          tone="danger"
          title="The role recorded on this send carries no comms capability"
          icon={<TriangleAlert className="size-4" />}
        >
          <p>
            The entry is stamped <strong>{roleLabel ?? 'no role'}</strong>, and the capability matrix grants that role
            none of <span className="font-mono text-xs">comms.send.department</span>,{' '}
            <span className="font-mono text-xs">comms.send.segment</span> or{' '}
            <span className="font-mono text-xs">comms.send.all</span>. The log records one role per entry while a
            person may hold several, so the innocent reading is that {entry.actorName ?? 'the sender'} also held a role
            that did. Confirm it against the role grants before you treat it as anything else.
          </p>
        </Alert>
      ) : null}

      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
        {/* ---------------------------------------------------------------
            Main column
           --------------------------------------------------------------- */}
        <div className="space-y-6">
          {/* Audience */}
          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">Who it went to</CardTitle>
                <CardDescription>
                  The count was computed on the server at send time, through the directory, with the sender&rsquo;s own
                  scope applied. It is a snapshot of that moment and is not recomputed here — the directory has moved
                  since, and a number that quietly changed after the fact would be worse than no number.
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-line bg-surface-sunken p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-secondary">Recipients addressed</p>
                  <p className="font-display text-display-xs font-bold tabular">
                    {recipients !== null ? recipients.toLocaleString('en-IN') : 'Not recorded'}
                  </p>
                </div>
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <Users className="size-4" aria-hidden="true" />
                  {recipients !== null
                    ? 'Verified members with a usable address at the moment of the send'
                    : 'The reason line on this entry does not carry a count'}
                </p>
              </div>

              <dl className="divide-y divide-line">
                <DetailRow label="Segment">
                  {audience ? (
                    <span className="space-y-1">
                      <span className="block">{audience.label}</span>
                      <span className="block text-xs font-normal text-secondary">{audience.body}</span>
                    </span>
                  ) : (
                    <span className="font-normal text-muted">
                      Not derivable — the role on this entry carries no send capability to read a scope from.
                    </span>
                  )}
                </DetailRow>
                <DetailRow label="Sent under">
                  {tier ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs">comms.send.{tier}</span>
                      <Badge tone="brand">{roleLabel ?? 'Role not recorded'}</Badge>
                    </span>
                  ) : (
                    <span className="font-normal text-muted">No comms capability on the recorded role</span>
                  )}
                </DetailRow>
                <DetailRow label="Filters named on the entry">
                  <span className="font-normal text-secondary">
                    None. The reason line carries the subject and the count; the filter set that produced the count is
                    not written out field by field, so the segment above is the widest audience that grant covers, not
                    a replay of what the sender ticked.
                  </span>
                </DetailRow>
                <DetailRow label="Excluded, always">
                  <span className="font-normal text-secondary">
                    Unverified accounts and unclaimed degree-register rows. The register carries no contact details, so
                    a graduate who has never signed up is not addressable from the composer at any tier.
                  </span>
                </DetailRow>
              </dl>
            </CardBody>
          </Card>

          {/* The message */}
          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">The message as sent</CardTitle>
                <CardDescription>
                  Stored form, not a re-render. Merge fields are shown exactly as they were typed; each recipient got
                  their own name substituted at dispatch.
                </CardDescription>
              </div>
              <Badge tone="neutral">
                <Mail className="size-3.5" aria-hidden="true" />
                Email
              </Badge>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
                <dl className="space-y-1 border-b border-line pb-3 text-xs">
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-muted">From</dt>
                    <dd className="min-w-0 font-medium">
                      {pack.copy.portalName}
                      {pack.copy.supportEmail ? (
                        <span className="text-muted"> &lt;{pack.copy.supportEmail}&gt;</span>
                      ) : null}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-muted">To</dt>
                    <dd className="min-w-0 font-medium">
                      {recipients !== null
                        ? `${recipients.toLocaleString('en-IN')} recipients, individually addressed`
                        : 'Recipient list not recorded on this entry'}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-muted">Channel</dt>
                    <dd className="min-w-0 font-medium">Email</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-muted">Sent</dt>
                    <dd className="min-w-0 font-medium tabular">{formatDateTime(entry.createdAt)}</dd>
                  </div>
                </dl>

                <p className="font-display text-md font-semibold">{subject}</p>

                {body ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-secondary">{body}</p>
                ) : (
                  <div className="rounded border border-dashed border-line bg-surface-sunken p-3">
                    <p className="text-sm font-semibold">The body is not held against this entry</p>
                    <p className="mt-1 text-sm text-secondary">
                      An audit row records that a send happened — actor, subject, segment, count. The text itself lives
                      with the campaign, and for this send there is no campaign record to read it from. The subject
                      above is the whole of what survives, and inventing the rest of it here would make this screen a
                      worse record than the log it is drawn from.
                    </p>
                  </div>
                )}

                <p className="border-t border-line pt-3 text-xs text-muted">
                  {pack.copy.institutionName} · You are receiving this because you are on the alumni register. Every
                  message carries an unsubscribe link; consent withdrawal is recorded against the member&rsquo;s
                  profile in <span className="font-mono">consent_records</span>, append-only, with the notice version.
                </p>
              </div>

              <p className="flex items-start gap-2 text-xs text-secondary">
                <MessageCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {whatsapp
                    ? 'WhatsApp is connected for this tenant. A WhatsApp send records the approved template name where the subject sits above, because Meta approves the template and not the words typed on the day.'
                    : 'WhatsApp is not connected for this tenant, so every entry in this log is an email send. That matters more than it sounds: email open rates on a ten-year-old personal address are poor, and WhatsApp is the channel this audience actually reads.'}
                </span>
              </p>
            </CardBody>
          </Card>

          {/* Delivery — the refusal */}
          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">Delivery</CardTitle>
                <CardDescription>
                  What is known about what happened after the send, stated at the accuracy it is actually known to.
                </CardDescription>
              </div>
              <Badge tone="warning">
                <BarChartBig className="size-3.5" aria-hidden="true" />
                Not measured
              </Badge>
            </CardHeader>
            <CardBody className="space-y-5">
              <Alert tone="warning" title="No delivery figure on this page is real, because none of them exists yet">
                <p>
                  The email provider is not connected and its bounce webhook is not wired — both are open items on the
                  backlog, not settings somebody forgot to switch on. Until that webhook is receiving events, nothing
                  in this product knows whether a single one of these messages arrived.
                </p>
              </Alert>

              <dl className="divide-y divide-line">
                <DetailRow label="Queued">
                  <span className="tabular">
                    {recipients !== null ? recipients.toLocaleString('en-IN') : '—'}
                  </span>
                  <span className="ml-2 font-normal text-secondary">
                    The only figure on this screen the log can evidence
                  </span>
                </DetailRow>
                <DetailRow label="Delivered">
                  <span className="font-normal text-muted">
                    Not known. Delivery is asserted by the provider, and there is no provider.
                  </span>
                </DetailRow>
                <DetailRow label="Opened">
                  <span className="font-normal text-muted">
                    Not measured. Open tracking is a one-pixel image loaded from a member&rsquo;s inbox, which is
                    processing that needs a purpose and a notice before it is switched on — not a default.
                  </span>
                </DetailRow>
                <DetailRow label="Bounced">
                  <span className="font-normal text-muted">
                    Not captured. Nothing is marking dead addresses, so this list keeps every one of them.
                  </span>
                </DetailRow>
                <DetailRow label="Unsubscribed">
                  <span className="font-normal text-muted">
                    Not captured against this send. Withdrawals recorded through a member&rsquo;s own privacy settings
                    are honoured, and they are the only ones the portal currently sees.
                  </span>
                </DetailRow>
              </dl>

              <Separator label="Why this is blank rather than filled in" />

              <div className="max-w-prose space-y-3 text-sm text-secondary">
                <p>
                  An open rate is the number a college quotes at a governing-body meeting. Rendering{' '}
                  <span className="font-semibold text-primary">34%</span> here because the layout has a slot for it
                  would put a fabricated figure into a minute book, and nobody reading the minute would ever learn it
                  was fabricated. A blank is recoverable; a quoted number is not.
                </p>
                <p>
                  The missing piece is small and specific. The provider posts bounce, complaint and delivery events to
                  a webhook; each event marks the address on the member record; a hard bounce takes that address out of
                  every subsequent segment. That is why the stack notes bounce webhooks as{' '}
                  <span className="font-semibold text-primary">required, not optional</span> — without them a dead
                  address is retried on every campaign for years, the sending domain&rsquo;s reputation falls, and the
                  mail that does matter stops arriving for everybody else.
                </p>
                <p>
                  Until then the honest report on a campaign is one line: it was queued for{' '}
                  {recipients !== null ? recipients.toLocaleString('en-IN') : 'the recorded'} recipients, by a named
                  person, at a recorded time.
                </p>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ---------------------------------------------------------------
            Aside
           --------------------------------------------------------------- */}
        <aside className="space-y-6">
          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h2">Dispatch record</CardTitle>
              <CardDescription>
                The audit row itself. Append-only — it cannot be edited or deleted at any role.
              </CardDescription>
            </CardHeader>
            <CardBody className="pt-4">
              <dl className="divide-y divide-line">
                <DetailRow label="Sent by">{entry.actorName ?? 'Unattributed'}</DetailRow>
                <DetailRow label="Role recorded">
                  {roleLabel ? (
                    <span className="flex flex-wrap items-center gap-2">
                      {roleLabel}
                      {tier === null ? <Badge tone="danger">No comms grant</Badge> : null}
                    </span>
                  ) : (
                    <span className="font-normal text-muted">None</span>
                  )}
                </DetailRow>
                <DetailRow label="When">
                  <span className="tabular">{formatDateTime(entry.createdAt)}</span>
                  <span className="block text-xs font-normal text-muted">{formatRelative(entry.createdAt)}</span>
                </DetailRow>
                <DetailRow label="Action">
                  <span className="font-mono text-xs">{entry.action}</span>
                </DetailRow>
                <DetailRow label="Audit reference">
                  <span className="font-mono text-xs">{entry.id}</span>
                </DetailRow>
                <DetailRow label="Campaign id">
                  <span className="font-mono text-xs">{entry.resourceId ?? 'not recorded'}</span>
                </DetailRow>
                <DetailRow label="From">
                  <span className="font-mono text-xs">{entry.ip ?? '—'}</span>
                </DetailRow>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Megaphone className="size-4 text-brand-fg" aria-hidden="true" />
                A broadcast, not a conversation
              </p>
              <Separator />
              <p className="text-sm text-secondary">
                This message went out one-to-many, over the college&rsquo;s name, and it is on the record because of
                that. Replies go to the alumni cell inbox and are answered there.
              </p>
              <p className="text-sm text-secondary">
                A private message between two members is a different thing entirely, and no screen in this console can
                open one. There is no capability that would grant it — deliberately. Mentorship conversations are the
                reason an alumnus answers a student at all, and a console that could read them would end that on the
                day somebody found out it existed.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="size-4 text-brand-fg" aria-hidden="true" />
                What this entry does not carry
              </p>
              <Separator />
              <p className="text-sm text-secondary">
                No recipient list, no addresses, no per-person result. An audit row records that an action touched a
                resource; it never becomes a second copy of the contact data, because an audit log that quietly does
                that is a second breach waiting for the same incident.
              </p>
              <p className="flex items-start gap-2 text-xs text-secondary">
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Reading this page needs <span className="font-mono">audit.read</span>. Sending needs one of the three{' '}
                  <span className="font-mono">comms.send.*</span> grants. They are separate on purpose: the person who
                  writes to eight thousand graduates and the person who audits what was written should be able to be
                  two different people.
                </span>
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
