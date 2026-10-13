'use client';

import * as React from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { ThemeToggle } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * The product site's menu below `lg`.
 *
 * A native `<details>`, like the college header's menu, so it opens before
 * hydration on a slow connection. The script only adds the ways a menu is
 * expected to close: a link tap (every item is an anchor on the landing
 * page, which does not change the pathname), Escape, and a tap outside.
 */
export function ShowcaseMenu({
  items,
  demoHref,
  className,
}: {
  items: Array<{ label: string; href: string }>;
  demoHref: string | null;
  className?: string;
}) {
  const ref = React.useRef<HTMLDetailsElement>(null);

  React.useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = ref.current;
      if (el?.open && e.target instanceof Node && !el.contains(e.target)) el.open = false;
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDetailsElement>) => {
    const el = ref.current;
    if (e.key !== 'Escape' || !el?.open) return;
    e.preventDefault();
    el.open = false;
    el.querySelector('summary')?.focus();
  };

  const onPanelClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target instanceof Element && e.target.closest('a') && ref.current) ref.current.open = false;
  };

  const row =
    'flex min-h-12 items-center justify-between gap-3 border-b border-line text-base font-medium text-primary hover:text-brand-fg';

  return (
    <details ref={ref} className={cn('group', className)} onKeyDown={onKeyDown}>
      <summary className="grid size-11 cursor-pointer list-none place-items-center hover:bg-surface-sunken [&::-webkit-details-marker]:hidden">
        <Menu className="size-5 group-open:hidden" aria-hidden="true" />
        <X className="hidden size-5 group-open:block" aria-hidden="true" />
        <span className="sr-only">Menu</span>
      </summary>

      <div
        onClick={onPanelClick}
        className="absolute inset-x-0 top-full border-b border-line bg-surface-raised animate-slide-down"
      >
        <nav aria-label="Product" className="page-shell pb-5 pt-1">
          <ul>
            {items.map((item) => (
              <li key={item.href}>
                <a href={item.href} className={row}>
                  {item.label}
                </a>
              </li>
            ))}
            {demoHref ? (
              <li>
                <a href={demoHref} className={row}>
                  See a demo college
                  <ArrowUpRight className="size-4 shrink-0 text-secondary" aria-hidden="true" />
                </a>
              </li>
            ) : null}
          </ul>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-sm text-secondary">Theme</span>
            <ThemeToggle size="lg" />
          </div>
        </nav>
      </div>
    </details>
  );
}
