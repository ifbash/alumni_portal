'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu as MenuIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { IconName } from '@/lib/navigation';
import { NavIcon } from './Icon';
import { OPEN_DRAWER_EVENT } from './TopBar';

/**
 * The phone tab bar: four destinations and "More".
 *
 * Member shell only, below `lg`, never for the vendor. The four hrefs come
 * from `mobileTabs()` on the server, resolved to their nav items there, so
 * the bar can never offer a door the sidebar would not. "More" opens the
 * same drawer as the menu button in the top bar.
 *
 * The shell root carries `.has-tabbar`, which sets `--shell-tabbar-h`, so
 * `StickyActionBar` and sticky form actions sit above this bar and the
 * page's last line is never hidden under it.
 */

export interface MobileTab {
  href: string;
  label: string;
  icon: IconName;
  /** Something is waiting behind this tab (Requests: pending requests). */
  dot: boolean;
  count: number;
}

export function MobileTabBar({ tabs }: { tabs: MobileTab[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Quick links"
      data-print-hide=""
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface-raised pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {tabs.map((tab) => {
        const active =
          tab.href === '/dashboard' ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              ITEM,
              active ? 'text-brand-fg' : 'text-secondary hover:text-primary',
            )}
          >
            {active ? (
              <span aria-hidden="true" className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-[var(--button-primary-bg)]" />
            ) : null}
            <span className="relative">
              <NavIcon name={tab.icon} className="size-5" />
              {tab.dot ? (
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-0.5 size-2.5 rounded-full bg-[var(--button-primary-bg)] ring-2 ring-[var(--surface-raised)]"
                />
              ) : null}
            </span>
            <span className="max-w-full truncate whitespace-nowrap px-1">{tab.label}</span>
            {tab.dot ? <span className="sr-only">, {tab.count} waiting</span> : null}
          </Link>
        );
      })}

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(OPEN_DRAWER_EVENT))}
        aria-haspopup="dialog"
        className={cn(ITEM, 'text-secondary hover:text-primary')}
      >
        <MenuIcon className="size-5" aria-hidden="true" strokeWidth={1.75} />
        <span className="whitespace-nowrap">More</span>
      </button>
    </nav>
  );
}

const ITEM = cn(
  'relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 text-xs font-medium',
  'transition-colors duration-fast ease-brand',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]',
);
