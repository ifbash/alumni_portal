'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, Send } from 'lucide-react';

import { Alert, Button, Dialog, Field, Textarea, describedBy, useToast } from '@/components/ui';
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
 *    fact it is rather than as a generic failure.
 *  - **A write that was not stored is not an application.** When the
 *    response says nothing was saved, the dialog says so too. A fake
 *    "Application sent" is the one thing a student must never be shown on
 *    a screen about their own job search.
 *
 * The page renders this only for a viewer who may apply to a live posting
 * (or who already has). `panel` is the rail on a desktop; `bar` is the
 * phone's sticky action bar, which has room for the button alone.
 */

const NOTE_MAX = 600;

interface ApplyResult {
  application: { id: string; jobTitle: string; company: string; note: string | null };
  note: string;
}

type Phase = 'form' | 'sent' | 'refused';

/**
 * It has to stay true of the applicant list the poster sees. The page
 * states the same line in its rail (a server file cannot import a value
 * from this client module).
 */
const APPLY_PRIVACY_LINE =
  'The poster sees your name, branch, batch and note — never your phone or email.';

export function ApplyButton({
  jobTitle,
  company,
  alreadyApplied,
  appliedOn,
  appliedNote,
  variant = 'panel',
}: {
  jobTitle: string;
  company: string;
  alreadyApplied: boolean;
  /** Pre-formatted on the server — this file must not pull the fixture clock in. */
  appliedOn: string | null;
  appliedNote: string | null;
  variant?: 'panel' | 'bar';
}) {
  const toast = useToast();
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [open, setOpen] = React.useState(false);
  // Per instance: the page renders this button twice (the rail and the
  // phone's sticky bar), and a shared id would label the other dialog.
  const noteId = `apply-note-${React.useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [note, setNote] = React.useState('');
  const [phase, setPhase] = React.useState<Phase>('form');
  const [busy, setBusy] = React.useState(false);
  const [noteError, setNoteError] = React.useState<string | undefined>(undefined);
  const [result, setResult] = React.useState<{ note: string; persisted: boolean } | null>(null);
  const [refusal, setRefusal] = React.useState<string | null>(null);

  const jobId = params?.id ?? '';

  if (alreadyApplied) {
    if (variant === 'bar') return null;
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
        <p className="text-sm text-secondary">{APPLY_PRIVACY_LINE}</p>
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
    phase === 'sent' ? 'Application sent' : phase === 'refused' ? 'Not sent' : `Apply — ${jobTitle}`;

  const written = note.trim();

  return (
    <>
      <Button className="min-h-11 w-full" size={variant === 'bar' ? 'md' : 'lg'} onClick={() => setOpen(true)}>
        <Send className="size-4" aria-hidden="true" />
        Apply with a note
      </Button>

      <Dialog
        open={open}
        onClose={close}
        title={title}
        description={phase === 'form' ? `${company} · your application goes to the person who posted this role.` : undefined}
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
            <p className="mt-2">Nothing was sent to {company}. The posting has been refreshed to show where it stands now.</p>
          </Alert>
        ) : phase === 'sent' ? (
          <div className="space-y-4">
            {/* Fixture honesty is the Demo data marker and the toast, not this panel. */}
            <Alert tone="success" title={`Your application is with ${company}`}>
              <p>
                {result?.persisted
                  ? 'It is listed under My applications, with the note you wrote.'
                  : 'It goes to the person who posted this role, with the note you wrote.'}
              </p>
            </Alert>

            {written ? (
              <div className="space-y-1.5">
                <p className="text-sm font-semibold">The note you wrote</p>
                <blockquote className="rounded border border-line bg-surface-sunken p-3 text-sm text-secondary">
                  {written}
                </blockquote>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <Field
              htmlFor={noteId}
              label="Add a note"
              hint="Optional. Say something specific: a project you built, a subject you know well, or why this team."
              error={noteError}
            >
              <Textarea
                id={noteId}
                name="note"
                rows={5}
                maxLength={NOTE_MAX}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                invalid={Boolean(noteError)}
                placeholder="Final-year CSE. Built a UPI reconciliation tool for our capstone — happy to walk through how I handled retries."
                aria-describedby={describedBy(noteId, {
                  hint: true,
                  error: Boolean(noteError),
                })}
              />
            </Field>
            <p className="text-right text-xs tabular text-secondary">
              {note.length} / {NOTE_MAX}
            </p>

            <Alert tone="neutral" title="What the poster receives">
              <p>
                Your name, branch, batch year and this note. Not your email, not your phone number,
                not your CGPA.
              </p>
            </Alert>
          </div>
        )}
      </Dialog>
    </>
  );
}
