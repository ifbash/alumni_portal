'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, LogOut, Menu as MenuIcon, Search, Shield, User } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Avatar, Menu, MenuItem, MenuLabel, MenuSeparator, Sheet, ThemeToggle } from '@/components/ui';
import { SidebarNav } from './SidebarNav';
import type { NavGroup } from '@/lib/navigation';
import type { NotificationItem } from '@/lib/data/types';

/**
 * Top bar.
 *
 * Holds the three things a member needs from anywhere in the portal:
 * search, what has happened since they last looked, and who they are
 * signed in as. On a phone it also owns the navigation drawer, because a
 * persistent sidebar on a 360px screen leaves no room for content.
 */

export function TopBar({
  groups,
  badges,
  notifications,
  user,
  adminHref,
  logo,
  searchPlaceholder = 'Search the directory…',
  showSearch = true,
}: {
  groups: NavGroup[];
  badges?: Partial<Record<string, number>>;
  notifications: NotificationItem[];
  user: { name: string; role: string; photoUrl: string | null };
  adminHref: string | null;
  logo: React.ReactNode;
  searchPlaceholder?: string;
  showSearch?: boolean;
}) {
  const router = useRouter();
  const [drawer, setDrawer] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const unread = notifications.filter((n) => !n.readAt).length;

  const onSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = new FormData(e.currentTarget).get('q');
    router.push(`/directory?q=${encodeURIComponent(String(value ?? ''))}`);
  };

  return (
    // Translucency via color-mix, not Tailwind's `/95`: the palette is CSS
    // custom properties, which Tailwind cannot decompose into channels for
    // an opacity modifier, so `bg-surface-raised/95` emits nothing at all.
    <header className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_srgb,var(--surface-raised)_95%,transparent)] backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--surface-raised)_80%,transparent)]">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-label="Open navigation"
          className="grid size-9 shrink-0 place-items-center rounded text-secondary hover:bg-surface-sunken hover:text-primary lg:hidden"
        >
          <MenuIcon className="size-5" aria-hidden="true" />
        </button>

        <Link href="/dashboard" className="shrink-0 lg:hidden">
          {logo}
        </Link>

        {showSearch ? (
          <form onSubmit={onSearch} role="search" className="ml-auto hidden max-w-md flex-1 sm:block lg:ml-0">
            <label htmlFor="global-search" className="sr-only">
              {searchPlaceholder}
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                id="global-search"
                name="q"
                type="search"
                placeholder={searchPlaceholder}
                className={cn(
                  'h-9 w-full rounded-full border border-line bg-surface pl-9 pr-3 text-sm',
                  'placeholder:text-muted hover:border-line-strong',
                  'focus:border-[var(--focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]',
                )}
              />
            </div>
          </form>
        ) : (
          <span className="flex-1" />
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle className="hidden sm:inline-flex" />

          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
              aria-expanded={notifOpen}
              className="relative grid size-9 place-items-center rounded text-secondary hover:bg-surface-sunken hover:text-primary"
            >
              <Bell className="size-[18px]" aria-hidden="true" />
              {unread ? (
                <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-danger-on">
                  {unread > 9 ? '9+' : unread}
                </span>
              ) : null}
            </button>

            {notifOpen ? (
              <>
                {/* Click-away layer. A pointerdown listener on document
                    would also fire for the button that opened this. */}
                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} aria-hidden="true" />
                <div className="absolute right-0 z-50 mt-2 w-80 animate-slide-down rounded-lg border border-line bg-surface-raised shadow-lg">
                  <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                    <p className="text-sm font-semibold">Notifications</p>
                    {unread ? <span className="text-xs text-muted">{unread} unread</span> : null}
                  </div>
                  <ul className="max-h-96 divide-y divide-line overflow-y-auto">
                    {notifications.length === 0 ? (
                      <li className="px-4 py-8 text-center text-sm text-secondary">Nothing new.</li>
                    ) : (
                      notifications.map((n) => (
                        <li key={n.id}>
                          <Link
                            href={n.href ?? '#'}
                            onClick={() => setNotifOpen(false)}
                            className={cn(
                              'flex gap-3 px-4 py-3 hover:bg-surface-sunken',
                              !n.readAt && 'bg-brand-soft',
                            )}
                          >
                            {/*
                              `--brand-soft-fg` rather than `brand-600`: the
                              dot sits on `--brand-soft`, which flips between
                              modes, and an absolute ramp stop on a ground
                              that moves was 4.74:1 in light and 2.54:1 in
                              dark — the mark all but disappeared exactly
                              where it is the only thing marking the row.
                              `--brand-soft-fg` is derived to be legible on
                              that ground in both modes.
                            */}
                            <span
                              className={cn(
                                'mt-1.5 size-2 shrink-0 rounded-full',
                                n.readAt ? 'bg-transparent' : 'bg-[var(--brand-soft-fg)]',
                              )}
                              aria-hidden="true"
                            />
                            {/* The dot is the only per-row unread signal, and
                                colour is never allowed to carry meaning alone. */}
                            {!n.readAt ? <span className="sr-only">Unread. </span> : null}
                            <span className="min-w-0 space-y-0.5">
                              <span className="block text-sm font-medium">{n.title}</span>
                              {n.body ? <span className="block text-xs text-secondary">{n.body}</span> : null}
                            </span>
                          </Link>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </>
            ) : null}
          </div>

          <Menu
            label="Account menu"
            trigger={() => (
              <span className="flex items-center gap-2 rounded p-1 hover:bg-surface-sunken">
                <Avatar name={user.name} src={user.photoUrl} size="sm" />
                <span className="hidden text-left text-sm leading-tight md:block">
                  <span className="block max-w-36 truncate font-medium">{user.name}</span>
                  <span className="block text-xs text-muted">{user.role}</span>
                </span>
              </span>
            )}
          >
            <MenuLabel>{user.name}</MenuLabel>
            <MenuItem href="/profile" icon={<User className="size-4" />}>
              My profile
            </MenuItem>
            {adminHref ? (
              <MenuItem href={adminHref} icon={<Shield className="size-4" />}>
                Admin console
              </MenuItem>
            ) : null}
            <MenuSeparator />
            <MenuItem href="/logout" tone="danger" icon={<LogOut className="size-4" />}>
              Sign out
            </MenuItem>
          </Menu>
        </div>
      </div>

      <Sheet open={drawer} onClose={() => setDrawer(false)} title="Navigation" side="left">
        <SidebarNav groups={groups} badges={badges} onNavigate={() => setDrawer(false)} />
        <div className="mt-6 border-t border-line pt-4">
          <ThemeToggle />
        </div>
      </Sheet>
    </header>
  );
}
