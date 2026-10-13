import * as React from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { contrastReport } from '@/lib/branding/tokens';
import { cn } from '@/lib/cn';
import type { BrandPack } from '@/lib/branding/pack';

/**
 * A short excerpt of one college's brand pack, and the contrast audit of
 * every pack in the registry.
 *
 * Both are read from the packs the portal is running, not typed into the
 * page: the values in the excerpt are the parsed file's, and the audit is
 * `contrastReport()` — the same check `npm run brand:check` and the
 * branding studio's publish gate run — computed as this page rendered. If
 * a pack changes, so does this panel.
 *
 * Only keys the file actually sets are shown, in the file's own order.
 * What is left out is marked as left out.
 */

type Kind = 'key' | 'str' | 'lit' | 'punct' | 'elided' | 'note';
type Token = { text: string; kind: Kind };
type Line = { indent: number; tokens: Token[] };

const TONE: Record<Kind, string> = {
  key: 'text-brand-fg',
  str: 'text-accent-fg',
  lit: 'font-medium text-primary',
  punct: 'text-secondary',
  // A decorative stand-in for lines not shown, never information on its own.
  elided: 'text-muted',
  // Words describing what was left out are information, so secondary, not muted.
  note: 'text-secondary',
};

const p = (text: string): Token => ({ text, kind: 'punct' });
const k = (name: string): Token[] => [{ text: JSON.stringify(name), kind: 'key' }, p(': ')];
const v = (value: string | number | boolean): Token =>
  typeof value === 'string' ? { text: JSON.stringify(value), kind: 'str' } : { text: String(value), kind: 'lit' };

function excerptLines(pack: BrandPack): Line[] {
  const { color, type, shape, assets, copy, features } = pack;
  const lines: Line[] = [];
  const add = (indent: number, ...tokens: Token[]) => lines.push({ indent, tokens });
  const gap: Token = { text: '…', kind: 'elided' };
  const more = (indent: number) => add(indent, gap);

  add(0, p('{'));
  add(1, ...k('id'), v(pack.id), p(','));

  add(1, ...k('color'), p('{'));
  add(2, ...k('primary'), v(color.primary), p(','));
  if (color.accent) add(2, ...k('accent'), v(color.accent), p(','));
  add(2, ...k('surface'), v(color.surface), p(','));
  more(2);
  add(1, p('},'));

  add(1, ...k('type'), p('{ '), ...k('display'), v(type.display), p(', '), ...k('body'), v(type.body), p(', '), gap, p(' },'));
  add(1, ...k('shape'), p('{ '), ...k('radius'), v(shape.radius), p(', '), ...k('elevation'), v(shape.elevation), p(', '), gap, p(' },'));

  if (assets.heroImage || assets.campusPhotos.length) {
    add(1, ...k('assets'), p('{'));
    if (assets.heroImage) add(2, ...k('heroImage'), v(assets.heroImage), p(','));
    if (assets.campusPhotos.length) {
      add(2, ...k('campusPhotos'), p('[ '), { text: `… ${assets.campusPhotos.length} photos, each with alt text`, kind: 'note' }, p(' ]'));
    }
    add(1, p('},'));
  }

  add(1, ...k('copy'), p('{'));
  add(2, ...k('portalName'), v(copy.portalName), p(','));
  add(2, ...k('institutionName'), v(copy.institutionName), p(','));
  more(2);
  add(1, p('},'));

  add(1, ...k('features'), p('{ '), ...k('jobs'), v(features.jobs), p(', '), ...k('donations'), v(features.donations), p(', '), gap, p(' }'));
  add(0, p('}'));
  return lines;
}

export function PackExcerpt({
  pack,
  audited,
  className,
}: {
  /** The pack to excerpt. */
  pack: BrandPack;
  /** Every pack in the registry, audited below the excerpt. */
  audited: BrandPack[];
  className?: string;
}) {
  const lines = excerptLines(pack);
  const reports = [...audited]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((each) => ({ id: each.id, report: contrastReport(each) }));

  return (
    <figure className={cn('m-0 border border-line bg-surface-raised', className)}>
      <figcaption className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <span className="truncate font-mono text-sm text-primary">brands/{pack.id}.json</span>
        <span className="shrink-0 font-mono text-xs uppercase tracking-[0.14em] text-secondary">Excerpt</span>
      </figcaption>

      {/*
        On a phone a long line wraps under a two-character hanging indent,
        so a static screenshot never shows a line cut off at the edge. From
        `sm` up the file keeps its own line breaks and scrolls if it must.
      */}
      <div className="overflow-x-auto">
        <pre className="m-0 whitespace-pre-wrap px-4 py-4 font-mono text-xs leading-5 [overflow-wrap:anywhere] sm:min-w-max sm:whitespace-pre sm:text-sm sm:leading-6">
          <code>
            {lines.map((line, i) => (
              <span
                key={i}
                className="block"
                style={{ paddingInlineStart: `${line.indent * 2 + 2}ch`, textIndent: '-2ch' }}
              >
                {line.tokens.map((t, j) => (
                  <span key={j} className={TONE[t.kind]}>
                    {t.text}
                  </span>
                ))}
              </span>
            ))}
          </code>
        </pre>
      </div>

      <div className="border-t border-line px-4 py-4">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-secondary">
          Contrast check · every pack · computed as this page loaded
        </p>
        <ul className="mt-3 divide-y divide-line">
          {reports.map(({ id, report }) => (
            <li key={id} className="flex items-baseline gap-3 py-2">
              {report.passes ? (
                <Check className="size-4 shrink-0 translate-y-0.5 text-accent-fg" aria-hidden="true" />
              ) : (
                <AlertTriangle className="size-4 shrink-0 translate-y-0.5 text-danger-fg" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 font-mono text-sm text-primary sm:w-36 sm:flex-none sm:shrink-0">
                {id}.json
              </span>
              {/* A phone gets the verdict in a word; wider screens get the checker's own summary. */}
              <span
                className={cn(
                  'shrink-0 text-sm font-medium sm:hidden',
                  report.passes ? 'text-accent-fg' : 'text-danger-fg',
                )}
              >
                {report.passes ? 'Passes' : 'Blocked'}
              </span>
              <span
                className={cn('hidden min-w-0 text-sm sm:inline', report.passes ? 'text-secondary' : 'text-danger-fg')}
              >
                <span className="sr-only">{report.passes ? 'Passes. ' : 'Blocked. '}</span>
                {report.summary}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
