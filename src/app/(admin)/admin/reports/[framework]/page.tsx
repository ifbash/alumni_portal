import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ClipboardList, FileSpreadsheet, Lock, Percent, ShieldCheck, TriangleAlert } from 'lucide-react';

import { getSessionMember } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import {
  getCoverageByYear,
  getReportSections,
  perceptionSurveyList,
  REPORT_FRAMEWORKS,
} from '@/lib/data/reports';
import { formatNumber } from '@/lib/format';
import {
  Alert,
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  DefinitionCard,
  EmptyState,
  PageHeader,
  Section,
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
import { ExportButton, PerceptionSurveyDialog } from '../ExportButton';
import {
  CSV_COLUMNS,
  FRAMEWORK_META,
  ReportSectionCard,
  frameworkFromSlug,
  frameworkOptions,
} from '../frameworks';

/**
 * One framework, on its own.
 *
 * The console answers "what do we have"; this page answers "what am I
 * submitting". It repeats the figures rather than summarising them,
 * because a page that summarises is a page somebody quotes from without
 * the caveat, and then adds the whole-file table underneath so the CSV
 * holds no surprises — what is in the spreadsheet is what is on screen,
 * column for column.
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
  if (!framework) return { title: 'Framework not found' };

  const meta = FRAMEWORK_META[framework];
  return {
    title: `${meta.name} reporting`,
    description: meta.asks,
  };
}

export default async function FrameworkReportPage({
  params,
}: {
  params: Promise<{ framework: string }>;
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

  const tabs: TabItem[] = [
    { label: 'Everything', href: '/admin/reports', count: all.reduce((n, s) => n + s.metrics.length, 0) },
    ...REPORT_FRAMEWORKS.map((f) => ({
      label: FRAMEWORK_META[f].name,
      href: `/admin/reports/${FRAMEWORK_META[f].slug}`,
      count: all.filter((s) => s.framework === f).reduce((n, s) => n + s.metrics.length, 0),
      active: f === framework,
    })),
  ];

  const options = frameworkOptions(all);
  const scoped = options.filter((o) => o.value === framework || o.value === 'all');

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Reporting', href: '/admin/reports' },
              { label: 'Accreditation', href: '/admin/reports' },
              { label: meta.name },
            ]}
          />
        }
        eyebrow={meta.full}
        title={`${meta.name} figures`}
        description={`${meta.asks} Owned by the ${meta.owner}.`}
        actions={
          sections.length > 0 ? (
            <>
              <ButtonLink href="/admin/reports" variant="ghost">
                <ArrowLeft className="size-4" aria-hidden="true" />
                All frameworks
              </ButtonLink>
              <ExportButton
                frameworks={scoped}
                defaultFramework={framework}
                columns={CSV_COLUMNS}
                label={`Export ${meta.name}`}
              />
            </>
          ) : (
            <ButtonLink href="/admin/reports" variant="secondary">
              <ArrowLeft className="size-4" aria-hidden="true" />
              All frameworks
            </ButtonLink>
          )
        }
      />

      <Tabs items={tabs} ariaLabel="Reporting frameworks" />

      {sections.length === 0 ? (
        <>
          <EmptyState
            icon={<ClipboardList className="size-5" />}
            title={`No ${meta.name} figures are computed`}
            description={
              meta.blocked ??
              `${meta.asks} Nothing behind it has reached the portal yet, so the module produces no figure rather than an estimate somebody would later have to defend.`
            }
            action={
              <ButtonLink href="/admin/reports" variant="secondary">
                Back to the console
              </ButtonLink>
            }
          />

          <Card>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle as="h2">Why this is left blank rather than filled in</CardTitle>
                <CardDescription>
                  An empty section is a finding about the college&apos;s data, not a gap in the software.
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="max-w-prose text-sm text-secondary">
                This module reports what the degree register and the member records can actually evidence. Where the
                source is missing, it produces nothing — a plausible number here would be repeated in a submission,
                asked about, and then withdrawn, which costs more than the blank does.
              </p>
              <p className="max-w-prose text-sm text-secondary">
                Everything the portal <em>can</em> evidence today is on the{' '}
                <Link className="link" href="/admin/reports">
                  accreditation console
                </Link>
                . The register coverage behind most of it is on the{' '}
                <Link className="link" href="/admin/reports/coverage">
                  coverage page
                </Link>
                .
              </p>
            </CardBody>
          </Card>
        </>
      ) : (
        <>
          {caveated.length > 0 ? (
            <Alert
              tone="warning"
              title={`${caveated.length} of these ${metrics.length} figures carry a caveat`}
              icon={<TriangleAlert className="size-4" aria-hidden="true" />}
            >
              <p>
                {caveated.map((m) => m.label).join(', ')}. The caveat sits with the figure below and in its own column
                in the export. Nothing here is hidden behind a hover — a caveat the reader missed is worse than no
                figure at all.
              </p>
            </Alert>
          ) : null}

          <Section
            title="The figures"
            description={`${metrics.length} figures across ${sections.length} section${sections.length === 1 ? '' : 's'}, each with the denominator it was measured against and the sentence it was counted by.`}
          >
            <div className="space-y-4">
              {sections.map((section) => (
                <ReportSectionCard key={`${section.criterion}-${section.title}`} section={section} />
              ))}
            </div>
          </Section>

          {showsPerception ? (
            <Section
              id="perception"
              title="Perception-survey list"
              description="The one control in this module that hands over contact data, and the only one that demands a written reason."
            >
              <Card>
                <CardHeader>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="danger" className="font-mono">
                        member.export
                      </Badge>
                      <Badge tone="outline">College admin only</Badge>
                    </div>
                    <CardTitle as="h3">
                      {formatNumber(perceptionRows)} alumni with a confirmed email address, out of{' '}
                      {formatNumber(registerRows)} recorded graduates
                    </CardTitle>
                    <CardDescription className="max-w-prose">
                      NIRF conducts its perception exercise against a contactable alumni list the institution supplies.
                      This is that list — roll number, name, year of passing, branch and email — and it is the point at
                      which an untraceable alumni body costs the college marks directly.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardBody className="space-y-4">
                  <Alert tone="warning" title="This is bulk contact data" icon={<Lock className="size-4" aria-hidden="true" />}>
                    <p>
                      Not the alumni cell operator, not the placement officer, not an HOD — staff leave, and an
                      exportable directory leaves with them. The export will not run until you have written down what it
                      is for, and the reason is stored verbatim beside your name.
                    </p>
                  </Alert>

                  <PerceptionSurveyDialog
                    rowCount={perceptionRows}
                    registerTotal={registerRows}
                    actorName={actor?.fullName ?? 'Signed-in admin'}
                    actorEmail={actor?.privateContact.email ?? 'your college address'}
                    columns={PERCEPTION_COLUMNS}
                  />

                  <p className="flex items-start gap-2 text-xs text-secondary">
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      Written to the audit log as <span className="font-mono">member.export</span> with the actor, the
                      scope and the reason, before the file is built. Audit rows are append-only — the entry outlives
                      the spreadsheet, and it names you.
                    </span>
                  </p>
                </CardBody>
              </Card>
            </Section>
          ) : null}

          <Section
            title="Exactly what the export contains"
            description="One row per figure, the same rows as above, in the order they will appear in the spreadsheet. Nothing is added on the way out and nothing is dropped."
            actions={
              <ButtonLink href="/admin/reports/coverage" variant="secondary" size="sm">
                <Percent className="size-4" aria-hidden="true" />
                Coverage detail
              </ButtonLink>
            }
          >
            {/* Below sm a six-column table of sentences is unreadable however
                it scrolls, so the same rows become cards. */}
            <div className="space-y-3 sm:hidden">
              {sections.flatMap((section) =>
                section.metrics.map((m) => (
                  <DefinitionCard
                    key={`m-${section.title}-${m.label}`}
                    title={m.label}
                    subtitle={`${section.framework} ${m.code} · ${section.title}`}
                    rows={[
                      { label: 'Value', value: <span className="tabular">{m.value}</span> },
                      {
                        label: 'Denominator',
                        // Sentences left-aligned inside a right-aligned
                        // definition list: a wrapped paragraph ragged on
                        // the left is close to unreadable on a phone.
                        value: (
                          <span className="block text-left font-normal">
                            {m.denominator ?? 'A count, not a proportion'}
                          </span>
                        ),
                      },
                      {
                        label: 'Definition',
                        value: <span className="block text-left font-normal">{m.definition}</span>,
                      },
                      {
                        label: 'Caveat',
                        value: m.caveat ? (
                          <span className="block text-left font-normal text-warning-fg">{m.caveat}</span>
                        ) : (
                          <span className="text-muted">None</span>
                        ),
                      },
                    ]}
                  />
                )),
              )}
            </div>

            <TableWrap className="hidden sm:block" caption={`${meta.name} figures, with denominators and definitions`}>
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
                  {sections.flatMap((section) =>
                    section.metrics.map((m) => (
                      <TR key={`r-${section.title}-${m.label}`} interactive>
                        <TD className="whitespace-nowrap font-mono text-xs">{m.code}</TD>
                        <TD>
                          <span className="font-medium">{m.label}</span>
                          <span className="block text-xs text-muted">{section.title}</span>
                        </TD>
                        <TD numeric className="whitespace-nowrap font-semibold">
                          {m.value}
                        </TD>
                        <TD className="min-w-48 text-xs text-secondary">
                          {m.denominator ?? <span className="text-muted">A count, not a proportion</span>}
                        </TD>
                        <TD className="min-w-64 text-xs text-secondary">{m.definition}</TD>
                        <TD className="min-w-56 text-xs">
                          {m.caveat ? (
                            <span className="text-warning-fg">{m.caveat}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </TD>
                      </TR>
                    )),
                  )}
                </TBody>
              </Table>
            </TableWrap>

            <p className="flex items-start gap-2 text-xs text-secondary">
              <FileSpreadsheet className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                The CSV carries these six columns plus Framework and Section:{' '}
                <span className="font-mono text-primary">{CSV_COLUMNS.join(' · ')}</span>. The Definition column travels
                with every figure — it is what lets whoever rebuilds this in three years get the same answer for the
                same reason. Each download is logged as <span className="font-mono">report.export</span> with the
                framework requested.
              </span>
            </p>
          </Section>
        </>
      )}
    </div>
  );
}
