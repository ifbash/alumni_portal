import Link from 'next/link';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { formatDate } from '@/lib/format';
import type { CopySpec, LocaleSpec } from '@/lib/branding/pack';

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
    <section
      id="announcements"
      aria-labelledby="announcements-title"
      className="scroll-mt-20 border-t border-line py-10 md:py-section"
    >
      <div className="page-shell">
        <h2 id="announcements-title" className="font-display text-display-xs font-bold">
          Announcements
        </h2>

        <ul className="mt-6 divide-y divide-line rounded-lg border border-line bg-surface-raised">
          {current.map((a) => {
            const external = a.href?.startsWith('https://') ?? false;
            const linkClass = 'inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brand-fg hover:underline underline-offset-4';
            const label = a.linkLabel ?? 'Read more';

            return (
              <li key={a.title} className="space-y-1 p-card">
                {a.date ? (
                  <time dateTime={a.date} className="block text-xs text-secondary">
                    {formatDate(a.date, fmt)}
                  </time>
                ) : null}
                <h3 className="font-display text-lg font-semibold">{a.title}</h3>
                {a.body ? <p className="text-sm text-secondary">{a.body}</p> : null}
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
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
