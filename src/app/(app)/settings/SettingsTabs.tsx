'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Database, KeyRound, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react';
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

  const sections: Array<TabItem & { icon: LucideIcon }> = [
    { label: 'Account', href: '/settings', icon: UserRound },
    { label: 'Privacy', href: '/settings/privacy', icon: ShieldCheck },
    { label: 'Notifications', href: '/settings/notifications', icon: Bell },
    { label: 'Security', href: '/settings/security', icon: KeyRound },
    {
      label: 'Your data',
      href: '/settings/data',
      icon: Database,
      count: openDataRequests > 0 ? openDataRequests : undefined,
    },
  ];
  const items = sections.map((item) => ({ ...item, active: pathname === item.href }));

  return (
    <>
      <Tabs items={items} ariaLabel="Settings sections" className="min-w-0 lg:hidden" />

      <nav aria-label="Settings sections" className="hidden lg:block">
        <ul className="sticky top-20 space-y-1">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-medium',
                  'transition-colors duration-fast ease-brand',
                  item.active
                    ? 'bg-brand-soft text-brand-soft-fg'
                    : 'text-secondary hover:bg-surface-sunken hover:text-primary',
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">{item.label}</span>
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
