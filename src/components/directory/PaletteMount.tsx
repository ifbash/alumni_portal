'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Kbd } from '@/components/ui';
import type { NavGroup } from '@/lib/navigation';
import {
  CommandPalette,
  type PaletteBatch,
  type PaletteBranch,
  type PaletteDestination,
} from './CommandPalette';

/**
 * The client boundary for the command palette.
 *
 * It owns three things and nothing else: whether the palette is open, the
 * global Ctrl/⌘-K listener, and a visible way in for the majority of users
 * who will never guess a keyboard shortcut. Everything it offers was
 * computed on the server and handed down as props — this file imports no
 * session, no repository and no capability check, because a client
 * component that could ask "what may this person see" is a second
 * authorisation layer, and the second one is always the wrong one.
 *
 * `groups` arrives already filtered through the capability matrix by
 * `memberNav`/`adminNav`, so the presence of a destination in this list is
 * itself the permission decision. The pages behind them still guard
 * themselves; hiding a link is presentation, never authorisation.
 */
export function PaletteMount({
  groups,
  departments,
  batches,
}: {
  /** Navigation the server has already filtered for this viewer. */
  groups: NavGroup[];
  /** The college's departments — `getDepartments()`. */
  departments: PaletteBranch[];
  /** Members per graduating year, oldest first — `batchDistribution`. */
  batches: PaletteBatch[];
}) {
  const [open, setOpen] = React.useState(false);
  // Rendered as "Ctrl" until the client says otherwise, so the server
  // markup and the first client render agree.
  const [mac, setMac] = React.useState(false);

  React.useEffect(() => {
    setMac(/Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.defaultPrevented) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== 'k') return;
      // Firefox gives Ctrl+K to the address bar; without this the palette
      // opens behind a focused URL field.
      e.preventDefault();
      setOpen((v) => !v);
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const destinations = React.useMemo<PaletteDestination[]>(
    () =>
      groups.flatMap((group) =>
        group.items.map((item) => ({
          label: item.label,
          href: item.href,
          icon: item.icon,
          group: group.label,
          description: item.description,
        })),
      ),
    [groups],
  );

  // The directory nav item exists only for a viewer who holds
  // `directory.search.alumni` on a tenant with the feature switched on —
  // so its presence is the gate for jump-to-batch and jump-to-branch.
  const directoryEnabled = destinations.some((d) => d.href === '/directory');

  // Newest batches first: "my batch" is nearly always a recent one, and
  // the resting list only has room for a handful.
  const recentBatches = React.useMemo(
    () => [...batches].sort((a, b) => b.label.localeCompare(a.label)),
    [batches],
  );

  if (destinations.length === 0) return null;

  return (
    <>
      {/* The keyboard shortcut needs somewhere to be discovered, and a
          phone has no Ctrl key at all — so the hint is also the button.
          The dialog renders in the browser's top layer, which covers this
          without any z-index arithmetic. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Control+K Meta+K"
        aria-haspopup="dialog"
        className={cn(
          'fixed bottom-4 right-4 z-30 inline-flex h-control items-center gap-2 rounded-full',
          'border border-line bg-surface-raised px-4 text-sm font-medium text-secondary shadow-lg',
          'transition-colors duration-fast ease-brand hover:border-line-strong hover:text-primary',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
        )}
      >
        <Search className="size-4" aria-hidden="true" />
        <span>Jump to</span>
        <span className="hidden items-center gap-1 sm:inline-flex" aria-hidden="true">
          <Kbd>{mac ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <CommandPalette
        open={open}
        onClose={() => setOpen(false)}
        destinations={destinations}
        branches={departments}
        batches={recentBatches}
        directoryEnabled={directoryEnabled}
      />
    </>
  );
}
