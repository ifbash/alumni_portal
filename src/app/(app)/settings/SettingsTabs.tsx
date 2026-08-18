'use client';

import { usePathname } from 'next/navigation';
import { Tabs, type TabItem } from '@/components/ui';

/**
 * The settings tab bar.
 *
 * Links, not buttons with state — a member on a WhatsApp support thread
 * needs to be able to paste "open this page" and have it open that page.
 * The only reason this is a client component at all is `usePathname`; the
 * tabs themselves are the same server-rendered links used everywhere else.
 */
export function SettingsTabs({ openDataRequests }: { openDataRequests: number }) {
  const pathname = usePathname();

  const items: TabItem[] = [
    { label: 'Account', href: '/settings' },
    { label: 'Privacy', href: '/settings/privacy' },
    { label: 'Notifications', href: '/settings/notifications' },
    {
      label: 'Your data',
      href: '/settings/data',
      count: openDataRequests > 0 ? openDataRequests : undefined,
    },
  ].map((item) => ({ ...item, active: pathname === item.href }));

  return <Tabs items={items} ariaLabel="Settings sections" />;
}
