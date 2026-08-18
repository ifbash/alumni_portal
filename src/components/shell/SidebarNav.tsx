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
 */

export function SidebarNav({
  groups,
  badges = {},
  onNavigate,
  className,
}: {
  groups: NavGroup[];
  badges?: Partial<Record<string, number>>;
  /** Called after a link is followed — closes the mobile drawer. */
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className={cn('space-y-6', className)} aria-label="Main">
      {groups.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              // Exact match for index routes, prefix match for sections —
              // otherwise `/admin` stays highlighted on every admin page.
              const active =
                item.href === '/dashboard' || item.href === '/admin' || item.href === '/platform'
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              const count = item.badge ? badges[item.badge] : undefined;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group flex items-center gap-3 rounded px-3 py-2 text-sm font-medium',
                      'transition-colors duration-fast ease-brand',
                      active
                        ? 'bg-brand-soft text-brand-soft-fg'
                        : 'text-secondary hover:bg-surface-sunken hover:text-primary',
                    )}
                  >
                    <NavIcon name={item.icon} className={cn('size-4 shrink-0', active ? '' : 'text-muted group-hover:text-secondary')} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {count ? (
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-xs font-semibold tabular',
                          active ? 'bg-surface-raised text-brand-fg' : 'bg-brand-soft text-brand-soft-fg',
                        )}
                      >
                        {count > 99 ? '99+' : count}
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
