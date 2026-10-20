'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ExternalLink, Menu, X } from 'lucide-react';
import { ButtonLink, ThemeToggle } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * The public header's menu below `lg`.
 *
 * A native `<details>`, so it opens on a cheap Android before the page
 * has hydrated: a graduate who taps "Menu" on a slow 4G connection gets
 * the menu, not a dead button. The script only adds the ways a menu is
 * expected to close — navigation, a link tap, Escape, a tap outside.
 *
 * The `<details>` is deliberately not positioned. The panel is
 * `absolute inset-x-0 top-full` against the sticky header, so it drops
 * full-width beneath the bar rather than hanging off the button.
 *
 * `items` are the feature-gated rows (Events, Get involved), decided by
 * the header with the same gates as the desktop nav. About and Contact
 * are always present, so they are added here.
 */
export function MobileNav({
  items,
  signedIn,
  websiteUrl,
  shortName,
  office,
  className,
}: {
  items: Array<{ label: string; href: string }>;
  signedIn: boolean;
  websiteUrl?: string;
  shortName: string;
  office: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  const rows = [
    ...items,
    { label: 'About the portal', href: '/about' },
    { label: `Contact the ${office}`, href: '/contact' },
  ];

  // Navigation closes it.
  React.useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  // A tap anywhere outside closes it, as a menu is expected to.
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

  // Any link, including `/#get-involved`, which does not change the pathname.
  const onPanelClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target instanceof Element && e.target.closest('a') && ref.current) ref.current.open = false;
  };

  return (
    <details ref={ref} className={cn('group', className)} onKeyDown={onKeyDown}>
      <summary className="grid size-11 cursor-pointer list-none place-items-center rounded hover:bg-surface-sunken [&::-webkit-details-marker]:hidden">
        <Menu className="size-5 group-open:hidden" aria-hidden="true" />
        <X className="hidden size-5 group-open:block" aria-hidden="true" />
        <span className="sr-only">Menu</span>
      </summary>

      <div
        className="animate-slide-down absolute inset-x-0 top-full border-b border-line bg-surface-raised shadow-lg"
        onClick={onPanelClick}
      >
        <nav aria-label="Main">
          <ul>
            {rows.map((row) => {
              const current = !row.href.includes('#') && pathname === row.href;
              return (
                <li key={row.href}>
                  <Link
                    href={row.href}
                    aria-current={current ? 'page' : undefined}
                    className="flex min-h-14 items-center border-b border-line px-4 font-display text-lg font-semibold transition-colors duration-fast ease-brand hover:bg-surface-sunken aria-[current=page]:text-brand-fg"
                  >
                    {row.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-3 px-4 py-4">
          {!signedIn ? (
            <div className="grid grid-cols-2 gap-3">
              <ButtonLink href="/claim" size="lg" className="min-h-12">
                Register
              </ButtonLink>
              <ButtonLink href="/login" variant="secondary" size="lg" className="min-h-12">
                Sign in
              </ButtonLink>
            </div>
          ) : null}

          {websiteUrl ? (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-secondary hover:text-primary"
            >
              {shortName} website
              <ExternalLink className="size-3.5" aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Theme</span>
            <ThemeToggle size="lg" />
          </div>
        </div>
      </div>
    </details>
  );
}
