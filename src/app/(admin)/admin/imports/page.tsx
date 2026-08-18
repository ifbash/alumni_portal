import { redirect } from 'next/navigation';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  Copy,
  FileUp,
  FlaskConical,
  Rows3,
  XCircle,
} from 'lucide-react';

import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  DefinitionCard,
  Disclosure,
  PageHeader,
  Section,
  Stat,
} from '@/components/ui';
import { ProportionBar } from '@/components/charts';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getDegreeRegisterStats } from '@/lib/data/repo';
import { formatDateTime, formatNumber, formatRelative } from '@/lib/format';

export const metadata = { title: 'Imports' };

const CURRENT_YEAR = 2026;

type ImportState = 'completed' | 'completed_with_rejections' | 'dry_run' | 'failed';

interface ImportRun {
  id: string;
  fileName: string;
  kind: 'Degree register' | 'Student roll list';
  actor: string;
  actorRole: string;
  startedAt: string;
  seconds: number;
  rowsInFile: number;
  added: number;
  skipped: number;
  rejected: number;
  state: ImportState;
  note?: string;
  failure?: string;
  reasons?: Array<{ reason: string; count: number }>;
}

/**
 * Import history.
 *
 * Kept as a first-class screen rather than a line in the audit log
 * because the question it answers — "has the 2021 ECE file ever been
 * loaded?" — is asked every time a claim arrives with no register row
 * behind it, and the answer decides whether the applicant or the college
 * is at fault.
 */
const RUNS: ImportRun[] = [
  {
    id: 'imp-9',
    fileName: 'DIET_2025_CSE.csv',
    kind: 'Degree register',
    actor: 'Sridevi Kandula',
    actorRole: 'Alumni cell',
    startedAt: '2026-08-14T11:12:00+05:30',
    seconds: 4,
    rowsInFile: 236,
    added: 236,
    skipped: 0,
    rejected: 0,
    state: 'completed',
    note: 'First file for the 2025 batch. Sent by the examinations branch fourteen months after the ceremony.',
  },
  {
    id: 'imp-8',
    fileName: 'DIET_2025_ECE.csv',
    kind: 'Degree register',
    actor: 'Sridevi Kandula',
    actorRole: 'Alumni cell',
    startedAt: '2026-08-14T11:19:00+05:30',
    seconds: 3,
    rowsInFile: 118,
    added: 114,
    skipped: 0,
    rejected: 4,
    state: 'completed_with_rejections',
    reasons: [
      { reason: 'Name column blank — the row carries a roll number and nothing else', count: 2 },
      { reason: 'Roll number written as a serial number (1, 2, 3) instead of the JNTU roll', count: 1 },
      { reason: 'Year of passing recorded as 2O25 with a letter O', count: 1 },
    ],
    note: 'Reasons sent back to the examinations branch on 14 Aug. The corrected file can be re-run over this one safely.',
  },
  {
    id: 'imp-7',
    fileName: 'DIET_2024_CSE.csv',
    kind: 'Degree register',
    actor: 'Dr. Padmaja Vemulapalli',
    actorRole: 'College admin',
    startedAt: '2026-08-02T16:40:00+05:30',
    seconds: 5,
    rowsInFile: 241,
    added: 0,
    skipped: 241,
    rejected: 0,
    state: 'completed',
    note: 'Re-run of the file loaded on 2 July, after a query about two missing names. Every row was recognised on its roll number and skipped — nothing was duplicated and nothing was overwritten. This is what idempotency looks like from the outside.',
  },
  {
    id: 'imp-6',
    fileName: 'DIET_2022_MECH.csv',
    kind: 'Degree register',
    actor: 'Sridevi Kandula',
    actorRole: 'Alumni cell',
    startedAt: '2026-07-28T10:05:00+05:30',
    seconds: 2,
    rowsInFile: 64,
    added: 0,
    skipped: 0,
    rejected: 3,
    state: 'dry_run',
    reasons: [
      { reason: 'Admission year 2018 with year of passing 2018 — one of the two is wrong', count: 2 },
      { reason: 'Branch code MEC is not configured; the college uses MECH', count: 1 },
    ],
    note: 'Stopped at the dry run on purpose. The alumni cell wanted the rejection list to send to the examinations branch before loading anything.',
  },
  {
    id: 'imp-5',
    fileName: 'DIET_2023_ALL.xlsx — Sheet1.csv',
    kind: 'Degree register',
    actor: 'Sridevi Kandula',
    actorRole: 'Alumni cell',
    startedAt: '2026-07-21T15:31:00+05:30',
    seconds: 1,
    rowsInFile: 0,
    added: 0,
    skipped: 0,
    rejected: 0,
    state: 'failed',
    failure:
      'Rejected at the header check: no column could be mapped to year of passing. The sheet had a merged title row above the headers, which Excel exports as a blank first line.',
    note: 'Re-exported without the title row the same afternoon and loaded as three separate files, one per branch.',
  },
  {
    id: 'imp-4',
    fileName: 'DIET_2024_CSE.csv',
    kind: 'Degree register',
    actor: 'Dr. Padmaja Vemulapalli',
    actorRole: 'College admin',
    startedAt: '2026-07-02T09:48:00+05:30',
    seconds: 5,
    rowsInFile: 241,
    added: 241,
    skipped: 0,
    rejected: 0,
    state: 'completed',
  },
  {
    id: 'imp-3',
    fileName: 'placement_final_year_2026.csv',
    kind: 'Student roll list',
    actor: 'Ramesh Kolluri',
    actorRole: 'Placement officer',
    startedAt: '2026-06-18T12:02:00+05:30',
    seconds: 2,
    rowsInFile: 96,
    added: 96,
    skipped: 0,
    rejected: 0,
    state: 'completed',
    note: 'Final-year roll list from the placement cell. Creates student accounts in the same members table — a graduating batch is a status change, never a migration between tables.',
  },
];

const STATE_META: Record<ImportState, { label: string; tone: 'success' | 'warning' | 'info' | 'danger' }> = {
  completed: { label: 'Completed', tone: 'success' },
  completed_with_rejections: { label: 'Completed with rejections', tone: 'warning' },
  dry_run: { label: 'Dry run only', tone: 'info' },
  failed: { label: 'Failed', tone: 'danger' },
};

function StateIcon({ state }: { state: ImportState }) {
  if (state === 'failed') return <XCircle className="size-4" aria-hidden="true" />;
  if (state === 'dry_run') return <FlaskConical className="size-4" aria-hidden="true" />;
  if (state === 'completed_with_rejections') return <AlertTriangle className="size-4" aria-hidden="true" />;
  return <CheckCircle2 className="size-4" aria-hidden="true" />;
}

export default async function ImportsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  requireCap(session, 'verification.review.any');

  const stats = getDegreeRegisterStats();

  const yearsPresent = new Set(stats.byYear.map((y) => y.year));
  const earliest = stats.byYear[0]?.year ?? CURRENT_YEAR;
  const missingYears: number[] = [];
  for (let y = earliest; y <= CURRENT_YEAR; y++) if (!yearsPresent.has(y)) missingYears.push(y);

  const committed = RUNS.filter((r) => r.state !== 'dry_run' && r.state !== 'failed');
  const totals = {
    files: committed.length,
    added: committed.reduce((n, r) => n + r.added, 0),
    skipped: committed.reduce((n, r) => n + r.skipped, 0),
    rejected: RUNS.reduce((n, r) => n + r.rejected, 0),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Identity"
        title="Imports"
        description="Every file the college has loaded, what it did, and what it refused. When a verification claim arrives with no register row behind it, this page decides whether the applicant got their roll number wrong or the college never loaded their batch."
        actions={
          <ButtonLink href="/admin/degree-register/upload">
            <FileUp className="size-4" aria-hidden="true" />
            Load a register file
          </ButtonLink>
        }
      />

      <div className="grid gap-gutter sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Files committed" value={totals.files} hint={`${RUNS.length} runs including dry runs and failures`} icon={<FileUp className="size-4" />} />
        <Stat label="Rows added" value={formatNumber(totals.added)} hint="Across every committed run" icon={<Rows3 className="size-4" />} />
        <Stat label="Rows skipped" value={formatNumber(totals.skipped)} hint="Already present — re-runs cost nothing" icon={<Copy className="size-4" />} />
        <Stat label="Rows refused" value={totals.rejected} hint="Every one with a reason on record" icon={<CircleSlash className="size-4" />} />
      </div>

      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Section title="History" description="Newest first. A run is kept whether it succeeded, was refused, or was never committed at all.">
          <ul className="space-y-4">
            {RUNS.map((run) => {
              const meta = STATE_META[run.state];
              return (
                <li key={run.id}>
                  <Card>
                    <CardHeader>
                      <div className="min-w-0 space-y-1">
                        <CardTitle as="h3" className="break-all font-mono text-md">
                          {run.fileName}
                        </CardTitle>
                        <CardDescription>
                          {run.kind} · {run.actor} ({run.actorRole}) · {formatDateTime(run.startedAt)} ·{' '}
                          {formatRelative(run.startedAt)}
                        </CardDescription>
                      </div>
                      <Badge tone={meta.tone}>
                        <StateIcon state={run.state} />
                        {meta.label}
                      </Badge>
                    </CardHeader>

                    <CardBody className="space-y-4">
                      {run.state === 'failed' ? (
                        <Alert tone="danger" title="Nothing was loaded" icon={<XCircle className="size-4" />}>
                          <p>{run.failure}</p>
                        </Alert>
                      ) : (
                        <>
                          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div>
                              <dt className="text-xs text-secondary">Rows in file</dt>
                              <dd className="font-display text-lg font-semibold tabular">{run.rowsInFile}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-secondary">Added</dt>
                              <dd className="font-display text-lg font-semibold tabular text-success-fg">{run.added}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-secondary">Skipped</dt>
                              <dd className="font-display text-lg font-semibold tabular">{run.skipped}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-secondary">Refused</dt>
                              <dd className="font-display text-lg font-semibold tabular text-danger-fg">{run.rejected}</dd>
                            </div>
                          </dl>

                          <ProportionBar
                            label={`Outcome of ${run.fileName}`}
                            segments={[
                              { label: 'Added', value: run.added, tone: 'success' },
                              { label: 'Skipped', value: run.skipped, tone: 'neutral' },
                              { label: 'Refused', value: run.rejected, tone: 'danger' },
                            ]}
                          />
                        </>
                      )}

                      {run.note ? <p className="text-sm text-secondary">{run.note}</p> : null}

                      {run.reasons && run.reasons.length > 0 ? (
                        <Disclosure summary={`Why ${run.rejected} rows were refused`}>
                          <ul className="space-y-2">
                            {run.reasons.map((r) => (
                              <li key={r.reason} className="flex items-baseline justify-between gap-4">
                                <span>{r.reason}</span>
                                <span className="shrink-0 font-semibold tabular text-primary">{r.count}</span>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-3 text-xs text-muted">
                            Refused rows are never silently dropped. The list goes back to the examinations branch, and
                            the corrected file can be loaded straight over this one — rows already in the register are
                            matched on roll number and skipped.
                          </p>
                        </Disclosure>
                      ) : null}
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ul>

        </Section>

        <div className="space-y-gutter">
          <Card>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle as="h2">Still to chase</CardTitle>
                <CardDescription>Files the register is waiting on. These block real people.</CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {missingYears.length > 0 ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <CalendarClock className="size-4 text-warning-fg" aria-hidden="true" />
                    Years with no rows at all
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {missingYears.map((y) => (
                      <li key={y}>
                        <Badge tone="warning">{y}</Badge>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-secondary">
                    A graduate from one of these years cannot be verified at all. Their claim reaches the queue with no
                    candidate row behind it, and the only honest action is to leave it queued until the file arrives.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-secondary">
                  Every year from {stats.byYear[0]?.year} to {CURRENT_YEAR} has rows in the register.
                </p>
              )}

              <Alert tone="warning" title="Hoopstr export" icon={<AlertTriangle className="size-4" />}>
                <p>
                  The previous vendor&rsquo;s contract has lapsed and the retention window may be closing. Their export
                  is the only record of which alumni had already been contacted, and it has not been received. Chase it
                  before the account is purged — it cannot be rebuilt from anything the college holds.
                </p>
              </Alert>

              <div className="rounded-lg border border-line bg-surface p-4 text-sm">
                <p className="font-medium">Nothing here imports contact details.</p>
                <p className="mt-1 text-secondary">
                  The degree register holds roll number, name, branch, programme and years — no email, no mobile, no
                  marks. Contact data reaches the portal only when the member enters it themselves and chooses who may
                  see it.
                </p>
              </div>
            </CardBody>
          </Card>

          <div className="sm:hidden">
            <DefinitionCard
              title="Register at a glance"
              rows={[
                { label: 'Rows', value: formatNumber(stats.total) },
                { label: 'Claimed', value: formatNumber(stats.claimed) },
                { label: 'Years loaded', value: stats.byYear.length },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
