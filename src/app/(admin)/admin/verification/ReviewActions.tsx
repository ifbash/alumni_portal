'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ClipboardCopy, MessageSquareWarning, ShieldAlert, XCircle } from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Dialog,
  Field,
  Fieldset,
  Radio,
  Textarea,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * The decision controls for one verification claim.
 *
 * The only interactive leaf on the review screen — the evidence above it
 * is server-rendered. Four things are deliberate here:
 *
 *  1. **Approval is always approval *against a row*.** There is no button
 *     that says "yes" without naming which register record the account is
 *     being bound to, because that binding is the verification. The chosen
 *     record id is what goes to the endpoint.
 *  2. **Rejection requires a typed reason.** The applicant is told what
 *     was wrong; "rejected" with no reason generates a support ticket and
 *     a second, identical registration the same evening. The server holds
 *     the same floor, and a refusal from it lands on this field rather
 *     than only in a toast.
 *  3. **The outcome shown is the server's answer**, not a local guess.
 *     Every field in the panel below comes back from
 *     `POST /api/admin/verification/[id]` — including whether the write
 *     actually persisted.
 *  4. **Asking for more information is composed here and sent by hand.**
 *     There is no endpoint for it yet, and the copy says so rather than
 *     showing a green tick over a message nobody sent.
 */

export interface ReviewCandidate {
  id: string;
  rollNumber: string;
  name: string;
  departmentCode: string | null;
  yearOfPassing: number | null;
  admissionYear: number | null;
  sourceFile: string | null;
  confidence: number;
  /** True when another candidate shares name, branch and year of passing. */
  contested: boolean;
}

type Mode = 'approve' | 'reject' | 'info';

/** Exactly what the endpoint returns. Nothing here is assembled locally. */
interface DecisionResponse {
  claim: {
    id: string;
    status: 'approved' | 'rejected';
    reviewedBy: string | null;
    reviewedAt: string;
    reviewNote: string | null;
    matchedDegreeRecordId: string | null;
  };
  note: string;
}

interface Outcome {
  mode: 'approve' | 'reject';
  candidate: ReviewCandidate | null;
  reason: string;
  action: string;
  persisted: boolean;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  note: string;
}

/** The server refuses anything shorter; matching it avoids a pointless 422. */
const MIN_REASON = 10;

export function ReviewActions({
  claimId,
  claimName,
  claimRoll,
  claimEmail,
  claimMobile,
  candidates,
  reviewerName,
  canOverride,
  decided,
}: {
  claimId: string;
  claimName: string;
  claimRoll: string;
  claimEmail: string;
  claimMobile: string | null;
  candidates: ReviewCandidate[];
  reviewerName: string;
  canOverride: boolean;
  decided: { status: 'approved' | 'rejected'; reviewedBy: string | null; reviewedAt: string; note: string | null } | null;
}) {
  const toast = useToast();
  const router = useRouter();

  const best = candidates[0] ?? null;
  const [selectedId, setSelectedId] = React.useState<string | null>(best?.id ?? null);
  const [reopened, setReopened] = React.useState(false);
  const [dialog, setDialog] = React.useState<Mode | null>(null);
  const [reason, setReason] = React.useState('');
  const [message, setMessage] = React.useState(
    `Namaste ${claimName}, we could not confirm roll number ${claimRoll} against the degree register. Please reply with a photo of your provisional certificate or memorandum of marks, and the exact spelling of your name as printed on it. — Alumni Cell, DIET Ganguru`,
  );
  const [reasonTouched, setReasonTouched] = React.useState(false);
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState<Mode | null>(null);
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);

  const selected = candidates.find((c) => c.id === selectedId) ?? null;
  const reasonMissing = reason.trim().length < MIN_REASON;

  const closeDialog = () => {
    setDialog(null);
    setReasonTouched(false);
  };

  const commit = async (mode: 'approve' | 'reject') => {
    if (mode === 'reject' && reasonMissing) {
      setReasonTouched(true);
      return;
    }

    setReasonError(null);
    setSubmitting(mode);

    const outcomeFromServer = await api.post<DecisionResponse>(`/api/admin/verification/${claimId}`, {
      action: mode,
      ...(mode === 'approve' ? { degreeRecordId: selected?.id } : {}),
      ...(reason.trim() ? { note: reason.trim() } : {}),
    });

    setSubmitting(null);

    if (outcomeFromServer.status === 'invalid') {
      // A 422 belongs on the field that caused it. The endpoint keys its
      // reason failures on `note`, which is this textarea.
      const onNote = outcomeFromServer.fieldErrors.note ?? null;
      setReasonError(onNote ?? outcomeFromServer.message);
      setReasonTouched(true);
      if (!onNote) closeDialog();
      const t = outcomeToast(outcomeFromServer, '');
      if (t) toast.show(t);
      return;
    }

    if (outcomeFromServer.status !== 'ok') {
      closeDialog();
      const t = outcomeToast(outcomeFromServer, '');
      if (t) toast.show(t);
      // A claim decided in another tab is the usual 409 here, and the page
      // beneath this component is now wrong. Pull it again.
      if (outcomeFromServer.status === 'conflict') router.refresh();
      return;
    }

    const { claim, note } = outcomeFromServer.data;
    const base = { claim_id: claimId, member: claimName, roll: claimRoll, email: claimEmail };

    setOutcome({
      mode,
      candidate: mode === 'approve' ? selected : null,
      reason: claim.reviewNote ?? (reason.trim() || 'No reason recorded.'),
      action: `verification.${mode}`,
      persisted: outcomeFromServer.persisted,
      // The state this reviewer was just looking at: a queued claim is
      // undecided by definition, which is the only way to reach these
      // controls at all.
      before: { ...base, claim_status: 'queued', reviewed_by: null, reviewed_at: null, review_note: null },
      // Straight off the response.
      after: {
        ...base,
        claim_status: claim.status,
        reviewed_by: claim.reviewedBy,
        reviewed_at: claim.reviewedAt,
        review_note: claim.reviewNote,
        matched_degree_record_id: claim.matchedDegreeRecordId,
      },
      note,
    });

    closeDialog();

    const t = outcomeToast(
      outcomeFromServer,
      mode === 'approve'
        ? `${claimName} is bound to register row ${selected?.rollNumber ?? '—'}`
        : 'Claim rejected',
    );
    if (t) toast.show(t);

    // Only worth re-reading the server when the server has something new
    // to say. In fixture mode nothing was stored, and a refresh would put
    // the claim back in front of the reviewer as though nothing happened.
    if (outcomeFromServer.persisted) router.refresh();
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.trim());
      toast.success('Message copied', 'Paste it into WhatsApp or your mail client. The claim stays queued.');
    } catch {
      toast.error(
        'Could not reach the clipboard',
        'Your browser blocked it. Select the message and copy it by hand — the text is unchanged.',
      );
    }
  };

  // ---------------------------------------------------------------
  // Already decided
  // ---------------------------------------------------------------

  if (decided && !reopened && !outcome) {
    return (
      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle as="h2">This claim has already been decided</CardTitle>
            <CardDescription>
              Decisions are kept with the reviewer and the reason, so a member who asks &ldquo;why was I
              rejected&rdquo; gets an answer rather than an apology.
            </CardDescription>
          </div>
          <Badge tone={decided.status === 'approved' ? 'success' : 'danger'}>
            {decided.status === 'approved' ? 'Approved' : 'Rejected'}
          </Badge>
        </CardHeader>
        <CardBody className="space-y-4">
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-secondary">Decided by</dt>
              <dd className="text-sm font-medium">{decided.reviewedBy ?? 'Unknown reviewer'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-secondary">Decided on</dt>
              <dd className="text-sm font-medium tabular">{decided.reviewedAt}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-secondary">Reason recorded</dt>
              <dd className="text-sm font-medium">{decided.note ?? 'No reason was recorded.'}</dd>
            </div>
          </dl>

          {canOverride ? (
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <Button variant="secondary" onClick={() => setReopened(true)}>
                <ShieldAlert className="size-4" aria-hidden="true" />
                Reopen the evidence
              </Button>
              <p className="text-xs text-secondary">
                You hold <span className="font-mono">verification.override</span>, so you can read the claim against the
                register again. Submitting a second decision is refused for now — the endpoint takes a claim that is
                still queued, and reopening a decided one is a separate override path that has not been built. Until it
                is, correct the person&rsquo;s status from their{' '}
                <span className="font-mono">/admin/members</span> record, which is wired and audited.
              </p>
            </div>
          ) : (
            <p className="border-t border-line pt-4 text-xs text-secondary">
              Overturning a decided claim needs <span className="font-mono">verification.override</span>, which you do
              not hold. Ask the college admin, or the alumni cell.
            </p>
          )}
        </CardBody>
      </Card>
    );
  }

  // ---------------------------------------------------------------
  // Outcome
  // ---------------------------------------------------------------

  if (outcome) {
    return (
      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle as="h2">
              {outcome.mode === 'approve' ? 'Claim approved' : 'Claim rejected'}
            </CardTitle>
            <CardDescription>
              What the server recorded, field by field. This is the audit entry, not a summary of it.
            </CardDescription>
          </div>
          <Badge tone={outcome.mode === 'approve' ? 'success' : 'danger'}>{outcome.action}</Badge>
        </CardHeader>
        <CardBody className="space-y-4">
          {outcome.mode === 'approve' && outcome.candidate ? (
            <Alert tone="success" title="Bound to one register row" icon={<CheckCircle2 className="size-4" />}>
              <p>
                {claimName} is linked to <span className="font-mono">{outcome.candidate.rollNumber}</span> —{' '}
                {outcome.candidate.name}
                {outcome.candidate.sourceFile ? (
                  <>
                    , loaded from <span className="font-mono">{outcome.candidate.sourceFile}</span>
                  </>
                ) : null}
                . Their status moves to <span className="font-mono">active_alumni</span> and the alumni role is granted,
                which is what opens the directory to them.
              </p>
            </Alert>
          ) : null}

          <p className="text-sm text-secondary">{outcome.note}</p>

          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-secondary">Actor</dt>
              <dd className="text-sm font-medium">{reviewerName}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-secondary">Resource</dt>
              <dd className="font-mono text-sm">verification_claim / {claimId}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-secondary">Reason</dt>
              <dd className="text-sm">{outcome.reason}</dd>
            </div>
          </dl>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Before</p>
              <pre className="overflow-x-auto rounded border border-line bg-surface-sunken p-3 font-mono text-xs">
                {JSON.stringify(outcome.before, null, 2)}
              </pre>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary">After</p>
              <pre className="overflow-x-auto rounded border border-line bg-surface-sunken p-3 font-mono text-xs">
                {JSON.stringify(outcome.after, null, 2)}
              </pre>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setOutcome(null);
                setReason('');
                setReasonError(null);
              }}
            >
              Back to the evidence
            </Button>
            {outcome.persisted ? (
              <p className="text-xs text-muted">
                Written to <span className="font-mono">audit_log</span>. Audit rows are append-only and cannot be
                removed, including by you.
              </p>
            ) : (
              <p className="text-xs text-muted">
                This build runs on seeded data with no database behind it. Every permission check and the audit entry
                ran against your account; the write to the claim did not, so the queue still shows it as waiting.
              </p>
            )}
          </div>
        </CardBody>
      </Card>
    );
  }

  // ---------------------------------------------------------------
  // Decide
  // ---------------------------------------------------------------

  return (
    <>
      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle as="h2">Decide this claim</CardTitle>
            <CardDescription>
              Each action writes one row to <span className="font-mono">audit_log</span> — your name, the claim, the
              before and after snapshot, and the reason you give. None of it is silent, and none of it is editable
              afterwards.
            </CardDescription>
          </div>
        </CardHeader>

        <CardBody className="space-y-5">
          {candidates.length === 0 ? (
            <Alert tone="danger" title="There is nothing to approve against" icon={<ShieldAlert className="size-4" />}>
              <p>
                No row in the degree register carries roll number <span className="font-mono">{claimRoll}</span>. Either
                the batch file from the examinations branch has not been loaded, or the roll number is wrong. Ask for the
                provisional certificate before you consider approving — an approval with no register row is exactly the
                unverified account this queue exists to prevent.
              </p>
            </Alert>
          ) : (
            <Fieldset
              legend="Approve against which register row?"
              hint={
                candidates.some((c) => c.contested)
                  ? 'Two rows carry this name in the same branch and year. Choose on roll number, admission year and source file — the fields that actually separate them.'
                  : 'The account is bound to the row you pick here. That binding is the verification.'
              }
            >
              <div className="space-y-2">
                {candidates.map((c, i) => (
                  <div
                    key={c.id}
                    className="rounded border border-line bg-surface p-3 transition-colors duration-fast ease-brand hover:border-line-strong has-[:checked]:border-line-strong has-[:checked]:bg-brand-soft"
                  >
                    <Radio
                      id={`cand-${c.id}`}
                      name="candidate"
                      checked={selectedId === c.id}
                      onChange={() => setSelectedId(c.id)}
                      label={
                        <span className="block space-y-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-semibold">{c.rollNumber}</span>
                            <Badge tone={i === 0 ? 'brand' : 'neutral'}>
                              {Math.round(c.confidence * 100)}% · {i === 0 ? 'best match' : `candidate ${i + 1}`}
                            </Badge>
                            {c.contested ? <Badge tone="warning">contested</Badge> : null}
                          </span>
                          <span className="block text-sm">{c.name}</span>
                          <span className="block text-xs text-secondary">
                            {c.departmentCode ?? 'branch not recorded'} · passed {c.yearOfPassing ?? '—'} · admitted{' '}
                            {c.admissionYear ?? '—'} · <span className="font-mono">{c.sourceFile ?? 'source unknown'}</span>
                          </span>
                        </span>
                      }
                    />
                  </div>
                ))}
              </div>
            </Fieldset>
          )}

          <div className="flex flex-wrap gap-3 border-t border-line pt-4">
            <Button onClick={() => setDialog('approve')} disabled={!selected || submitting !== null}>
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Approve against this row
            </Button>
            <Button variant="danger" onClick={() => setDialog('reject')} disabled={submitting !== null}>
              <XCircle className="size-4" aria-hidden="true" />
              Reject with a reason
            </Button>
            <Button variant="secondary" onClick={() => setDialog('info')} disabled={submitting !== null}>
              <MessageSquareWarning className="size-4" aria-hidden="true" />
              Ask for more information
            </Button>
          </div>

          <p className="text-xs text-secondary">
            Asking for more information leaves the claim in the queue. It is the right move whenever the evidence is
            thin — a rejection the applicant does not understand comes back as a second registration the same evening.
            The portal drafts that message; sending it is still done from the alumni cell&rsquo;s own WhatsApp and
            mailbox.
          </p>
        </CardBody>
      </Card>

      {/* Only the open dialog is mounted: the kit's Dialog labels itself
          with a fixed id, so three of them in the tree at once would put
          three `dialog-title` ids on the page. */}
      {dialog === 'approve' ? (
      <ConfirmDialog
        open
        onClose={closeDialog}
        onConfirm={() => void commit('approve')}
        pending={submitting === 'approve'}
        tone="primary"
        title="Approve this claim?"
        confirmLabel="Approve and grant alumni access"
        body={
          <div className="space-y-3">
            <p>
              <span className="font-medium text-primary">{claimName}</span> will be bound to register row{' '}
              <span className="font-mono text-primary">{selected?.rollNumber}</span> ({selected?.name}).
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Status moves <span className="font-mono">pending → active_alumni</span>
              </li>
              <li>The alumni role is granted, which opens the directory to them</li>
              <li>
                The account is linked to <span className="font-mono">degree_register.{selected?.id}</span>
              </li>
              <li>
                One row is written to <span className="font-mono">audit_log</span> with the before and after snapshot
              </li>
            </ul>
          </div>
        }
      />
      ) : null}

      {dialog === 'reject' ? (
      <Dialog
        open
        onClose={closeDialog}
        title="Reject this claim"
        description="The reason is sent to the applicant and kept in the audit log. Write it for them to read."
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog}>
              Cancel
            </Button>
            <Button variant="danger" loading={submitting === 'reject'} onClick={() => void commit('reject')}>
              Reject the claim
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field
            htmlFor="reject-reason"
            label="Reason for rejection"
            required
            hint="At least a sentence. This is what the applicant is shown."
            error={
              reasonError ??
              (reasonTouched && reasonMissing ? `Give a reason of at least ${MIN_REASON} characters.` : null)
            }
          >
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError(null);
              }}
              invalid={Boolean(reasonError) || (reasonTouched && reasonMissing)}
              placeholder="No row in the 2016 CSE register carries this roll number. Please check the roll number on your memorandum of marks and register again."
            />
          </Field>
          <p className="text-xs text-secondary">
            Rejecting sets the member to <span className="font-mono">rejected</span>. They can register again — this is
            not a ban, and the copy the applicant reads should make that obvious.
          </p>
        </div>
      </Dialog>
      ) : null}

      {dialog === 'info' ? (
      <Dialog
        open
        onClose={closeDialog}
        title="Ask for more information"
        description={
          claimMobile
            ? `Send it over WhatsApp to ${claimMobile}, with email to ${claimEmail} as the fallback.`
            : `No mobile number on this claim — email to ${claimEmail} is the only route.`
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog}>
              Close
            </Button>
            <Button onClick={() => void copyMessage()}>
              <ClipboardCopy className="size-4" aria-hidden="true" />
              Copy the message
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field htmlFor="info-message" label="Message" hint="Edit freely. Say exactly which document you need.">
            <Textarea id="info-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={6} />
          </Field>
          <Alert tone="neutral" icon={<MessageSquareWarning className="size-4" />}>
            <p>
              The portal cannot send this yet — there is no request-information endpoint behind this screen, so nothing
              here reaches the applicant on its own. Copy the text and send it from the alumni cell&rsquo;s WhatsApp or
              mailbox. Approve and reject are wired; this one is not, and pretending otherwise would leave an applicant
              waiting on a message nobody sent.
            </p>
          </Alert>
          <p className="text-xs text-secondary">
            The claim stays in the queue and the clock keeps running. Nothing about the member&rsquo;s status changes.
          </p>
        </div>
      </Dialog>
      ) : null}
    </>
  );
}
