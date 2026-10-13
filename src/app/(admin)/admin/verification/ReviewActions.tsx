'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, ClipboardCopy, MessageSquareText, ShieldAlert, XCircle } from 'lucide-react';

import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  ConfirmDialog,
  Dialog,
  Field,
  Radio,
  StickyActionBar,
  Textarea,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';
import { cn } from '@/lib/cn';

/**
 * The decision controls for one registration.
 *
 * The only interactive leaf on the review screen: the evidence beside it
 * is server-rendered. On a desktop it is a sticky rail; on a phone the
 * three actions sit in a bar at the bottom of the screen and the row
 * choice, when there is one to make, follows the evidence.
 *
 *  1. **Approval is always approval against a row.** There is no button
 *     that says "yes" without naming which register record the account is
 *     bound to, because that binding is the verification.
 *  2. **Rejection requires a typed reason.** The server holds the same
 *     floor, and a refusal from it lands on this field.
 *  3. **The outcome shown is the server's answer**, including whether the
 *     write persisted.
 *  4. **Asking for a document is composed here and sent by hand.** There
 *     is no endpoint for it, so the dialog copies the text and says where
 *     to send it; nothing claims it was sent.
 */

export interface ReviewCandidate {
  id: string;
  rollNumber: string;
  name: string;
  departmentCode: string | null;
  yearOfPassing: number | null;
  admissionYear: number | null;
  /** "the 2019 CSE file" — never the file name itself. */
  sourceLabel: string;
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
  persisted: boolean;
}

/** The server refuses anything shorter; matching it avoids a pointless 422. */
const MIN_REASON = 10;

export function ReviewActions({
  claimId,
  claimName,
  firstName,
  claimRoll,
  claimEmail,
  claimMobile,
  candidates,
  reviewerName,
  canOverride,
  decided,
  greeting,
  signature,
  whatsapp,
  nextHref,
  auditHref,
}: {
  claimId: string;
  claimName: string;
  firstName: string;
  claimRoll: string;
  claimEmail: string;
  claimMobile: string | null;
  candidates: ReviewCandidate[];
  reviewerName: string;
  canOverride: boolean;
  decided: { status: 'approved' | 'rejected'; reviewedBy: string | null; reviewedAt: string; note: string | null } | null;
  /** The college's greeting word ("Namaste"). */
  greeting: string;
  /** "— {Office}, {shortName}". */
  signature: string;
  /** Whether the college runs WhatsApp; the send line only offers it when it does. */
  whatsapp: boolean;
  nextHref: string | null;
  /** The audit log, when this viewer can read it. */
  auditHref: string | null;
}) {
  const toast = useToast();
  const router = useRouter();

  const best = candidates[0] ?? null;
  // With one candidate there is nothing to choose, so it is pre-selected.
  // With several there is, and pre-selecting the top one is the "silently
  // picks the first" failure the server refuses to commit: this component
  // always sends a `degreeRecordId`, so the server's "choose a row" guard
  // could never fire. Start empty; Approve stays disabled until a row is
  // picked on purpose.
  const [selectedId, setSelectedId] = React.useState<string | null>(
    candidates.length === 1 ? (best?.id ?? null) : null,
  );
  const [reopened, setReopened] = React.useState(false);
  const [dialog, setDialog] = React.useState<Mode | null>(null);
  const [reason, setReason] = React.useState('');
  const [message, setMessage] = React.useState(
    `${greeting} ${firstName}, we could not confirm roll number ${claimRoll} against the degree register. Please reply with a photo of your provisional certificate or memorandum of marks, and your name exactly as it is printed on it. ${signature}`,
  );
  const [reasonTouched, setReasonTouched] = React.useState(false);
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState<Mode | null>(null);
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);
  const outcomeRef = React.useRef<HTMLDivElement>(null);

  const selected = candidates.find((c) => c.id === selectedId) ?? null;
  const reasonMissing = reason.trim().length < MIN_REASON;

  // On a phone the outcome renders below the evidence; bring it into view.
  React.useEffect(() => {
    if (!outcome) return;
    if (window.matchMedia('(max-width: 1023px)').matches) {
      outcomeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [outcome]);

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

    const { claim } = outcomeFromServer.data;

    setOutcome({
      mode,
      candidate: mode === 'approve' ? selected : null,
      reason: claim.reviewNote ?? (reason.trim() || 'No reason recorded.'),
      persisted: outcomeFromServer.persisted,
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
      toast.success('Message copied', 'Paste it into your email or chat. The registration stays in the queue.');
    } catch {
      toast.error(
        'Could not reach the clipboard',
        'Your browser blocked it. Select the message and copy it by hand — the text is unchanged.',
      );
    }
  };

  const nextLink = nextHref ? (
    <ButtonLink href={nextHref} variant="secondary" className="min-h-11 w-full">
      Next claim
      <ArrowRight className="size-4" aria-hidden="true" />
    </ButtonLink>
  ) : (
    <ButtonLink href="/admin/verification" variant="secondary" className="min-h-11 w-full">
      Back to the queue
    </ButtonLink>
  );

  // ---------------------------------------------------------------
  // Outcome
  // ---------------------------------------------------------------

  if (outcome) {
    const approved = outcome.mode === 'approve';
    return (
      <div ref={outcomeRef}>
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-full',
                  approved ? 'bg-success-soft text-success-fg' : 'bg-danger-soft text-danger-fg',
                )}
                aria-hidden="true"
              >
                {approved ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
              </span>
              <div className="min-w-0 space-y-1" role="status">
                <p className="font-semibold">
                  {approved
                    ? `Approved. ${firstName} can now sign in and see the directory.`
                    : `Rejected. ${firstName} can register again with the right details.`}
                </p>
                {approved && outcome.candidate ? (
                  <p className="text-sm text-secondary">
                    Bound to register row <span className="font-mono">{outcome.candidate.rollNumber}</span>.
                  </p>
                ) : (
                  <p className="text-sm text-secondary">Reason: {outcome.reason}</p>
                )}
              </div>
            </div>

            <p className="text-sm text-secondary">
              {auditHref ? (
                <Link href={`${auditHref}?action=verification.${outcome.mode}`} className="link">
                  Recorded in the audit log
                </Link>
              ) : (
                'Recorded in the audit log'
              )}{' '}
              against {reviewerName}.
            </p>

            <div className="space-y-2">
              {nextLink}
              <Button
                variant="ghost"
                className="min-h-11 w-full"
                onClick={() => {
                  setOutcome(null);
                  setReason('');
                  setReasonError(null);
                }}
              >
                Back to the evidence
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Already decided
  // ---------------------------------------------------------------

  if (decided && !reopened) {
    return (
      <Card>
        <CardBody className="space-y-3">
          <p className="font-semibold">This registration has been decided.</p>
          {canOverride ? (
            <>
              <Button variant="secondary" className="min-h-11 w-full" onClick={() => setReopened(true)}>
                <ShieldAlert className="size-4" aria-hidden="true" />
                Reopen the evidence
              </Button>
              <p className="text-xs text-secondary">
                A second decision cannot be recorded here yet. To change the outcome, correct the member’s status from
                their record.
              </p>
            </>
          ) : (
            <p className="text-sm text-secondary">Only the college admin can change a decided registration.</p>
          )}
          {nextLink}
        </CardBody>
      </Card>
    );
  }

  // ---------------------------------------------------------------
  // Decide
  // ---------------------------------------------------------------

  // Rendered twice (the desktop rail and the phone flow), so each copy
  // keeps its own radio group name and ids.
  const choice = (scope: 'rail' | 'flow') =>
    candidates.length > 1 ? (
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Approve against which row?</legend>
        {candidates.map((c, i) => (
          <div
            key={c.id}
            className="rounded border border-line bg-surface p-3 transition-colors duration-fast ease-brand hover:border-line-strong has-[:checked]:border-line-strong has-[:checked]:bg-brand-soft"
          >
            <Radio
              id={`cand-${scope}-${c.id}`}
              name={`candidate-${scope}`}
              checked={selectedId === c.id}
              onChange={() => setSelectedId(c.id)}
              label={
                <span className="block space-y-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold">{c.rollNumber}</span>
                    <Badge tone={i === 0 ? 'brand' : 'neutral'}>{Math.round(c.confidence * 100)}%</Badge>
                  </span>
                  <span className="block text-sm">{c.name}</span>
                  <span className="block text-xs text-secondary">
                    Admitted {c.admissionYear ?? '—'} · {c.sourceLabel}
                  </span>
                </span>
              }
            />
          </div>
        ))}
      </fieldset>
    ) : best ? (
      <p className="text-sm text-secondary">
        Approving binds {firstName} to row <span className="font-mono text-primary">{best.rollNumber}</span>.
      </p>
    ) : (
      <p className="text-sm text-secondary">There is no register row to approve against.</p>
    );

  return (
    <>
      {/* Desktop: the rail. */}
      <Card className="hidden lg:block">
        <CardBody className="space-y-4">
          <h2 className="font-display text-md font-semibold">Decision</h2>
          {choice('rail')}
          <div className="space-y-2">
            <Button onClick={() => setDialog('approve')} disabled={!selected || submitting !== null} className="w-full">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Approve
            </Button>
            <Button variant="secondary" onClick={() => setDialog('info')} disabled={submitting !== null} className="w-full">
              <MessageSquareText className="size-4" aria-hidden="true" />
              Ask for a document
            </Button>
            <Button
              variant="secondary"
              onClick={() => setDialog('reject')}
              disabled={submitting !== null}
              className="w-full text-danger-fg"
            >
              <XCircle className="size-4" aria-hidden="true" />
              Reject
            </Button>
          </div>
          <p className="text-xs text-secondary">Asking for a document keeps it in the queue.</p>
        </CardBody>
      </Card>

      {/* Phones: the row choice follows the evidence; the actions stay in reach. */}
      {candidates.length > 1 ? (
        <Card className="lg:hidden">
          <CardBody>{choice('flow')}</CardBody>
        </Card>
      ) : null}

      {/* The bar's own in-flow spacer would land mid-page, where this rail
          sits on a phone; the page puts one at its foot instead. */}
      <div className="[&>div[aria-hidden]]:hidden">
      <StickyActionBar label="Decision">
        <Button onClick={() => setDialog('approve')} disabled={!selected || submitting !== null}>
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Approve
        </Button>
        <Button
          variant="secondary"
          onClick={() => setDialog('info')}
          disabled={submitting !== null}
          aria-label="Ask for a document"
        >
          <MessageSquareText className="size-4" aria-hidden="true" />
          Ask
        </Button>
        <Button
          variant="secondary"
          onClick={() => setDialog('reject')}
          disabled={submitting !== null}
          className="text-danger-fg"
        >
          <XCircle className="size-4" aria-hidden="true" />
          Reject
        </Button>
      </StickyActionBar>
      </div>

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
          title={`Approve ${firstName}?`}
          confirmLabel="Approve"
          body={
            <div className="space-y-3">
              <p>
                <span className="font-medium text-primary">{claimName}</span> will be bound to register row{' '}
                <span className="font-mono text-primary">{selected?.rollNumber}</span> ({selected?.name}), become an
                alumni member and be able to open the directory.
              </p>
              <p>Recorded in the audit log with your name.</p>
            </div>
          }
        />
      ) : null}

      {dialog === 'reject' ? (
        <Dialog
          open
          onClose={closeDialog}
          title={`Reject ${firstName}’s registration`}
          description="The reason is kept with the decision in the audit log. Write it for them to read."
          footer={
            <>
              <Button variant="secondary" onClick={closeDialog}>
                Cancel
              </Button>
              <Button variant="danger" loading={submitting === 'reject'} onClick={() => void commit('reject')}>
                Reject
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <Field
              htmlFor="reject-reason"
              label="Reason"
              required
              hint="At least a sentence."
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
                placeholder="No register row carries this roll number. Please check it on your memorandum of marks and register again."
              />
            </Field>
            <p className="text-xs text-secondary">They can register again. This is not a ban.</p>
          </div>
        </Dialog>
      ) : null}

      {dialog === 'info' ? (
        <Dialog
          open
          onClose={closeDialog}
          title="Ask for a document"
          description={
            whatsapp && claimMobile
              ? `Copy it and send it by email to ${claimEmail} or WhatsApp to ${claimMobile}.`
              : `Copy it and send it by email to ${claimEmail}.`
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
          <div className="space-y-3">
            <Field htmlFor="info-message" label="Message" hint="Edit freely. Say exactly which document you need.">
              <Textarea id="info-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={6} />
            </Field>
            <p className="text-xs text-secondary">The registration stays in the queue and nothing about it changes.</p>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
