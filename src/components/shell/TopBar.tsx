'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  Bell,
  Building2,
  ChevronDown,
  Eye,
  LogOut,
  Menu as MenuIcon,
  Monitor,
  Moon,
  Search,
  Settings,
  Shield,
  Sun,
  User,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Avatar, Kbd, MenuItem, MenuSeparator, Sheet, ThemeToggle } from '@/components/ui';
import { notificationAction } from '@/lib/notifications-view';
import type { NavGroup } from '@/lib/navigation';
import type { NotificationItem } from '@/lib/data/types';
import { OPEN_PALETTE_EVENT } from '@/components/directory/PaletteMount';
import { SidebarNav } from './SidebarNav';

/**
 * Top bar.
 *
 * Holds the things a person needs from anywhere in the portal: the one
 * search, what has happened since they last looked, and who they are
 * signed in as. Below `lg` it also owns the navigation drawer, because a
 * persistent sidebar on a 360px screen leaves no room for content.
 *
 * Everything it offers was decided on the server and arrives as props: the
 * nav tree, which links exist, whether there is a bell. This component
 * decides only what is open and which link is current.
 */

/** Dispatched by the phone tab bar's "More"; opens the drawer. */
export const OPEN_DRAWER_EVENT = 'alumni:open-drawer';

export type ShellNotification = NotificationItem & {
  /** "2 days ago", formatted on the server against the fixture clock. */
  ago: string;
};

export interface ShellBrand {
  homeHref: string;
  /** Accessible name of the home link: "{portalName}, home". */
  homeLabel: string;
  /** Institution name, "Staff console" or "Platform". */
  line2: string;
  tone: 'member' | 'console';
  /** `<Logo height={22} />` for the plain top bar. */
  logo: React.ReactNode;
  /** `<Logo variant="band" height={22} />` for the band. */
  bandLogo: React.ReactNode;
  /** `<Crest size={28} />`; null for every pack without a crest. */
  crestSmall: React.ReactNode;
  /** `<Crest size={40} />` for the drawer's band. */
  crestLarge: React.ReactNode;
  poweredBy: React.ReactNode;
}

/**
 * The college on the band: crest (when there is one), the band logo or
 * wordmark, and a second line. Used at the top of the sidebar and of the
 * phone drawer, so the two can never drift apart.
 */
export function ShellIdentity({
  href,
  label,
  crest,
  logo,
  line2,
  tone,
  onNavigate,
}: {
  href: string;
  label: string;
  crest: React.ReactNode;
  logo: React.ReactNode;
  line2: string;
  tone: 'member' | 'console';
  onNavigate?: () => void;
}) {
  return (
    <Link href={href} aria-label={label} onClick={onNavigate} className="group flex min-h-11 items-center gap-3 rounded-lg">
      {crest}
      <span className="min-w-0">
        <span className="block transition-opacity duration-fast ease-brand group-hover:opacity-90">{logo}</span>
        <span
          className={cn(
            'mt-1.5 block text-xs',
            tone === 'console'
              ? 'truncate font-semibold uppercase tracking-[0.14em] text-band-accent'
              : 'line-clamp-2 text-band-muted',
          )}
          title={line2}
        >
          {line2}
        </span>
      </span>
    </Link>
  );
}

export function TopBar({
  groups,
  badges,
  notifications,
  user,
  brand,
  showSearch,
  showBell,
  links,
  demo,
}: {
  groups: NavGroup[];
  badges?: Partial<Record<string, number>>;
  notifications: ShellNotification[];
  user: { name: string; identity: string; photoUrl: string | null };
  brand: ShellBrand;
  /** True exactly where the command palette is mounted. */
  showSearch: boolean;
  /** False for vendor-only sessions: /notifications refuses them. */
  showBell: boolean;
  links: {
    /** "What others see" — directory on, not the vendor. */
    preview: boolean;
    notifications: boolean;
    /** "Staff console" — member shell, with a console to go to. */
    console: boolean;
    /** "Back to the portal" — console shells, not the vendor. */
    portal: boolean;
    /** "Platform" — holders of `tenant.provision`, outside the platform shell. */
    platform: boolean;
  };
  /** The Demo data marker, or null outside fixture mode. */
  demo?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [accountOpen, setAccountOpen] = React.useState(false);
  // Rendered as "Ctrl" until the client says otherwise, so the server
  // markup and the first client render agree.
  const [mac, setMac] = React.useState(false);
  const bellRef = useDismiss(notifOpen, React.useCallback(() => setNotifOpen(false), []));
  const accountRef = useDismiss(accountOpen, React.useCallback(() => setAccountOpen(false), []));
  const accountButton = React.useRef<HTMLButtonElement>(null);
  const accountMenuId = React.useId();

  const unread = notifications.filter((n) => !n.readAt).length;
  // On the directory the page has its own search field; the trigger steps
  // back to an icon so there are not two fields side by side.
  const compactSearch = pathname === '/directory' || pathname.startsWith('/directory/');

  React.useEffect(() => {
    setMac(/Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);

  // The tab bar's "More" opens the drawer from outside this component.
  React.useEffect(() => {
    const open = () => setDrawer(true);
    window.addEventListener(OPEN_DRAWER_EVENT, open);
    return () => window.removeEventListener(OPEN_DRAWER_EVENT, open);
  }, []);

  // Anything that navigates closes what is open.
  React.useEffect(() => {
    setDrawer(false);
    setNotifOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  /** Arrow keys walk the account menu's items, as a menu should. */
  const onAccountKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]'),
    );
    if (items.length === 0) return;
    const at = items.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (e.key === 'ArrowDown') next = at < 0 ? 0 : (at + 1) % items.length;
    else if (e.key === 'ArrowUp') next = at < 0 ? items.length - 1 : (at - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else if (e.key === 'Escape') {
      setAccountOpen(false);
      accountButton.current?.focus();
      return;
    }
    if (next === null) return;
    e.preventDefault();
    items[next]?.focus();
  };

  const openPalette = () => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));

  return (
    // Translucency via color-mix, not Tailwind's `/95`: the palette is CSS
    // custom properties, which Tailwind cannot decompose into channels for
    // an opacity modifier, so `bg-surface-raised/95` emits nothing at all.
    <header
      data-print-hide=""
      className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_srgb,var(--surface-raised)_95%,transparent)] backdrop-blur-md backdrop-saturate-150 supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--surface-raised)_72%,transparent)]"
    >
      <div className="flex h-14 items-center gap-1 pl-1 pr-2 sm:gap-2 sm:px-4 lg:px-6">
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-label="Open navigation"
          aria-haspopup="dialog"
          className={cn(ICON_BUTTON, 'lg:hidden')}
        >
          <MenuIcon className="size-5" aria-hidden="true" />
        </button>

        <Link
          href={brand.homeHref}
          aria-label={brand.homeLabel}
          className="flex min-h-11 min-w-0 shrink items-center gap-2 rounded px-1 lg:hidden"
        >
          {brand.crestSmall}
          <span className="min-w-0 truncate">{brand.logo}</span>
        </Link>

        <div className="flex min-w-0 flex-1 justify-center px-2">
          {showSearch && !compactSearch ? (
            <button
              type="button"
              onClick={openPalette}
              aria-haspopup="dialog"
              aria-keyshortcuts="Control+K Meta+K"
              className={cn(
                'group hidden h-10 w-full max-w-md items-center gap-2.5 rounded-full border border-line bg-surface-sunken pl-3.5 pr-2 text-sm text-secondary sm:flex',
                'shadow-[inset_0_1px_2px_var(--shadow-color)] transition-[background-color,border-color,box-shadow] duration-fast ease-brand',
                'hover:border-line-strong hover:bg-surface-raised hover:shadow-sm',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
              )}
            >
              <Search className="size-4 shrink-0 text-muted transition-colors duration-fast group-hover:text-secondary" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-left">Search people, batches and pages</span>
              <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
                <Kbd>{mac ? '⌘' : 'Ctrl'}</Kbd>
                <Kbd>K</Kbd>
              </span>
            </button>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {demo}

          {showSearch ? (
            <button
              type="button"
              onClick={openPalette}
              aria-label="Search"
              aria-haspopup="dialog"
              aria-keyshortcuts="Control+K Meta+K"
              className={cn(ICON_BUTTON, compactSearch ? null : 'sm:hidden')}
            >
              <Search className="size-5" aria-hidden="true" />
            </button>
          ) : null}

          {showBell ? (
            <div ref={bellRef} className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
                aria-expanded={notifOpen}
                aria-controls="shell-notifications"
                className={ICON_BUTTON}
              >
                <Bell className="size-5" aria-hidden="true" />
                {unread ? (
                  <span
                    aria-hidden="true"
                    className="absolute right-1 top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--button-primary-bg)] px-1 text-xs font-semibold leading-none text-[var(--button-primary-fg)] ring-2 ring-[var(--surface-raised)] tabular"
                  >
                    {unread > 9 ? '9+' : unread}
                  </span>
                ) : null}
              </button>

              {notifOpen ? (
                <div
                  id="shell-notifications"
                  className={cn(
                    // Below sm the panel spans the bar (the header is its
                    // containing block); from sm it hangs off the bell.
                    'fixed inset-x-2 top-14 z-50 mt-1 animate-slide-down overflow-hidden rounded-lg border border-line bg-surface-raised shadow-lg',
                    'sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:w-96',
                  )}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
                    <p className="text-sm font-semibold">Notifications</p>
                    {unread ? <span className="text-xs text-secondary">{unread} unread</span> : null}
                  </div>

                  {notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-secondary">
                      Nothing yet. Replies to your requests and changes to your events appear here.
                    </p>
                  ) : (
                    <ul className="max-h-[min(24rem,60vh)] divide-y divide-line overflow-y-auto">
                      {notifications.map((n) => (
                        <li key={n.id}>
                          <NotificationRow n={n} onFollow={() => setNotifOpen(false)} />
                        </li>
                      ))}
                    </ul>
                  )}

                  <Link
                    href="/notifications"
                    onClick={() => setNotifOpen(false)}
                    className="flex min-h-11 items-center justify-center border-t border-line text-sm font-semibold text-brand-fg hover:bg-surface-sunken"
                  >
                    All notifications
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}

          {/*
            The account menu. Built here rather than on the kit's Menu,
            whose trigger is a `display: contents` button that browsers
            leave out of the tab order: a keyboard could not reach Sign out.
          */}
          <div ref={accountRef} className="relative">
            <button
              ref={accountButton}
              type="button"
              onClick={(e) => {
                const opening = !accountOpen;
                setAccountOpen(opening);
                // Opened from the keyboard (no pointer detail): put focus on
                // the first item, as a menu button should.
                if (opening && e.detail === 0) {
                  requestAnimationFrame(() =>
                    document.getElementById(accountMenuId)?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(),
                  );
                }
              }}
              aria-label={`Account menu, ${user.name}`}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              aria-controls={accountOpen ? accountMenuId : undefined}
              className={cn(
                'flex min-h-11 items-center gap-2 rounded-full border border-transparent p-1 text-left md:border-line md:bg-surface md:pr-3',
                'transition-[background-color,border-color,box-shadow] duration-fast ease-brand hover:bg-surface-sunken md:hover:border-line-strong md:hover:shadow-sm',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
              )}
            >
              <Avatar name={user.name} src={user.photoUrl} size="sm" />
              <span className="hidden leading-tight md:block">
                <span className="block max-w-52 truncate text-sm font-semibold">{user.name}</span>
                <span className="block max-w-52 truncate text-xs text-secondary">{user.identity}</span>
              </span>
              <ChevronDown className="hidden size-4 text-muted md:block" aria-hidden="true" />
            </button>

            {accountOpen ? (
              // The popover holds the name block and the menu; only the menu
              // carries role="menu", so every child of it is a menu item and
              // the theme choice is reachable with the arrow keys.
              <div
                onKeyDown={onAccountKeyDown}
                onClick={() => setAccountOpen(false)}
                className="absolute right-0 z-50 mt-1.5 w-64 animate-slide-down rounded-lg border border-line bg-surface-raised p-1 shadow-lg ring-hairline"
              >
                <div className="px-2.5 pb-2 pt-1.5">
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="truncate text-xs text-secondary">{user.identity}</p>
                </div>
                <MenuSeparator />
                <div id={accountMenuId} role="menu" aria-label="Account">
                <MenuItem href="/profile" icon={<User className="size-4" />}>
                  My profile
                </MenuItem>
                {links.preview ? (
                  <MenuItem href="/profile/preview" icon={<Eye className="size-4" />}>
                    What others see
                  </MenuItem>
                ) : null}
                {links.notifications ? (
                  <MenuItem href="/notifications" icon={<Bell className="size-4" />}>
                    <span className="flex-1">Notifications</span>
                    {unread ? (
                      <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-xs font-semibold text-brand-soft-fg tabular">
                        {unread}
                        <span className="sr-only"> unread</span>
                      </span>
                    ) : null}
                  </MenuItem>
                ) : null}
                <MenuItem href="/settings" icon={<Settings className="size-4" />}>
                  Settings
                </MenuItem>

                <MenuSeparator />
                <AppearanceItems />

                {links.console || links.portal || links.platform ? <MenuSeparator /> : null}
                {links.console ? (
                  <MenuItem href="/admin" icon={<Shield className="size-4" />}>
                    Staff console
                  </MenuItem>
                ) : null}
                {links.portal ? (
                  <MenuItem href="/dashboard" icon={<ArrowLeft className="size-4" />}>
                    Back to the portal
                  </MenuItem>
                ) : null}
                {links.platform ? (
                  <MenuItem href="/platform" icon={<Building2 className="size-4" />}>
                    Platform
                  </MenuItem>
                ) : null}

                <MenuSeparator />
                <MenuItem href="/logout" tone="danger" icon={<LogOut className="size-4" />}>
                  Sign out
                </MenuItem>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Sheet open={drawer} onClose={() => setDrawer(false)} title="Menu" side="left">
        <div className="band-surface grain relative isolate -mx-4 -mt-4 overflow-hidden px-4 pb-4 pt-3">
          <div className="aurora" aria-hidden="true" />
          <div className="relative z-[2]">
          <ShellIdentity
            href={brand.homeHref}
            label={brand.homeLabel}
            crest={brand.crestLarge}
            logo={brand.bandLogo}
            line2={brand.line2}
            tone={brand.tone}
            onNavigate={() => setDrawer(false)}
          />
          <div className="band-exit mt-3 flex items-center gap-3 rounded-lg bg-surface-raised p-3">
            <Avatar name={user.name} src={user.photoUrl} size="md" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold">{user.name}</span>
              <span className="mt-0.5 block truncate text-xs text-secondary">{user.identity}</span>
            </span>
          </div>
          </div>
        </div>

        <SidebarNav
          className="mt-5"
          groups={groups}
          badges={badges}
          onNavigate={() => setDrawer(false)}
        />

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-sm font-medium">Theme</span>
          <ThemeToggle size="lg" />
        </div>

        <div className="mt-4">{brand.poweredBy}</div>
      </Sheet>
    </header>
  );
}

/**
 * Close on an outside pointerdown and on Escape. The ref goes on a wrapper
 * that holds the trigger too, so the press that opened it does not close it.
 */
function useDismiss(open: boolean, onDismiss: () => void) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onDismiss]);

  return ref;
}

const ICON_BUTTON = cn(
  'relative grid size-11 shrink-0 place-items-center rounded text-secondary',
  'transition-colors duration-fast ease-brand hover:bg-surface-sunken hover:text-primary',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
);

/**
 * One notification. The row is the link when there is somewhere to go,
 * and the verb says what happens there. Unread rows carry a brand dot and
 * a bold title; the dot is never the only signal.
 */
function NotificationRow({ n, onFollow }: { n: ShellNotification; onFollow: () => void }) {
  const isUnread = !n.readAt;
  const verb = notificationAction(n);

  const body = (
    <>
      <span
        className={cn('mt-1.5 size-2 shrink-0 rounded-full', isUnread ? 'bg-brand-fg' : 'bg-transparent')}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 space-y-0.5">
        {isUnread ? <span className="sr-only">Unread. </span> : null}
        <span className={cn('block text-sm', isUnread ? 'font-semibold' : 'font-medium')}>{n.title}</span>
        {n.body ? <span className="block text-xs text-secondary">{n.body}</span> : null}
        <span className="flex items-center gap-2 pt-0.5 text-xs">
          <span className="text-secondary">{n.ago}</span>
          {verb && n.href ? (
            <>
              <span className="text-muted" aria-hidden="true">·</span>
              <span className="font-semibold text-brand-fg">{verb}</span>
            </>
          ) : null}
        </span>
      </span>
    </>
  );

  if (!n.href) {
    return <div className="flex gap-3 px-4 py-3">{body}</div>;
  }

  return (
    <Link href={n.href} onClick={onFollow} className="flex gap-3 px-4 py-3 hover:bg-surface-sunken">
      {body}
    </Link>
  );
}

type Theme = 'light' | 'dark' | 'system';

const THEMES: Array<{ value: Theme; label: string; icon: React.ReactNode }> = [
  { value: 'light', label: 'Light', icon: <Sun className="size-3.5" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="size-3.5" /> },
  { value: 'system', label: 'System', icon: <Monitor className="size-3.5" /> },
];

/**
 * The account menu's theme choice, as three `menuitemradio` items in a
 * labelled group. A radiogroup is not a valid child of a menu, and screen
 * readers in menu mode skip it; these are reached with the arrow keys like
 * every other item. Same storage and attribute as `ThemeToggle`.
 */
function AppearanceItems() {
  const [theme, setTheme] = React.useState<Theme>('system');

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem('theme');
      setTheme(stored === 'light' || stored === 'dark' ? stored : 'system');
    } catch {
      setTheme('system');
    }
  }, []);

  const apply = (next: Theme) => {
    setTheme(next);
    try {
      if (next === 'system') window.localStorage.removeItem('theme');
      else window.localStorage.setItem('theme', next);
    } catch {
      // Storage refused (a private window): the choice still applies now.
    }
    if (next === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <div role="group" aria-label="Appearance" className="px-2.5 pb-2 pt-1">
      {/* Hidden from the tree: the group's own label says it, and a menu
          may hold only items, groups and separators. */}
      <span aria-hidden="true" className="block pb-1.5 text-xs font-semibold uppercase tracking-wide text-secondary">
        Appearance
      </span>
      <div className="inline-flex rounded-full border border-line bg-surface-sunken p-0.5">
        {THEMES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="menuitemradio"
            aria-checked={theme === t.value}
            // Choosing a theme should not close the menu.
            onClick={(e) => {
              e.stopPropagation();
              apply(t.value);
            }}
            className={cn(
              'inline-flex h-11 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium lg:h-7',
              'transition-colors duration-fast ease-brand',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
              theme === t.value ? 'bg-surface-raised text-primary shadow-sm' : 'text-secondary hover:text-primary',
            )}
          >
            <span aria-hidden="true">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
