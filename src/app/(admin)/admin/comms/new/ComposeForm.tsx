'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Mail, MessageCircle, Lock, Users, Eye, ShieldCheck, RotateCcw } from 'lucide-react';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Field,
  describedBy,
  Input,
  Textarea,
  Select,
  Radio,
  Fieldset,
  FormActions,
  Button,
  Badge,
  Alert,
  Progress,
  Separator,
  ConfirmDialog,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * Segment builder and composer.
 *
 * The recipient count is not estimated in the browser — every change to the
 * segment goes back through the directory on the server, with this viewer's
 * own scope applied, and the number that comes back is the number that will
 * be sent to. A count computed client-side from a cached list is the reason
 * "it said 400" turns into 4,000 delivered.
 *
 * That holds at the send as well. `POST /api/admin/comms` resolves the
 * segment a second time, through the same directory query and the same
 * scope, and the count it returns is the count that was used — this screen
 * reports that number rather than the one it happened to be showing. If
 * the two disagree, the disagreement is stated, because a stale tab is
 * precisely how somebody mails eight thousand people believing it was two
 * hundred.
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

type Channel = 'email' | 'whatsapp';

interface Option {
  value: string;
  label: string;
}

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
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();

  const [channel, setChannel] = React.useState<Channel>('email');
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
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

  const filterCount = [
    segment.cohort !== 'all',
    Boolean(segment.department) && !lockedDepartment,
    Boolean(segment.batchFrom),
    Boolean(segment.batchTo),
    Boolean(segment.city),
    Boolean(segment.availability),
  ].filter(Boolean).length;

  // A `segment` grant is exactly that: it addresses a slice, never the list.
  const needsFilter = tier === 'segment' && filterCount === 0;
  const subjectOk = subject.trim().length >= 4;
  const bodyOk = body.trim().length >= 20;
  const blocked = recipientCount === 0 || needsFilter || !subjectOk || !bodyOk || pending || sending;

  const blockedReason = needsFilter
    ? 'Your tier is comms.send.segment. Narrow the audience with at least one filter — that grant does not cover the whole list.'
    : recipientCount === 0
      ? 'No member matches this segment, so there is nobody to send to. Loosen a filter.'
      : !subjectOk
        ? 'Write a subject line. It is the only thing most recipients will read.'
        : !bodyOk
          ? 'Write the message. Two sentences is a real minimum for a broadcast.'
          : null;

  const sample = sampleNames[0] ?? 'Vamsi Krishna Pothineni';
  const firstName = sample.split(/\s+/)[0] ?? sample;
  const rendered = body
    .replaceAll('{{name}}', sample)
    .replaceAll('{{first_name}}', firstName)
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

  if (sent !== null) {
    // The number the screen was showing when Send was pressed, against the
    // number the server resolved. They agree almost always; the case where
    // they do not is the one worth printing.
    const drifted = sent.recipientCount !== recipientCount;

    return (
      <Card>
        <CardBody className="space-y-4">
          <Badge tone={sent.persisted ? 'success' : 'info'} dot>
            {sent.persisted ? 'Queued' : 'Not queued'}
          </Badge>
          <p className="font-display text-xl font-semibold">
            &ldquo;{sent.subject}&rdquo; queued for {sent.recipientCount.toLocaleString('en-IN')} recipients
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
            The audit log now carries one entry, <code className="font-mono text-xs">{sent.auditedAs}</code>: your
            name, the segment ({sent.segmentLabel}), the channel and the recipient count. Delivery, bounces and
            unsubscribes attach to that entry as they come back from the provider.
          </p>

          <p className="max-w-prose text-sm text-secondary">{sent.note}</p>

          <div className="flex flex-wrap gap-3 pt-1">
            <Button variant="secondary" onClick={() => router.push('/admin/comms')}>
              Back to communications
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setSent(null);
                setSubject('');
                setBody('');
              }}
            >
              Write another
            </Button>
          </div>

          {!sent.persisted ? (
            <p className="border-t border-line pt-3 text-xs text-muted">
              Nothing left the building. This build runs on seeded data with no database and no message provider
              behind it — your permission tier was checked, the segment was resolved and the audit entry was
              written, but no message was queued to anybody.
            </p>
          ) : null}
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          {/* ---------------- Segment ---------------- */}
          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">Segment</CardTitle>
                <CardDescription>
                  Drawn from the directory with your own scope applied — you cannot address someone you could not
                  look up.
                </CardDescription>
              </div>
              {filterCount > 0 && !lockedDepartment ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    update({
                      cohort: 'all',
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
              ) : null}
            </CardHeader>

            <CardBody className="space-y-5">
              <Fieldset legend="Cohort" hint="Students and alumni read a college mail very differently.">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Radio
                    id="seg-cohort-all"
                    name="cohort"
                    label="Both"
                    checked={segment.cohort === 'all'}
                    onChange={() => update({ cohort: 'all' })}
                  />
                  <Radio
                    id="seg-cohort-alumni"
                    name="cohort"
                    label="Alumni only"
                    checked={segment.cohort === 'alumni'}
                    onChange={() => update({ cohort: 'alumni' })}
                  />
                  <Radio
                    id="seg-cohort-students"
                    name="cohort"
                    label="Students only"
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
                  hint={
                    lockedDepartment
                      ? `Fixed to ${lockedDepartmentName ?? lockedDepartment} by your comms.send.department grant.`
                      : 'Counts are the members in each branch you can reach.'
                  }
                  error={fieldError('department')}
                >
                  <Select
                    id="seg-department"
                    value={segment.department}
                    disabled={Boolean(lockedDepartment)}
                    onChange={(e) => update({ department: e.target.value })}
                    aria-describedby={describedBy('seg-department', {
                      hint: true,
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

                <Field
                  htmlFor="seg-city"
                  label="City"
                  hint="Useful for a city meet-up. Members who never filled in a city are excluded."
                  error={fieldError('city')}
                >
                  <Select
                    id="seg-city"
                    value={segment.city}
                    onChange={(e) => update({ city: e.target.value })}
                    aria-describedby={describedBy('seg-city', { hint: true, error: Boolean(fieldError('city')) })}
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
                  hint="What they have said they are willing to do, not what you would like them to do."
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

                <Field
                  htmlFor="seg-verification"
                  label="Verification state"
                  hint={`Not a choice. ${unclaimedRegisterRows.toLocaleString('en-IN')} degree-register rows have never been claimed, so there is no verified address to write to.`}
                >
                  <Input
                    id="seg-verification"
                    value="Verified members only"
                    readOnly
                    disabled
                    aria-describedby={describedBy('seg-verification', { hint: true })}
                  />
                </Field>
              </div>

              <Separator />

              <div className="space-y-3 rounded-lg border border-line bg-surface-sunken p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-secondary">Recipients</p>
                    <p className="font-display text-display-xs font-bold tabular">
                      {pending ? '…' : recipientCount.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <p className="text-xs text-muted">
                    {pending ? 'Recounting…' : `of ${scopeTotal.toLocaleString('en-IN')} you can reach`}
                  </p>
                </div>

                <Progress
                  value={pending ? 0 : recipientCount}
                  max={scopeTotal || 1}
                  tone={recipientCount === 0 ? 'danger' : recipientCount === scopeTotal ? 'warning' : 'brand'}
                  label={`${recipientCount} of ${scopeTotal} reachable members selected`}
                />

                <p className="text-sm text-secondary">
                  <Users className="mr-1.5 inline size-4 align-[-2px]" aria-hidden="true" />
                  {audienceLine}
                </p>

                {sampleNames.length > 0 ? (
                  <p className="text-xs text-muted">
                    Includes {sampleNames.slice(0, 3).join(', ')}
                    {recipientCount > 3 ? ` and ${(recipientCount - 3).toLocaleString('en-IN')} others` : ''}.
                  </p>
                ) : null}

                {!studentsAddressable ? (
                  <p className="text-xs text-muted">
                    Your directory scope returns alumni only. Students are not addressable from your roles — that
                    needs <code className="font-mono">directory.search.students</code> — so they are not in this
                    count, whichever cohort is selected above.
                  </p>
                ) : null}
              </div>

              {needsFilter ? (
                <Alert tone="warning" title="Pick at least one filter">
                  <p>
                    <code className="font-mono text-xs">comms.send.segment</code> addresses a slice of the list, not
                    the list. Sending to everyone needs <code className="font-mono text-xs">comms.send.all</code>,
                    which the college admin holds.
                  </p>
                </Alert>
              ) : null}
            </CardBody>
          </Card>

          {/* ---------------- Compose ---------------- */}
          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">Message</CardTitle>
                <CardDescription>One message, one channel. Nothing is queued twice.</CardDescription>
              </div>
            </CardHeader>

            <CardBody className="space-y-5">
              <Fieldset legend="Channel">
                <Radio
                  id="ch-email"
                  name="channel"
                  label={
                    <span className="flex items-center gap-2">
                      <Mail className="size-4 text-muted" aria-hidden="true" />
                      Email
                    </span>
                  }
                  hint="Always available. Bounces come back through the provider webhook and mark the address."
                  checked={channel === 'email'}
                  onChange={() => setChannel('email')}
                />
                <Radio
                  id="ch-whatsapp"
                  name="channel"
                  label={
                    <span className="flex flex-wrap items-center gap-2">
                      <MessageCircle className="size-4 text-muted" aria-hidden="true" />
                      WhatsApp
                      {!whatsappEnabled ? (
                        <Badge tone="neutral">
                          <Lock className="size-3" aria-hidden="true" />
                          Not connected
                        </Badge>
                      ) : null}
                    </span>
                  }
                  hint={
                    whatsappEnabled
                      ? 'Sent as an approved template. Members who have not opted in are skipped.'
                      : 'Needs a WhatsApp Business API provider account for the college and an approved template. Until that exists this cannot be selected — which matters, because email open rates on alumni lists this old are poor and WhatsApp is the channel most of them actually read.'
                  }
                  disabled={!whatsappEnabled}
                  checked={channel === 'whatsapp'}
                  onChange={() => setChannel('whatsapp')}
                />
              </Fieldset>

              {fieldErrors.channel ? (
                <p role="alert" className="flex gap-1.5 text-xs font-medium text-danger-fg">
                  <span aria-hidden="true">⚠</span>
                  <span>{fieldErrors.channel}</span>
                </p>
              ) : null}

              <Field
                htmlFor="msg-subject"
                label={channel === 'whatsapp' ? 'Template name' : 'Subject'}
                required
                hint={
                  channel === 'whatsapp'
                    ? 'The approved template this send uses.'
                    : 'Say what it is about. "Update from the alumni cell" is why nobody opens the next one.'
                }
                error={fieldErrors.subject}
              >
                <Input
                  id="msg-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={120}
                  placeholder="Annual Alumni Meet 2027 — registration is open"
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
                hint="{{first_name}}, {{name}} and {{college}} are replaced per recipient. Everything else is sent exactly as typed."
                error={fieldErrors.body}
              >
                <Textarea
                  id="msg-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={9}
                  invalid={Boolean(fieldErrors.body)}
                  aria-describedby={describedBy('msg-body', { hint: true, error: Boolean(fieldErrors.body) })}
                  placeholder={
                    'Dear {{first_name}},\n\nThe Annual Alumni Meet is on 24 September on campus. Department sessions in the morning, the general body meeting after lunch, and the cultural evening in the open-air auditorium.\n\nRegistration is ₹500 and closes on 15 September.'
                  }
                />
              </Field>

              <p className="text-xs text-muted">{body.trim().length} characters</p>
            </CardBody>
          </Card>

          <FormActions>
            <p className="mr-auto max-w-prose text-xs text-muted">
              Sending posts the segment to the server, which resolves the recipients itself and writes the audit
              entry. If nothing is actually queued — this build can run on seeded data with no message provider
              behind it — you are told that rather than shown a tick.
            </p>
            <Button variant="secondary" onClick={() => router.push('/admin/comms')}>
              Cancel
            </Button>
            <Button disabled={blocked} loading={sending} onClick={() => setConfirming(true)}>
              Send to {recipientCount.toLocaleString('en-IN')} recipient{recipientCount === 1 ? '' : 's'}
            </Button>
          </FormActions>

          {blockedReason ? <p className="text-right text-xs text-danger-fg">{blockedReason}</p> : null}

          {refusal ? (
            <Alert tone="danger" title="Nothing was sent">
              <p>{refusal}</p>
            </Alert>
          ) : null}
        </div>

        {/* ---------------- Preview ---------------- */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">
                  <span className="flex items-center gap-2">
                    <Eye className="size-4 text-muted" aria-hidden="true" />
                    Preview
                  </span>
                </CardTitle>
                <CardDescription>Merge fields filled in with {sample}.</CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
                <dl className="space-y-1 border-b border-line pb-3 text-xs">
                  <div className="flex gap-2">
                    <dt className="w-14 shrink-0 text-muted">From</dt>
                    <dd className="min-w-0 font-medium">
                      {portalName}
                      {supportEmail ? <span className="text-muted"> &lt;{supportEmail}&gt;</span> : null}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-14 shrink-0 text-muted">To</dt>
                    <dd className="min-w-0 font-medium">{sample}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-14 shrink-0 text-muted">Channel</dt>
                    <dd className="min-w-0 font-medium">{channel === 'whatsapp' ? 'WhatsApp template' : 'Email'}</dd>
                  </div>
                </dl>

                <p className="font-display text-md font-semibold">
                  {subject.trim() || 'Your subject line appears here'}
                </p>

                <p className="whitespace-pre-line text-sm leading-relaxed text-secondary">
                  {rendered.trim() || 'The message body appears here, with merge fields filled in.'}
                </p>

                <p className="border-t border-line pt-3 text-xs text-muted">
                  {institutionName} · You are receiving this because you are on the alumni register. Every message
                  carries an unsubscribe link; consent withdrawal is recorded against your profile.
                </p>
              </div>

              <div className="space-y-2 border-t border-line pt-3">
                <p className="flex items-start gap-2 text-xs text-secondary">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                  <span>
                    Sending writes one audit entry: your name, the segment, the channel and the recipient count. That
                    entry is the record of the send.
                  </span>
                </p>
                <p className="flex items-start gap-2 text-xs text-secondary">
                  <Lock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                  <span>
                    This is a broadcast, not a conversation. Replies go to the alumni cell inbox; private messages
                    between members are not readable from any console.
                  </span>
                </p>
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>

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
              &ldquo;{subject.trim()}&rdquo; by {channel === 'whatsapp' ? 'WhatsApp' : 'email'}.
            </p>
            <p>{audienceLine}.</p>
            <p>
              There is no recall. Type the recipient count to confirm you have read it — that number is the one thing
              worth checking twice.
            </p>
            <p>
              The server resolves the segment again as it sends, with your own directory scope applied. If its count
              differs from this one, you are shown both.
            </p>
          </div>
        }
      />
    </>
  );
}
