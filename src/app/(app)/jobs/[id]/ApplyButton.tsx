'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, Lock, Send } from 'lucide-react';

import { Alert, Badge, Button, Dialog, Field, Textarea, describedBy, useToast } from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * The apply action.
 *
 * The only client-side piece on the posting page. It collects an optional
 * note, posts it to the applications endpoint, and then reports exactly
 * what came back — including the two answers that are not success:
 *
 *  - **A second application is refused, not swallowed.** The server 409s
 *    on a posting you have already applied to, and that is shown as the
 *    fact it is rather than as a generic failure. Applying twice does not
 *    move anyone up a list, and a student should be told that once.
 *  - **A fixture write is not an application.** This build has no writable
 *    store; when the response says so, the panel says so too. A fake
 *    "Application sent" is the one thing a student must never be shown on
 *    a screen about their own job search.
 */

const NOTE_MAX = 600;

interface ApplyResult {
  application: { id: string; jobTitle: string; company: string; note: string | null };
  note: string;
}

type Phase = 'form' | 'sent' | 'refused';

export function ApplyButton({
  jobTitle,
  company,
  isLive,
  canApply,
  isAuthor,
  alreadyApplied,
  appliedOn,
  appliedNote,
  applyUrl,
}: {
  jobTitle: string;
  company: string;
  isLive: boolean;
  canApply: boolean;
  isAuthor: boolean;
  alreadyApplied: boolean;
  /** Pre-formatted on the server — this file must not pull the fixture clock in. */
  appliedOn: string | null;
  appliedNote: string | null;
  applyUrl: string | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [phase, setPhase] = React.useState<Phase>('form');
  const [busy, setBusy] = React.useState(false);
  const [noteError, setNoteError] = React.useState<string | undefined>(undefined);
  const [result, setResult] = React.useState<{ note: string; persisted: boolean } | null>(null);
  const [refusal, setRefusal] = React.useState<string | null>(null);

  const jobId = params?.id ?? '';

  if (isAuthor) {
    return (
      <div className="space-y-2">
        <Badge tone="brand">Your posting</Badge>
        <p className="text-sm text-secondary">
          You posted this role, so there is nothing to apply to. Applications are counted in the
          panel below.
        </p>
      </div>
    );
  }

  if (alreadyApplied) {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-success-fg">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          You applied{appliedOn ? ` on ${appliedOn}` : ''}
        </p>
        {appliedNote ? (
          <blockquote className="border-l-2 border-line-strong pl-3 text-sm text-secondary">
            {appliedNote}
          </blockquote>
        ) : (
          <p className="text-sm text-secondary">You applied without a note.</p>
        )}
        <p className="text-xs text-muted">
          {company} sees your name, branch and batch. You cannot apply twice — if something has
          changed, message the poster from their profile.
        </p>
      </div>
    );
  }

  if (!isLive) {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-secondary">
          <Lock className="size-4" aria-hidden="true" />
          Applications are not open
        </p>
        <p className="text-sm text-secondary">
          This posting is not live on the board, so nobody can apply to it. That is a state of the
          posting, not of your account.
        </p>
      </div>
    );
  }

  if (!canApply) {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-secondary">
          <Lock className="size-4" aria-hidden="true" />
          Your account cannot apply
        </p>
        <p className="text-sm text-secondary">
          Applying is for final-year students and alumni. Staff accounts post and moderate roles
          instead.
          {applyUrl ? ' The company careers link below still works.' : ''}
        </p>
      </div>
    );
  }

  const close = () => {
    setOpen(false);
    // Reset only after the dialog has gone, so the panel does not flicker
    // back to the empty form while it is closing.
    window.setTimeout(() => {
      setPhase('form');
      setRefusal(null);
      setNoteError(undefined);
    }, 200);
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setNoteError(undefined);

    const trimmed = note.trim();
    const outcome = await api.post<ApplyResult>(`/api/jobs/${jobId}/apply`, {
      note: trimmed ? trimmed : undefined,
    });
    setBusy(false);

    if (outcome.status === 'invalid') {
      setNoteError(outcome.fieldErrors.note);
      const t = outcomeToast(outcome, '');
      if (t && !outcome.fieldErrors.note) toast.show(t);
      return;
    }

    if (outcome.status === 'conflict') {
      // Already applied, closed, or withdrawn from the board since this
      // page rendered. Say which, and pull the page back into line.
      setRefusal(outcome.message);
      setPhase('refused');
      router.refresh();
      return;
    }

    if (outcome.status !== 'ok') {
      const t = outcomeToast(outcome, '');
      if (t) toast.show(t);
      return;
    }

    setResult({ note: outcome.data.note, persisted: outcome.persisted });
    setPhase('sent');

    const t = outcomeToast(outcome, 'Application sent');
    if (t) toast.show(t);

    // The posting page re-renders into its "you applied" state.
    if (outcome.persisted) router.refresh();
  };

  const title =
    phase === 'sent'
      ? result?.persisted
        ? 'Application sent'
        : 'Not sent'
      : phase === 'refused'
        ? 'Not sent'
        : `Apply — ${jobTitle}`;

  return (
    <div className="space-y-2">
      <Button className="w-full" onClick={() => setOpen(true)}>
        <Send className="size-4" aria-hidden="true" />
        Apply through the portal
      </Button>
      <p className="text-xs text-muted">
        The poster sees your name, branch, batch and your note. Your email and phone number are
        never attached.
      </p>

      <Dialog
        open={open}
        onClose={close}
        title={title}
        description={
          phase === 'form'
            ? `${company} · your application goes to the person who posted this role.`
            : undefined
        }
        footer={
          phase === 'form' ? (
            <>
              <Button variant="secondary" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={() => void submit()} loading={busy}>
                <Send className="size-4" aria-hidden="true" />
                Send application
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={close}>
              Close
            </Button>
          )
        }
      >
        {phase === 'refused' ? (
          <Alert tone="danger" title="This application was not accepted">
            <p>{refusal}</p>
            <p className="mt-2">
              Nothing was sent to {company}. The posting on screen has been refreshed to whatever
              its current state is.
            </p>
          </Alert>
        ) : phase === 'sent' ? (
          <div className="space-y-4">
            {result?.persisted ? (
              <Alert tone="success" title={`Your application is with ${company}`}>
                <p>{result.note}</p>
              </Alert>
            ) : (
              <Alert tone="info" title="Nothing was stored">
                <p>
                  Your note has not gone to {company}, to the poster, or to the placement cell.
                  This build runs on seeded data with no database behind it: the capability check,
                  the closing-date check and the duplicate-application check all ran on the server,
                  and the write did not.
                </p>
              </Alert>
            )}

            <div className="space-y-2">
              <p className="text-sm font-semibold">
                {result?.persisted ? 'What happens next' : 'What this does once the store is behind it'}
              </p>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-secondary">
                <li>Records an application against this posting with your note.</li>
                <li>Notifies the poster on WhatsApp and email, with your name, branch and batch.</li>
                <li>
                  Adds it to your <span className="font-medium text-primary">My applications</span>{' '}
                  tab so you can see what you said and when.
                </li>
              </ol>
            </div>

            {note.trim() ? (
              <div className="space-y-1.5">
                <p className="text-sm font-semibold">The note you wrote</p>
                <blockquote className="rounded border border-line bg-surface-sunken p-3 text-sm text-secondary">
                  {note.trim()}
                </blockquote>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <Field
              htmlFor="apply-note"
              label="Add a note"
              hint="Optional, but the ones that get read say something specific — a project you built, a module you know well, or why this team."
              error={noteError}
            >
              <Textarea
                id="apply-note"
                name="note"
                rows={5}
                maxLength={NOTE_MAX}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                invalid={Boolean(noteError)}
                placeholder="Final-year CSE. Built a UPI reconciliation tool for our capstone — happy to walk through how I handled retries."
                aria-describedby={describedBy('apply-note', {
                  hint: true,
                  error: Boolean(noteError),
                })}
              />
            </Field>
            <p className="text-right text-xs tabular text-muted">
              {note.length} / {NOTE_MAX}
            </p>

            <Alert tone="neutral" title="What the poster receives">
              <p>
                Your name, branch, batch year and this note. Not your email, not your phone number,
                not your CGPA. If they want to talk, they reply through the portal and you decide
                whether to share anything else.
              </p>
            </Alert>
          </div>
        )}
      </Dialog>
    </div>
  );
}
