import * as React from 'react';
import { Card } from '@/components/ui';

/**
 * The shared look of the signed-in not-found pages in this module: one
 * lit panel that says there is nothing at this address and where to go
 * instead, then the reasons it might be, each on its own tile.
 *
 * It only lays words out. The pages that use it choose the words with
 * care (a not-found must never say which of its causes applied), and a
 * server component can hand it ordinary nodes.
 */
export function NotFoundPanel({
  documentTitle,
  icon,
  title,
  description,
  actions,
  reasons,
  footnote,
}: {
  /** The page's only h1, for assistive tech; the visible title is a paragraph. */
  documentTitle: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  actions: React.ReactNode;
  reasons: Array<{ icon: React.ReactNode; title: string; body: string }>;
  footnote?: string;
}) {
  return (
    <div className="space-y-8">
      <h1 className="sr-only">{documentTitle}</h1>

      <section className="ring-hairline relative isolate overflow-hidden rounded-xl border border-line bg-surface-raised px-6 py-10 text-center shadow-md sm:py-12">
        {/* The error code, drawn big and outlined, with the icon sitting on its
            foot. Decoration only. */}
        <span
          aria-hidden="true"
          className="display-outline pointer-events-none block select-none font-display text-[6.5rem] font-bold leading-none text-brand-fg opacity-[0.16] sm:text-[9rem]"
        >
          404
        </span>
        <span
          className="relative -mt-7 mx-auto grid size-14 place-items-center rounded-full bg-brand-soft text-brand-soft-fg shadow-[0_0_0_7px_color-mix(in_srgb,var(--brand-soft)_45%,transparent)]"
          aria-hidden="true"
        >
          {icon}
        </span>
        <p className="mx-auto mt-6 max-w-xl font-display text-display-xs font-bold tracking-tight text-primary">
          {title}
        </p>
        <p className="mx-auto mt-3 max-w-prose text-md text-secondary">{description}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div>
      </section>

      <ol className="grid grid-cols-1 gap-gutter md:grid-cols-3">
        {reasons.map((r, i) => (
          <li key={r.title} className="min-w-0">
            <Card className="h-full space-y-3 p-card">
              <p className="eyebrow text-xs text-secondary">
                <span aria-hidden="true" className="tabular">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="sr-only">Reason {i + 1}: </span>
              </p>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-brand-fg" aria-hidden="true">
                  {r.icon}
                </span>
                <div className="min-w-0 space-y-1 text-sm">
                  <p className="font-display text-md font-semibold leading-snug">{r.title}</p>
                  <p className="text-secondary">{r.body}</p>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      {footnote ? <p className="mx-auto max-w-prose text-center text-sm text-secondary">{footnote}</p> : null}
    </div>
  );
}
