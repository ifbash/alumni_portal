import { Divide, Ruler, TriangleAlert } from 'lucide-react';

import {
  REPORT_FRAMEWORKS,
  type ReportFramework,
  type ReportMetric,
  type ReportSection,
} from '@/lib/data/reports';
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import type { FrameworkOption } from './ExportButton';

/**
 * Shared rendering for the accreditation console.
 *
 * The console and the per-framework page show the same figures, and they
 * have to show them identically — a value that is rendered with its
 * denominator on one screen and without it on another is exactly the
 * failure this module exists to prevent. So the metric tile and the
 * section card live here, next to the pages that use them, in the same
 * way `admin/members/status.ts` and `admin/audit/audit-taxonomy.ts` do.
 *
 * Nothing here computes a figure. Every number comes from
 * `@/lib/data/reports`, which is also what the CSV export flattens.
 */

/** The export's header row, shown in the UI before anyone downloads it. */
export const CSV_COLUMNS = [
  'Framework',
  'Criterion',
  'Section',
  'Metric',
  'Value',
  'Denominator',
  'Definition',
  'Caveat',
];

export interface FrameworkMeta {
  slug: string;
  name: string;
  /** What the body actually is, for a reader who has not sat in the IQAC. */
  full: string;
  /** What it asks this portal for. */
  asks: string;
  /** Who inside the college owns the submission. */
  owner: string;
  /**
   * Why the reporting module produces nothing for this framework. Set only
   * where that is the honest answer; rendered as a finding rather than
   * hidden behind an empty tab.
   */
  blocked?: string;
}

export const FRAMEWORK_META: Record<ReportFramework, FrameworkMeta> = {
  NAAC: {
    slug: 'naac',
    name: 'NAAC',
    full: 'National Assessment and Accreditation Council',
    asks: 'Criterion 5 — student support and progression, and evidence that the alumni association exists, meets and contributes.',
    owner: 'IQAC, in the Self Study Report',
  },
  NIRF: {
    slug: 'nirf',
    name: 'NIRF',
    full: 'National Institutional Ranking Framework',
    asks: 'Graduating cohort sizes over a three-year window, and a contactable alumni list for the perception survey.',
    owner: 'Director’s office, in the annual data capture',
  },
  AICTE: {
    slug: 'aicte',
    name: 'AICTE',
    full: 'All India Council for Technical Education',
    asks: 'Sanctioned intake, current enrolment and staff strength — none of which is alumni data.',
    owner: 'Principal’s office, in the Extension of Approval return',
    blocked:
      'The college has not supplied the year of establishment, the sanctioned intake by branch, the current enrolment or the staff count. This module holds the degree register and the member records; it does not hold headcounts, and it will not estimate one. Chase those four figures and this section starts producing.',
  },
  Internal: {
    slug: 'internal',
    name: 'Internal',
    full: 'The association’s own record of itself',
    asks: 'Whether the association is functioning rather than merely registered — events held, requests answered, jobs posted by graduates.',
    owner: 'Alumni cell, for the governing body',
  },
};

export function frameworkFromSlug(slug: string): ReportFramework | null {
  const lower = slug.toLowerCase();
  return REPORT_FRAMEWORKS.find((f) => FRAMEWORK_META[f].slug === lower) ?? null;
}

/** Options for the export dialog — only frameworks that produce something. */
export function frameworkOptions(sections: ReportSection[]): FrameworkOption[] {
  const metrics = sections.flatMap((s) => s.metrics);

  const options: FrameworkOption[] = [
    {
      value: 'all',
      label: 'Every framework',
      sections: sections.length,
      metrics: metrics.length,
      caveats: metrics.filter((m) => m.caveat).length,
    },
  ];

  for (const framework of REPORT_FRAMEWORKS) {
    const mine = sections.filter((s) => s.framework === framework);
    if (mine.length === 0) continue;
    const theirs = mine.flatMap((s) => s.metrics);
    options.push({
      value: framework,
      label: `${FRAMEWORK_META[framework].name} only`,
      sections: mine.length,
      metrics: theirs.length,
      caveats: theirs.filter((m) => m.caveat).length,
    });
  }

  return options;
}

// ---------------------------------------------------------------
// The figure, and the two things that make it defensible
// ---------------------------------------------------------------

/**
 * One metric, rendered as a triple: value, denominator, definition.
 *
 * The denominator gets its own labelled panel rather than a parenthetical,
 * because "out of what" is the first thing an assessor asks and the first
 * thing a hurried reader skips. Where the module supplies no denominator
 * that is stated as a fact about the figure — a count is not a proportion
 * and must not be turned into one on the way to a submission.
 *
 * A caveat is an `Alert`, never a tooltip. A figure whose caveat the
 * reader missed is worse than no figure at all.
 */
export function MetricFigure({ metric }: { metric: ReportMetric }) {
  const value = String(metric.value);
  const compact = value.length <= 14;

  return (
    <article className="flex h-full flex-col gap-3 rounded-lg border border-line bg-surface-raised p-4">
      <div className="flex items-start justify-between gap-3">
        <h4 className="min-w-0 text-sm font-semibold text-primary">{metric.label}</h4>
        <Badge tone="outline" className="shrink-0 font-mono">
          {metric.code}
        </Badge>
      </div>

      <p
        className={
          compact
            ? 'font-display text-display-xs font-bold tabular text-primary'
            : 'font-display text-xl font-bold tabular text-primary'
        }
      >
        {value}
      </p>

      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded border border-line bg-surface-sunken p-3">
          <dt className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-secondary">
            <Divide className="size-3.5" aria-hidden="true" />
            Out of
          </dt>
          <dd className="mt-1.5 leading-relaxed text-primary">
            {metric.denominator ?? (
              <span className="text-secondary">
                No denominator. This is a count, not a proportion — do not convert it to a percentage.
              </span>
            )}
          </dd>
        </div>

        <div className="rounded border border-line bg-surface-sunken p-3">
          <dt className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-secondary">
            <Ruler className="size-3.5" aria-hidden="true" />
            How it was counted
          </dt>
          <dd className="mt-1.5 leading-relaxed text-primary">{metric.definition}</dd>
        </div>
      </dl>

      {metric.caveat ? (
        <Alert
          tone="warning"
          title="Quote this figure with its caveat"
          icon={<TriangleAlert className="size-4" aria-hidden="true" />}
          className="mt-auto text-xs"
        >
          <p>{metric.caveat}</p>
        </Alert>
      ) : null}
    </article>
  );
}

/** One reporting section — criterion, what it answers, and its figures. */
export function ReportSectionCard({ section }: { section: ReportSection }) {
  const caveats = section.metrics.filter((m) => m.caveat).length;

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" className="font-mono">
              {section.framework} {section.criterion}
            </Badge>
            {caveats > 0 ? (
              <Badge tone="warning">
                {caveats} caveated figure{caveats === 1 ? '' : 's'}
              </Badge>
            ) : null}
          </div>
          <CardTitle as="h3">{section.title}</CardTitle>
          <CardDescription className="max-w-prose">{section.description}</CardDescription>
        </div>
      </CardHeader>

      <CardBody>
        <div className="grid gap-3 lg:grid-cols-2">
          {section.metrics.map((metric) => (
            <MetricFigure key={`${metric.code}-${metric.label}`} metric={metric} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
