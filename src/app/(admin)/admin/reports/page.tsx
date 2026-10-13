import { redirect } from 'next/navigation';
import { ArrowRight, Briefcase, CalendarCheck, CheckCircle2, Mail, Percent, TriangleAlert, Users } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getCoverageByYear, getReportSections, REPORT_FRAMEWORKS } from '@/lib/data/reports';
import type { ReportMetric } from '@/lib/data/reports';
import { formatNumber, formatPercent } from '@/lib/format';
import { ButtonLink, Card, CardBody, HowThisWorks, PageHeader, Stat } from '@/components/ui';
import { inSentence } from '@/lib/branding/copy';
import { ExportButton, PrintButton } from './ExportButton';
import { Letterhead } from './Letterhead';
import {
  CSV_COLUMNS,
  FRAMEWORK_META,
  denominatorPhrase,
  displayValue,
  frameworkInputs,
  frameworkOptions,
  frameworkStatus,
  headlineMetrics,
} from './frameworks';

export const metadata = {
  title: 'Accreditation · Staff console',
  description: 'NAAC Criterion 5, NIRF graduation outcomes and association activity, each figure with its denominator.',
};

/**
 * The accreditation console.
 *
 * Every NAAC cycle, somebody rebuilds these numbers from a spreadsheet an
 * assistant kept by hand, and the figures come out defensible but not
 * reproducible. This screen answers "what can we evidence, and what is
 * blocked" at a glance; each framework's own page carries every figure
 * with its denominator, definition and caveat.
 *
 * Nothing here computes a number. Every figure comes from
 * `@/lib/data/reports`, which is also what the CSV export flattens, so the
 * screen and the spreadsheet cannot drift apart. The vendor holds
 * `audit.read` and reads this page, so it carries aggregates only: no
 * names, no member drill-downs.
 */

export default async function ReportsConsolePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  // Hiding the nav link is presentation. This is the authorisation.
  requireCap(session, 'audit.read');

  const canExportContacts = can(session, 'member.export');

  const sections = getReportSections();
  const resolved = await getTenantBrand();
  const pack = resolved?.brand.pack;

  const coverage = getCoverageByYear();
  const registerRows = coverage.reduce((n, y) => n + y.total, 0);
  const claimed = coverage.reduce((n, y) => n + y.claimed, 0);

  const metric = (label: string): ReportMetric | undefined =>
    sections.flatMap((s) => s.metrics).find((m) => m.label === label);
  const events = metric('Events held or scheduled');
  const referrals = metric('Offers attributable to an alumni referral');
  const contactable = metric('Contactable alumni available for the perception survey');

  const options = frameworkOptions(sections);

  return (
    <div className="space-y-8">
      {pack ? <Letterhead pack={pack} title="Accreditation figures" /> : null}

      <PageHeader
        eyebrow="Reporting"
        title="Accreditation reporting"
        description="What the college can evidence for NAAC and NIRF, each figure with what it is out of."
        actions={
          <div data-print-hide="" className="flex flex-wrap items-center gap-2">
            {/* On a phone the coverage page is one tap away through the first
                headline figure, and printing is a desk job; Export stays. */}
            <ButtonLink href="/admin/reports/coverage" variant="secondary" className="hidden sm:inline-flex">
              <Percent className="size-4" aria-hidden="true" />
              Register coverage
            </ButtonLink>
            <PrintButton className="hidden sm:inline-flex" />
            <ExportButton frameworks={options} columns={CSV_COLUMNS} label="Export" />
          </div>
        }
      />

      {/* ---- The college's headline outcomes ---------------------- */}
      <section aria-labelledby="headline-heading" className="space-y-3">
        <h2 id="headline-heading" className="text-sm font-semibold text-secondary">
          Headline outcomes
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Graduates traceable"
            value={`${formatNumber(claimed)} of ${formatNumber(registerRows)}`}
            hint={`${formatPercent(registerRows ? claimed / registerRows : 0, 1)} of the degree register`}
            icon={<Users className="size-4" />}
            href="/admin/reports/coverage"
          />
          {events ? (
            <Stat
              label="Alumni events held or scheduled"
              value={displayValue(events.value)}
              hint="Published events, past and upcoming"
              icon={<CalendarCheck className="size-4" />}
              href="/admin/reports/internal"
            />
          ) : null}
          {referrals ? (
            // Labelled as what it counts. The portal sees applications to
            // postings graduates placed, never an offer letter.
            <Stat
              label="Applications to postings by alumni"
              value={displayValue(referrals.value)}
              hint="Not offers: the portal cannot see an offer letter"
              icon={<Briefcase className="size-4" />}
              href="/admin/reports/naac"
            />
          ) : null}
          {contactable ? (
            <Stat
              label="Contactable for the NIRF survey"
              value={displayValue(contactable.value)}
              hint={contactable.denominator ? denominatorPhrase(contactable.denominator) : undefined}
              icon={<Mail className="size-4" />}
              href="/admin/reports/nirf"
            />
          ) : null}
        </div>
      </section>

      {/* ---- One card per framework ------------------------------- */}
      <section aria-labelledby="frameworks-heading" className="space-y-3">
        <h2 id="frameworks-heading" className="text-sm font-semibold text-secondary">
          Frameworks
        </h2>
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {REPORT_FRAMEWORKS.map((framework) => {
            const meta = FRAMEWORK_META[framework];
            const status = frameworkStatus(framework, sections);
            const figures = headlineMetrics(framework, sections);
            const inputs = frameworkInputs(framework, sections);
            const option = options.find((o) => o.value === framework);

            return (
              <li key={framework} className="min-w-0">
                <Card className="flex h-full flex-col">
                  <CardBody className="flex flex-1 flex-col gap-4">
                    <div className="min-w-0 space-y-1">
                      <h3 className="font-display text-lg font-semibold">
                        <span>{meta.name}</span>
                        <span className="sr-only"> — {meta.full}</span>
                      </h3>
                      <p className="text-sm text-secondary">For the {inSentence(meta.owner)}</p>
                    </div>

                    <p
                      className={`flex items-center gap-1.5 text-sm font-semibold ${status.ready ? 'text-success-fg' : 'text-warning-fg'}`}
                    >
                      {status.ready ? (
                        <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
                      )}
                      {status.line}
                    </p>

                    {figures.length ? (
                      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {figures.map((m) => (
                          <div key={m.label} className="min-w-0 rounded border border-line bg-surface px-3 py-2.5">
                            <dt className="text-xs text-secondary">{m.label}</dt>
                            <dd className="mt-1 font-display text-lg font-bold tabular">
                              {displayValue(m.value)}
                              {m.caveat ? (
                                <span className="ml-1.5 inline-flex align-baseline text-warning-fg">
                                  <TriangleAlert className="size-3.5" aria-hidden="true" />
                                  <span className="sr-only">(has a caveat)</span>
                                </span>
                              ) : null}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : inputs.length ? (
                      <ul className="divide-y divide-line rounded border border-line bg-surface text-sm">
                        {inputs.map((i) => (
                          <li key={i.label} className="flex items-center justify-between gap-3 px-3 py-2">
                            <span>{i.label}</span>
                            <span className={i.value ? 'font-semibold tabular' : 'text-secondary'}>
                              {i.value ?? 'Not supplied yet'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <div data-print-hide="" className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                      <ButtonLink href={`/admin/reports/${meta.slug}`} variant="secondary" size="sm">
                        Open {meta.name}
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </ButtonLink>
                      {option ? (
                        <ExportButton
                          frameworks={options.filter((o) => o.value === framework || o.value === 'all')}
                          defaultFramework={framework}
                          columns={CSV_COLUMNS}
                          variant="secondary"
                          label={`Export ${meta.name}`}
                        />
                      ) : null}
                    </div>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <div data-print-hide="" className="space-y-3">
        <p className="text-sm text-secondary">
          The export is a spreadsheet with one row per figure, carrying its denominator, definition and caveat; every
          download is recorded in the audit log.
        </p>
        {canExportContacts ? (
          <Card>
            <CardBody className="flex flex-wrap items-center justify-between gap-3 py-4">
              <p className="text-sm text-secondary">
                The contact list for the NIRF survey is for the college admin only, and your reason is recorded.
              </p>
              <ButtonLink href="/admin/reports/nirf#perception" variant="ghost" size="sm">
                NIRF perception-survey list
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
            </CardBody>
          </Card>
        ) : null}

        <HowThisWorks summary="How these figures are counted">
          <p>
            Coverage is measured against the degree register: every graduate the examinations branch recorded, whether
            or not they ever signed in. Counting only people on the portal would always read close to 100% and answer
            nothing.
          </p>
          <p>
            Every figure states what it is out of and the sentence it was counted by. A plain count is marked
            &ldquo;Count&rdquo;, so nobody turns it into a percentage. Where the college has not supplied a source, the
            framework shows as blocked rather than estimated.
          </p>
        </HowThisWorks>
      </div>
    </div>
  );
}
