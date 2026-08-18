'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  FileSpreadsheet,
  RefreshCw,
  Users,
} from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  ConfirmDialog,
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
import { ProportionBar } from '@/components/charts';
import { cn } from '@/lib/cn';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * The degree-register loader.
 *
 * Four steps, and the third one is the point of the whole screen: a dry
 * run that says exactly what would change, row by row, before anything
 * does. Loading the register wrong is expensive in a way that is invisible
 * for months — a mistyped year of passing does not fail, it quietly makes
 * a batch unverifiable — so the preview is not a courtesy.
 *
 * The file is *parsed* in the browser, which is what makes it safe to
 * point this at a file somebody forwarded over WhatsApp: nothing is sent
 * until the mapping is right. The *verdicts* are not. Step three posts the
 * mapped rows to `POST /api/admin/degree-register/import` with
 * `dryRun: true` and renders what comes back, because a preview computed
 * by different code from the write is a preview of something else — and
 * the phrase typed at step four is typed against the server's own count of
 * new rows.
 *
 * Nothing is written before step four. Rows are keyed on tenant and roll
 * number, so committing the same file twice inserts nothing the second
 * time.
 */

const TARGETS = [
  { key: 'roll_number', label: 'Roll number', required: true, hint: 'The key every row is matched on.' },
  { key: 'name', label: 'Name', required: true, hint: 'Exactly as printed on the memorandum of marks.' },
  { key: 'department', label: 'Branch', required: true, hint: 'CSE, ECE, EEE, MECH, CIVIL, IT, AIML.' },
  { key: 'programme', label: 'Programme', required: false, hint: 'Defaults to B.Tech when the column is absent.' },
  {
    key: 'admission_year',
    label: 'Admission year',
    required: false,
    hint: 'Falls back to the two digits at the front of the roll number.',
  },
  { key: 'year_of_passing', label: 'Year of passing', required: true, hint: 'The batch. It drives the whole directory.' },
] as const;

type TargetKey = (typeof TARGETS)[number]['key'];

const DETECT: Record<TargetKey, string[]> = {
  roll_number: ['rollno', 'roll', 'regdno', 'regno', 'registration', 'htno', 'hallticket', 'admnno'],
  name: ['studentname', 'candidatename', 'name'],
  department: ['branch', 'department', 'dept', 'discipline'],
  programme: ['programme', 'program', 'degree', 'course'],
  admission_year: ['yearofadmission', 'admissionyear', 'admitted', 'yearofjoining', 'joining'],
  year_of_passing: ['yearofpassing', 'passingyear', 'passout', 'yop', 'graduationyear', 'batch'],
};

type Mapping = Record<TargetKey, string>;

const EMPTY_MAPPING: Mapping = {
  roll_number: '',
  name: '',
  department: '',
  programme: '',
  admission_year: '',
  year_of_passing: '',
};

/** The endpoint refuses more than this in one request. */
const MAX_ROWS = 5000;

// ---------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function detectMapping(headers: string[]): Mapping {
  const mapping: Mapping = { ...EMPTY_MAPPING };
  const taken = new Set<string>();

  for (const target of TARGETS) {
    const found = headers.find(
      (h) => !taken.has(h) && DETECT[target.key].some((hint) => slug(h).includes(hint)),
    );
    if (found) {
      mapping[target.key] = found;
      taken.add(found);
    }
  }
  return mapping;
}

// ---------------------------------------------------------------
// What the endpoint says
// ---------------------------------------------------------------

interface ImportReport {
  fileName: string;
  counts: {
    rows: number;
    new: number;
    duplicate: number;
    duplicateInRegister: number;
    duplicateInFile: number;
    rejected: number;
  };
  rejected: Array<{ line: number; rollNumber: string; name: string; reason: string }>;
  rejectedListTruncatedAt: number | null;
  homonyms: Array<{ label: string; rollNumbers: string[] }>;
  fileAlreadyLoaded: boolean;
  registerTotal: number;
  registerTotalAfter: number;
  idempotentOn: string;
  confirmPhrase: string;
  note: string;
  auditedAs?: string;
}

// ---------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------

const STEP_LABELS = ['Choose the file', 'Map the columns', 'Dry run', 'Commit'];

function Steps({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Import steps">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',
              active && 'border-line-strong bg-brand-soft text-brand-soft-fg',
              done && 'border-line bg-surface-sunken text-secondary',
              !active && !done && 'border-line bg-surface text-muted',
            )}
          >
            <span
              className={cn(
                'grid size-5 shrink-0 place-items-center rounded-full text-xs tabular',
                active ? 'bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)]' : 'bg-surface-sunken',
              )}
              aria-hidden="true"
            >
              {done ? <Check className="size-3" /> : n}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------
// Wizard
// ---------------------------------------------------------------

export function UploadWizard({
  departmentCodes,
  registerTotal,
  sampleFileName,
  sampleCsv,
}: {
  departmentCodes: string[];
  /**
   * `existingRolls` and `loadedFiles` are still supplied by the page and
   * deliberately not read here. The browser no longer decides what is a
   * duplicate — the endpoint does, against the register as it stands at
   * the moment of the request, which is the only copy that can be right.
   */
  existingRolls: string[];
  registerTotal: number;
  loadedFiles: string[];
  sampleFileName: string;
  sampleCsv: string;
}) {
  const toast = useToast();
  const router = useRouter();

  const [step, setStep] = React.useState(1);
  const [fileName, setFileName] = React.useState('');
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [data, setData] = React.useState<string[][]>([]);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [mapping, setMapping] = React.useState<Mapping>(EMPTY_MAPPING);
  const [confirming, setConfirming] = React.useState(false);
  const [running, setRunning] = React.useState<'preview' | 'commit' | null>(null);
  const [refused, setRefused] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<ImportReport | null>(null);
  const [committed, setCommitted] = React.useState<{ report: ImportReport; persisted: boolean } | null>(null);

  const setTarget = (key: TargetKey, value: string) => {
    // The preview was computed against the old mapping. Keeping it on
    // screen while the columns move underneath it is how the wrong file
    // gets committed against the right-looking numbers.
    setPreview(null);
    setMapping((m) => {
      const next: Mapping = { ...m };
      next[key] = value;
      return next;
    });
  };

  const load = React.useCallback(
    (name: string, text: string) => {
      const rows = parseCsv(text);
      if (rows.length < 2) {
        setParseError(
          'That file has a header row and nothing under it, or is not a CSV at all. Export the sheet as CSV (UTF-8) and try again.',
        );
        return;
      }
      const head = (rows[0] ?? []).map((h) => h.trim());
      setHeaders(head);
      setData(rows.slice(1));
      setMapping(detectMapping(head));
      setFileName(name);
      setParseError(null);
      setPreview(null);
      setCommitted(null);
      setRefused(null);
      setStep(2);
      toast.success('File read', `${rows.length - 1} data rows, ${head.length} columns. Nothing has been uploaded.`);
    },
    [toast],
  );

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      load(file.name, await file.text());
    } catch {
      setParseError('That file could not be read. If it is an .xlsx, save it as CSV first.');
    }
  };

  const mappingProblems = React.useMemo(() => {
    const problems: string[] = [];
    for (const t of TARGETS) {
      if (t.required && !mapping[t.key]) problems.push(`${t.label} is not mapped to a column.`);
    }
    const used = TARGETS.map((t) => mapping[t.key]).filter(Boolean);
    const repeated = used.filter((h, i) => used.indexOf(h) !== i);
    for (const h of new Set(repeated)) problems.push(`Column "${h}" is mapped to more than one field.`);
    if (data.length > MAX_ROWS) {
      problems.push(
        `${data.length} data rows is more than the ${MAX_ROWS} the loader takes in one go. Split the file by branch — that is how the examinations branch exports it anyway.`,
      );
    }
    return problems;
  }, [mapping, data.length]);

  /** The mapped rows, exactly as the endpoint judges them. */
  const mappedRows = React.useCallback(() => {
    const idx: Record<TargetKey, number> = {
      roll_number: headers.indexOf(mapping.roll_number),
      name: headers.indexOf(mapping.name),
      department: headers.indexOf(mapping.department),
      programme: headers.indexOf(mapping.programme),
      admission_year: headers.indexOf(mapping.admission_year),
      year_of_passing: headers.indexOf(mapping.year_of_passing),
    };
    const at = (r: string[], key: TargetKey) => (idx[key] >= 0 ? (r[idx[key]] ?? '').trim() : '');

    return data.map((r, i) => ({
      // The line in the file the operator opened, header row included, so
      // a rejection can be found and fixed rather than hunted for.
      line: i + 2,
      rollNumber: at(r, 'roll_number'),
      name: at(r, 'name'),
      department: at(r, 'department'),
      programme: at(r, 'programme') || 'B.Tech',
      admissionYear: at(r, 'admission_year'),
      yearOfPassing: at(r, 'year_of_passing'),
    }));
  }, [data, headers, mapping]);

  const runDryRun = async () => {
    setRunning('preview');
    setRefused(null);

    const outcome = await api.post<ImportReport>('/api/admin/degree-register/import', {
      // Stated, never omitted: the endpoint has no default, because a
      // missing flag on a route that writes to the register must not mean
      // "go ahead".
      dryRun: true,
      fileName,
      rows: mappedRows(),
    });

    setRunning(null);

    if (outcome.status !== 'ok') {
      setPreview(null);
      setRefused(outcome.message);
      const t = outcomeToast(outcome, '');
      if (t) toast.show(t);
      return;
    }

    setPreview(outcome.data);
    setStep(3);
    toast.info(
      'Dry run complete',
      `${outcome.data.counts.new} new, ${outcome.data.counts.duplicate} already present, ${outcome.data.counts.rejected} refused. Nothing has been written.`,
    );
  };

  const commit = async () => {
    if (!preview) return;
    setRunning('commit');
    setRefused(null);

    const outcome = await api.post<ImportReport>('/api/admin/degree-register/import', {
      dryRun: false,
      fileName,
      rows: mappedRows(),
      // The phrase the dialog asked for, which the endpoint recomputes
      // against its own count of new rows. A mismatch means the dry run
      // went stale while it was being read.
      confirm: preview.confirmPhrase,
    });

    setRunning(null);
    setConfirming(false);

    if (outcome.status !== 'ok') {
      setRefused(outcome.message);
      const t = outcomeToast(outcome, '');
      if (t) toast.show(t);
      // A stale preview is the common refusal here — somebody else loaded
      // rows while this one was being read. The fix is to run the dry run
      // again and read the counts, not to retype the phrase, so the
      // preview goes and the wizard steps back to where it is produced.
      if (outcome.status === 'invalid') {
        setPreview(null);
        setStep(2);
      }
      return;
    }

    setCommitted({ report: outcome.data, persisted: outcome.persisted });

    const t = outcomeToast(outcome, `${outcome.data.counts.new} rows added to the degree register`);
    if (t) toast.show(t);

    if (outcome.persisted) router.refresh();
  };

  const reset = () => {
    setStep(1);
    setFileName('');
    setHeaders([]);
    setData([]);
    setMapping(EMPTY_MAPPING);
    setPreview(null);
    setCommitted(null);
    setParseError(null);
    setRefused(null);
  };

  // ---------------------------------------------------------------

  if (committed) {
    const { report, persisted } = committed;

    return (
      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle as="h2">
              <CheckCircle2 className="mr-2 inline size-5 align-[-4px] text-success-fg" aria-hidden="true" />
              {report.fileName} loaded
            </CardTitle>
            <CardDescription>
              {report.counts.new} rows added, {report.counts.duplicate} skipped as duplicates,{' '}
              {report.counts.rejected} rejected.
            </CardDescription>
          </div>
          <Badge tone="success">{report.auditedAs ?? 'register.import'}</Badge>
        </CardHeader>
        <CardBody className="space-y-4">
          <Alert tone="success" title="What changed" icon={<CheckCircle2 className="size-4" />}>
            <p>
              The register now holds {report.registerTotalAfter} rows. {report.counts.new} graduates who could not be
              verified an hour ago can be verified now. One row was written to{' '}
              <span className="font-mono">audit_log</span>: actor, file name, row counts, and the rejection list.
            </p>
          </Alert>

          <p className="text-sm text-secondary">{report.note}</p>

          {report.counts.rejected > 0 ? (
            <Alert tone="warning" title="Fix and re-send" icon={<AlertTriangle className="size-4" />}>
              <p>
                {report.counts.rejected} rows were rejected and are not in the register. Send the reasons back to the
                examinations branch, then load the corrected file — the rows that went in today will be skipped, so
                re-running is safe.
              </p>
            </Alert>
          ) : null}

          {!persisted ? (
            <p className="text-xs text-muted">
              This build runs on seeded data with no database behind it. The capability check, every row verdict and the
              audit entry all ran on the server; the insert did not, so the register still holds{' '}
              {report.registerTotal} rows. The counts above are what the loader would have done with this exact file.
            </p>
          ) : null}
        </CardBody>
        <CardFooter>
          <ButtonLink href="/admin/degree-register">Back to the register</ButtonLink>
          <ButtonLink href="/admin/imports" variant="secondary">
            Import history
          </ButtonLink>
          <Button variant="ghost" onClick={reset}>
            Load another file
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Steps current={step} />

      {refused ? (
        <Alert tone="danger" title="The server refused this" icon={<AlertTriangle className="size-4" />}>
          <p>{refused}</p>
        </Alert>
      ) : null}

      {/* ---------------- Step 1 ---------------- */}
      {step === 1 ? (
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle as="h2">Choose the file</CardTitle>
              <CardDescription>
                A CSV from the examinations branch. It is parsed here in the browser, so you can check the columns of a
                file before any of it is sent anywhere.
              </CardDescription>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field
              htmlFor="register-file"
              label="Register file"
              hint="CSV, UTF-8, with a header row. An .xlsx must be saved as CSV first."
            >
              <input
                id="register-file"
                type="file"
                accept=".csv,text/csv"
                onChange={onPick}
                className={cn(
                  'block w-full cursor-pointer rounded border border-dashed border-line-strong bg-surface px-3 py-8 text-sm text-secondary',
                  'file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5',
                  'file:text-sm file:font-semibold file:text-primary',
                  'hover:border-[var(--focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
                )}
              />
            </Field>

            {parseError ? (
              <Alert tone="danger" title="That file could not be used" icon={<AlertTriangle className="size-4" />}>
                <p>{parseError}</p>
              </Alert>
            ) : null}

            <div className="rounded-lg border border-line bg-surface p-4">
              <p className="text-sm font-medium">No file to hand?</p>
              <p className="mt-1 text-sm text-secondary">
                Load <span className="font-mono">{sampleFileName}</span> — a real export shape, including four rows
                already in the register, two graduates who share a name, and five rows the loader will refuse.
              </p>
              <div className="mt-3">
                <Button variant="secondary" size="sm" onClick={() => load(sampleFileName, sampleCsv)}>
                  <FileSpreadsheet className="size-4" aria-hidden="true" />
                  Use {sampleFileName}
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* ---------------- Step 2 ---------------- */}
      {step === 2 ? (
        <Card>
          <CardHeader>
            <div className="min-w-0 space-y-1">
              <CardTitle as="h2">Map the columns</CardTitle>
              <CardDescription>
                <span className="font-mono">{fileName}</span> — {data.length} data rows, {headers.length} columns.
                Detected automatically from the header row; correct anything that is wrong.
              </CardDescription>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {TARGETS.map((t) => {
                const column = mapping[t.key];
                const sampleValue = column ? (data[0]?.[headers.indexOf(column)] ?? '').trim() : '';
                return (
                  <Field
                    key={t.key}
                    htmlFor={`map-${t.key}`}
                    label={t.label}
                    required={t.required}
                    hint={t.key === 'department' ? `Configured on this college: ${departmentCodes.join(', ')}.` : t.hint}
                  >
                    <Select
                      id={`map-${t.key}`}
                      value={column}
                      onChange={(e) => setTarget(t.key, e.target.value)}
                      invalid={t.required && !column}
                    >
                      <option value="">— not in this file —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </Select>
                    <p className="pt-1 text-xs text-muted">
                      {column ? (
                        <>
                          First row: <span className="font-mono text-secondary">{sampleValue || '(blank)'}</span>
                        </>
                      ) : t.required ? (
                        'Required — the loader cannot run without it.'
                      ) : (
                        'Left out. The fallback above applies.'
                      )}
                    </p>
                  </Field>
                );
              })}
            </div>

            {mappingProblems.length > 0 ? (
              <Alert tone="danger" title="Fix the mapping first" icon={<AlertTriangle className="size-4" />}>
                <ul className="list-disc space-y-1 pl-5">
                  {mappingProblems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </Alert>
            ) : null}
          </CardBody>
          <CardFooter>
            <Button variant="ghost" onClick={reset} disabled={running !== null}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Choose a different file
            </Button>
            <div className="ml-auto">
              <Button
                onClick={() => void runDryRun()}
                loading={running === 'preview'}
                disabled={mappingProblems.length > 0}
              >
                Run the dry run
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      ) : null}

      {/* ---------------- Step 3 ---------------- */}
      {step === 3 && preview ? (
        <Card>
          <CardHeader>
            <div className="min-w-0 space-y-1">
              <CardTitle as="h2">Dry run</CardTitle>
              <CardDescription>
                Nothing has been written. This is what the server says committing{' '}
                <span className="font-mono">{fileName}</span> would do, row by row.
              </CardDescription>
            </div>
          </CardHeader>
          <CardBody className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-line bg-surface p-4">
                <p className="text-sm text-secondary">New rows</p>
                <p className="font-display text-display-xs font-bold tabular text-success-fg">
                  {preview.counts.new}
                </p>
                <p className="text-xs text-muted">Graduates who become verifiable</p>
              </div>
              <div className="rounded-lg border border-line bg-surface p-4">
                <p className="text-sm text-secondary">Already present</p>
                <p className="font-display text-display-xs font-bold tabular">{preview.counts.duplicate}</p>
                <p className="text-xs text-muted">
                  {preview.counts.duplicateInRegister} in the register · {preview.counts.duplicateInFile} repeated in
                  the file
                </p>
              </div>
              <div className="rounded-lg border border-line bg-surface p-4">
                <p className="text-sm text-secondary">Rejected</p>
                <p className="font-display text-display-xs font-bold tabular text-danger-fg">
                  {preview.counts.rejected}
                </p>
                <p className="text-xs text-muted">Listed row by row below</p>
              </div>
            </div>

            <ProportionBar
              label="Dry run outcome by row"
              segments={[
                { label: 'New', value: preview.counts.new, tone: 'success' },
                { label: 'Already present', value: preview.counts.duplicate, tone: 'neutral' },
                { label: 'Rejected', value: preview.counts.rejected, tone: 'danger' },
              ]}
            />

            <Alert tone="info" title="Running this file twice changes nothing" icon={<Copy className="size-4" />}>
              <p>
                Rows are keyed on <span className="font-mono">{preview.idempotentOn}</span>. Commit this file now and{' '}
                <span className="font-semibold">{preview.counts.new}</span> rows are inserted; commit the same file
                again and all {preview.counts.new + preview.counts.duplicate} rows are recognised and skipped, with
                nothing duplicated and nothing overwritten. A load that fails halfway can be re-run from the start.
              </p>
              {preview.fileAlreadyLoaded ? (
                <p className="mt-2">
                  <span className="font-semibold">
                    A file named {fileName} has already been loaded into this register.
                  </span>{' '}
                  That is fine — it is exactly the case the roll-number key handles. Expect most rows to be skipped.
                </p>
              ) : null}
            </Alert>

            {preview.homonyms.length > 0 ? (
              <Alert
                tone="warning"
                title={`${preview.homonyms.length} name${preview.homonyms.length === 1 ? '' : 's'} shared inside this file`}
                icon={<Users className="size-4" />}
              >
                <p>
                  These are two real people, not a duplicate row, and both go in. The verification queue will surface
                  the ambiguity when either of them registers, and a reviewer will separate them on roll number.
                </p>
                <ul className="mt-2 space-y-1">
                  {preview.homonyms.map((h) => (
                    <li key={h.label}>
                      {h.label} — <span className="font-mono">{h.rollNumbers.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              </Alert>
            ) : null}

            {preview.counts.rejected > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Rejected rows, and why</h3>
                <TableWrap caption="Rows the loader would refuse">
                  <Table>
                    <THead>
                      <TR>
                        <TH align="right">Line</TH>
                        <TH>Roll number</TH>
                        <TH>Name</TH>
                        <TH>Reason</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {preview.rejected.map((r) => (
                        <TR key={`${r.line}-${r.rollNumber}`}>
                          <TD numeric>{r.line}</TD>
                          <TD>
                            <span className="font-mono">{r.rollNumber || '—'}</span>
                          </TD>
                          <TD>{r.name || <span className="text-muted">(blank)</span>}</TD>
                          <TD>{r.reason}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableWrap>
                {preview.rejectedListTruncatedAt ? (
                  <p className="text-xs text-muted">
                    Showing the first {preview.rejectedListTruncatedAt} of {preview.counts.rejected}. The full list goes
                    into the import record.
                  </p>
                ) : null}
              </div>
            ) : (
              <Alert tone="success" title="Every row is usable" icon={<CheckCircle2 className="size-4" />}>
                <p>No row was refused. That is unusual for a first export — worth a second look at the column mapping.</p>
              </Alert>
            )}
          </CardBody>
          <CardFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setPreview(null);
                setStep(2);
              }}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to the mapping
            </Button>
            <div className="ml-auto">
              <Button
                onClick={() => setStep(4)}
                disabled={preview.counts.new === 0 && preview.counts.duplicate === 0}
              >
                Continue to commit
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      ) : null}

      {/* ---------------- Step 4 ---------------- */}
      {step === 4 && preview ? (
        <Card>
          <CardHeader>
            <div className="min-w-0 space-y-1">
              <CardTitle as="h2">Commit the import</CardTitle>
              <CardDescription>The last step that changes anything.</CardDescription>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <dl className="divide-y divide-line rounded-lg border border-line bg-surface px-4">
              <div className="flex justify-between gap-4 py-3 text-sm">
                <dt className="text-secondary">File</dt>
                <dd className="font-mono font-medium">{fileName}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3 text-sm">
                <dt className="text-secondary">Rows inserted</dt>
                <dd className="font-medium tabular">{preview.counts.new}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3 text-sm">
                <dt className="text-secondary">Rows skipped as already present</dt>
                <dd className="font-medium tabular">{preview.counts.duplicate}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3 text-sm">
                <dt className="text-secondary">Rows refused</dt>
                <dd className="font-medium tabular">{preview.counts.rejected}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3 text-sm">
                <dt className="text-secondary">Register size after</dt>
                <dd className="font-medium tabular">{preview.registerTotalAfter}</dd>
              </div>
            </dl>

            <Alert tone="warning" title="What a commit does" icon={<RefreshCw className="size-4" />}>
              <p>
                Inserts {preview.counts.new} rows into <span className="font-mono">degree_register</span>, records the
                import with your name and the full rejection list, and writes one{' '}
                <span className="font-mono">audit_log</span> entry with the before and after row counts. It does not
                touch a single member account — verification stays a separate, human decision.
              </p>
            </Alert>
          </CardBody>
          <CardFooter>
            <Button variant="ghost" onClick={() => setStep(3)} disabled={running !== null}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to the dry run
            </Button>
            <div className="ml-auto">
              <Button onClick={() => setConfirming(true)} disabled={running !== null}>
                Commit {preview.counts.new} rows
              </Button>
            </div>
          </CardFooter>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void commit()}
        pending={running === 'commit'}
        tone="primary"
        title="Commit this import?"
        confirmLabel="Commit the import"
        requireTyped={preview?.confirmPhrase ?? 'IMPORT'}
        body={
          <div className="space-y-3">
            <p>
              <span className="font-mono text-primary">{fileName}</span> adds{' '}
              <span className="font-semibold text-primary">{preview?.counts.new ?? 0}</span> rows and skips{' '}
              {preview?.counts.duplicate ?? 0} already present.
            </p>
            <p>
              The register is what every alumni verification is decided against, so a wrong file is felt for years
              rather than minutes. Type the phrase to confirm you have read the dry run — the server checks it against
              its own count, so a preview that went stale while you read it is refused rather than committed.
            </p>
          </div>
        }
      />
    </div>
  );
}
