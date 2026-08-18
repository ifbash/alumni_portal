import { redirect } from 'next/navigation';
import { ArrowRight, ClipboardList, Divide, ListChecks, Percent, Scale, ScrollText, TriangleAlert } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getCoverageByYear, getReportSections, REPORT_FRAMEWORKS } from '@/lib/data/reports';
import { formatNumber, formatPercent } from '@/lib/format';
import {
  Alert,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Section,
  Stat,
  Tabs,
  type TabItem,
} from '@/components/ui';
import { MarginNote } from '@/components/brand/Marks';
import { ExportButton } from './ExportButton';
import { CSV_COLUMNS, FRAMEWORK_META, ReportSectionCard, frameworkOptions } from './frameworks';

export const metadata = {
  title: 'Accreditation reporting',
  description: 'NAAC Criterion 5, NIRF graduation outcomes and association activity, each figure with its denominator.',
};

/**
 * The accreditation console.
 *
 * Every NAAC cycle, somebody rebuilds these numbers from a spreadsheet an
 * assistant kept by hand, and the figures come out defensible but not
 * reproducible. This screen exists so that the assessor's two questions —
 * "out of what" and "how did you count it" — are answered in the same row
 * as the number, not in a file nobody can find three years later.
 *
 * The rendering rules follow from that and are not decoration:
 *
 *  - The value, the denominator and the definition are one visual unit.
 *    Splitting them behind a tooltip or a footnote is how a figure ends up
 *    quoted without the thing that qualifies it.
 *  - A caveat is a visible warning, never a hover. A figure whose caveat
 *    the reader missed is worse than no figure at all.
 *  - Where the reporting module declines to compute something, the refusal
 *    is rendered as a finding. An empty AICTE tab is information.
 *
 * Nothing here computes a number. Every figure comes from
 * `@/lib/data/reports`, which is also what the CSV export flattens, so the
 * screen and the spreadsheet cannot drift apart.
 */

// ---------------------------------------------------------------
// The page
// ---------------------------------------------------------------

export default async function ReportsConsolePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  // Hiding the nav link is presentation. This is the authorisation.
  requireCap(session, 'audit.read');

  const canExportContacts = can(session, 'member.export');

  const sections = getReportSections();
  const metrics = sections.flatMap((s) => s.metrics);
  const caveated = metrics.filter((m) => m.caveat);

  const coverage = getCoverageByYear();
  const registerRows = coverage.reduce((n, y) => n + y.total, 0);
  const claimed = coverage.reduce((n, y) => n + y.claimed, 0);
  const unclaimed = registerRows - claimed;

  const present = REPORT_FRAMEWORKS.filter((f) => sections.some((s) => s.framework === f));
  const absent = REPORT_FRAMEWORKS.filter((f) => !sections.some((s) => s.framework === f));

  const tabs: TabItem[] = [
    { label: 'Everything', href: '/admin/reports', count: metrics.length, active: true },
    ...REPORT_FRAMEWORKS.map((f) => ({
      label: FRAMEWORK_META[f].name,
      href: `/admin/reports/${FRAMEWORK_META[f].slug}`,
      count: sections.filter((s) => s.framework === f).reduce((n, s) => n + s.metrics.length, 0),
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reporting"
        title="Accreditation reporting"
        description="The figures NAAC and NIRF ask for, computed from the degree register and the member records rather than rebuilt by hand each cycle. Every number on this page carries the denominator it was measured against and the sentence it was counted by."
        actions={
          <>
            <ButtonLink href="/admin/reports/coverage" variant="secondary">
              <Percent className="size-4" aria-hidden="true" />
              Register coverage
            </ButtonLink>
            <ExportButton frameworks={frameworkOptions(sections)} columns={CSV_COLUMNS} />
          </>
        }
      />

      {/* The product position, stated where a registrar will read it — not
          in a footnote under the last table. */}
      <Card>
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <div className="flex gap-3">
            <span className="mt-0.5 shrink-0 text-brand-fg" aria-hidden="true">
              <Scale className="size-5" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold">Nothing here is inflated</p>
              <p className="text-sm text-secondary">
                Coverage is reported against the degree register — every graduate the examinations branch has recorded,
                whether or not they ever opened the portal. A portal that claims “97% of alumni are engaged” because it
                counts only the people on it is useless to whoever has to defend the figure in the room.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="mt-0.5 shrink-0 text-brand-fg" aria-hidden="true">
              <Divide className="size-5" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold">Every number states its denominator</p>
              <p className="text-sm text-secondary">
                “Out of what?” is the assessor&apos;s first question, and a report that cannot answer it in the same row
                has already failed. Where a figure is a plain count, it says so, so nobody turns it into a percentage on
                the way to the submission.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-gutter sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Figures computed"
          value={formatNumber(metrics.length)}
          hint={`Across ${sections.length} sections and ${present.length} frameworks`}
          icon={<ListChecks className="size-4" />}
        />
        <Stat
          label="Figures carrying a caveat"
          value={formatNumber(caveated.length)}
          hint="Shown beside the value, never as a footnote"
          icon={<TriangleAlert className="size-4" />}
        />
        <Stat
          label="Graduates not on the portal"
          value={formatNumber(unclaimed)}
          hint={`${formatPercent(registerRows ? claimed / registerRows : 0, 1)} of the register is traceable`}
          icon={<ScrollText className="size-4" />}
        />
        <Stat
          label="Frameworks with nothing computed"
          value={formatNumber(absent.length)}
          hint={absent.length ? `${absent.join(', ')} — see below for why` : 'Every framework has figures'}
          icon={<ClipboardList className="size-4" />}
        />
      </div>

      <Tabs items={tabs} ariaLabel="Reporting frameworks" />

      {caveated.length > 0 ? (
        <Alert
          tone="warning"
          title={`${caveated.length} of the ${metrics.length} figures cannot be quoted on their own`}
          icon={<TriangleAlert className="size-4" aria-hidden="true" />}
        >
          <p>
            {caveated.map((m) => m.label).join(', ')}. Each one is rendered with its caveat attached below, and the
            caveat travels in its own column in the CSV. Lifting a value out of this page without it is the single
            easiest way to get a submission challenged.
          </p>
        </Alert>
      ) : null}

      {present.map((framework) => {
        const meta = FRAMEWORK_META[framework];
        const mine = sections.filter((s) => s.framework === framework);

        return (
          <Section
            key={framework}
            id={meta.slug}
            title={`${meta.name} — ${meta.full}`}
            description={meta.asks}
            actions={
              <ButtonLink href={`/admin/reports/${meta.slug}`} variant="secondary" size="sm">
                Open {meta.name}
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
            }
          >
            <div className="space-y-4">
              {mine.map((section) => (
                <ReportSectionCard key={`${section.framework}-${section.criterion}-${section.title}`} section={section} />
              ))}
            </div>
          </Section>
        );
      })}

      {absent.length > 0 ? (
        <Section
          title="Where the report declines to answer"
          description="A framework with no figures is a finding, not an omission. It is listed here so nobody assumes the numbers exist somewhere else in the portal."
        >
          {absent.map((framework) => (
            <EmptyState
              key={framework}
              icon={<ClipboardList className="size-5" />}
              title={`${FRAMEWORK_META[framework].name} — no figures are computed`}
              description={
                FRAMEWORK_META[framework].blocked ??
                `${FRAMEWORK_META[framework].asks} Nothing behind it is available to the portal yet, so the module produces no figure rather than an estimate somebody would later have to defend.`
              }
              action={
                <ButtonLink href={`/admin/reports/${FRAMEWORK_META[framework].slug}`} variant="secondary" size="sm">
                  What {FRAMEWORK_META[framework].name} would need
                </ButtonLink>
              }
            />
          ))}
        </Section>
      ) : null}

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle as="h2">Taking these numbers into a submission</CardTitle>
            <CardDescription>
              The export is a spreadsheet, because a college that retypes figures out of a web page will introduce an
              error and then have to defend it.
            </CardDescription>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="max-w-prose text-sm text-secondary">
            The CSV carries one row per figure and eight columns:{' '}
            <span className="font-mono text-xs text-primary">{CSV_COLUMNS.join(' · ')}</span>. The{' '}
            <span className="font-semibold text-primary">Definition</span> column travels with every figure on purpose —
            it is the part that makes next cycle&apos;s submission reproducible instead of merely defensible. Every
            download is written to the audit log as <span className="font-mono">report.export</span> with the framework
            requested.
          </p>

          <div className="flex flex-wrap gap-2">
            <ExportButton frameworks={frameworkOptions(sections)} columns={CSV_COLUMNS} variant="secondary" label="Download the CSV" />
            <ButtonLink href="/admin/reports/coverage" variant="secondary">
              Coverage by year and branch
            </ButtonLink>
            {canExportContacts ? (
              <ButtonLink href="/admin/reports/nirf" variant="ghost">
                NIRF perception-survey list
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
            ) : null}
          </div>

          {canExportContacts ? (
            <MarginNote className="max-w-prose border-t border-line pt-4">
              The perception-survey list is the only control in this module that hands over contact data. It lives on
              the NIRF page, it is <span className="font-mono not-italic">member.export</span> — college admin alone —
              and it will not run until you have written down why.
            </MarginNote>
          ) : (
            <MarginNote className="max-w-prose border-t border-line pt-4">
              These figures are aggregates. No screen in this module will give you an alumni contact list; that is a
              college-admin action taken elsewhere, with a written reason against it.
            </MarginNote>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
