'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Mail, PlayCircle, RotateCcw, ScrollText, Users } from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  DetailRow,
  EmptyState,
  Field,
  Select,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@/components/ui';
import { BarList } from '@/components/charts';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * The annual student → alumnus transition.
 *
 * Two properties are non-negotiable and both are visible in the UI:
 * it is triggered by a person, never by a schedule; and the dry run comes
 * first, always, with a typed confirmation between the preview and the
 * commit. A rollover run against the wrong batch cannot be undone from
 * inside the product — the reverse is a database restore — so the friction
 * here is the design, not an oversight.
 *
 * Every number on this screen after the dry run comes back from
 * `POST /api/admin/rollover`, computed by the same query the write would
 * use. Nothing is counted twice, in two places, by two pieces of code that
 * can drift apart: a preview assembled locally is a preview of something
 * else, and the phrase the admin types is typed against the server's count.
 */

export interface BatchPreview {
  year: number;
  total: number;
  departments: Array<{ code: string; name: string; count: number }>;
  collegeEmailOnly: number;
  withRegisterRow: number;
  sample: Array<{ name: string; roll: string; department: string }>;
}

/** Exactly the shape `/api/admin/rollover` returns. */
interface RolloverPreview {
  batchYear: number;
  moves: { from: string; to: string; count: number };
  byDepartment: Array<{ code: string; name: string; count: number }>;
  reachability: {
    collegeEmailOnly: number;
    onPersonalEmail: number;
    withRegisterRow: number;
    withoutRegisterRow: number;
  };
  changes: {
    status: string;
    roles: string;
    connectionQuota: { before: string; after: string };
    directory: string;
    gains: string[];
    loses: string[];
    untouched: string[];
    verificationMethod: string;
  };
  sample: Array<{ name: string; rollNumber: string | null; departmentCode: string | null }>;
  warnings: string[];
  note: string;
}

interface RolloverResult extends RolloverPreview {
  movedAt: string;
  auditedAs: string;
}

export function RolloverRunner({ batches, actorName }: { batches: BatchPreview[]; actorName: string }) {
  const toast = useToast();
  const router = useRouter();

  const [year, setYear] = React.useState<number | null>(batches[0]?.year ?? null);
  const [preview, setPreview] = React.useState<RolloverPreview | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [running, setRunning] = React.useState<'dry' | 'execute' | null>(null);
  const [refused, setRefused] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ result: RolloverResult; persisted: boolean } | null>(null);

  const batch = batches.find((b) => b.year === year) ?? null;
  const earliest = batches[0]?.year ?? null;
  const premature = batch !== null && earliest !== null && batch.year > earliest;

  const runDryRun = async () => {
    if (year === null) return;
    setRunning('dry');
    setRefused(null);

    // `dryRun` is stated, never omitted. The endpoint has no default and
    // refuses a body without it, which is the behaviour that makes a
    // forgotten flag a 422 rather than 198 people becoming alumni.
    const outcome = await api.post<RolloverPreview>('/api/admin/rollover', { dryRun: true, batchYear: year });
    setRunning(null);

    if (outcome.status !== 'ok') {
      setPreview(null);
      setRefused(outcome.message);
      const t = outcomeToast(outcome, '');
      if (t) toast.show(t);
      return;
    }

    setPreview(outcome.data);
    toast.info(
      'Dry run complete',
      `${outcome.data.moves.count} members would move. Nothing has changed.`,
    );
  };

  const execute = async () => {
    if (year === null) return;
    setRunning('execute');
    setRefused(null);

    const outcome = await api.post<RolloverResult>('/api/admin/rollover', {
      dryRun: false,
      batchYear: year,
      // The same phrase the dialog asked for. The whole risk of this
      // endpoint is running it against the wrong year.
      confirm: `ROLLOVER ${year}`,
    });

    setRunning(null);
    setConfirming(false);

    if (outcome.status !== 'ok') {
      setRefused(outcome.message);
      const t = outcomeToast(outcome, '');
      if (t) toast.show(t);
      return;
    }

    setDone({ result: outcome.data, persisted: outcome.persisted });

    const t = outcomeToast(outcome, `${outcome.data.moves.count} members are now alumni`);
    if (t) toast.show(t);

    if (outcome.persisted) router.refresh();
  };

  if (batches.length === 0) {
    return (
      <EmptyState
        icon={<Users className="size-5" />}
        title="No student cohort is loaded"
        description="Rollover moves final-years to alumni. There are no members with status active_student on this tenant yet — load the final-year roll list from the placement cell first."
      />
    );
  }

  if (done) {
    const { result, persisted } = done;

    return (
      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle as="h2">
              <CheckCircle2 className="mr-2 inline size-5 align-[-4px] text-success-fg" aria-hidden="true" />
              Batch of {result.batchYear} rolled over
            </CardTitle>
            <CardDescription>
              {result.moves.count} members moved from <span className="font-mono">{result.moves.from}</span> to{' '}
              <span className="font-mono">{result.moves.to}</span>.
            </CardDescription>
          </div>
          <Badge tone="success">{result.auditedAs}</Badge>
        </CardHeader>

        <CardBody className="space-y-4">
          {result.reachability.collegeEmailOnly > 0 ? (
            <Alert tone="warning" title="Do this next, today" icon={<Mail className="size-4" />}>
              <p>
                {result.reachability.collegeEmailOnly} of them still have only a{' '}
                <span className="font-mono">@diet.ac.in</span> address on the account. Those mailboxes are deactivated
                within weeks, and after that neither the OTP nor the recovery mail reaches them — the account is lost and
                so is the person. Send the &ldquo;add a personal email&rdquo; campaign over WhatsApp before the mailboxes
                go.
              </p>
            </Alert>
          ) : null}

          <dl className="divide-y divide-line">
            <DetailRow label="Status">
              <span className="font-mono text-xs">{result.changes.status}</span>
            </DetailRow>
            <DetailRow label="Roles">
              <span className="font-mono text-xs">{result.changes.roles}</span>
            </DetailRow>
            <DetailRow label="Request quota">
              <span className="tabular">
                {result.changes.connectionQuota.before} → {result.changes.connectionQuota.after}
              </span>
            </DetailRow>
            <DetailRow label="Verification method">
              <span className="font-mono text-xs">{result.changes.verificationMethod}</span>
            </DetailRow>
            <DetailRow label="Moved at">
              {/* The timestamp as the audit entry records it, not as a
                  reading date — this row is the entry, not a summary. */}
              <span className="font-mono text-xs">{result.movedAt}</span>
            </DetailRow>
          </dl>

          <p className="text-sm text-secondary">{result.note}</p>

          <p className="text-sm text-secondary">
            Written to <span className="font-mono">audit_log</span> as one entry — actor {actorName}, action{' '}
            <span className="font-mono">{result.auditedAs}</span>, resource{' '}
            <span className="font-mono">batch/{result.batchYear}</span> — with the per-member before and after snapshots
            attached.
          </p>

          {!persisted ? (
            <p className="text-xs text-muted">
              This build runs on seeded data with no database behind it. The capability check, the batch-year
              confirmation and the audit entry all ran; the status change did not, so these members are still students
              on the next page load. The counts are computed from the real member records this tenant holds.
            </p>
          ) : null}
        </CardBody>

        <CardFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setDone(null);
              setPreview(null);
            }}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Back to the runner
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="space-y-1">
          <CardTitle as="h2">Run the rollover</CardTitle>
          <CardDescription>
            Pick the batch, read the dry run, then type the confirmation phrase. There is no step that skips the
            preview.
          </CardDescription>
        </div>
      </CardHeader>

      <CardBody className="space-y-5">
        <Field
          htmlFor="batch-year"
          label="Graduating batch"
          hint="The year of passing recorded on the student's account."
          required
        >
          <Select
            id="batch-year"
            value={year ?? ''}
            onChange={(e) => {
              setYear(Number(e.target.value));
              setPreview(null);
              setRefused(null);
            }}
          >
            {batches.map((b) => (
              <option key={b.year} value={b.year}>
                Batch of {b.year} — {b.total} members
              </option>
            ))}
          </Select>
        </Field>

        {premature && batch ? (
          <Alert tone="danger" title={`The ${batch.year} batch has not graduated`} icon={<AlertTriangle className="size-4" />}>
            <p>
              {earliest} is still on the portal as a student cohort, which means {batch.year} is at least a year from
              finishing. Rolling them over now would give final-years alumni access and strip them of the student view
              they are actually using. Roll the {earliest} batch first.
            </p>
          </Alert>
        ) : null}

        {refused ? (
          <Alert tone="danger" title="The server refused this" icon={<AlertTriangle className="size-4" />}>
            <p>{refused}</p>
          </Alert>
        ) : null}

        {!preview ? (
          <div className="rounded-lg border border-dashed border-line bg-surface p-6 text-center">
            <p className="text-sm text-secondary">
              Nothing has been read yet. The dry run counts the members, groups them by branch, and lists what would
              change — without touching a single record.
            </p>
            <div className="mt-4">
              <Button onClick={() => void runDryRun()} loading={running === 'dry'} disabled={!batch}>
                <PlayCircle className="size-4" aria-hidden="true" />
                Run the dry run
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <Alert tone="info" title={`${preview.moves.count} members would move`} icon={<Users className="size-4" />}>
              <p>
                Every member with status <span className="font-mono">{preview.moves.from}</span> and year of passing{' '}
                <span className="font-mono">{preview.batchYear}</span> becomes{' '}
                <span className="font-mono">{preview.moves.to}</span>. Nothing has changed yet — this is a count, not an
                action.
              </p>
            </Alert>

            {preview.warnings.map((w) => (
              <Alert key={w} tone="warning" icon={<AlertTriangle className="size-4" />}>
                <p>{w}</p>
              </Alert>
            ))}

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">By branch</h3>
              <BarList
                label={`Batch of ${preview.batchYear} by branch`}
                data={preview.byDepartment.map((d) => ({ label: `${d.code} — ${d.name}`, value: d.count }))}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-surface p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="size-4 text-warning-fg" aria-hidden="true" />
                  {preview.reachability.collegeEmailOnly} on a college mailbox
                </p>
                <p className="mt-1 text-xs text-secondary">
                  Their only address is <span className="font-mono">@diet.ac.in</span>. Once IT deactivates it, the OTP
                  has nowhere to go and the account is unrecoverable. This is the number that decides whether a batch
                  stays reachable in five years — {preview.reachability.onPersonalEmail} of them have a personal address
                  as well.
                </p>
              </div>
              <div className="rounded-lg border border-line bg-surface p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <ScrollText className="size-4 text-muted" aria-hidden="true" />
                  {preview.reachability.withRegisterRow} of {preview.moves.count} have a register row
                </p>
                <p className="mt-1 text-xs text-secondary">
                  The examinations branch supplies the degree file months after the ceremony. The{' '}
                  {preview.reachability.withoutRegisterRow} without a row are marked{' '}
                  <span className="font-mono">verified_by: {preview.changes.verificationMethod}</span> — the college
                  vouched for them directly — and are re-linked automatically when the {preview.batchYear} file is
                  loaded.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">
                First {preview.sample.length} of {preview.moves.count}
              </h3>
              <TableWrap caption={`Sample of the batch of ${preview.batchYear}`}>
                <Table>
                  <THead>
                    <TR>
                      <TH>Name</TH>
                      <TH>Roll number</TH>
                      <TH>Branch</TH>
                      <TH>Status after</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {preview.sample.map((m, i) => (
                      <TR key={m.rollNumber ?? `${m.name}-${i}`}>
                        <TD>{m.name}</TD>
                        <TD>
                          <span className="font-mono">{m.rollNumber ?? '—'}</span>
                        </TD>
                        <TD>{m.departmentCode ?? '—'}</TD>
                        <TD>
                          <Badge tone="success">{preview.moves.to}</Badge>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
              <p className="text-xs text-muted">
                The full list is attached to the audit entry when the rollover runs, so the batch can be reconstructed
                exactly.
              </p>
            </div>
          </div>
        )}
      </CardBody>

      <CardFooter>
        {preview ? (
          <Button variant="ghost" onClick={() => setPreview(null)} disabled={running !== null}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Discard the preview
          </Button>
        ) : null}
        <div className="ml-auto">
          <Button
            variant="danger"
            disabled={!preview || running !== null}
            onClick={() => setConfirming(true)}
          >
            Commit the rollover
          </Button>
        </div>
      </CardFooter>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void execute()}
        pending={running === 'execute'}
        title={`Roll the batch of ${preview?.batchYear ?? year} into alumni?`}
        confirmLabel="Run the rollover"
        requireTyped={`ROLLOVER ${preview?.batchYear ?? year ?? ''}`}
        body={
          <div className="space-y-3">
            <p>
              <span className="font-semibold text-primary">{preview?.moves.count ?? 0} members</span> change status,
              role, directory cohort and request quota in one transaction.
            </p>
            <p>
              <span className="font-semibold text-primary">There is no undo inside the product.</span> Reversing a
              rollover means restoring the database to a point before it ran, which loses everything else that happened
              in between. Type the phrase to confirm the batch year is the one you meant.
            </p>
            <p>
              One entry is written to <span className="font-mono">audit_log</span> — actor, batch, count, and the
              per-member before and after snapshots.
            </p>
          </div>
        }
      />
    </Card>
  );
}
