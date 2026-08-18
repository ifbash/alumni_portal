import * as React from 'react';
import { AlertTriangle, Check, Info } from 'lucide-react';
import { Alert, Badge, Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import type { ContrastIssue } from '@/lib/branding/color';
import { cn } from '@/lib/cn';

/**
 * The accessibility report, shown continuously rather than on submit.
 *
 * Errors refuse publication. Warnings do not, and the difference is
 * deliberate: a college that picks a pale gold for its accent should be
 * told the muted text is marginal and then left to ship over it. Body text
 * nobody can read is a different category.
 *
 * Every issue names the token, says what that token is for in words a
 * registrar can act on, gives the measured ratio against the actual colour
 * it was measured against, and says what to change. "Contrast error on
 * --brand-soft-fg" is not a message anyone can do anything with.
 */

export interface ContrastReportValue {
  passes: boolean;
  errors: ContrastIssue[];
  warnings: ContrastIssue[];
  summary: string;
}

/** What each audited token is, in the words a registrar would use. */
const PURPOSE: Record<string, string> = {
  '--text-primary': 'This is your body text on the page background — everything a member reads.',
  '--text-secondary': 'Supporting text: card subtitles, the hints under form fields, table captions.',
  '--text-muted': 'The quietest text on the page — timestamps, result counts, placeholder copy.',
  '--brand-fg': 'Brand-coloured text on the page: links, section eyebrows, the active tab.',
  '--brand-soft-fg': 'Text inside a tinted brand chip — badges, avatar initials, count pills.',
  '--accent-fg': 'Accent-coloured text. Used sparingly, wherever a second hue is called for.',
  '--button-primary-fg': 'The label on your primary button — "Send request", "Publish", "Register".',
  '--focus-ring': 'The ring drawn around whatever has keyboard focus.',
  '--border-strong': 'Emphasised edges: input borders, table outlines, the rule under a heading.',
  '--danger-fg': 'Error text: failed payments, validation messages, deletion warnings.',
  '--text-on-inverse': 'Text on your dark band — the footer, and buttons on an inverse background.',
};

/** What to change. Named after the seed, not after the derived token. */
const REMEDY: Record<string, string> = {
  '--text-primary':
    'Your page colour and your ink are too close. Darken the ink, or lighten the page surface.',
  '--text-secondary':
    'Set an ink with more weight, or raise the neutral chroma so the greys separate from the page.',
  '--text-muted': 'Advisory. The quietest text is marginal here; a slightly darker ink fixes it.',
  '--brand-fg':
    'Your primary sits too close to the page colour. Darken the primary, or lighten the page surface.',
  '--brand-soft-fg':
    'The tinted brand chip has no readable text colour in the ramp. Darken the primary.',
  '--accent-fg':
    'Advisory. The accent is close to the page colour, so accent text reads faintly. Darken the accent or drop it and inherit the primary.',
  '--button-primary-fg':
    'No label colour clears 4.5:1 on this fill. Push the primary noticeably darker or noticeably lighter — mid-tones sit in the dead zone where neither white nor black works.',
  '--focus-ring':
    'The focus ring must be visible or the portal is unusable by keyboard. Darken the primary.',
  '--border-strong': 'Advisory. Edges read faintly against the page. A darker ink strengthens them.',
  '--danger-fg':
    'The error colour is too close to the page colour. Darken it in the pack file, or lighten the page surface.',
  '--text-on-inverse':
    'Your ink is the dark band, and the text on it does not separate. Pick a darker ink.',
};

interface ParsedIssue extends ContrastIssue {
  base: string;
  mode: 'light' | 'dark';
}

function parse(issue: ContrastIssue): ParsedIssue {
  const dark = issue.token.endsWith('(dark)');
  return {
    ...issue,
    base: issue.token.replace(/\s*\(dark\)\s*$/, ''),
    mode: dark ? 'dark' : 'light',
  };
}

export function ContrastReport({
  report,
  pending = false,
  className,
}: {
  report: ContrastReportValue;
  /** A preview request is in flight; the numbers below are one edit old. */
  pending?: boolean;
  className?: string;
}) {
  const errors = report.errors.map(parse);
  const warnings = report.warnings.map(parse);
  const clean = errors.length === 0 && warnings.length === 0;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="min-w-0 space-y-1">
          <CardTitle as="h2" className="flex flex-wrap items-center gap-2">
            Accessibility check
            {pending ? (
              <Badge tone="neutral">rechecking</Badge>
            ) : report.passes ? (
              <Badge tone="success" dot>
                Publishable
              </Badge>
            ) : (
              <Badge tone="danger" dot>
                Blocked
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Run against the tokens the portal really renders, including anything pinned by hand — a
            pinned colour is exactly where an unreadable value gets in.
          </CardDescription>
        </div>
      </CardHeader>

      <CardBody className="space-y-4">
        {clean ? (
          <Alert tone="success" title={report.summary} icon={<Check className="size-4" />}>
            <p>
              Body text, brand text, button labels, error text and the focus ring all clear WCAG AA
              in both light and dark mode.
            </p>
          </Alert>
        ) : null}

        {errors.length ? (
          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h3 className="font-display text-md font-semibold text-danger-fg">
                {errors.length} failure{errors.length === 1 ? '' : 's'} — publishing is blocked
              </h3>
              <p className="text-xs text-secondary">
                Fix the seed colour, not the token. Every one of these is derived.
              </p>
            </div>
            <ul className="space-y-2.5">
              {errors.map((issue) => (
                <li key={`${issue.token}-${issue.against}`}>
                  <IssueRow issue={issue} severity="error" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {warnings.length ? (
          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h3 className="font-display text-md font-semibold">
                {warnings.length} advisory warning{warnings.length === 1 ? '' : 's'}
              </h3>
              <p className="text-xs text-secondary">
                Worth reviewing. These do not stop you publishing.
              </p>
            </div>
            <ul className="space-y-2.5">
              {warnings.map((issue) => (
                <li key={`${issue.token}-${issue.against}`}>
                  <IssueRow issue={issue} severity="warning" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!clean ? (
          <p className="text-xs text-muted">
            Ratios are WCAG 2.1 contrast, measured between the two colours shown. 4.5:1 is the AA
            threshold for normal text; 3:1 applies to focus rings and other non-text controls that
            carry meaning; 7:1 is AAA and is required of body copy here because the portal is read on
            cheap phone screens in daylight.
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

function IssueRow({ issue, severity }: { issue: ParsedIssue; severity: 'error' | 'warning' }) {
  const purpose = PURPOSE[issue.base] ?? 'A token the portal renders directly.';
  const remedy = REMEDY[issue.base];

  return (
    <div
      className={cn(
        'rounded-lg border p-3.5',
        severity === 'error'
          ? 'border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] bg-danger-soft'
          : 'border-[color-mix(in_srgb,var(--warning)_40%,var(--border))] bg-warning-soft',
      )}
    >
      <div className="flex gap-3">
        <span
          aria-hidden="true"
          className={cn('mt-0.5 shrink-0', severity === 'error' ? 'text-danger-fg' : 'text-warning-fg')}
        >
          {severity === 'error' ? (
            <AlertTriangle className="size-4" />
          ) : (
            <Info className="size-4" />
          )}
        </span>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <code className="font-mono text-xs font-semibold">{issue.base}</code>
            <Badge tone="outline">{issue.mode === 'dark' ? 'dark mode' : 'light mode'}</Badge>
          </div>

          <p className={cn('text-sm', severity === 'error' ? 'text-danger-fg' : 'text-warning-fg')}>
            {purpose}
          </p>

          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secondary">
            <span className="tabular">
              Measured <strong className="font-semibold">{issue.ratio.toFixed(2)}:1</strong> against
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-3.5 rounded-sm border border-line-strong"
                style={{ background: issue.against }}
              />
              <span className="font-mono uppercase">{issue.against}</span>
            </span>
            <span className="tabular">
              · needs <strong className="font-semibold">{issue.required}:1</strong>
            </span>
          </p>

          {remedy ? <p className="text-xs text-secondary">{remedy}</p> : null}
        </div>
      </div>
    </div>
  );
}
