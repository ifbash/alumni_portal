import * as React from 'react';
import { AlertTriangle, ArrowDown, ArrowRight, Check } from 'lucide-react';
import { contrastReport } from '@/lib/branding/tokens';
import { cn } from '@/lib/cn';
import type { BrandPack } from '@/lib/branding/pack';
import { LABEL } from './styles';

/**
 * One college's brand pack, and what the portal makes of it.
 *
 * The figure reads left to right: a short excerpt of the JSON file, the
 * design system derived from its seeds, and below them the contrast audit
 * of every pack in the registry. All three are read from the packs the
 * portal is running, not typed into the page: the excerpt shows the parsed
 * file's values, the swatches are the pack's own scoped tokens (the hero
 * emits them once for the whole page, as `.pv-<id>`), and the audit is
 * `contrastReport()`, the same check `npm run brand:check` and the
 * branding studio's publish gate run, computed as this page rendered.
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
  more(2);
  add(1, p('},'));

  add(1, ...k('type'), p('{ '), ...k('display'), v(type.display), p(', '), ...k('body'), v(type.body), p(', '), gap, p(' },'));
  add(1, ...k('shape'), p('{ '), ...k('radius'), v(shape.radius), p(', '), gap, p(' },'));

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
  more(2);
  add(1, p('},'));

  add(1, ...k('features'), p('{ '), ...k('jobs'), v(features.jobs), p(', '), ...k('donations'), v(features.donations), p(', '), gap, p(' }'));
  add(0, p('}'));
  return lines;
}

/** The ten stops of a derived ramp, light to dark. Spelled out so Tailwind sees every class. */
const BRAND_STOPS = ['bg-brand-50', 'bg-brand-100', 'bg-brand-200', 'bg-brand-300', 'bg-brand-400', 'bg-brand-500', 'bg-brand-600', 'bg-brand-700', 'bg-brand-800', 'bg-brand-900'];
const ACCENT_STOPS = ['bg-accent-50', 'bg-accent-100', 'bg-accent-200', 'bg-accent-300', 'bg-accent-400', 'bg-accent-500', 'bg-accent-600', 'bg-accent-700', 'bg-accent-800', 'bg-accent-900'];

function Ramp({ name, stops }: { name: string; stops: string[] }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-xs text-secondary">{name}</p>
      <div aria-hidden="true" className="flex h-7 overflow-hidden">
        {stops.map((stop) => (
          <span key={stop} className={cn('flex-1', stop)} />
        ))}
      </div>
    </div>
  );
}

/** What the resolver makes of the seeds, in the college's own scoped tokens. */
function Derived({ pack }: { pack: BrandPack }) {
  const { copy, assets, color } = pack;
  const photos = assets.campusPhotos.slice(0, 4);

  return (
    <div className={cn(`pv-${pack.id}`, 'flex min-w-0 flex-col gap-4 bg-surface p-5 font-body text-primary')}>
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-secondary">Derived · {pack.copy.shortName}&rsquo;s tokens</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Ramp name="colour.primary → 10 stops" stops={BRAND_STOPS} />
        {color.accent ? <Ramp name="colour.accent → 10 stops" stops={ACCENT_STOPS} /> : null}
      </div>

      {/* The band, the buttons and a tag, as the portal builds them. */}
      <div className="band-surface p-4">
        <p className="text-xs font-semibold text-band-accent">{copy.institutionName}</p>
        <p className="mt-1 font-display text-display-xs font-bold text-band-fg">
          {copy.heroHeadline ?? `Welcome back to ${copy.shortName}.`}
        </p>
        <div className="mt-3 flex gap-2">
          <span className="inline-flex h-9 items-center rounded-lg bg-band-fg px-4 text-sm font-semibold text-band">Register</span>
          <span className="inline-flex h-9 items-center rounded-lg border border-band-muted px-4 text-sm font-semibold text-band-fg">
            Sign in
          </span>
        </div>
      </div>

      {photos.length ? (
        <div>
          <p className="mb-1.5 font-mono text-xs text-secondary">assets.campusPhotos → the gallery</p>
          <ul className="grid grid-cols-4 gap-1.5">
            {photos.map((photo) => (
              <li key={photo.src}>
                {/* Brand imagery bypasses the optimiser, as everywhere else in the portal. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.src}
                  alt={photo.alt}
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: photo.focus }}
                  className="block aspect-[4/3] w-full bg-surface-sunken object-cover"
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
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
        <span className={cn(LABEL, 'shrink-0')}>Excerpt → portal</span>
      </figcaption>

      <div className="grid lg:grid-cols-[minmax(0,5fr)_auto_minmax(0,6fr)]">
        {/*
          On a phone a long line wraps under a two-character hanging indent,
          so a static screenshot never shows a line cut off at the edge. From
          `sm` up the file keeps its own line breaks and scrolls if it must.
        */}
        <div className="min-w-0 overflow-x-auto">
          <pre className="m-0 whitespace-pre-wrap px-4 py-4 font-mono text-xs leading-5 [overflow-wrap:anywhere] sm:min-w-max sm:whitespace-pre">
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

        {/* The resolver between them: seeds in, tokens out. */}
        <div className="flex items-center justify-center gap-2 border-y border-line px-3 py-2.5 lg:flex-col lg:border-x lg:border-y-0 lg:px-4">
          <ArrowRight className="hidden size-5 text-brand-fg lg:block" aria-hidden="true" />
          <ArrowDown className="size-5 text-brand-fg lg:hidden" aria-hidden="true" />
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-secondary">resolve</span>
        </div>

        <Derived pack={pack} />
      </div>

      <div className="border-t border-line px-4 py-4">
        <p className={LABEL}>Contrast check · every pack · computed as this page loaded</p>
        <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
          {reports.map(({ id, report }) => (
            <li key={id} className="flex items-baseline gap-2">
              {report.passes ? (
                <Check className="size-4 shrink-0 translate-y-0.5 text-accent-fg" aria-hidden="true" />
              ) : (
                <AlertTriangle className="size-4 shrink-0 translate-y-0.5 text-danger-fg" aria-hidden="true" />
              )}
              <span className="min-w-0 text-sm">
                <span className="font-mono text-primary">{id}.json</span>{' '}
                <span className={report.passes ? 'text-secondary' : 'text-danger-fg'}>
                  <span className="sr-only">{report.passes ? 'Passes. ' : 'Blocked. '}</span>
                  {report.passes ? 'passes' : 'blocked'}
                </span>
                {/* The checker's own summary, for anyone who wants the count. */}
                <span className="sr-only">{report.summary}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
