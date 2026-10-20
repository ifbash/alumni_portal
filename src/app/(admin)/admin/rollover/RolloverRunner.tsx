'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, PlayCircle, RotateCcw, Users } from 'lucide-react';

import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardBody,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Field,
  Select,
  useToast,
} from '@/components/ui';
import { BarList } from '@/components/charts';
import { api, outcomeToast } from '@/lib/client/api';
import { cn } from '@/lib/cn';

/**
 * The annual final-year → alumni transition, in three steps.
 *
 * Two properties are non-negotiable and both are visible in the UI: it is
 * triggered by a person, never by a schedule; and the dry run comes first,
 * always, with a typed confirmation between the preview and the commit.
 * The commit control does not exist until the preview has been read.
 *
 * Every number after the dry run comes back from `POST
 * /api/admin/rollover`, computed by the same query the write would use.
 * The words around them are this screen's own; the response's machine
 * fields and the college-mailbox figures are not shown.
 */

export interface BatchPreview {
  year: number;
  total: number;
  departments: Array<{ code: string; name: string; count: number }>;
  withRegisterRow: number;
}

/** The fields of `/api/admin/rollover` this screen reads. */
interface RolloverPreview {
  batchYear: number;
  moves: { from: string; to: string; count: number };
  byDepartment: Array<{ code: string; name: string; count: number }>;
  reachability: {
    withRegisterRow: number;
    withoutRegisterRow: number;
  };
  changes: {
    connectionQuota: { before: string; after: string };
  };
  sample: Array<{ name: string; rollNumber: string | null; departmentCode: string | null }>;
}

interface RolloverResult extends RolloverPreview {
  movedAt: string;
  auditedAs: string;
}

function Step({
  n,
  title,
  state,
  children,
}: {
  n: number;
  title: string;
  state: 'current' | 'done' | 'waiting';
  children?: React.ReactNode;
}) {
  return (
    <li className="relative flex gap-4">
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold tabular',
          state === 'done'
            ? 'bg-success-soft text-success-fg'
            : state === 'current'
              ? 'bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)]'
              : 'border border-line bg-surface text-secondary',
        )}
        aria-hidden="true"
      >
        {state === 'done' ? <CheckCircle2 className="size-4" /> : n}
      </span>
      <div className="min-w-0 flex-1 space-y-3 pb-6">
        <h2 className={cn('pt-1 font-display text-md font-semibold', state === 'waiting' && 'text-secondary')}>
          <span className="sr-only">Step {n}: </span>
          {title}
        </h2>
        {children}
      </div>
    </li>
  );
}

export function RolloverRunner({
  batches,
  actorName,
  crest,
  links,
  donations,
}: {
  batches: BatchPreview[];
  actorName: string;
  /** The college crest for the welcome card, rendered on the server (null when the pack has none). */
  crest: React.ReactNode;
  /** Which doors this viewer can open; hrefs are built here per batch. */
  links: { upload: boolean; comms: boolean; news: boolean; audit: boolean };
  /** Whether members can give; the dry run mentions giving only when they can. */
  donations: boolean;
}) {
  const toast = useToast();
  const router = useRouter();

  const [year, setYear] = React.useState<number | null>(batches[0]?.year ?? null);
  const [preview, setPreview] = React.useState<RolloverPreview | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  // Reading the preview is a deliberate act, not a side effect of scrolling past it.
  const [ackedYear, setAckedYear] = React.useState<number | null>(null);
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
    setAckedYear(null);

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
    toast.info('Dry run complete', `${outcome.data.moves.count} final-year students would become alumni. Nothing has changed.`);
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
        title="No final-year students on the portal"
        description="The rollover moves final-year students to alumni. It has nobody to move until the final-year list is loaded."
      />
    );
  }

  // ---------------------------------------------------------------
  // Done: the welcome
  // ---------------------------------------------------------------

  if (done) {
    // Whether it persisted is said once, by the outcome toast.
    const { result } = done;
    const y = result.batchYear;
    return (
      <div className="space-y-4">
        <section aria-labelledby="welcome-title" className="band-surface rounded-xl px-6 py-8 sm:px-8">
          <div className="flex items-start gap-4">
            {crest}
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-semibold text-band-accent">Batch of {y}</p>
              <h2 id="welcome-title" className="font-display text-display-xs font-bold text-band-fg">
                Welcome the Class of {y} to the alumni network
              </h2>
              <p className="text-md text-band-muted">
                {result.moves.count} final-year students are now alumni.
              </p>
              {links.news || links.comms ? (
                <div className="flex flex-wrap gap-2 pt-3">
                  {links.news ? (
                    <ButtonLink href="/admin/news/new" variant="band" className="min-h-11">
                      Write the announcement
                    </ButtonLink>
                  ) : null}
                  {links.comms ? (
                    <ButtonLink
                      href={`/admin/comms/new?cohort=alumni&batchFrom=${y}&batchTo=${y}`}
                      variant="band-outline"
                      className="min-h-11"
                    >
                      Write to the {y} batch
                    </ButtonLink>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <p className="text-sm text-secondary">
          {links.audit ? (
            <Link href="/admin/audit?action=rollover.execute" className="link">
              Recorded in the audit log
            </Link>
          ) : (
            'Recorded in the audit log'
          )}{' '}
          against {actorName}, with every member before and after.
        </p>

        <Button
          variant="secondary"
          onClick={() => {
            setDone(null);
            setPreview(null);
          }}
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Back to the rollover
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // The three steps
  // ---------------------------------------------------------------

  const inRegister = batch ? batch.withRegisterRow : 0;
  const registerDone = batch ? inRegister >= batch.total : false;

  return (
    <Card>
      <CardBody>
        <ol aria-label="Rollover steps">
          {/* ---- 1 ---- */}
          <Step n={1} title="Before you run" state={preview ? 'done' : 'current'}>
            <Field htmlFor="batch-year" label="Graduating batch" required className="sm:max-w-sm">
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
                    Batch of {b.year} — {b.total} final-year students
                  </option>
                ))}
              </Select>
            </Field>

            {premature && batch ? (
              <Alert tone="danger" title={`The ${batch.year} batch has not graduated`} icon={<AlertTriangle className="size-4" />}>
                <p>
                  The {earliest} batch is still on the portal as final-year students. Roll {earliest} first; running{' '}
                  {batch.year} now would be refused.
                </p>
              </Alert>
            ) : null}

            {batch ? (
              <ul className="space-y-2 text-sm">
                <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {registerDone ? (
                    <CheckCircle2 className="size-4 shrink-0 text-success-fg" aria-hidden="true" />
                  ) : (
                    <Circle className="size-4 shrink-0 text-warning-fg" aria-hidden="true" />
                  )}
                  <span>
                    {inRegister} of {batch.total} are in the degree register
                  </span>
                  {!registerDone && links.upload ? (
                    <Link
                      href="/admin/degree-register/upload"
                      className="inline-flex min-h-11 items-center gap-1 font-semibold text-brand-fg hover:underline sm:min-h-0"
                    >
                      Load the {batch.year} files
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  ) : null}
                </li>
                {links.comms ? (
                  <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Circle className="size-4 shrink-0 text-muted" aria-hidden="true" />
                    <span>Tell the batch first</span>
                    <Link
                      href={`/admin/comms/new?cohort=students&batchFrom=${batch.year}&batchTo=${batch.year}`}
                      className="inline-flex min-h-11 items-center gap-1 font-semibold text-brand-fg hover:underline sm:min-h-0"
                    >
                      Write to them
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </Step>

          {/* ---- 2 ---- */}
          <Step n={2} title="Preview" state={preview ? 'done' : 'waiting'}>
            {refused ? (
              <Alert tone="danger" title="The server refused this" icon={<AlertTriangle className="size-4" />}>
                <p>{refused}</p>
              </Alert>
            ) : null}

            {!preview ? (
              <div className="space-y-3">
                <p className="text-sm text-secondary">
                  Counts who would move and what changes for them. Nothing is written.
                </p>
                <Button onClick={() => void runDryRun()} loading={running === 'dry'} disabled={!batch}>
                  <PlayCircle className="size-4" aria-hidden="true" />
                  Run the dry run
                </Button>
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                {/* The number the decision turns on, set big, with the two
                    facts that change for those people beside it. */}
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                  <div className="rounded-lg border border-line bg-surface-sunken p-5">
                    <p className="text-sm font-medium text-secondary">Batch of {preview.batchYear} would move</p>
                    <p className="mt-2 font-display text-display-lg font-bold leading-none tabular">
                      {preview.moves.count.toLocaleString('en-IN')}
                    </p>
                    <p className="mt-2 text-sm">final-year students become alumni.</p>
                  </div>
                  <dl className="space-y-3 rounded-lg border border-line p-5">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">Request limit</dt>
                      <dd className="mt-1 font-display text-lg font-semibold tabular">
                        {preview.changes.connectionQuota.before}
                        <ArrowRight className="mx-1.5 inline size-4 align-[-2px] text-muted" aria-hidden="true" />
                        {preview.changes.connectionQuota.after}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">Register rows</dt>
                      <dd className="mt-1 text-sm">
                        <span className="font-semibold tabular">{preview.reachability.withRegisterRow}</span> matched
                        {preview.reachability.withoutRegisterRow > 0 ? (
                          <>
                            , <span className="font-semibold tabular text-warning-fg">{preview.reachability.withoutRegisterRow}</span> without a row yet
                          </>
                        ) : null}
                      </dd>
                    </div>
                  </dl>
                </div>
                <ul className="list-disc space-y-1.5 pl-5 text-secondary">
                  <li>
                    They can post jobs and receive mentorship and referral requests
                    {donations ? ', and give to campaigns' : ''}.
                  </li>
                  <li>Their academic and placement data stays with placement staff.</li>
                  <li>Their contact settings, connections, registrations and applications stay as they are.</li>
                  {preview.reachability.withoutRegisterRow > 0 ? (
                    <li>
                      Those without a row are verified by the rollover and linked to it when the {preview.batchYear}{' '}
                      files are loaded.
                    </li>
                  ) : null}
                </ul>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">By branch</h3>
                  <BarList
                    label={`Batch of ${preview.batchYear} by branch`}
                    data={preview.byDepartment.map((d) => ({ label: `${d.code} · ${d.name}`, value: d.count }))}
                  />
                </div>
                <Button variant="ghost" onClick={() => setPreview(null)} disabled={running !== null}>
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Discard the preview
                </Button>
              </div>
            )}
          </Step>

          {/* ---- 3 ---- */}
          <Step n={3} title="Run" state={preview ? 'current' : 'waiting'}>
            {preview ? (
              <div className="space-y-4 rounded-lg border border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_5%,var(--surface-raised))] p-4">
                <p className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger-fg" aria-hidden="true" />
                  <span>
                    <span className="font-semibold">There is no undo inside the portal.</span> You will be asked to type
                    the phrase for the batch year to confirm.
                  </span>
                </p>
                <Checkbox
                  id="rollover-ack"
                  checked={ackedYear === preview.batchYear}
                  onChange={(e) => setAckedYear(e.target.checked ? preview.batchYear : null)}
                  label={`I have read the preview for the batch of ${preview.batchYear}.`}
                />
                <Button
                  variant="danger"
                  disabled={running !== null || ackedYear !== preview.batchYear}
                  onClick={() => setConfirming(true)}
                >
                  Roll the batch of {preview.batchYear} into alumni
                </Button>
              </div>
            ) : (
              <p className="text-sm text-secondary">Opens once you have read the preview.</p>
            )}
          </Step>
        </ol>
      </CardBody>

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
              <span className="font-semibold text-primary">{preview?.moves.count ?? 0} final-year students</span> become
              alumni in one step: their status, role, place in the directory and request limit all change.
            </p>
            <p>
              <span className="font-semibold text-primary">There is no undo inside the portal.</span> Type the phrase to
              confirm the batch year is the one you meant.
            </p>
          </div>
        }
      />
    </Card>
  );
}
