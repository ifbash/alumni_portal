import Link from 'next/link';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { formatDate } from '@/lib/format';
import type { CopySpec, LocaleSpec } from '@/lib/branding/pack';
import { SectionHead } from './SectionHead';

/**
 * Announcements the college has written (Oxford's "Top news").
 *
 * Only what the pack's `copy.announcements` holds — never anything
 * generated from member rows. An item with an `until` date drops off the
 * day after it, measured in the college's own time zone. With nothing
 * current, the section is omitted rather than shown empty.
 */
export function Announcements({ items, locale }: { items: CopySpec['announcements']; locale: LocaleSpec }) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: locale.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const current = items.filter((a) => !a.until || a.until >= today).slice(0, 3);
  if (!current.length) return null;

  const fmt = { locale: locale.locale, timeZone: locale.timeZone };

  return (
    <section id="announcements" aria-labelledby="announcements-title" className="scroll-mt-20 pb-10 md:pb-section">
      <div className="page-shell">
        <SectionHead id="announcements-title" eyebrow="News" title="Announcements" />

        <ul className="reveal mt-8 divide-y divide-line border-y border-line">
          {current.map((a) => {
            const external = a.href?.startsWith('https://') ?? false;
            const linkClass =
              'inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-fg underline-offset-4 hover:underline';
            const label = a.linkLabel ?? 'Read more';

            return (
              <li key={a.title} className="grid gap-x-10 gap-y-2 py-6 md:grid-cols-[9rem_minmax(0,1fr)] md:py-8">
                {a.date ? (
                  <time dateTime={a.date} className="text-sm font-semibold uppercase tracking-[0.1em] text-secondary tabular">
                    {formatDate(a.date, fmt)}
                  </time>
                ) : (
                  <span aria-hidden="true" className="hidden md:block" />
                )}
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-bold leading-snug">{a.title}</h3>
                  {a.body ? <p className="mt-2 max-w-prose text-secondary">{a.body}</p> : null}
                  {a.href ? (
                    external ? (
                      <a href={a.href} target="_blank" rel="noreferrer noopener" className={linkClass}>
                        {label}
                        <ExternalLink className="size-4" aria-hidden="true" />
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      <Link href={a.href} className={linkClass}>
                        {label}
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    )
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
