'use client';

import * as React from 'react';
import { Download, Lock, ShieldCheck, TriangleAlert } from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  DetailRow,
  Dialog,
  Field,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * Downloading the applicant list.
 *
 * Reading who applied and walking away with a copy are different acts, so
 * this is a different capability from the page around it:
 * `job.applicants.export`, which the placement cell and the college admin
 * hold. Posting the role does not carry it — an alumnus reads their own
 * applicants on the page and cannot take the file.
 *
 * The rules are stated here rather than only in a policy note, because
 * this is the screen where somebody decides to take the file:
 *
 *  - a written reason, twenty-five characters minimum, stored verbatim;
 *  - the audit row — actor, posting, row count and the exact column list —
 *    is written *before* the file is built;
 *  - no email and no mobile in the file, at any tier. Bulk contact data is
 *    `member.export`, college admin only, and it does not ride along here.
 *
 * The CSV is assembled by the server and handed over finished. Nothing on
 * this side decides a column, so the file and the rules above cannot drift
 * apart.
 */

const MIN_REASON = 25;

interface ExportPreview {
  rowCount: number;
  columns: string[];
  includesRollNumbers: boolean;
  neverIncluded: string[];
  minReasonLength: number;
  auditedAs: string;
  note: string;
}

interface ExportResult {
  rowCount: number;
  columns: string[];
  filename: string;
  contentType: string;
  csv: string;
  note: string;
}

export function ExportApplicantsDialog({
  jobId,
  jobTitle,
  company,
  applicantCount,
}: {
  jobId: string;
  jobTitle: string;
  company: string;
  /** What the page counted, so the dialog is honest before it asks. */
  applicantCount: number;
}) {
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [refusal, setRefusal] = React.useState<{ denied: boolean; message: string } | null>(null);
  const [preview, setPreview] = React.useState<ExportPreview | null>(null);
  const [recorded, setRecorded] = React.useState<{ reason: string; result: ExportResult } | null>(null);

  const uid = React.useId();
  const reasonId = `applicants-reason-${uid}`;

  const short = reason.trim().length < MIN_REASON;
  const rowCount = preview?.rowCount ?? applicantCount;

  // The exact column list the server will write, fetched from the export
  // endpoint under the same capability. Until it answers, nothing claims a
  // column that might not be there.
  const columns = preview?.columns ?? null;

  React.useEffect(() => {
    if (!open || preview) return;
    let live = true;
    void api
      .get<ExportPreview>(`/api/jobs/${encodeURIComponent(jobId)}/applicants/export`)
      .then((outcome) => {
        if (live && outcome.status === 'ok') setPreview(outcome.data);
      });
    return () => {
      live = false;
    };
  }, [open, preview, jobId]);

  const close = () => {
    if (pending) return;
    setOpen(false);
    setRefusal(null);
    // Reset only after a completed export, so a carefully typed reason
    // survives a stray Escape keypress.
    if (recorded) {
      setRecorded(null);
      setReason('');
      setTouched(false);
      setReasonError(null);
    }
  };

  const submit = async () => {
    setTouched(true);
    if (short || pending) return;

    setPending(true);
    setReasonError(null);
    setRefusal(null);

    const written = reason.trim();
    const outcome = await api.post<ExportResult>(
      `/api/jobs/${encodeURIComponent(jobId)}/applicants/export`,
      { reason: written },
    );

    setPending(false);

    if (outcome.status !== 'ok') {
      const t = outcomeToast(outcome, 'Applicant list exported');
      if (t) toast.show(t);

      if (outcome.status === 'invalid') {
        // A 422 lands on the field that caused it, not only in a toast.
        const onReason = outcome.fieldErrors.reason ?? null;
        setReasonError(onReason);
        if (!onReason) setRefusal({ denied: false, message: outcome.message });
        return;
      }

      setRefusal({ denied: outcome.status === 'denied', message: outcome.message });
      return;
    }

    const result = outcome.data;
    // Finished bytes from the server; the browser only saves them.
    const blob = new Blob([result.csv], { type: result.contentType || 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.append(link);
    link.click();
    link.remove();
    // Revoked on the next tick: revoking synchronously races the download
    // in Firefox and the file arrives empty.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    setRecorded({ reason: written, result });
    toast.success(
      'Applicant list exported',
      `job.applicants.export written against your name. ${result.rowCount.toLocaleString('en-IN')} rows from ${jobTitle} at ${company}.`,
    );
  };

  return (
    <>
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        <Download className="size-4" aria-hidden="true" />
        Export as CSV
      </Button>

      <Dialog
        open={open}
        onClose={close}
        title={recorded ? 'Export recorded' : 'Export the applicant list'}
        description={
          recorded
            ? undefined
            : `Everyone who applied to ${jobTitle} at ${company}, for the placement cell’s own shortlisting.`
        }
        size="md"
        footer={
          recorded ? (
            <Button variant="secondary" onClick={close}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={close} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={short} loading={pending}>
                <Download className="size-4" aria-hidden="true" />
                Record and export
              </Button>
            </>
          )
        }
      >
        {recorded ? (
          <div className="space-y-4">
            <Alert tone="success" title="Written to the audit log" icon={<ShieldCheck className="size-4" />}>
              <p>
                Audit rows are append-only. This entry cannot be edited or removed, including by
                you.
              </p>
            </Alert>

            <dl className="divide-y divide-line">
              <DetailRow label="Action">
                <span className="font-mono text-sm">job.applicants.export</span>
              </DetailRow>
              <DetailRow label="Posting">
                {jobTitle} · {company}
              </DetailRow>
              <DetailRow label="Rows">
                <span className="tabular">{recorded.result.rowCount.toLocaleString('en-IN')}</span>
              </DetailRow>
              <DetailRow label="Columns">
                <span className="text-sm text-secondary">{recorded.result.columns.join(', ')}</span>
              </DetailRow>
              <DetailRow label="File">
                <span className="font-mono text-xs">{recorded.result.filename}</span>
              </DetailRow>
              <DetailRow label="Reason">
                <span className="text-sm font-normal text-secondary">{recorded.reason}</span>
              </DetailRow>
            </dl>

            <p className="text-xs text-secondary">{recorded.result.note}</p>
          </div>
        ) : (
          <div className="space-y-5">
            <Alert
              tone="warning"
              title={`${rowCount.toLocaleString('en-IN')} applicant${rowCount === 1 ? '' : 's'}, one row each`}
              icon={<TriangleAlert className="size-4" />}
            >
              <p>
                These are final-year students. Once the file leaves the portal the college can no
                longer control who reads it, and the students have no way to withdraw it.
              </p>
            </Alert>

            <Field
              htmlFor={reasonId}
              label="Why is this list being exported?"
              required
              hint="Name the drive and who asked for it. Stored verbatim in the audit log."
              error={
                reasonError ??
                (touched && short
                  ? `Write at least ${MIN_REASON} characters. "Shortlisting" is not a reason.`
                  : null)
              }
            >
              <Textarea
                id={reasonId}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (reasonError) setReasonError(null);
                }}
                onBlur={() => setTouched(true)}
                invalid={Boolean(reasonError) || (touched && short)}
                disabled={pending}
                aria-describedby={describedBy(reasonId, {
                  hint: true,
                  error: Boolean(reasonError) || (touched && short),
                })}
                placeholder={`Shortlisting for the ${company} campus drive on 4 Sep — list requested by the placement officer to share with the panel.`}
                rows={3}
              />
            </Field>

            <div className="rounded-lg border border-line bg-surface-sunken p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-secondary">
                <Lock className="size-3.5" aria-hidden="true" />
                What the file contains
              </p>

              {columns ? (
                <ul className="flex flex-wrap gap-1.5">
                  {columns.map((c) => (
                    <li key={c}>
                      <Badge tone={c === 'Roll number' ? 'brand' : 'outline'}>{c}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-secondary">
                  Reading the column list from the server — it is the same list the audit entry
                  records, so it is not guessed here.
                </p>
              )}

              <p className="mt-3 text-xs text-secondary">
                <span className="font-semibold text-primary">
                  Never in the file: {(preview?.neverIncluded ?? ['Email', 'Mobile']).join(' and ')}.
                </span>{' '}
                Bulk contact data is <span className="font-mono">member.export</span>, college admin
                only, and it does not ride along here. To reach an applicant, message them from the
                posting.
              </p>

              <p className="mt-2 text-xs text-secondary">
                {preview?.note ??
                  'The audit row — your name, this posting, the row count and the reason you type — is written before the file is built. Audit rows are append-only; you cannot remove your own.'}
              </p>
            </div>

            {refusal ? (
              <Alert
                tone="danger"
                title={refusal.denied ? 'Not yours to download' : 'The export was refused'}
                icon={<Lock className="size-4" />}
              >
                <p>{refusal.message}</p>
                {refusal.denied ? (
                  <p className="mt-2">
                    Downloading the list needs <span className="font-mono">job.applicants.export</span>,
                    which the placement cell holds. Posting the role lets you read every applicant on
                    this page; it does not let you keep a copy. Nothing was exported and no file
                    reached this machine.
                  </p>
                ) : null}
              </Alert>
            ) : null}
          </div>
        )}
      </Dialog>
    </>
  );
}
