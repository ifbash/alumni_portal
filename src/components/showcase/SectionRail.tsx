'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { SHOWCASE_SECTIONS } from './styles';

/**
 * A rail of ticks at the right edge of a wide screen: where you are in the
 * story, and a way to jump. It duplicates the header's anchors, so it is a
 * convenience and never the only way anywhere, and it stays off the page
 * until the first numbered section is reached (the hero is dark, and a rail
 * drawn for paper would not read on it). Hidden below 1360px, where there
 * is no margin to put it in.
 */
export function SectionRail({ className }: { className?: string }) {
  const [active, setActive] = React.useState<string | null>(null);

  React.useEffect(() => {
    const els = SHOWCASE_SECTIONS.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => Boolean(e));
    if (!els.length) return;

    // The section crossing the middle of the viewport is the one being read.
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const now = els.filter((el) => seen.get(el.id)).map((el) => el.id);
        setActive(now.length ? now[now.length - 1]! : null);
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <nav
      aria-label="Sections of this page"
      className={cn(
        'fixed right-3 top-1/2 z-30 hidden -translate-y-1/2 transition-opacity duration-slow ease-brand min-[1360px]:block',
        active ? 'opacity-100' : 'pointer-events-none opacity-0',
        className,
      )}
    >
      <ol className="flex flex-col items-end">
        {SHOWCASE_SECTIONS.map((s, i) => {
          const on = s.id === active;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={on ? 'location' : undefined}
                tabIndex={active ? undefined : -1}
                className="group flex h-8 items-center justify-end gap-2.5 pl-3"
              >
                <span
                  className={cn(
                    'font-mono text-xs uppercase tracking-[0.12em] transition-opacity duration-fast ease-brand',
                    // Only the number shows at rest, so the rail never sits on the page's content; hover or focus opens the name.
                    on ? 'text-primary' : 'text-secondary',
                  )}
                >
                  <span className="hidden border border-line bg-surface-raised px-2 py-1 group-hover:inline-block group-focus-visible:inline-block">{s.label}</span>
                  <span className="tabular ml-2">{String(i + 1).padStart(2, '0')}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'block h-px transition-[width] duration-slow ease-brand',
                    on ? 'w-8 bg-brand-fg' : 'w-4 bg-line-strong group-hover:w-6',
                  )}
                />
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
