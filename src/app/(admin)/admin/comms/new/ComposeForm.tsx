'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  Circle,
  Eye,
  Mail,
  MessageCircle,
  Newspaper,
  PenLine,
  RotateCcw,
  Send,
  Users,
} from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  CopyButton,
  Field,
  Fieldset,
  Input,
  Progress,
  Radio,
  Select,
  Sheet,
  StickyActionBar,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';
import { cn } from '@/lib/cn';

/**
 * Messages composer: channel, who, message, review.
 *
 * WhatsApp comes first because that is where alumni read. While the
 * college has no WhatsApp Business account, the WhatsApp card offers a
 * draft for batch groups instead: copy-ready text and a link, sent from
 * the staff member's own phone. It sends nothing from here and carries no
 * member data.
 *
 * The recipient count is not estimated in the browser — every change to the
 * segment goes back through the directory on the server, with this viewer's
 * own scope applied, and the number that comes back is the number that will
 * be sent to. `POST /api/admin/comms` resolves the segment a second time at
 * the send, and the count it returns is the count that was used; if the two
 * disagree, the disagreement is stated.
 */

interface SendResult {
  channel: Channel;
  subject: string;
  /** The server's own resolution of the segment. The authority, not the estimate. */
  recipientCount: number;
  segmentLabel: string;
  senderTier: 'all' | 'segment' | 'department';
  sampleNames: string[];
  auditedAs: string;
  note: string;
}

export interface Segment {
  cohort: 'all' | 'alumni' | 'students';
  department: string;
  batchFrom: string;
  batchTo: string;
  city: string;
  availability: '' | 'mentoring' | 'referrals' | 'speaking';
}

/** A message to start from: an event invite, a thank-you, or a story. Written on the server. */
export interface StartingPoint {
  key: string;
  kind: 'event' | 'story';
  label: string;
  hint: string;
  subject: string;
  /** The email or WhatsApp body, with merge fields. */
  body: string;
  /** The text for a batch group: no merge fields, link included. */
  whatsapp: string;
}

type Channel = 'email' | 'whatsapp';
type Mode = 'send' | 'draft';
type StartKind = 'blank' | 'event' | 'story';

interface Option {
  value: string;
  label: string;
}

const SETUP = ['A WhatsApp Business provider account', 'A sender name for the college', 'The first message template approved'];

export function ComposeForm({
  tier,
  segment,
  lockedDepartment,
  lockedDepartmentName,
  recipientCount,
  scopeTotal,
  sampleNames,
  departmentOptions,
  cityOptions,
  batchYears,
  studentsAddressable,
  whatsappEnabled,
  portalName,
  institutionName,
  supportEmail,
  unclaimedRegisterRows,
  starts,
  initialStart,
  initialStartKey,
  initialMode,
  groupText,
  brandHeader,
  brandMark,
}: {
  tier: 'all' | 'segment' | 'department';
  segment: Segment;
  lockedDepartment: string | null;
  lockedDepartmentName: string | null;
  recipientCount: number;
  scopeTotal: number;
  sampleNames: string[];
  departmentOptions: Option[];
  cityOptions: Option[];
  batchYears: string[];
  studentsAddressable: boolean;
  whatsappEnabled: boolean;
  portalName: string;
  institutionName: string;
  supportEmail: string | null;
  unclaimedRegisterRows: number;
  starts: StartingPoint[];
  initialStart: StartKind;
  initialStartKey: string | null;
  initialMode: Mode;
  /** The general invitation for a group post, link included. */
  groupText: string;
  /** The college's logo, rendered on the server, for the email preview. */
  brandHeader: React.ReactNode;
  /** The college's mark, for the WhatsApp sender avatar. */
  brandMark: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();

  const initialPoint = starts.find((s) => s.key === initialStartKey) ?? null;

  const [mode, setMode] = React.useState<Mode>(initialMode);
  const [channel, setChannel] = React.useState<Channel>(whatsappEnabled ? 'whatsapp' : 'email');
  const [startKind, setStartKind] = React.useState<StartKind>(initialPoint?.kind ?? initialStart);
  const [pointKey, setPointKey] = React.useState(initialPoint?.key ?? '');
  const [subject, setSubject] = React.useState(initialPoint?.subject ?? '');
  const [body, setBody] = React.useState(initialPoint?.body ?? '');
  const [draft, setDraft] = React.useState(initialPoint?.whatsapp ?? groupText);
  const [touched, setTouched] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState<(SendResult & { persisted: boolean }) | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [refusal, setRefusal] = React.useState<string | null>(null);

  /**
   * The server keys its 422s by input name, and the segment's are nested
   * under `segment.`. Both spellings resolve to the control that caused
   * them, so a rejected batch year lands on the batch year rather than
   * only in a toast the reader has already dismissed.
   */
  const fieldError = (name: string): string | undefined =>
    fieldErrors[name] ?? fieldErrors[`segment.${name}`];

  const send = async () => {
    setSending(true);
    setFieldErrors({});
    setRefusal(null);

    const outcome = await api.post<SendResult>('/api/admin/comms', {
      channel,
      subject: subject.trim(),
      body: body.trim(),
      // The route's payload mirrors this Segment shape, with the batch
      // years as numbers and empty filters left out rather than sent as
      // blanks — an empty string is an absent filter, not a member whose
      // city is "".
      segment: {
        cohort: segment.cohort,
        ...(segment.department ? { department: segment.department } : {}),
        ...(segment.batchFrom ? { batchFrom: Number(segment.batchFrom) } : {}),
        ...(segment.batchTo ? { batchTo: Number(segment.batchTo) } : {}),
        ...(segment.city ? { city: segment.city } : {}),
        ...(segment.availability ? { availability: segment.availability } : {}),
      },
      // The dialog made the sender type the recipient count before this
      // ran. This is the server's record that the count was read.
      acknowledged: true,
    });

    setSending(false);
    setConfirming(false);

    const count = outcome.status === 'ok' ? outcome.data.recipientCount : recipientCount;
    const t = outcomeToast(outcome, `Queued for ${count.toLocaleString('en-IN')} recipients`);
    if (t) toast.show(t);

    if (outcome.status === 'ok') {
      setSent({ ...outcome.data, persisted: outcome.persisted });
      return;
    }

    if (outcome.status === 'invalid') setFieldErrors(outcome.fieldErrors);
    setRefusal(outcome.message);
  };

  const update = (patch: Partial<Segment>) => {
    const next = { ...segment, ...patch };
    const qs = new URLSearchParams();
    if (next.cohort !== 'all') qs.set('cohort', next.cohort);
    if (next.department && !lockedDepartment) qs.set('department', next.department);
    if (next.batchFrom) qs.set('batchFrom', next.batchFrom);
    if (next.batchTo) qs.set('batchTo', next.batchTo);
    if (next.city) qs.set('city', next.city);
    if (next.availability) qs.set('availability', next.availability);
    const q = qs.toString();
    startTransition(() => router.replace(q ? `/admin/comms/new?${q}` : '/admin/comms/new', { scroll: false }));
  };

  // ---------------------------------------------------------------
  // Starting points
  // ---------------------------------------------------------------

  const events = starts.filter((s) => s.kind === 'event');
  const stories = starts.filter((s) => s.kind === 'story');

  const chooseKind = (kind: StartKind) => {
    setStartKind(kind);
    setPointKey('');
    if (kind === 'blank') {
      setSubject('');
      setBody('');
      setDraft(groupText);
    }
  };

  const choosePoint = (key: string) => {
    setPointKey(key);
    const point = starts.find((s) => s.key === key);
    if (!point) return;
    setSubject(point.subject);
    setBody(point.body);
    setDraft(point.whatsapp);
  };

  // ---------------------------------------------------------------
  // Readiness
  // ---------------------------------------------------------------

  const filterCount = [
    segment.cohort !== 'all',
    Boolean(segment.department) && !lockedDepartment,
    Boolean(segment.batchFrom),
    Boolean(segment.batchTo),
    Boolean(segment.city),
    Boolean(segment.availability),
  ].filter(Boolean).length;

  // A segment grant addresses a slice, never the whole list.
  const needsFilter = tier === 'segment' && filterCount === 0;
  const subjectOk = subject.trim().length >= 4;
  const bodyOk = body.trim().length >= 20;
  const blocked = recipientCount === 0 || needsFilter || !subjectOk || !bodyOk;

  const blockedReason = needsFilter
    ? 'Narrow the audience with at least one filter. Writing to everyone is kept for the college admin.'
    : recipientCount === 0
      ? 'Nobody matches this audience. Loosen a filter.'
      : !subjectOk
        ? channel === 'whatsapp'
          ? 'Name the approved template this message uses.'
          : 'Write a subject line. It is the only part most people read.'
        : !bodyOk
          ? 'Write the message. Two sentences at least.'
          : null;

  const trySend = () => {
    setTouched(true);
    if (blocked || pending || sending) return;
    setConfirming(true);
  };

  const sample = sampleNames[0] ?? null;
  const firstName = sample ? (sample.split(/\s+/)[0] ?? sample) : null;
  const rendered = body
    .replaceAll('{{name}}', sample ?? '[name]')
    .replaceAll('{{first_name}}', firstName ?? '[first name]')
    .replaceAll('{{college}}', institutionName);

  const audienceLine = [
    segment.cohort === 'alumni' ? 'Alumni' : segment.cohort === 'students' ? 'Final-year students' : 'Alumni and students',
    segment.department ? `in ${segment.department}` : null,
    segment.batchFrom || segment.batchTo
      ? `batches ${segment.batchFrom || 'earliest'}–${segment.batchTo || 'latest'}`
      : null,
    segment.city ? `living in ${segment.city}` : null,
    segment.availability ? `open to ${segment.availability}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const footer =
    segment.cohort === 'students'
      ? `${institutionName} · You are receiving this as a final-year student.`
      : segment.cohort === 'alumni'
        ? `${institutionName} · You are receiving this as a graduate on the alumni register.`
        : `${institutionName} · You are receiving this as a member of ${portalName}.`;

  const channelWord = channel === 'whatsapp' ? 'WhatsApp' : 'email';
  const count = recipientCount.toLocaleString('en-IN');

  // ---------------------------------------------------------------
  // After the send
  // ---------------------------------------------------------------

  if (sent !== null) {
    // The number the screen was showing when Send was pressed, against the
    // number the server resolved. They agree almost always; the case where
    // they do not is the one worth printing.
    const drifted = sent.recipientCount !== recipientCount;

    return (
      <Card className="max-w-2xl">
        <CardBody className="space-y-4">
          <Badge tone={sent.persisted ? 'success' : 'neutral'} dot>
            {sent.persisted ? 'Queued' : 'Not sent'}
          </Badge>
          <p className="font-display text-xl font-semibold">
            {sent.persisted
              ? `“${sent.subject}” is queued for ${sent.recipientCount.toLocaleString('en-IN')} recipients`
              : `“${sent.subject}” was checked for ${sent.recipientCount.toLocaleString('en-IN')} recipients`}
          </p>

          {drifted ? (
            <Alert tone="warning" title="The count moved between this screen and the send">
              <p>
                This screen was showing {recipientCount.toLocaleString('en-IN')}. The server resolved the segment
                again at the moment of sending and found {sent.recipientCount.toLocaleString('en-IN')} — somebody
                joined, was verified or withdrew in between. The number above is the one that was used, and it is
                the number in the audit entry.
              </p>
            </Alert>
          ) : null}

          <p className="max-w-prose text-sm text-secondary">
            {sent.segmentLabel} · by {sent.channel === 'whatsapp' ? 'WhatsApp' : 'email'}. The audit log records
            your name, the audience and the count.
          </p>

          <div className="flex flex-wrap gap-3 pt-1">
            <Button variant="secondary" onClick={() => router.push('/admin/comms')}>
              Back to messages
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setSent(null);
                setSubject('');
                setBody('');
                setTouched(false);
                setStartKind('blank');
                setPointKey('');
              }}
            >
              Write another
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  // ---------------------------------------------------------------
  // The four steps
  // ---------------------------------------------------------------

  const preview = (
    <MessagePreview
      mode={mode}
      channel={channel}
      subject={subject}
      rendered={rendered}
      draft={draft}
      to={sample ?? 'a member'}
      footer={footer}
      portalName={portalName}
      supportEmail={supportEmail}
      brandHeader={brandHeader}
      brandMark={brandMark}
    />
  );

  const startChips: Array<{ kind: StartKind; label: string; icon: React.ReactNode; show: boolean }> = [
    { kind: 'event', label: 'Event invite', icon: <CalendarDays className="size-4" />, show: events.length > 0 },
    { kind: 'story', label: 'News story', icon: <Newspaper className="size-4" />, show: stories.length > 0 },
    { kind: 'blank', label: 'Blank', icon: <PenLine className="size-4" />, show: true },
  ];

  const messageStart = (
    <div className="space-y-3">
      <div role="group" aria-label="Start from" className="scroll-fade-x flex gap-2 overflow-x-auto pb-1">
        {startChips
          .filter((c) => c.show)
          .map((c) => (
            <button
              key={c.kind}
              type="button"
              aria-pressed={startKind === c.kind}
              onClick={() => chooseKind(c.kind)}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm sm:min-h-9',
                'transition-colors duration-fast ease-brand [&_svg]:shrink-0',
                startKind === c.kind
                  ? 'border-line-strong bg-brand-soft font-medium text-brand-soft-fg'
                  : 'border-line bg-surface-raised text-secondary hover:border-line-strong hover:text-primary',
              )}
            >
              <span aria-hidden="true">{c.icon}</span>
              {c.label}
            </button>
          ))}
      </div>

      {startKind === 'event' || startKind === 'story' ? (
        <Field htmlFor="msg-start" label={startKind === 'event' ? 'Event' : 'Story'}>
          <Select id="msg-start" value={pointKey} onChange={(e) => choosePoint(e.target.value)}>
            <option value="">{startKind === 'event' ? 'Choose an event' : 'Choose a story'}</option>
            {(startKind === 'event' ? events : stories).map((s) => (
              <option key={s.key} value={s.key}>
                {s.label} · {s.hint}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
    </div>
  );

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          {/* ---------------- 1. Channel ---------------- */}
          <Step n={1} title="Channel">
            <div className="grid gap-3 sm:grid-cols-2">
              {whatsappEnabled ? (
                <ChoiceCard
                  id="ch-whatsapp"
                  name="channel"
                  checked={mode === 'send' && channel === 'whatsapp'}
                  onSelect={() => {
                    setMode('send');
                    setChannel('whatsapp');
                  }}
                  icon={<MessageCircle className="size-5" />}
                  title="WhatsApp"
                  tag="Where alumni read"
                  line="Sent from the portal as an approved message template."
                  footer={
                    <Button
                      type="button"
                      variant={mode === 'draft' ? 'primary' : 'secondary'}
                      size="sm"
                      className="min-h-11 sm:min-h-0"
                      aria-pressed={mode === 'draft'}
                      onClick={() => setMode('draft')}
                    >
                      Draft for WhatsApp groups
                    </Button>
                  }
                />
              ) : (
                <div
                  className={cn(
                    'rounded-lg border p-4',
                    mode === 'draft'
                      ? 'border-[var(--button-primary-bg)] bg-brand-soft ring-1 ring-[var(--button-primary-bg)]'
                      : 'border-line bg-surface-raised',
                  )}
                >
                  <p className="flex flex-wrap items-center gap-2">
                    <MessageCircle className="size-5 text-muted" aria-hidden="true" />
                    <span className="font-semibold text-primary">WhatsApp</span>
                    <span className="text-sm text-secondary">Where alumni read</span>
                  </p>
                  <p className="mt-2 text-sm text-secondary">Not set up yet. It needs:</p>
                  <ul className="mt-1.5 space-y-1 text-sm text-primary">
                    {SETUP.map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <Circle className="size-3 shrink-0 text-muted" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    variant={mode === 'draft' ? 'primary' : 'secondary'}
                    size="sm"
                    className="mt-3 min-h-11 sm:min-h-0"
                    aria-pressed={mode === 'draft'}
                    onClick={() => setMode('draft')}
                  >
                    Draft for WhatsApp groups
                  </Button>
                </div>
              )}

              <ChoiceCard
                id="ch-email"
                name="channel"
                checked={mode === 'send' && channel === 'email'}
                onSelect={() => {
                  setMode('send');
                  setChannel('email');
                }}
                icon={<Mail className="size-5" />}
                title="Email"
                line="Queued from the portal for everyone in the audience."
              />
            </div>
            {fieldErrors.channel ? (
              <p role="alert" className="text-xs font-medium text-danger-fg">
                {fieldErrors.channel}
              </p>
            ) : null}
          </Step>

          {mode === 'draft' ? (
            /* ---------------- 2. The group post ---------------- */
            <Step n={2} title="Message">
              {messageStart}
              <Field
                htmlFor="msg-draft"
                label="Text for the group"
                hint="Post it from your own phone. Nothing is sent from here, and no member details are included."
              >
                <Textarea
                  id="msg-draft"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={6}
                  aria-describedby={describedBy('msg-draft', { hint: true })}
                />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <CopyButton text={draft} label="Copy the text" copiedLabel="Text copied" variant="primary" />
                <ButtonLink
                  href={`https://wa.me/?text=${encodeURIComponent(draft)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  variant="secondary"
                  className="min-h-11"
                >
                  <MessageCircle className="size-4" aria-hidden="true" />
                  Open in WhatsApp
                  <span className="sr-only"> (opens WhatsApp)</span>
                </ButtonLink>
              </div>
            </Step>
          ) : (
            <>
              {/* ---------------- 2. Who ---------------- */}
              <Step
                n={2}
                title="Who"
                action={
                  // The alumni cohort is fixed for an account that cannot reach students.
                  filterCount > (studentsAddressable ? 0 : 1) && !lockedDepartment ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        update({
                          cohort: studentsAddressable ? 'all' : 'alumni',
                          department: '',
                          batchFrom: '',
                          batchTo: '',
                          city: '',
                          availability: '',
                        })
                      }
                    >
                      <RotateCcw className="size-4" aria-hidden="true" />
                      Clear
                    </Button>
                  ) : null
                }
              >
                <Fieldset legend="Cohort">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Radio
                      id="seg-cohort-all"
                      name="cohort"
                      label="Both"
                      hint={studentsAddressable ? undefined : 'Your account writes to alumni only.'}
                      checked={segment.cohort === 'all'}
                      disabled={!studentsAddressable}
                      onChange={() => update({ cohort: 'all' })}
                    />
                    <Radio
                      id="seg-cohort-alumni"
                      name="cohort"
                      label="Alumni"
                      checked={segment.cohort === 'alumni'}
                      onChange={() => update({ cohort: 'alumni' })}
                    />
                    <Radio
                      id="seg-cohort-students"
                      name="cohort"
                      label="Final-year students"
                      hint={studentsAddressable ? undefined : 'The placement cell writes to students.'}
                      checked={segment.cohort === 'students'}
                      disabled={!studentsAddressable}
                      onChange={() => update({ cohort: 'students' })}
                    />
                  </div>
                </Fieldset>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    htmlFor="seg-department"
                    label="Branch"
                    hint={lockedDepartment ? `Your messages go to ${lockedDepartmentName ?? lockedDepartment}.` : undefined}
                    error={fieldError('department')}
                  >
                    <Select
                      id="seg-department"
                      value={segment.department}
                      disabled={Boolean(lockedDepartment)}
                      onChange={(e) => update({ department: e.target.value })}
                      aria-describedby={describedBy('seg-department', {
                        hint: Boolean(lockedDepartment),
                        error: Boolean(fieldError('department')),
                      })}
                    >
                      {departmentOptions.map((o) => (
                        <option key={o.value || 'any'} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field htmlFor="seg-city" label="City" error={fieldError('city')}>
                    <Select
                      id="seg-city"
                      value={segment.city}
                      onChange={(e) => update({ city: e.target.value })}
                      aria-describedby={describedBy('seg-city', { error: Boolean(fieldError('city')) })}
                    >
                      <option value="">Anywhere</option>
                      {cityOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field htmlFor="seg-batch-from" label="Batch from" error={fieldError('batchFrom')}>
                    <Select
                      id="seg-batch-from"
                      value={segment.batchFrom}
                      onChange={(e) => update({ batchFrom: e.target.value })}
                      aria-describedby={describedBy('seg-batch-from', { error: Boolean(fieldError('batchFrom')) })}
                    >
                      <option value="">Earliest</option>
                      {batchYears.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field htmlFor="seg-batch-to" label="Batch to" error={fieldError('batchTo')}>
                    <Select
                      id="seg-batch-to"
                      value={segment.batchTo}
                      onChange={(e) => update({ batchTo: e.target.value })}
                      aria-describedby={describedBy('seg-batch-to', { error: Boolean(fieldError('batchTo')) })}
                    >
                      <option value="">Latest</option>
                      {batchYears.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field
                    htmlFor="seg-availability"
                    label="Availability"
                    hint="What they have said they are willing to do."
                    error={fieldError('availability')}
                  >
                    <Select
                      id="seg-availability"
                      value={segment.availability}
                      onChange={(e) => update({ availability: e.target.value as Segment['availability'] })}
                      aria-describedby={describedBy('seg-availability', {
                        hint: true,
                        error: Boolean(fieldError('availability')),
                      })}
                    >
                      <option value="">Any</option>
                      <option value="mentoring">Open to mentoring</option>
                      <option value="referrals">Open to referrals</option>
                      <option value="speaking">Open to speaking</option>
                    </Select>
                  </Field>
                </div>

                <div className="space-y-3 rounded-lg border border-line bg-surface p-4" aria-live="polite">
                  <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                    <p className="flex items-baseline gap-2">
                      <span className="font-display text-display-xs font-bold tabular">{pending ? '…' : count}</span>
                      <span className="text-sm font-medium text-secondary">
                        {recipientCount === 1 ? 'recipient' : 'recipients'}
                      </span>
                    </p>
                    <p className="text-sm text-secondary">
                      {pending ? 'Counting…' : `of ${scopeTotal.toLocaleString('en-IN')} you can reach`}
                    </p>
                  </div>
                  <Progress
                    value={pending ? 0 : recipientCount}
                    max={scopeTotal || 1}
                    tone="brand"
                    label={`${recipientCount} of ${scopeTotal} reachable members selected`}
                  />
                  <p className="text-sm text-primary">
                    <Users className="mr-1.5 inline size-4 align-[-3px] text-muted" aria-hidden="true" />
                    {audienceLine}
                  </p>
                  {sampleNames.length > 0 ? (
                    <p className="text-sm text-secondary">
                      Includes {sampleNames.slice(0, 3).join(', ')}
                      {recipientCount > 3 ? ` and ${(recipientCount - 3).toLocaleString('en-IN')} others` : ''}.
                    </p>
                  ) : null}
                  {unclaimedRegisterRows > 0 ? (
                    <p className="text-sm text-secondary">
                      Only registered members are counted.{' '}
                      {unclaimedRegisterRows.toLocaleString('en-IN')} graduates on the degree register have not
                      registered yet.
                    </p>
                  ) : null}
                </div>
              </Step>

              {/* ---------------- 3. Message ---------------- */}
              <Step n={3} title="Message">
                {messageStart}

                <Field
                  htmlFor="msg-subject"
                  label={channel === 'whatsapp' ? 'Template name' : 'Subject'}
                  required
                  hint={
                    channel === 'whatsapp'
                      ? 'The approved template this message uses.'
                      : 'Say what it is about. It is the only part most people read.'
                  }
                  error={fieldErrors.subject}
                >
                  <Input
                    id="msg-subject"
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value);
                      setTouched(true);
                    }}
                    maxLength={120}
                    placeholder="e.g. Registration is open for the annual meet"
                    invalid={Boolean(fieldErrors.subject)}
                    aria-describedby={describedBy('msg-subject', {
                      hint: true,
                      error: Boolean(fieldErrors.subject),
                    })}
                  />
                </Field>

                <Field
                  htmlFor="msg-body"
                  label="Message"
                  required
                  hint="{{first_name}}, {{name}} and {{college}} are filled in for each person."
                  error={fieldErrors.body}
                >
                  <Textarea
                    id="msg-body"
                    value={body}
                    onChange={(e) => {
                      setBody(e.target.value);
                      setTouched(true);
                    }}
                    rows={9}
                    invalid={Boolean(fieldErrors.body)}
                    aria-describedby={describedBy('msg-body', { hint: true, error: Boolean(fieldErrors.body) })}
                    placeholder={'Dear {{first_name}},\n\nWhat is happening, when and where, and what to do next.'}
                  />
                </Field>
              </Step>

              {/* ---------------- 4. Review and send ---------------- */}
              <Step n={4} title="Review and send">
                <p className="text-sm text-primary">
                  <span className="font-semibold tabular">{count}</span>{' '}
                  {recipientCount === 1 ? 'person' : 'people'} · by {channelWord} · {audienceLine}
                </p>
                <p className="text-sm text-secondary">
                  You will type the count to confirm. The server counts again as it sends.
                </p>
                {touched && blockedReason ? (
                  <p className="text-sm font-medium text-warning-fg" role="status">
                    {blockedReason}
                  </p>
                ) : null}
                {refusal ? (
                  <Alert tone="danger" title="Nothing was sent">
                    <p>{refusal}</p>
                  </Alert>
                ) : null}
                <div className="hidden flex-wrap items-center justify-end gap-3 lg:flex">
                  <Button variant="secondary" onClick={() => router.push('/admin/comms')}>
                    Cancel
                  </Button>
                  <Button onClick={trySend} loading={sending} disabled={pending}>
                    <Send className="size-4" aria-hidden="true" />
                    Send to {count}
                  </Button>
                </div>
              </Step>
            </>
          )}
        </div>

        {/* ---------------- Preview ---------------- */}
        <aside aria-label="Preview" className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="flex items-center gap-2 text-md">
                <Eye className="size-4 text-muted" aria-hidden="true" />
                Preview
              </CardTitle>
            </CardHeader>
            <CardBody>{preview}</CardBody>
          </Card>
        </aside>
      </div>

      <StickyActionBar label="Message actions">
        <Button type="button" variant="secondary" onClick={() => setPreviewOpen(true)}>
          <Eye className="size-4" aria-hidden="true" />
          Preview
        </Button>
        {mode === 'send' ? (
          <Button type="button" onClick={trySend} loading={sending} disabled={pending}>
            <Send className="size-4" aria-hidden="true" />
            Send to {count}
          </Button>
        ) : null}
      </StickyActionBar>

      <Sheet open={previewOpen} onClose={() => setPreviewOpen(false)} title="Preview">
        {preview}
      </Sheet>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void send()}
        pending={sending}
        tone="primary"
        confirmLabel="Send now"
        requireTyped={String(recipientCount)}
        title="Send this message?"
        body={
          <div className="space-y-2">
            <p>
              <strong className="text-primary">{recipientCount.toLocaleString('en-IN')}</strong> people receive
              &ldquo;{subject.trim()}&rdquo; by {channelWord}.
            </p>
            <p>{audienceLine}.</p>
            <p>A message cannot be recalled. Type the count to confirm you have read it.</p>
          </div>
        }
      />
    </>
  );
}

// ---------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------

function Step({
  n,
  title,
  action,
  children,
}: {
  n: number;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const id = `compose-step-${n}`;
  return (
    <section aria-labelledby={id}>
      <Card>
        <CardHeader className="items-center">
          <h2 id={id} className="flex items-center gap-3 font-display text-lg font-semibold">
            <span
              aria-hidden="true"
              className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold tabular text-brand-soft-fg"
            >
              {n}
            </span>
            <span>
              <span className="sr-only">Step {n}: </span>
              {title}
            </span>
          </h2>
          {action}
        </CardHeader>
        <CardBody className="space-y-5">{children}</CardBody>
      </Card>
    </section>
  );
}

/** A radio drawn as a card. The input stays real, so arrow keys and forms work. */
function ChoiceCard({
  id,
  name,
  checked,
  onSelect,
  icon,
  title,
  tag,
  line,
  footer,
}: {
  id: string;
  name: string;
  checked: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  tag?: string;
  line: string;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-colors duration-fast ease-brand',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus-ring)]',
        checked
          ? 'border-[var(--button-primary-bg)] bg-brand-soft ring-1 ring-[var(--button-primary-bg)]'
          : 'border-line bg-surface-raised hover:border-line-strong',
      )}
    >
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input id={id} type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" />
        <span className={cn('mt-0.5 shrink-0', checked ? 'text-brand-fg' : 'text-muted')} aria-hidden="true">
          {icon}
        </span>
        <span className="min-w-0 space-y-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-primary">{title}</span>
            {tag ? <span className="text-sm text-secondary">{tag}</span> : null}
          </span>
          <span className="block text-sm text-secondary">{line}</span>
        </span>
      </label>
      {footer ? <div className="mt-2 pl-8">{footer}</div> : null}
    </div>
  );
}

function MessagePreview({
  mode,
  channel,
  subject,
  rendered,
  draft,
  to,
  footer,
  portalName,
  supportEmail,
  brandHeader,
  brandMark,
}: {
  mode: Mode;
  channel: Channel;
  subject: string;
  rendered: string;
  draft: string;
  to: string;
  footer: string;
  portalName: string;
  supportEmail: string | null;
  brandHeader: React.ReactNode;
  brandMark: React.ReactNode;
}) {
  if (mode === 'draft') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-secondary">Your post in a batch group</p>
        <div className="rounded-lg bg-surface-sunken p-3">
          <p className="ml-auto max-w-[92%] whitespace-pre-line break-words rounded-lg rounded-tr-none border border-line bg-surface-raised p-3 text-sm leading-relaxed text-primary shadow-sm">
            {draft.trim() || 'The text appears here.'}
          </p>
        </div>
      </div>
    );
  }

  if (channel === 'whatsapp') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-secondary">To {to}</p>
        <div className="rounded-lg bg-surface-sunken p-3">
          <div className="flex items-start gap-2">
            <span className="shrink-0">{brandMark}</span>
            <div className="min-w-0 space-y-1.5 rounded-lg rounded-tl-none border border-line bg-surface-raised p-3 text-sm shadow-sm">
              <p className="text-xs font-semibold text-brand-fg">{portalName}</p>
              <p className="whitespace-pre-line break-words leading-relaxed text-primary">
                {rendered.trim() || 'The message appears here, with names filled in.'}
              </p>
              {subject.trim() ? <p className="text-xs text-secondary">Template: {subject.trim()}</p> : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="border-b border-line bg-surface-raised px-4 py-3">{brandHeader}</div>
      <dl className="space-y-1 border-b border-line px-4 py-3 text-xs">
        <div className="flex gap-2">
          <dt className="w-10 shrink-0 text-secondary">From</dt>
          <dd className="min-w-0 break-words font-medium">
            {portalName}
            {supportEmail ? <span className="font-normal text-secondary"> &lt;{supportEmail}&gt;</span> : null}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-10 shrink-0 text-secondary">To</dt>
          <dd className="min-w-0 font-medium">{to}</dd>
        </div>
      </dl>
      <div className="space-y-3 px-4 py-4">
        <p className="font-display text-md font-semibold">{subject.trim() || 'The subject appears here'}</p>
        <p className="whitespace-pre-line break-words text-sm leading-relaxed text-secondary">
          {rendered.trim() || 'The message appears here, with names filled in.'}
        </p>
      </div>
      <p className="border-t border-line px-4 py-3 text-xs text-secondary">{footer}</p>
    </div>
  );
}
