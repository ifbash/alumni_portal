import * as React from 'react';
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { readableTextOn, STOPS } from '@/lib/branding/color';

/**
 * What the seeds became.
 *
 * The studio sends three or four colours to the server and gets a
 * stylesheet back. This is that stylesheet, read out loud: the ten-stop
 * ramps, the semantic tokens every component actually renders, and the
 * shape and type values. Nothing here is configurable — that is the
 * point. A college supplies colours it can name from its own style guide,
 * and the hover states, tinted fills, borders and text pairings are
 * computed against contrast targets rather than chosen by eye.
 *
 * Tokens are parsed out of the CSS the API returned, not recomputed in the
 * browser. What is listed here is therefore literally what ships.
 */

export interface TokenMaps {
  light: Record<string, string>;
  dark: Record<string, string>;
}

/**
 * Read `tokensToCss()` output back into two maps.
 *
 * The format is fixed by `src/lib/branding/tokens.ts`: one `:root` block
 * carrying the mode-independent values plus light mode, a media query, and
 * a `[data-theme="dark"]` block. No token value contains a brace, so the
 * blocks split cleanly.
 */
export function parseTokenCss(css: string): TokenMaps {
  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};

  const root = /:root\{([^}]*)\}/.exec(css);
  if (root?.[1]) assignDeclarations(light, root[1]);

  const themed = /\[data-theme="dark"\]\{([^}]*)\}/.exec(css);
  if (themed?.[1]) assignDeclarations(dark, themed[1]);

  // Dark mode redefines only the semantic tokens; radii, fonts, spacing
  // and motion carry over from the base block.
  return { light, dark: { ...light, ...dark } };
}

function assignDeclarations(into: Record<string, string>, block: string): void {
  for (const decl of block.split(';')) {
    const at = decl.indexOf(':');
    if (at < 1) continue;
    const name = decl.slice(0, at).trim();
    if (!name.startsWith('--')) continue;
    into[name] = decl.slice(at + 1).trim();
  }
}

// ---------------------------------------------------------------
// What each token is for, in plain English
// ---------------------------------------------------------------

interface TokenRow {
  token: string;
  purpose: string;
}

interface TokenGroup {
  title: string;
  note: string;
  rows: TokenRow[];
}

const GROUPS: TokenGroup[] = [
  {
    title: 'Surfaces',
    note: 'The grounds everything else sits on.',
    rows: [
      { token: '--surface', purpose: 'The page itself.' },
      { token: '--surface-raised', purpose: 'Cards, panels, the top bar, form controls.' },
      { token: '--surface-sunken', purpose: 'Table headers, inset wells, hover fills.' },
      { token: '--surface-inverse', purpose: 'Dark bands — the footer, inverse buttons.' },
    ],
  },
  {
    title: 'Text',
    note: 'Three weights of copy, each checked against the page ground.',
    rows: [
      { token: '--text-primary', purpose: 'Body text on the page background — everything a member reads.' },
      { token: '--text-secondary', purpose: 'Card subtitles, field hints, table captions.' },
      { token: '--text-muted', purpose: 'The quietest text: timestamps, counts, placeholders.' },
      { token: '--text-on-inverse', purpose: 'Text sitting on the dark band.' },
    ],
  },
  {
    title: 'Brand and accent',
    note: 'Derived by walking the ramp until a stop clears 4.5:1, not by naming a step and hoping.',
    rows: [
      { token: '--brand-fg', purpose: 'Brand-coloured text: links, eyebrows, the active tab.' },
      { token: '--brand-soft', purpose: 'Tinted brand fill behind badges and avatar initials.' },
      { token: '--brand-soft-fg', purpose: 'Text inside that tinted fill.' },
      { token: '--accent-fg', purpose: 'Accent-coloured text, used sparingly for a second hue.' },
      { token: '--accent-soft', purpose: 'Tinted accent fill.' },
      { token: '--accent-soft-fg', purpose: 'Text inside the accent fill.' },
      { token: '--marker', purpose: 'The highlighter stroke under a hero phrase. Decoration only.' },
    ],
  },
  {
    title: 'Buttons, edges and focus',
    note: 'The pairs that decide whether the portal is operable by keyboard.',
    rows: [
      { token: '--button-primary-bg', purpose: 'Fill of the primary button.' },
      { token: '--button-primary-fg', purpose: 'The label on the primary button.' },
      { token: '--button-primary-hover', purpose: 'That fill under the cursor.' },
      { token: '--focus-ring', purpose: 'The ring drawn round whatever has keyboard focus.' },
      { token: '--border', purpose: 'Hairlines between rows, cards and sections.' },
      { token: '--border-strong', purpose: 'Emphasised edges: input borders, table outlines.' },
    ],
  },
  {
    title: 'Status',
    note: 'Fixed meanings. A college can retint these, but green stays the one that means "verified".',
    rows: [
      { token: '--success-fg', purpose: 'Verified, accepted, paid.' },
      { token: '--warning-fg', purpose: 'Awaiting review, expiring soon, over quota.' },
      { token: '--danger-fg', purpose: 'Failed payments, validation errors, deletion warnings.' },
      { token: '--info-fg', purpose: 'Neutral notices — final-year cohort, statutory deadlines.' },
    ],
  },
];

const SHAPE_ROWS: Array<{ token: string; purpose: string }> = [
  { token: '--radius', purpose: 'Buttons, inputs, badges' },
  { token: '--radius-lg', purpose: 'Cards and panels' },
  { token: '--control-h', purpose: 'Height of a button or input' },
  { token: '--card-p', purpose: 'Padding inside a card' },
  { token: '--gutter', purpose: 'Space between panels' },
  { token: '--border-width', purpose: 'Every hairline in the portal' },
];

const TYPE_ROWS: Array<{ token: string; purpose: string }> = [
  { token: '--font-display', purpose: 'Headings and the wordmark' },
  { token: '--font-body', purpose: 'Everything else' },
  { token: '--font-mono', purpose: 'Roll numbers, amounts, IDs' },
  { token: '--display-md', purpose: 'Hero heading, fluid between phone and desktop' },
];

// ---------------------------------------------------------------

export function TokenPreview({ tokens, className }: { tokens: TokenMaps; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle as="h2">Everything derived from those seeds</CardTitle>
          <CardDescription>
            Three colours went to the server. This came back. Ramps, hover states, tinted fills and
            text pairings are computed against contrast targets, which is why the result is accessible
            by construction rather than by review.
          </CardDescription>
        </div>
      </CardHeader>

      <CardBody className="space-y-8">
        <section className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-display text-md font-semibold">The ramps</h3>
            <p className="text-sm text-secondary">
              Ten stops per hue, generated in OKLCH so the steps stay perceptually even whether the
              college's colour is a deep blue or a bright saffron. Stops are absolute — stop 600 is
              the same colour in dark mode, and components reach for semantics instead.
            </p>
          </div>

          <Ramp label="Brand" prefix="brand" tokens={tokens.light} />
          <Ramp label="Accent" prefix="accent" tokens={tokens.light} />
          <Ramp
            label="Neutral"
            prefix="neutral"
            tokens={tokens.light}
            note="Derived from the page colour, not a fixed grey — a warm bone surface with cold grey borders reads as two designs stacked on top of each other."
          />
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <h3 className="font-display text-md font-semibold">Semantic tokens</h3>
            <p className="text-sm text-secondary">
              What components actually render. Dark mode is derived, never configured: asking a
              college for a second palette produces a second bad palette.
            </p>
          </div>

          <TableWrap caption="Semantic design tokens, light and dark">
            <Table>
              <caption className="sr-only">
                Every semantic token, what it is used for, and its light and dark values
              </caption>
              <THead>
                <TR>
                  <TH>Token</TH>
                  <TH>What it is for</TH>
                  <TH>Light</TH>
                  <TH>Dark</TH>
                </TR>
              </THead>
              <TBody>
                {GROUPS.map((group) => (
                  <React.Fragment key={group.title}>
                    <TR className="bg-surface-sunken">
                      <TD colSpan={4} className="py-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
                          {group.title}
                        </span>
                        <span className="ml-2 text-xs text-muted">{group.note}</span>
                      </TD>
                    </TR>
                    {group.rows.map((row) => (
                      <TR key={row.token}>
                        <TD className="whitespace-nowrap font-mono text-xs">{row.token}</TD>
                        <TD className="min-w-52 text-secondary">{row.purpose}</TD>
                        <TD>
                          <Swatch value={tokens.light[row.token]} />
                        </TD>
                        <TD>
                          <Swatch value={tokens.dark[row.token]} />
                        </TD>
                      </TR>
                    ))}
                  </React.Fragment>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </section>

        <section className="grid gap-6 sm:grid-cols-2">
          <ValueList
            title="Shape and density"
            note="One choice each for corners, spacing and elevation; every control in the portal follows."
            rows={SHAPE_ROWS}
            tokens={tokens.light}
          />
          <ValueList
            title="Type"
            note="Loaded at runtime, so a typeface picked after deployment still arrives."
            rows={TYPE_ROWS}
            tokens={tokens.light}
          />
        </section>
      </CardBody>
    </Card>
  );
}

function Ramp({
  label,
  prefix,
  tokens,
  note,
}: {
  label: string;
  prefix: string;
  tokens: Record<string, string>;
  note?: string;
}) {
  const stops = STOPS.map((stop) => ({ stop: stop as number, hex: tokens[`--${prefix}-${stop}`] })).filter(
    (s) => Boolean(s.hex),
  );

  if (!stops.length) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="text-sm font-semibold">{label}</h4>
        {note ? <p className="max-w-prose text-xs text-muted">{note}</p> : null}
      </div>

      <div
        className="flex overflow-x-auto rounded-lg border border-line"
        tabIndex={0}
        role="group"
        aria-label={`${label} ramp, ten stops`}
      >
        {stops.map(({ stop, hex }) => (
          <div
            key={stop}
            className="flex min-w-[4.25rem] flex-1 flex-col items-center justify-center gap-0.5 py-3"
            style={{ background: hex, color: safeReadable(hex) }}
          >
            <span className="text-xs font-semibold tabular">{stop}</span>
            <span className="font-mono text-xs uppercase">{hex}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Swatch({ value }: { value: string | undefined }) {
  if (!value) return <span className="text-xs text-muted">—</span>;

  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span
        aria-hidden="true"
        className="size-4 shrink-0 rounded-sm border border-line-strong"
        style={{ background: value }}
      />
      <span className="font-mono text-xs uppercase">{value}</span>
    </span>
  );
}

function ValueList({
  title,
  note,
  rows,
  tokens,
}: {
  title: string;
  note: string;
  rows: Array<{ token: string; purpose: string }>;
  tokens: Record<string, string>;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <h3 className="font-display text-md font-semibold">{title}</h3>
        <p className="text-sm text-secondary">{note}</p>
      </div>
      <dl className="divide-y divide-line rounded-lg border border-line">
        {rows.map((row) => (
          <div key={row.token} className="grid gap-0.5 px-3 py-2.5">
            <dt className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xs">{row.token}</span>
              <span className="text-xs text-muted">{row.purpose}</span>
            </dt>
            <dd className="truncate font-mono text-xs text-secondary">{tokens[row.token] ?? '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * A swatch label has to be legible on whatever colour it lands on, so the
 * text colour is computed from the swatch rather than chosen. This is the
 * one place a literal is unavoidable, and it is data about the swatch, not
 * a design decision.
 */
function safeReadable(hex: string): string | undefined {
  try {
    return readableTextOn(hex);
  } catch {
    return undefined;
  }
}
