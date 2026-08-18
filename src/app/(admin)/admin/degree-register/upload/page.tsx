import { redirect } from 'next/navigation';
import { FileSpreadsheet, ShieldCheck } from 'lucide-react';

import {
  Alert,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from '@/components/ui';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getDegreeRegisterStats, getDepartments, searchDegreeRegister } from '@/lib/data/repo';
import { formatNumber } from '@/lib/format';
import { UploadWizard } from './UploadWizard';

export const metadata = { title: 'Load a degree register file' };

const SAMPLE_YEAR = 2019;
const SAMPLE_DEPT = 'CSE';

/**
 * Builds a realistic file for the wizard to chew on.
 *
 * The first rows are copied verbatim out of the register, so the dry run
 * demonstrates idempotency against real data rather than against a story.
 * The rest are the failures a real examinations-branch export actually
 * contains: a roll typed as a serial number, a blank name, a year with a
 * letter in it, and two people who genuinely share a name.
 */
function buildSampleCsv(): { fileName: string; csv: string } {
  const existing = searchDegreeRegister('', { department: SAMPLE_DEPT, year: SAMPLE_YEAR, perPage: 4 }).items;

  const header = 'Roll No,Student Name,Branch,Programme,Year of Admission,Year of Passing';
  const admitted = SAMPLE_YEAR - 4;
  const yy = String(admitted).slice(2);

  const lines = [
    header,
    ...existing.map((r) =>
      [
        r.rollNumber,
        r.name,
        r.departmentCode ?? SAMPLE_DEPT,
        r.programme ?? 'B.Tech',
        r.admissionYear ?? admitted,
        r.yearOfPassing ?? SAMPLE_YEAR,
      ].join(','),
    ),
    `${yy}JN1A0591,KOLLIPARA SAI KIRAN,CSE,B.Tech,${admitted},${SAMPLE_YEAR}`,
    `${yy}JN1A0592,MADDIPATLA ANUSHA,CSE,B.Tech,${admitted},${SAMPLE_YEAR}`,
    `${yy}JN1A0593,GUDIVADA RAMYA SREE,CSE,B.Tech,${admitted},${SAMPLE_YEAR}`,
    `${yy}JN1A0594,GUDIVADA RAMYA SREE,CSE,B.Tech,${admitted},${SAMPLE_YEAR}`,
    `${yy}JN1A0595,NALLAMOTHU HARIKA,CSE,B.Tech,${admitted},${SAMPLE_YEAR}`,
    `${yy}JN1A0591,KOLLIPARA SAI KIRAN,CSE,B.Tech,${admitted},${SAMPLE_YEAR}`,
    `01,BHOGIREDDY VENKATA SUBBA RAO,CSE,B.Tech,${admitted},${SAMPLE_YEAR}`,
    `${yy}JN1A0596,,CSE,B.Tech,${admitted},${SAMPLE_YEAR}`,
    `${yy}JN1A0597,CHINTALAPUDI LAKSHMI PRASANNA,CSE,B.Tech,${admitted},20l9`,
    `${yy}JN1A0598,YALAMANCHILI DURGA PRASAD,CSE,B.Tech,${SAMPLE_YEAR + 1},${SAMPLE_YEAR}`,
    `${yy}JN1A0599,PATHAN IMRAN KHAN,CSM,B.Tech,${admitted},${SAMPLE_YEAR}`,
  ];

  return { fileName: `DIET_${SAMPLE_YEAR}_${SAMPLE_DEPT}.csv`, csv: lines.join('\n') };
}

export default async function DegreeRegisterUploadPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  requireCap(session, 'verification.review.any');

  const stats = getDegreeRegisterStats();
  const departments = getDepartments();

  const allRows = searchDegreeRegister('', { perPage: 100000 }).items;
  const existingRolls = allRows.map((r) => r.rollNumber);
  const loadedFiles = [...new Set(allRows.map((r) => r.sourceFile).filter((f): f is string => Boolean(f)))].sort();

  const sample = buildSampleCsv();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Admin', href: '/admin' },
              { label: 'Degree register', href: '/admin/degree-register' },
              { label: 'Load a file' },
            ]}
          />
        }
        eyebrow="Identity"
        title="Load a degree register file"
        description="Four steps: choose the file, map its columns, read the dry run, then commit. Nothing is written until the last step, and re-running the same file adds nothing the second time."
        actions={
          <ButtonLink href="/admin/imports" variant="secondary">
            Import history
          </ButtonLink>
        }
      />

      <Alert tone="info" title="What to ask the examinations branch for" icon={<FileSpreadsheet className="size-4" />}>
        <p>
          One CSV per batch and branch, named like <span className="font-mono">DIET_2019_CSE.csv</span>, with a header
          row and six columns: roll number, name exactly as printed on the memorandum of marks, branch code, programme,
          year of admission and year of passing. An Excel file saved as CSV (UTF-8) is fine. Nothing else is needed —
          the register holds no marks, no CGPA and no contact details, and asking for them would put data in the portal
          that nobody here has a purpose for.
        </p>
      </Alert>

      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <UploadWizard
          departmentCodes={departments.map((d) => d.code)}
          existingRolls={existingRolls}
          registerTotal={stats.total}
          loadedFiles={loadedFiles}
          sampleFileName={sample.fileName}
          sampleCsv={sample.csv}
        />

        <div className="space-y-gutter">
          <Card>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle as="h2">Rules the loader applies</CardTitle>
                <CardDescription>The same rules the verification matcher is scored against.</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <ul className="space-y-3 text-sm text-secondary">
                <li>
                  <span className="font-medium text-primary">Roll number is the key.</span> Rows are matched on tenant
                  and roll number. A roll already present is skipped, never inserted a second time and never silently
                  overwritten.
                </li>
                <li>
                  <span className="font-medium text-primary">The name is kept as printed.</span> Register spelling is
                  the evidence; the matcher normalises at comparison time instead of at load time, so nothing is lost.
                </li>
                <li>
                  <span className="font-medium text-primary">Bad rows are reported, not dropped.</span> Every rejection
                  names the row and the reason, so the file can be fixed once and re-sent.
                </li>
                <li>
                  <span className="font-medium text-primary">Two people may share a name.</span> Same name, same branch,
                  same year is a warning, never a rejection — in a cohort of 240 it happens, and deleting one of them
                  makes a graduate unverifiable forever.
                </li>
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle as="h2">Already loaded</CardTitle>
                <CardDescription>{formatNumber(stats.total)} rows across {loadedFiles.length} files.</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <ul className="max-h-64 space-y-1 overflow-y-auto font-mono text-xs text-secondary">
                {loadedFiles.slice(0, 40).map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {loadedFiles.length > 40 ? (
                <p className="pt-2 text-xs text-muted">and {loadedFiles.length - 40} more.</p>
              ) : null}
            </CardBody>
          </Card>

          <Alert tone="neutral" icon={<ShieldCheck className="size-4" />}>
            <p className="text-xs">
              The file is read in your browser to build the preview — it is not uploaded anywhere until you commit, and
              the register itself never leaves <span className="font-mono">ap-south-1</span>.
            </p>
          </Alert>
        </div>
      </div>
    </div>
  );
}
