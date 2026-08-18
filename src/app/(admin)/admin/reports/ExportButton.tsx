'use client';

import * as React from 'react';
import { Download, FileSpreadsheet, Lock, ShieldCheck, TriangleAlert } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  DetailRow,
  Dialog,
  Field,
  Select,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';

/**
 * The two ways a figure leaves this console.
 *
 * They look similar and are governed completely differently, which is the
 * whole point of keeping them in one file where nobody can copy the wrong
 * one:
 *
 *  - `ExportButton` downloads the report — aggregate figures, no contact
 *    data, `audit.read`. The audit entry records which framework was
 *    asked for. No reason is demanded, because nothing personal moves.
 *  - `PerceptionSurveyDialog` downloads the NIRF perception list — roll
 *    number, name and email for every contactable graduate. That is bulk
 *    contact data, so it is `member.export`, `college_admin` only, and it
 *    will not run without a written reason. Same rules as the members
 *    export, deliberately.
 *
 * Neither builds a file in the browser. The CSV is assembled on the server
 * by the reporting module, so the spreadsheet and the screen cannot drift
 * apart, and the audit row is written before a single byte is generated.
 */

const MIN_REASON = 25;

export interface FrameworkOption {
  value: string;
  label: string;
  sections: number;
  metrics: number;
  caveats: number;
}

/** Pull the server's filename out of the response rather than guessing. */
function filenameFrom(res: Response, fallback: string): string {
  const header = res.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(header);
  return match?.[1] ?? fallback;
}

async function download(res: Response, fallbackName: string): Promise<void> {
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filenameFrom(res, fallbackName);
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked on the next tick: revoking synchronously races the download in
  // Firefox and the file arrives empty.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function messageFrom(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `The export failed with status ${res.status}. Nothing was downloaded.`;
}

// ---------------------------------------------------------------
// Report export
// ---------------------------------------------------------------

export function ExportButton({
  frameworks,
  defaultFramework = 'all',
  columns,
  variant = 'primary',
  label = 'Export for the submission',
}: {
  frameworks: FrameworkOption[];
  defaultFramework?: string;
  /** The CSV's header row, shown before anyone commits to a download. */
  columns: string[];
  variant?: 'primary' | 'secondary';
  label?: string;
}) {
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [framework, setFramework] = React.useState(defaultFramework);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // The console renders this control twice — header and footer — and both
  // dialogs sit in the DOM whether they are open or not. Hardcoded ids
  // would collide and every label would point at the first one.
  const selectId = `report-framework-${React.useId()}`;

  const chosen = frameworks.find((f) => f.value === framework) ?? frameworks[0];

  const run = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/export?framework=${encodeURIComponent(framework)}`, {
        headers: { accept: 'text/csv' },
      });
      if (!res.ok) {
        setError(await messageFrom(res));
        return;
      }
      await download(res, `accreditation-${framework.toLowerCase()}.csv`);
      setOpen(false);
      toast.success(
        'Report downloaded',
        `${chosen?.metrics ?? 0} figures, each with its denominator and definition. Recorded in the audit log as report.export.`,
      );
    } catch {
      setError(
        'The download did not start. If the request reached the server the audit entry was still written, so check the audit log rather than assuming nothing happened.',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <FileSpreadsheet className="size-4" aria-hidden="true" />
        {label}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Export the accreditation figures"
        description="One row per figure, in the order they appear on screen. Aggregate numbers only — no member contact details are in this file."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={run} loading={pending}>
              <Download className="size-4" aria-hidden="true" />
              Download CSV
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field
            htmlFor={selectId}
            label="Which framework"
            hint="Pick the one you are actually submitting. A file that mixes NAAC and NIRF rows gets trimmed by hand, and hand-trimming is where the wrong row survives."
          >
            <Select
              id={selectId}
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
              aria-describedby={describedBy(selectId, { hint: true })}
            >
              {frameworks.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label} — {f.metrics} figures across {f.sections} section{f.sections === 1 ? '' : 's'}
                </option>
              ))}
            </Select>
          </Field>

          <div className="rounded-lg border border-line bg-surface-sunken p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-secondary">
              Columns in the file
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {columns.map((c) => (
                <li key={c}>
                  <Badge tone={c === 'Definition' || c === 'Denominator' ? 'brand' : 'outline'}>{c}</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-secondary">
              <span className="font-semibold text-primary">Denominator and Definition travel with every figure.</span>{' '}
              That is what makes next cycle&apos;s submission reproducible: whoever rebuilds this in three years can
              check the count against the sentence that produced it, rather than guessing what the last person meant.
            </p>
          </div>

          {chosen && chosen.caveats > 0 ? (
            <Alert
              tone="warning"
              title={`${chosen.caveats} figure${chosen.caveats === 1 ? '' : 's'} in this file carry a caveat`}
              icon={<TriangleAlert className="size-4" aria-hidden="true" />}
            >
              <p>
                The caveats are in their own column, not footnotes. Do not paste the value column into a submission
                template on its own — a figure separated from its caveat is the one that gets challenged.
              </p>
            </Alert>
          ) : null}

          {error ? (
            <Alert tone="danger" title="The export was refused">
              <p>{error}</p>
            </Alert>
          ) : null}

          <p className="text-xs text-secondary">
            Recorded in the audit log as <span className="font-mono">report.export</span> with your name and the
            framework you asked for. Aggregate figures, so no reason is demanded here — the perception-survey list is a
            different control with different rules.
          </p>
        </div>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------
// NIRF perception-survey list
// ---------------------------------------------------------------

/**
 * Bulk contact data, so this is the members-export dialog's twin.
 *
 * It will not submit without a written reason, and the actor, the scope
 * and the row count are shown back before the button goes live — nobody
 * gets to claim afterwards that they did not know the export was
 * attributable to them.
 */
export function PerceptionSurveyDialog({
  rowCount,
  registerTotal,
  actorName,
  actorEmail,
  columns,
}: {
  rowCount: number;
  registerTotal: number;
  actorName: string;
  actorEmail: string;
  columns: string[];
}) {
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [touched, setTouched] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [recorded, setRecorded] = React.useState<string | null>(null);

  const uid = React.useId();
  const reasonId = `perception-reason-${uid}`;
  const ackId = `perception-ack-${uid}`;

  const short = reason.trim().length < MIN_REASON;
  const blocked = short || !acknowledged;

  const scopeLabel = `NIRF perception survey — ${rowCount.toLocaleString('en-IN')} alumni with a confirmed email address`;

  const close = () => {
    setOpen(false);
    setError(null);
    // Reset only after a completed export, so a carefully typed reason
    // survives a stray Escape keypress.
    if (recorded) {
      setRecorded(null);
      setReason('');
      setAcknowledged(false);
      setTouched(false);
    }
  };

  const submit = async () => {
    setTouched(true);
    if (blocked || pending) return;

    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/reports/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dataset: 'nirf-perception', reason: reason.trim(), acknowledged }),
      });
      if (!res.ok) {
        setError(await messageFrom(res));
        return;
      }
      await download(res, 'nirf-perception-list.csv');
      setRecorded(reason.trim());
      toast.success(
        'Export recorded',
        `member.export written against ${actorName}. ${rowCount.toLocaleString('en-IN')} rows, ${scopeLabel}.`,
      );
    } catch {
      setError('The export did not complete. If an audit entry was written it stays on the record, even though no file arrived.');
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Download className="size-4" aria-hidden="true" />
        Perception-survey list
      </Button>

      <Dialog
        open={open}
        onClose={close}
        title={recorded ? 'Export recorded' : 'Export the NIRF perception-survey list'}
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
                <Download className="size-4" aria-hidden="true" />
                Record and export
              </Button>
            </>
          )
        }
      >
        {recorded ? (
          <div className="space-y-4">
            <Alert tone="success" title="Written to the audit log" icon={<ShieldCheck className="size-4" aria-hidden="true" />}>
              <p>Audit rows are append-only. This entry cannot be edited or removed, including by you.</p>
            </Alert>

            <dl className="divide-y divide-line">
              <DetailRow label="Action">
                <span className="font-mono text-sm">member.export</span>
              </DetailRow>
              <DetailRow label="Actor">{actorName}</DetailRow>
              <DetailRow label="Scope">{scopeLabel}</DetailRow>
              <DetailRow label="Rows">
                <span className="tabular">{rowCount.toLocaleString('en-IN')}</span>
              </DetailRow>
              <DetailRow label="Fields">
                <span className="text-sm text-secondary">{columns.join(', ')}</span>
              </DetailRow>
              <DetailRow label="Reason">
                <span className="text-sm font-normal text-secondary">{recorded}</span>
              </DetailRow>
            </dl>

            <p className="text-xs text-secondary">
              The file is on this machine now, addressed to{' '}
              <span className="font-mono">{actorEmail}</span> in the audit entry. Delete it once the perception survey
              window closes — the audit row will outlive the file, and it names you.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <Alert
              tone="warning"
              title={`${rowCount.toLocaleString('en-IN')} alumni email addresses`}
              icon={<TriangleAlert className="size-4" aria-hidden="true" />}
            >
              <p>
                Every verified graduate holding a confirmed email address, out of {registerTotal.toLocaleString('en-IN')}{' '}
                in the degree register. It contains {columns.join(', ').toLowerCase()}. Once it leaves the portal the
                college can no longer control who reads it.
              </p>
            </Alert>

            <Field
              htmlFor={reasonId}
              label="Why is this list being exported?"
              required
              hint="Name the submission and who asked for it. Stored verbatim in the audit log."
              error={touched && short ? `Write at least ${MIN_REASON} characters. "NIRF" is not a reason.` : null}
            >
              <Textarea
                id={reasonId}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onBlur={() => setTouched(true)}
                invalid={touched && short}
                aria-describedby={describedBy(reasonId, { hint: true, error: touched && short })}
                placeholder="NIRF 2027 data capture — perception survey contact list requested by the Director's office on 14 Aug, to be uploaded to the NIRF portal before 30 Sep."
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
            </div>

            <Checkbox
              id={ackId}
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              label="I am accountable for this file and for deleting it once the survey window closes."
              hint="DPDP purpose limitation: the list may only be used for the reason written above."
            />

            {error ? (
              <Alert tone="danger" title="The export was refused">
                <p>{error}</p>
              </Alert>
            ) : null}
          </div>
        )}
      </Dialog>
    </>
  );
}
