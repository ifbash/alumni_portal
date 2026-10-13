import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ShieldCheck, TriangleAlert } from 'lucide-react';

import { getSessionMember } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { inSentence } from '@/lib/branding/copy';
import {
  getCoverageByYear,
  getReportSections,
  perceptionSurveyList,
  REPORT_FRAMEWORKS,
  type ReportSection,
} from '@/lib/data/reports';
import { formatNumber } from '@/lib/format';
import {
  Alert,
  Badge,
  Breadcrumbs,
  Card,
  CardBody,
  DefinitionCard,
  PageHeader,
  SegmentedNav,
  Table,
  TableWrap,
  Tabs,
  TBody,
  TD,
  TH,
  THead,
  TR,
  type TabItem,
} from '@/components/ui';
import { ExportButton, PerceptionSurveyDialog, PrintButton } from '../ExportButton';
import { Letterhead } from '../Letterhead';
import {
  CSV_COLUMNS,
  FRAMEWORK_META,
  ReportSectionCard,
  displayValue,
  frameworkFromSlug,
  frameworkInputs,
  frameworkOptions,
  frameworkStatus,
  hasCriterion,
  plainDefinition,
} from '../frameworks';

/**
 * One framework, on its own.
 *
 * The console answers "what do we have"; this page answers "what am I
 * submitting". Two views of the same rows, switched in the URL: the cards
 * (each figure with its denominator, definition and caveat) and the table
 * the export holds, column for column. Printing always produces the table,
 * on the college letterhead.
 *
 * The NIRF page is the only one carrying a contact-data control. The
 * perception-survey list is `member.export`, college admin alone, and it
 * is rendered nowhere at all for anyone else — not disabled, not greyed,
 * absent.
 */

const PERCEPTION_COLUMNS = ['Roll number', 'Name', 'Year of passing', 'Branch', 'Email'];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ framework: string }>;
}): Promise<Metadata> {
  const { framework: slug } = await params;
  const framework = frameworkFromSlug(slug);
  if (!framework) return { title: 'Framework not found · Staff console' };

  const meta = FRAMEWORK_META[framework];
  return {
    title: `${meta.name} · Staff console`,
    description: meta.asks,
  };
}

export default async function FrameworkReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ framework: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session, member: actor } = await getSessionMember();
  if (!session) redirect('/login');
  requireCap(session, 'audit.read');

  const { framework: slug } = await params;
  const framework = frameworkFromSlug(slug);
  if (!framework) notFound();

  const meta = FRAMEWORK_META[framework];
  const all = getReportSections();
  const sections = all.filter((s) => s.framework === framework);
  const metrics = sections.flatMap((s) => s.metrics);
  const caveated = metrics.filter((m) => m.caveat);

  // Bulk contact data. The function is only called at all when the viewer
  // holds the capability that would let them export it.
  const canExportContacts = can(session, 'member.export');
  const showsPerception = framework === 'NIRF' && canExportContacts;
  const perceptionRows = showsPerception ? perceptionSurveyList().length : 0;
  // The denominator the perception list has to be read against: contactable
  // alumni are always a fraction of the recorded graduating body.
  const registerRows = showsPerception ? getCoverageByYear().reduce((n, y) => n + y.total, 0) : 0;

  const query = await searchParams;
  const view = (Array.isArray(query.view) ? query.view[0] : query.view) === 'table' ? 'table' : 'cards';
  const base = `/admin/reports/${meta.slug}`;

  const resolved = await getTenantBrand();
  const pack = resolved?.brand.pack;

  const status = frameworkStatus(framework, all);
  const inputs = frameworkInputs(framework, all);

  const tabs: TabItem[] = [
    { label: 'Overview', href: '/admin/reports' },
    ...REPORT_FRAMEWORKS.map((f) => ({
      label: FRAMEWORK_META[f].name,
      href: `/admin/reports/${FRAMEWORK_META[f].slug}`,
      active: f === framework,
    })),
  ];

  const options = frameworkOptions(all);
  const scoped = options.filter((o) => o.value === framework || o.value === 'all');

  return (
    <div className="space-y-6">
      {pack ? <Letterhead pack={pack} title={`${meta.name} annexure`} /> : null}

      <PageHeader
        breadcrumbs={
          <div data-print-hide="">
            <Breadcrumbs
              items={[
                { label: 'Staff console', href: '/admin' },
                { label: 'Accreditation', href: '/admin/reports' },
                { label: meta.name },
              ]}
            />
          </div>
        }
        eyebrow="Reporting"
        title={meta.name}
        description={`${meta.full}, for the ${inSentence(meta.owner)}.`}
        meta={
          <Badge tone={status.ready ? 'success' : 'warning'} className="whitespace-nowrap">
            {status.line}
          </Badge>
        }
        actions={
          sections.length > 0 ? (
            <div data-print-hide="" className="flex flex-wrap items-center gap-2">
              <PrintButton label="Print annexure" />
              <ExportButton
                frameworks={scoped}
                defaultFramework={framework}
                columns={CSV_COLUMNS}
                label={`Export ${meta.name}`}
              />
            </div>
          ) : null
        }
      />

      <div data-print-hide="">
        <Tabs items={tabs} ariaLabel="Reporting frameworks" />
      </div>

      {sections.length === 0 ? (
        <Card>
          <CardBody className="space-y-4">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-semibold">What {meta.name} needs from the college</h2>
              <p className="max-w-prose text-sm text-secondary">{meta.blocked ?? meta.asks}</p>
            </div>
            {inputs.length ? (
              <ul className="divide-y divide-line rounded border border-line bg-surface text-sm">
                {inputs.map((i) => (
                  <li key={i.label} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5">
                    <span className="font-medium">{i.label}</span>
                    {i.value ? (
                      <span className="font-semibold tabular">On record: {i.value}</span>
                    ) : (
                      <Badge tone="warning">Not supplied yet</Badge>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-sm">
              <span className="text-secondary">Who to ask:</span>{' '}
              <span className="font-medium">the {inSentence(meta.owner.split(',')[0] ?? meta.owner)}</span>
            </p>
          </CardBody>
        </Card>
      ) : (
        <>
          <div data-print-hide="" className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedNav
              items={[
                { label: 'Cards', href: base, active: view === 'cards' },
                { label: 'Table', href: `${base}?view=table`, active: view === 'table' },
              ]}
            />
            <p className="text-sm text-secondary">
              {metrics.length} figures across {sections.length} {sections.length === 1 ? 'section' : 'sections'}
            </p>
          </div>

          {caveated.length > 0 ? (
            <Alert
              tone="warning"
              title={`${caveated.length} of these ${metrics.length} figures carry a caveat`}
              icon={<TriangleAlert className="size-4" aria-hidden="true" />}
            >
              <p>{caveated.map((m) => m.label).join(', ')}. Quote each one with its caveat.</p>
            </Alert>
          ) : null}

          {view === 'cards' ? (
            <>
              <div data-print-hide="" className="space-y-4">
                {sections.map((section) => (
                  <ReportSectionCard key={`${section.criterion}-${section.title}`} section={section} />
                ))}
              </div>
              {/* Printing from the cards view still produces the annexure table. */}
              <div className="print-only">
                <ExportTable sections={sections} name={meta.name} />
              </div>
            </>
          ) : (
            <section aria-labelledby="export-table-heading" className="space-y-3">
              <div className="space-y-1">
                <h2 id="export-table-heading" className="font-display text-xl font-semibold">
                  What the export holds
                </h2>
                <p className="text-sm text-secondary">
                  One row per figure, in the order of the spreadsheet, which also carries Framework and Section.
                </p>
              </div>
              <ExportTable sections={sections} name={meta.name} />
            </section>
          )}

          {showsPerception ? (
            <section id="perception" aria-labelledby="perception-heading" data-print-hide="">
              <Card>
                <CardBody className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <h2 id="perception-heading" className="font-display text-lg font-semibold">
                      {formatNumber(perceptionRows)} alumni can be sent the NIRF survey (of{' '}
                      {formatNumber(registerRows)} graduates)
                    </h2>
                    <p className="flex items-center gap-1.5 text-sm text-secondary">
                      <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
                      College admin only · your reason is recorded
                    </p>
                  </div>
                  <PerceptionSurveyDialog
                    rowCount={perceptionRows}
                    registerTotal={registerRows}
                    actorName={actor?.fullName ?? 'Signed-in admin'}
                    actorEmail={actor?.privateContact.email ?? 'your college address'}
                    columns={PERCEPTION_COLUMNS}
                  />
                </CardBody>
              </Card>
            </section>
          ) : null}

          <p data-print-hide="" className="text-sm text-secondary">
            Want the register behind these figures by year and branch?{' '}
            <Link href="/admin/reports/coverage" className="link">
              Open register coverage
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

/** The export's rows, column for column. Cards below `sm`, a table above it and in print. */
function ExportTable({ sections, name }: { sections: ReportSection[]; name: string }) {
  const rows = sections.flatMap((section) => section.metrics.map((m) => ({ section, m })));

  return (
    <>
      <ul className="space-y-3 sm:hidden print:hidden">
        {rows.map(({ section, m }) => (
          <li key={`m-${section.title}-${m.label}`}>
            <DefinitionCard
              title={m.label}
              subtitle={[hasCriterion(m.code) ? m.code : null, section.title].filter(Boolean).join(' · ')}
              rows={[
                { label: 'Value', value: <span className="tabular">{displayValue(m.value)}</span> },
                {
                  label: 'Out of',
                  value: <span className="block text-left font-normal">{m.denominator ?? 'A count'}</span>,
                },
                {
                  label: 'Definition',
                  value: <span className="block text-left font-normal">{plainDefinition(m.definition)}</span>,
                },
                ...(m.caveat
                  ? [
                      {
                        label: 'Caveat',
                        value: <span className="block text-left font-normal text-warning-fg">{m.caveat}</span>,
                      },
                    ]
                  : []),
              ]}
            />
          </li>
        ))}
      </ul>

      <TableWrap className="hidden sm:block print:block" caption={`${name} figures, with denominators and definitions`}>
        <Table>
          <THead>
            <TR>
              <TH>Criterion</TH>
              <TH>Metric</TH>
              <TH align="right">Value</TH>
              <TH>Denominator</TH>
              <TH>Definition</TH>
              <TH>Caveat</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map(({ section, m }) => (
              <TR key={`r-${section.title}-${m.label}`}>
                <TD className="whitespace-nowrap font-mono text-xs">{hasCriterion(m.code) ? m.code : ''}</TD>
                <TD className="min-w-48 print:min-w-0">
                  <span className="font-medium">{m.label}</span>
                  <span className="block text-xs text-secondary">{section.title}</span>
                </TD>
                <TD numeric className="whitespace-nowrap font-semibold">
                  {displayValue(m.value)}
                </TD>
                <TD className="min-w-40 text-xs text-secondary print:min-w-0">{m.denominator ?? 'A count'}</TD>
                <TD className="min-w-64 text-xs text-secondary print:min-w-0">{plainDefinition(m.definition)}</TD>
                <TD className="min-w-48 text-xs print:min-w-0">
                  {m.caveat ? <span className="text-warning-fg">{m.caveat}</span> : null}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </TableWrap>
    </>
  );
}
