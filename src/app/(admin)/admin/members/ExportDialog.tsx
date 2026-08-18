'use client';

import * as React from 'react';
import { Download, Lock, ShieldCheck, TriangleAlert } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  DetailRow,
  Dialog,
  Field,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import { api, outcomeToast, type ApiOutcome } from '@/lib/client/api';

/**
 * Bulk contact export.
 *
 * `member.export` is held by `college_admin` and nothing else — not the
 * alumni cell operator, not the placement officer, not an HOD. Staff
 * leave, and an exportable directory leaves with them.
 *
 * The dialog will not submit without a written reason. That is not
 * friction for its own sake: "who exported the alumni list, what did it
 * cover, and why" is the first question asked after a leak, and an empty
 * column is not an answer. The reason, the actor and the scope are shown
 * back before the button is live, so nobody can claim they did not know
 * the export was attributable.
 *
 * The server decides all of that. This posts to `POST
 * /api/admin/members/export`, which re-checks the capability, re-checks
 * the reason length, writes the audit row and only then builds the file.
 * A refusal from that endpoint is the product working, and it is reported
 * here as a sentence about permission rather than as an error.
 */

const MIN_REASON = 25;

interface ExportPreview {
  totalMembers: number;
  minReasonLength: number;
  columns: string[];
  auditedAs: string;
  note: string;
}

interface ExportedFile {
  filename: string;
  rowCount: number | null;
}

/**
 * The one endpoint in this screen's reach that answers with a file rather
 * than JSON, so `api.post()` cannot carry the result: it reads the body as
 * JSON and a CSV is not that.
 *
 * The status mapping below is deliberately the *same* taxonomy as
 * `@/lib/client/api` — same `ApiOutcome` union, same `outcomeToast` — so
 * there is one vocabulary of failure in the app and not two. The proper
 * home for this is an `api.download()` beside `api.post()`; that file was
 * out of scope for this change and the duplication is flagged rather than
 * hidden.
 */
async function postForFile(path: string, body: unknown): Promise<ApiOutcome<ExportedFile>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/csv' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return {
      status: 'offline',
      message:
        'Nothing reached the server. Your device looks to be offline — reconnect and try again; nothing was exported and no audit row was written.',
    };
  }

  if (res.ok) {
    const blob = await res.blob();
    const filename =
      /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'members.csv';
    const rowHeader = Number(res.headers.get('x-row-count'));

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    // Revoked on the next tick: revoking synchronously races the download
    // in Firefox and the file arrives empty.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    return {
      status: 'ok',
      data: { filename, rowCount: Number.isFinite(rowHeader) && rowHeader > 0 ? rowHeader : null },
      // The CSV is assembled from the real member rows either way. Fixture
      // mode has nothing to persist here — an export is a read plus an
      // audit entry, and both of those happened.
      persisted: true,
    };
  }

  const err = ((await res.json().catch(() => null)) ?? {}) as {
    error?: string;
    message?: string;
    code?: string;
    fieldErrors?: Record<string, string>;
  };
  const message = err.error ?? err.message ?? null;

  switch (res.status) {
    case 400:
    case 422:
      return {
        status: 'invalid',
        message: message ?? 'Check the highlighted fields and try again.',
        fieldErrors: err.fieldErrors ?? {},
      };
    case 401:
      return {
        status: 'denied',
        code: err.code ?? 'not_authenticated',
        message: message ?? 'Your session has ended. Sign in again to continue.',
      };
    case 403:
      return {
        status: 'denied',
        code: err.code ?? 'forbidden',
        message: message ?? 'You do not have permission to do that.',
      };
    case 404:
      return { status: 'missing', message: message ?? 'That endpoint is not connected in this build.' };
    case 409:
      return {
        status: 'conflict',
        code: err.code ?? 'conflict',
        message: message ?? 'That conflicts with something already recorded.',
      };
    case 429:
      return {
        status: 'rate_limited',
        retryAfter: Number(res.headers.get('retry-after') ?? 60),
        message: message ?? 'Too many exports. Wait a moment and try again.',
      };
    case 501:
      return {
        status: 'missing',
        message:
          message ??
          'The export is not wired to the database yet. Every permission check ran; no file was produced.',
      };
    default:
      return {
        status: 'error',
        message: message ?? 'The export failed at our end. Nothing was downloaded.',
        httpStatus: res.status,
      };
  }
}

/**
 * The filters the export inherits, read from the address bar at the moment
 * of submitting.
 *
 * The list on screen is filtered by query string, and the file has to be
 * the same cut of the data — a dialog that says "412 rows, CSE, 2019–2021"
 * and posts an unfiltered export is worse than no filter at all.
 */
function scopeFromUrl(): { q?: string; status?: string; department?: string } {
  if (typeof window === 'undefined') return {};
  const sp = new URLSearchParams(window.location.search);
  const scope: { q?: string; status?: string; department?: string } = {};
  const q = sp.get('q')?.trim();
  const status = sp.get('status')?.trim();
  const department = sp.get('department')?.trim();
  if (q) scope.q = q;
  if (status && status !== 'all') scope.status = status;
  if (department) scope.department = department;
  return scope;
}

export function ExportDialog({
  rowCount,
  scopeLabel,
  actorName,
  actorEmail,
  fields,
  defaultOpen = false,
}: {
  rowCount: number;
  /** Human summary of the filters the export will inherit. */
  scopeLabel: string;
  actorName: string;
  actorEmail: string;
  fields: string[];
  defaultOpen?: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = React.useState(defaultOpen);
  const [reason, setReason] = React.useState('');
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [touched, setTouched] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [refusal, setRefusal] = React.useState<{ denied: boolean; message: string } | null>(null);
  const [recorded, setRecorded] = React.useState<{ reason: string; file: ExportedFile } | null>(null);
  const [preview, setPreview] = React.useState<ExportPreview | null>(null);

  const short = reason.trim().length < MIN_REASON;
  const blocked = short || !acknowledged;

  // The column list the server will actually write, fetched from the same
  // endpoint under the same capability. Until it answers, the page's own
  // summary stands in — never a longer list than the file really has.
  const columns = preview?.columns ?? fields;

  React.useEffect(() => {
    if (!open || preview) return;
    let live = true;
    void api.get<ExportPreview>('/api/admin/members/export').then((outcome) => {
      if (live && outcome.status === 'ok') setPreview(outcome.data);
    });
    return () => {
      live = false;
    };
  }, [open, preview]);

  const close = () => {
    if (pending) return;
    setOpen(false);
    setRefusal(null);
    // Reset only after a completed export, so a mistyped reason survives a
    // stray Escape keypress.
    if (recorded) {
      setRecorded(null);
      setReason('');
      setAcknowledged(false);
      setTouched(false);
      setReasonError(null);
    }
  };

  const submit = async () => {
    setTouched(true);
    if (blocked || pending) return;

    setPending(true);
    setReasonError(null);
    setRefusal(null);

    const written = reason.trim();
    const outcome = await postForFile('/api/admin/members/export', {
      reason: written,
      acknowledged,
      scope: scopeFromUrl(),
      // Placement-side data does not ride along in a contact export.
      includeAcademic: false,
    });

    setPending(false);

    if (outcome.status === 'ok') {
      setRecorded({ reason: written, file: outcome.data });
      toast.success(
        'Export recorded',
        `member.export written against ${actorName}. ${(outcome.data.rowCount ?? rowCount).toLocaleString('en-IN')} rows, ${scopeLabel}.`,
      );
      return;
    }

    const t = outcomeToast(outcome, 'Export recorded');
    if (t) toast.show(t);

    if (outcome.status === 'invalid') {
      // A 422 lands on the field that caused it, not only in a toast.
      setReasonError(outcome.fieldErrors.reason ?? null);
      if (!outcome.fieldErrors.reason) setRefusal({ denied: false, message: outcome.message });
      return;
    }

    setRefusal({ denied: outcome.status === 'denied', message: outcome.message });
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Download className="size-4" />
        Export contacts
      </Button>

      <Dialog
        open={open}
        onClose={close}
        title={recorded ? 'Export recorded' : 'Export member contact details'}
        description={
          recorded
            ? undefined
            : 'Bulk contact export is restricted to the college admin and is written to the audit log with your name against it.'
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
              <Button onClick={submit} disabled={blocked} loading={pending}>
                <Download className="size-4" />
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
                Audit rows are append-only. This entry cannot be edited or removed, including by you.
              </p>
            </Alert>

            <dl className="divide-y divide-line">
              <DetailRow label="Action">
                <span className="font-mono text-sm">member.export</span>
              </DetailRow>
              <DetailRow label="Actor">{actorName}</DetailRow>
              <DetailRow label="Scope">{scopeLabel}</DetailRow>
              <DetailRow label="Rows">
                <span className="tabular">
                  {(recorded.file.rowCount ?? rowCount).toLocaleString('en-IN')}
                </span>
              </DetailRow>
              <DetailRow label="Fields">
                <span className="text-sm text-secondary">{columns.join(', ')}</span>
              </DetailRow>
              <DetailRow label="File">
                <span className="font-mono text-xs">{recorded.file.filename}</span>
              </DetailRow>
              <DetailRow label="Reason">
                <span className="text-sm font-normal text-secondary">{recorded.reason}</span>
              </DetailRow>
            </dl>

            <p className="text-xs text-secondary">
              The file was assembled on the server — the browser never builds one — and has been
              saved to this machine as{' '}
              <span className="font-mono">{recorded.file.filename}</span>. The audit entry names{' '}
              <span className="font-mono">{actorEmail}</span>. Delete the file once the purpose you
              wrote above is met: the audit row outlives it, and it names you.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <Alert
              tone="warning"
              title={`${rowCount.toLocaleString('en-IN')} member records, contact fields included`}
              icon={<TriangleAlert className="size-4" />}
            >
              <p>
                The file inherits the filters on screen — <strong>{scopeLabel}</strong>. It contains{' '}
                {columns.join(', ')}. Once it leaves the portal the college can no longer control who
                reads it.
              </p>
            </Alert>

            <Field
              htmlFor="export-reason"
              label="Why is this export being taken?"
              required
              hint="Name the purpose specifically — the submission, the committee, or the person who asked for it. Stored verbatim in the audit log."
              error={
                reasonError ??
                (touched && short
                  ? `Write at least ${MIN_REASON} characters. "Reporting" is not a reason.`
                  : null)
              }
            >
              <Textarea
                id="export-reason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (reasonError) setReasonError(null);
                }}
                onBlur={() => setTouched(true)}
                invalid={Boolean(reasonError) || (touched && short)}
                disabled={pending}
                aria-describedby={describedBy('export-reason', {
                  hint: true,
                  error: Boolean(reasonError) || (touched && short),
                })}
                placeholder="NAAC Criterion 5 submission — alumni engagement evidence requested by the IQAC on 12 Aug."
                rows={3}
              />
            </Field>

            <div className="rounded-lg border border-line bg-surface-sunken p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-secondary">
                <Lock className="size-3.5" aria-hidden="true" />
                Recorded with the export
              </p>
              <dl className="divide-y divide-line">
                <DetailRow label="Actor">
                  <span className="flex flex-wrap items-center gap-2">
                    {actorName}
                    <Badge tone="brand">College admin</Badge>
                  </span>
                </DetailRow>
                <DetailRow label="Scope">{scopeLabel}</DetailRow>
                <DetailRow label="Rows">
                  <span className="tabular">{rowCount.toLocaleString('en-IN')}</span>
                </DetailRow>
              </dl>
              <p className="mt-3 text-xs text-secondary">
                {preview?.note ??
                  'Your name, the scope and the reason are written to the audit log before a single row is read. Audit rows are append-only and cannot be removed, including by you.'}
              </p>
            </div>

            <Checkbox
              id="export-ack"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              disabled={pending}
              label="I am accountable for this file and for deleting it once the stated purpose is met."
              hint="DPDP purpose limitation: the export may only be used for the reason written above."
            />

            {refusal ? (
              <Alert
                tone="danger"
                title={refusal.denied ? 'This is the college administrator’s to run' : 'The export was refused'}
                icon={<Lock className="size-4" />}
              >
                <p>{refusal.message}</p>
                {refusal.denied ? (
                  <p className="mt-2">
                    <span className="font-mono">member.export</span> sits with the college admin
                    alone — not the alumni cell, not the placement officer, not an HOD. Staff leave,
                    and an exportable directory leaves with them, so the list is not something a
                    departing account can take on its way out. Ask the college admin to run it and
                    to record who asked. Nothing was exported and no file reached this machine.
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
