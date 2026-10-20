'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { NavIcon } from './Icon';
import type { NavGroup } from '@/lib/navigation';

/**
 * Sidebar navigation.
 *
 * A client component only because the active item depends on the current
 * path. The nav *data* is computed on the server from the viewer's
 * capabilities and passed down as plain JSON — the client never decides
 * what a user is allowed to see, it only decides which link is
 * highlighted.
 *
 * Used twice: the desktop sidebar and the phone drawer. Every link keeps a
 * 44px target, because the drawer is a touch surface.
 */

/**
 * Counts keyed by a nav item's href rather than its `badge`, for queues
 * whose pill means "overdue" rather than "waiting". Drawn in the danger
 * tone, so a late statutory deadline is noticed even with the item
 * scrolled out of view. AppShell writes these as `overdue:{href}`; the
 * prefix is a literal on both sides because a value exported from this
 * client module reaches a server component only as a reference.
 */
const OVERDUE_PREFIX = 'overdue:';

export function SidebarNav({
  groups,
  badges = {},
  onNavigate,
  compact = false,
  className,
}: {
  groups: NavGroup[];
  badges?: Partial<Record<string, number>>;
  /** Called after a link is followed — closes the mobile drawer. */
  onNavigate?: () => void;
  /**
   * The staff console's desktop sidebar: tighter rows from `lg`, matching
   * the console's compact density there. Below `lg` (the drawer) every
   * link keeps its 44px target regardless.
   */
  compact?: boolean;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className={cn('space-y-7', compact && 'lg:space-y-4', className)} aria-label="Main">
      {groups.map((group) => (
        <div key={group.label} className={cn('space-y-1.5', compact && 'lg:space-y-0.5')}>
          {/* A group whose first item carries its own name ("Today" under
              "Today") needs no heading: it would say the same word twice. */}
          {group.items[0]?.label === group.label ? null : (
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-secondary">{group.label}</p>
          )}
          <ul className={cn('space-y-0.5', compact && 'lg:space-y-0')}>
            {group.items.map((item) => {
              // Exact match for index routes, prefix match for sections —
              // otherwise `/admin` stays highlighted on every admin page.
              const active =
                item.href === '/dashboard' || item.href === '/admin' || item.href === '/platform'
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              // A pill at 0 is noise; it only ever says "something is waiting".
              const overdue = badges[`${OVERDUE_PREFIX}${item.href}`] ?? 0;
              const count = overdue > 0 ? overdue : item.badge ? (badges[item.badge] ?? 0) : 0;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex min-h-11 items-center gap-3 rounded-lg py-1.5 pl-2 pr-3 text-sm font-medium',
                      compact && 'lg:min-h-8 lg:py-1 lg:pl-3',
                      'transition-[background-color,color] duration-fast ease-brand',
                      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus-ring)]',
                      active
                        ? 'bg-brand-soft font-semibold text-brand-soft-fg'
                        : 'text-secondary hover:bg-surface-sunken hover:text-primary',
                    )}
                  >
                    {/* The active rail grows from the middle, so moving
                        between pages reads as the marker travelling. */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute -left-3 top-2 bottom-2 w-1 origin-center rounded-r-full bg-[var(--button-primary-bg)]',
                        'transition-transform duration-slow ease-brand',
                        compact && 'lg:-left-3 lg:top-1.5 lg:bottom-1.5',
                        active ? 'scale-y-100' : 'scale-y-0',
                      )}
                    />
                    <span
                      className={cn(
                        'grid size-8 shrink-0 place-items-center rounded-md transition-[background-color,box-shadow,color] duration-fast ease-brand',
                        compact && 'lg:size-5 lg:bg-transparent lg:shadow-none',
                        active
                          ? 'bg-surface-raised text-brand-fg shadow-sm'
                          : 'text-muted group-hover:bg-surface-raised group-hover:text-secondary',
                      )}
                    >
                      <NavIcon name={item.icon} className="size-4 shrink-0" />
                    </span>
                    <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                      <span className="truncate">{item.label}</span>
                      {item.tag ? (
                        <span
                          className={cn(
                            'shrink-0 whitespace-nowrap text-xs font-normal',
                            active ? 'text-brand-soft-fg' : 'text-secondary',
                          )}
                        >
                          {item.tag}
                        </span>
                      ) : null}
                    </span>
                    {count > 0 ? (
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular',
                          overdue > 0
                            ? 'bg-danger-soft text-danger-fg'
                            : active
                              ? 'bg-surface-raised text-brand-fg'
                              : 'bg-brand-soft text-brand-soft-fg',
                        )}
                      >
                        <span className="sr-only">, </span>
                        {count > 99 ? '99+' : count}
                        <span className="sr-only">
                          {overdue > 0 ? ' overdue' : item.badge === 'notifications' ? ' unread' : ' waiting'}
                        </span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
