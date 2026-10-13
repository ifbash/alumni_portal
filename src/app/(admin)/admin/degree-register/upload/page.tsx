import { redirect } from 'next/navigation';
import { MapPin } from 'lucide-react';

import {
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CopyButton,
  Disclosure,
  PageHeader,
  Section,
} from '@/components/ui';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { capitalise } from '@/lib/branding/copy';
import { getDegreeRegisterStats, getDepartments, searchDegreeRegister } from '@/lib/data/repo';
import { displayNow, formatNumber, yearIn } from '@/lib/format';
import { UploadWizard } from './UploadWizard';
import {
  RegisterFilesGrid,
  missingRegisterFiles,
  registerRequestText,
} from '../../_shared/RegisterFilesGrid';

export const metadata = { title: 'Load a register file · Staff console' };

const SAMPLE_YEAR = 2019;

/**
 * Builds a realistic file for the wizard to chew on.
 *
 * The first rows are copied verbatim out of the register, so the dry run
 * demonstrates idempotency against real data rather than against a story.
 * The rest are the failures a real examinations-branch export actually
 * contains: a roll typed as a serial number, a blank name, a year with a
 * letter in it, and two people who genuinely share a name.
 */
function buildSampleCsv(shortName: string, dept: string): { fileName: string; csv: string } {
  const existing = searchDegreeRegister('', { department: dept, year: SAMPLE_YEAR, perPage: 4 }).items;

  const header = 'Roll No,Student Name,Branch,Programme,Year of Admission,Year of Passing';
  const admitted = SAMPLE_YEAR - 4;
  const yy = String(admitted).slice(2);

  const lines = [
    header,
    ...existing.map((r) =>
      [
        r.rollNumber,
        r.name,
        r.departmentCode ?? dept,
        r.programme ?? 'B.Tech',
        r.admissionYear ?? admitted,
        r.yearOfPassing ?? SAMPLE_YEAR,
      ].join(','),
    ),
    `${yy}JN1A0591,KOLLIPARA SAI KIRAN,${dept},B.Tech,${admitted},${SAMPLE_YEAR}`,
    `${yy}JN1A0592,MADDIPATLA ANUSHA,${dept},B.Tech,${admitted},${SAMPLE_YEAR}`,
    `${yy}JN1A0593,GUDIVADA RAMYA SREE,${dept},B.Tech,${admitted},${SAMPLE_YEAR}`,
    `${yy}JN1A0594,GUDIVADA RAMYA SREE,${dept},B.Tech,${admitted},${SAMPLE_YEAR}`,
    `${yy}JN1A0595,NALLAMOTHU HARIKA,${dept},B.Tech,${admitted},${SAMPLE_YEAR}`,
    `${yy}JN1A0591,KOLLIPARA SAI KIRAN,${dept},B.Tech,${admitted},${SAMPLE_YEAR}`,
    `01,BHOGIREDDY VENKATA SUBBA RAO,${dept},B.Tech,${admitted},${SAMPLE_YEAR}`,
    `${yy}JN1A0596,,${dept},B.Tech,${admitted},${SAMPLE_YEAR}`,
    `${yy}JN1A0597,CHINTALAPUDI LAKSHMI PRASANNA,${dept},B.Tech,${admitted},20l9`,
    `${yy}JN1A0598,YALAMANCHILI DURGA PRASAD,${dept},B.Tech,${SAMPLE_YEAR + 1},${SAMPLE_YEAR}`,
    `${yy}JN1A0599,PATHAN IMRAN KHAN,CSM,B.Tech,${admitted},${SAMPLE_YEAR}`,
  ];

  return { fileName: `${shortName}_${SAMPLE_YEAR}_${dept}.csv`, csv: lines.join('\n') };
}

export default async function DegreeRegisterUploadPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  requireCap(session, 'verification.review.any');

  const resolved = await getTenantBrand();
  if (!resolved) redirect('/login');
  const pack = resolved.brand.pack;
  const shortName = pack.copy.shortName;

  const stats = getDegreeRegisterStats();
  const departments = getDepartments();
  const codes = departments.map((d) => d.code);
  const sampleDept = codes[0] ?? 'BRANCH';

  const allRows = searchDegreeRegister('', { perPage: 100000 }).items;
  const sourceFiles = allRows.map((r) => r.sourceFile);
  const throughYear = yearIn(pack.locale.timeZone, displayNow());
  const missing = missingRegisterFiles({ sourceFiles, branches: codes, throughYear });
  const fileCount = new Set(sourceFiles.filter(Boolean)).size;

  const request = registerRequestText({
    shortName,
    office: capitalise(pack.copy.officeName),
    rollLabel: pack.copy.rollNumberLabel,
    missing,
    exampleYear: SAMPLE_YEAR,
    exampleBranch: sampleDept,
  });

  const sample = buildSampleCsv(shortName, sampleDept);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Staff console', href: '/admin' },
              { label: 'Degree register', href: '/admin/degree-register' },
              { label: 'Load a file' },
            ]}
          />
        }
        eyebrow="People and records"
        title="Load a register file"
        description="Choose the file, check its columns, read the dry run, then commit. Nothing is written before the last step."
      />

      <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <UploadWizard
            departmentCodes={codes}
            registerTotal={stats.total}
            sampleFileName={sample.fileName}
            sampleCsv={sample.csv}
          />
        </div>

        <aside aria-label="About register files" className="min-w-0 space-y-gutter">
          <Card>
            <CardHeader variant="stack">
              <CardTitle as="h2" className="text-md">
                Ask the examinations branch
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3 pt-3">
              <p className="text-sm text-secondary">
                One CSV per batch and branch, with six columns.
                {missing.length > 0
                  ? ` ${missing.length} ${missing.length === 1 ? 'file is' : 'files are'} still missing; the request lists them.`
                  : ''}
              </p>
              <CopyButton
                text={request}
                label="Copy request for the examinations branch"
                copiedLabel="Request copied"
                className="w-full [&>button]:h-auto [&>button]:w-full [&>button]:whitespace-normal [&>button]:py-2.5"
              />
            </CardBody>
          </Card>

          <Disclosure summary="Rules the loader applies">
            <ul className="space-y-2">
              <li>
                <span className="font-medium text-primary">The roll number is the key.</span> A roll already in the
                register is skipped, never added twice and never overwritten.
              </li>
              <li>
                <span className="font-medium text-primary">Names are kept as printed.</span> Spelling differences are
                handled when a registration is matched.
              </li>
              <li>
                <span className="font-medium text-primary">Bad rows are reported, not dropped.</span> Each refusal names
                the line and the reason.
              </li>
              <li>
                <span className="font-medium text-primary">Two people may share a name.</span> Both go in; the roll
                number tells them apart.
              </li>
            </ul>
          </Disclosure>

          <p className="flex items-start gap-2 px-1 text-xs text-secondary">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              The file is read in your browser for the preview. The register is stored in India, and holds no marks and
              no contact details.
            </span>
          </p>
        </aside>
      </div>

      <Section
        title="Already loaded"
        description={`${formatNumber(stats.total)} rows from ${formatNumber(fileCount)} files.`}
        actions={
          <ButtonLink href="/admin/imports" variant="ghost" size="sm" className="min-h-11 sm:min-h-0">
            Imports
          </ButtonLink>
        }
      >
        <RegisterFilesGrid sourceFiles={sourceFiles} branches={codes} throughYear={throughYear} linkable />
      </Section>
    </div>
  );
}
