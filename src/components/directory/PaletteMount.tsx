'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import type { NavGroup } from '@/lib/navigation';
import {
  CommandPalette,
  type PaletteBatch,
  type PaletteBranch,
  type PaletteDestination,
  type PaletteEvent,
  type PaletteViewer,
} from './CommandPalette';

/** Dispatched by the top bar's search trigger; opens the palette. */
export const OPEN_PALETTE_EVENT = 'alumni:open-palette';

/** Recently visited palette destinations, newest first. Per browser. */
const RECENT_KEY = 'alumni:palette-recent';
/** One more than the palette shows, so the page you are on can drop out. */
const RECENT_STORED = 6;

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((h): h is string => typeof h === 'string') : [];
  } catch {
    // Private windows, blocked storage, a hand-edited value: start empty.
    return [];
  }
}

function writeRecent(list: string[]): void {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Storage refused. The palette still works; it just forgets.
  }
}

/**
 * The client boundary for the command palette.
 *
 * It owns three things and nothing else: whether the palette is open, the
 * ways in (Ctrl/⌘-K and the top bar's search trigger), and the short list
 * of recently visited places. Everything it offers was computed on the
 * server and handed down as props — this file imports no session, no
 * repository and no capability check, because a client component that
 * could ask "what may this person see" is a second authorisation layer,
 * and the second one is always the wrong one.
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
  viewer,
  nextEvent = null,
}: {
  /** Navigation the server has already filtered for this viewer. */
  groups: NavGroup[];
  /** The college's departments — `getDepartments()`. */
  departments: PaletteBranch[];
  /** Members per graduating year, oldest first — `batchDistribution`. */
  batches: PaletteBatch[];
  /** "Your batch" and "Your branch": `viewerBatchYear()` and `viewerBranch()`. */
  viewer: PaletteViewer;
  /** The next event this viewer may register for, formatted on the server. */
  nextEvent?: PaletteEvent | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [recent, setRecent] = React.useState<string[]>([]);

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
    const onOpen = () => setOpen(true);

    document.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
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
  // so its presence is the gate for people, batches and branches.
  const directoryEnabled = destinations.some((d) => d.href === '/directory');

  // Newest batches first: "my batch" is nearly always a recent one, and
  // the resting list only has room for a handful.
  const recentBatches = React.useMemo(
    () => [...batches].sort((a, b) => b.label.localeCompare(a.label)),
    [batches],
  );

  // Every address the palette itself could offer. Only these are
  // remembered, and only these are shown back: a stored href that is not
  // in today's props (a role removed, a feature switched off) is dropped.
  const known = React.useMemo(() => {
    const set = new Set(destinations.map((d) => d.href));
    if (directoryEnabled) {
      for (const b of batches) set.add(`/directory/batch/${b.label}`);
      for (const d of departments) set.add(`/directory/branch/${d.code}`);
    }
    return set;
  }, [destinations, directoryEnabled, batches, departments]);

  // Remember the page when it is one the palette knows. Runs after
  // hydration only, so the server and first client render agree.
  React.useEffect(() => {
    const stored = readRecent().filter((h) => known.has(h));
    const next = known.has(pathname) ? [pathname, ...stored.filter((h) => h !== pathname)] : stored;
    const trimmed = next.slice(0, RECENT_STORED);
    if (known.has(pathname)) writeRecent(trimmed);
    setRecent(trimmed);
  }, [pathname, known]);

  if (destinations.length === 0) return null;

  return (
    <CommandPalette
      open={open}
      onClose={() => setOpen(false)}
      destinations={destinations}
      branches={departments}
      batches={recentBatches}
      directoryEnabled={directoryEnabled}
      viewer={viewer}
      nextEvent={nextEvent}
      recent={recent.filter((h) => h !== pathname)}
    />
  );
}
