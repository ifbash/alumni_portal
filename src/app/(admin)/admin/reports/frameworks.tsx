import { TriangleAlert } from 'lucide-react';

import {
  REPORT_FRAMEWORKS,
  type ReportFramework,
  type ReportMetric,
  type ReportSection,
} from '@/lib/data/reports';
import { formatNumber } from '@/lib/format';
import { Badge, Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui';
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
  /**
   * The three figures a card on the overview leads with, by metric label.
   * Never a blended money total: domestic and foreign stay apart.
   */
  headline: string[];
}

export const FRAMEWORK_META: Record<ReportFramework, FrameworkMeta> = {
  NAAC: {
    slug: 'naac',
    name: 'NAAC',
    full: 'National Assessment and Accreditation Council',
    asks: 'Criterion 5 — student support and progression, and evidence that the alumni association exists, meets and contributes.',
    owner: 'IQAC, in the Self Study Report',
    headline: [
      'Graduates traceable on the portal',
      'Final-year students placed',
      'Graduates volunteering to support students',
    ],
  },
  NIRF: {
    slug: 'nirf',
    name: 'NIRF',
    full: 'National Institutional Ranking Framework',
    asks: 'Graduating cohort sizes over a three-year window, and a contactable alumni list for the perception survey.',
    owner: 'Director’s office, in the annual data capture',
    headline: [
      'Graduating cohort, last three years',
      'Contactable alumni available for the perception survey',
      'Graduates working outside India',
    ],
  },
  AICTE: {
    slug: 'aicte',
    name: 'AICTE',
    full: 'All India Council for Technical Education',
    asks: 'Sanctioned intake, current enrolment and staff strength — none of which is alumni data.',
    owner: 'Principal’s office, in the Extension of Approval return',
    blocked:
      'AICTE needs figures the college has not supplied yet. The portal holds the degree register and member records, not headcounts, and it does not estimate them.',
    headline: [],
  },
  Internal: {
    slug: 'internal',
    name: 'Internal',
    full: 'The association’s own record of itself',
    asks: 'Whether the association is functioning rather than merely registered — events held, requests answered, jobs posted by graduates.',
    owner: 'Alumni cell, for the governing body',
    headline: ['Events held or scheduled', 'Total event registrations', 'Response rate to student requests'],
  },
};

/**
 * What AICTE's Extension of Approval return asks the college for. Each is a
 * college fact the portal cannot derive: its status is read from the report
 * sections themselves, so it turns "on record" only when a section actually
 * carries the figure, never from department fixtures.
 */
const AICTE_INPUTS = ['Year of establishment', 'Sanctioned intake by branch', 'Current enrolment', 'Staff count'];

export interface FrameworkInput {
  label: string;
  /** The figure as the report carries it, or null when the college has not supplied it. */
  value: string | null;
}

export function frameworkInputs(framework: ReportFramework, sections: ReportSection[]): FrameworkInput[] {
  if (framework !== 'AICTE') return [];
  const metrics = sections.filter((s) => s.framework === framework).flatMap((s) => s.metrics);
  return AICTE_INPUTS.map((label) => {
    const hit = metrics.find((m) => m.label.toLowerCase() === label.toLowerCase());
    return { label, value: hit ? displayValue(hit.value) : null };
  });
}

export interface FrameworkStatus {
  ready: boolean;
  figures: number;
  caveats: number;
  /** College-supplied inputs still missing. */
  needs: number;
  /** "Ready · 14 figures · 1 caveat" or "Blocked · needs 4 figures from the college". */
  line: string;
}

export function frameworkStatus(framework: ReportFramework, sections: ReportSection[]): FrameworkStatus {
  const metrics = sections.filter((s) => s.framework === framework).flatMap((s) => s.metrics);
  const caveats = metrics.filter((m) => m.caveat).length;
  const needs = frameworkInputs(framework, sections).filter((i) => i.value === null).length;
  const ready = metrics.length > 0 && needs === 0;

  if (!ready) {
    const n = needs || 1;
    return {
      ready,
      figures: metrics.length,
      caveats,
      needs,
      line: `Blocked · needs ${n} ${n === 1 ? 'figure' : 'figures'} from the college`,
    };
  }
  const parts = [`${metrics.length} ${metrics.length === 1 ? 'figure' : 'figures'}`];
  if (caveats) parts.push(`${caveats} ${caveats === 1 ? 'caveat' : 'caveats'}`);
  return { ready, figures: metrics.length, caveats, needs, line: `Ready · ${parts.join(' · ')}` };
}

/** The overview card's three figures, found by label in the framework's own sections. */
export function headlineMetrics(framework: ReportFramework, sections: ReportSection[]): ReportMetric[] {
  const metrics = sections.filter((s) => s.framework === framework).flatMap((s) => s.metrics);
  return FRAMEWORK_META[framework].headline
    .map((label) => metrics.find((m) => m.label === label))
    .filter((m): m is ReportMetric => Boolean(m));
}

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
// Presentation helpers
// ---------------------------------------------------------------

/** A figure as it reads: numbers grouped the Indian way, strings as the module wrote them. */
export function displayValue(value: number | string): string {
  return typeof value === 'number' ? formatNumber(value) : value;
}

/**
 * "of 834 recorded graduates". A year window is not a denominator, so it
 * reads "in 2023–2026" rather than "of 2023–2026".
 */
export function denominatorPhrase(denominator: string): string {
  return /^\d{4}\s*[–-]\s*\d{4}$/.test(denominator.trim()) ? `in ${denominator}` : `of ${denominator}`;
}

/** Definitions are sentences for a reader; the module's inline code marks are dropped. */
export function plainDefinition(definition: string): string {
  return definition.replace(/`/g, '');
}

/** A criterion worth showing: not empty and not the module's "—" placeholder. */
export function hasCriterion(code: string | undefined): code is string {
  return Boolean(code && code.trim() && code.trim() !== '—' && code.trim() !== '-');
}

// ---------------------------------------------------------------
// The figure, and the two things that make it defensible
// ---------------------------------------------------------------

/**
 * One metric: label, the value with what it is out of directly beneath it,
 * the definition in one muted line, and any caveat as a warning row.
 *
 * Value, denominator, definition and caveat stay one visual unit — never
 * behind a tooltip or a footnote, because that is how a figure ends up
 * quoted without the thing that qualifies it. A figure with no denominator
 * is marked "Count", so nobody turns it into a percentage on the way to a
 * submission.
 */
export function MetricFigure({ metric, sectionCode }: { metric: ReportMetric; sectionCode?: string }) {
  const showCode = hasCriterion(metric.code) && metric.code !== sectionCode;

  return (
    <article className="flex h-full min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface-raised p-4">
      <div className="flex items-start justify-between gap-3">
        <h4 className="min-w-0 text-sm font-semibold text-primary">{metric.label}</h4>
        <span className="flex shrink-0 items-center gap-1.5">
          {showCode ? (
            <Badge tone="outline" className="whitespace-nowrap font-mono">
              {metric.code}
            </Badge>
          ) : null}
          {metric.denominator ? null : (
            <Badge tone="neutral" className="whitespace-nowrap" title="A count, not a proportion">
              Count
            </Badge>
          )}
        </span>
      </div>

      <div>
        <p className="break-words font-display text-xl font-bold tabular text-primary">{displayValue(metric.value)}</p>
        {metric.denominator ? (
          <p className="text-sm text-secondary">{denominatorPhrase(metric.denominator)}</p>
        ) : null}
      </div>

      <p className="text-xs leading-relaxed text-secondary">{plainDefinition(metric.definition)}</p>

      {metric.caveat ? (
        <p className="mt-auto flex items-start gap-1.5 rounded bg-warning-soft px-2.5 py-2 text-xs text-warning-fg">
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">Caveat: </span>
            {metric.caveat}
          </span>
        </p>
      ) : null}
    </article>
  );
}

/** One reporting section — criterion, what it answers, and its figures. */
export function ReportSectionCard({ section }: { section: ReportSection }) {
  const caveats = section.metrics.filter((m) => m.caveat).length;
  const criterion = hasCriterion(section.criterion) ? section.criterion : null;

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0 space-y-1.5">
          {criterion || caveats > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {criterion ? (
                <Badge tone="brand" className="font-mono">
                  {section.framework} {criterion}
                </Badge>
              ) : null}
              {caveats > 0 ? (
                <Badge tone="warning">
                  {caveats} {caveats === 1 ? 'caveat' : 'caveats'}
                </Badge>
              ) : null}
            </div>
          ) : null}
          <CardTitle as="h3">{section.title}</CardTitle>
          <CardDescription className="max-w-prose">{section.description}</CardDescription>
        </div>
      </CardHeader>

      <CardBody>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {section.metrics.map((metric) => (
            <MetricFigure
              key={`${metric.code}-${metric.label}`}
              metric={metric}
              sectionCode={criterion ?? undefined}
            />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
