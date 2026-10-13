'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tabs, type TabItem } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * The settings sections: a left-hand list at lg, a scrolling tab strip
 * below it.
 *
 * Links, not buttons with state — a member on a WhatsApp support thread
 * needs to be able to paste "open this page" and have it open that page.
 * The only reason this is a client component at all is `usePathname`.
 */
export function SettingsTabs({ openDataRequests }: { openDataRequests: number }) {
  const pathname = usePathname();

  const items: TabItem[] = [
    { label: 'Account', href: '/settings' },
    { label: 'Privacy', href: '/settings/privacy' },
    { label: 'Notifications', href: '/settings/notifications' },
    { label: 'Security', href: '/settings/security' },
    {
      label: 'Your data',
      href: '/settings/data',
      count: openDataRequests > 0 ? openDataRequests : undefined,
    },
  ].map((item) => ({ ...item, active: pathname === item.href }));

  return (
    <>
      <Tabs items={items} ariaLabel="Settings sections" className="min-w-0 lg:hidden" />

      <nav aria-label="Settings sections" className="hidden lg:block">
        <ul className="sticky top-20 space-y-0.5">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center justify-between gap-2 border-l-2 px-3 text-sm font-medium',
                  'transition-colors duration-fast ease-brand',
                  item.active
                    ? 'border-[var(--button-primary-bg)] text-brand-fg'
                    : 'border-line text-secondary hover:border-line-strong hover:text-primary',
                )}
              >
                {item.label}
                {item.count ? (
                  <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-xs font-semibold tabular text-brand-soft-fg">
                    {item.count}
                    <span className="sr-only"> open</span>
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
