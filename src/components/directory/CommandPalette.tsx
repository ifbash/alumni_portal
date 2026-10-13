'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, CornerDownLeft, GraduationCap, History, Search, Users, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Kbd } from '@/components/ui';
import { NavIcon } from '@/components/shell/Icon';
import type { IconName } from '@/lib/navigation';

/**
 * Ctrl/⌘-K: the portal's one search.
 *
 * Built on the native `<dialog>` element, the same way `ui/overlay.tsx`
 * builds `Dialog` and `Sheet`, and for the same reason: `showModal()`
 * gives focus trapping, Escape-to-close, `inert` on the background and
 * correct screen-reader semantics for free, and a hand-rolled
 * div-with-a-backdrop gets all four wrong in four different ways. There is
 * one dialog pattern in this codebase, not two.
 *
 * Everything it can offer arrives as props. The *server* decides what a
 * viewer may jump to — the navigation list handed in here has already been
 * filtered through the capability matrix — and this component only sorts
 * and displays it. A palette that filtered by role on the client would be
 * a capability matrix maintained twice, and the second copy is always the
 * wrong one.
 *
 * At rest it offers the viewer's own places first (their batch, their
 * branch, the next event), then where they have been, then every page and
 * the newest batches. Typing puts "Search people for …" first, because
 * the palette knows pages and the directory knows people.
 */

export interface PaletteDestination {
  label: string;
  href: string;
  icon: IconName;
  /** The nav group the item came from — shown as the row's context. */
  group: string;
  description?: string;
}

export interface PaletteBranch {
  code: string;
  name: string;
}

export interface PaletteBatch {
  /** Year as it appears in the URL. */
  label: string;
  /** How many members that batch has. */
  value: number;
}

export interface PaletteViewer {
  /** `viewerBatchYear()`: null for anyone without the alumni role. */
  batchYear: number | null;
  /** `viewerBranch()`: the viewer's own branch or department code. */
  departmentCode: string | null;
}

export interface PaletteEvent {
  title: string;
  slug: string;
  startsAt: string;
  /** "Sat, 24 Oct", in the college's time zone. */
  when: string;
}

interface Choice {
  id: string;
  section: string;
  label: string;
  hint?: string;
  href: string;
  icon: React.ReactNode;
}

const RESTING_BATCHES = 4;
const RECENT_SHOWN = 5;
const MATCHED_PER_SECTION = 5;

/** Same window the directory's batch filter accepts. */
const MIN_YEAR = 1950;
const MAX_YEAR = 2100;

/**
 * Subsequence match with a score, not a substring test.
 *
 * People type "req" for Requests and "cse17" for nothing at all, so the
 * scorer rewards a prefix hit hardest, then a substring, then letters
 * found in order — with a bonus for consecutive runs, which is what makes
 * "csci" pick Computer Science over a company called Cisco. Returns null
 * when the letters are not there at all.
 */
function score(query: string, target: string): number | null {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  const at = t.indexOf(q);
  if (at === 0) return 1000;
  if (at > 0) return 800 - Math.min(at, 100);

  let cursor = 0;
  let total = 0;
  let streak = 0;

  for (const ch of q) {
    if (ch === ' ') continue;
    const next = t.indexOf(ch, cursor);
    if (next === -1) return null;
    streak = next === cursor ? streak + 1 : 0;
    total += 12 + streak * 6 - Math.min(next - cursor, 12);
    cursor = next + 1;
  }

  return total;
}

function rank<T>(items: T[], query: string, haystack: (item: T) => string, limit: number): T[] {
  if (!query) return items.slice(0, limit);
  return items
    .map((item) => ({ item, s: score(query, haystack(item)) }))
    .filter((r): r is { item: T; s: number } => r.s !== null)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((r) => r.item);
}

export function CommandPalette({
  open,
  onClose,
  destinations,
  branches,
  batches,
  directoryEnabled,
  viewer,
  nextEvent,
  recent,
}: {
  open: boolean;
  onClose: () => void;
  destinations: PaletteDestination[];
  branches: PaletteBranch[];
  batches: PaletteBatch[];
  /** False when the viewer has no directory surface at all. */
  directoryEnabled: boolean;
  viewer: PaletteViewer;
  nextEvent: PaletteEvent | null;
  /** Recently visited hrefs, newest first, already limited to known places. */
  recent: string[];
}) {
  const router = useRouter();
  const ref = React.useRef<HTMLDialogElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  /**
   * Where focus was before the palette opened. The dialog spec restores it
   * on close in current browsers, but the palette usually closes *into a
   * navigation*, and restoring it explicitly is the difference between
   * landing on the new page's first heading and landing nowhere.
   */
  const restoreTo = React.useRef<HTMLElement | null>(null);

  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);

  const id = React.useId();
  const listId = `${id}-list`;

  const results = React.useMemo(
    () =>
      buildResults({
        raw: query,
        destinations,
        branches,
        batches,
        directoryEnabled,
        viewer,
        nextEvent,
        recent,
      }),
    [query, destinations, branches, batches, directoryEnabled, viewer, nextEvent, recent],
  );

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open && !el.open) {
      restoreTo.current = document.activeElement as HTMLElement | null;
      el.showModal();
      inputRef.current?.focus();
    }

    if (!open && el.open) {
      el.close();
      // A detached node is a no-op, which is exactly right after a
      // navigation has replaced the trigger.
      restoreTo.current?.focus?.();
      restoreTo.current = null;
    }
  }, [open]);

  // Every opening starts from nothing typed. A palette that remembers the
  // last query is a palette whose first keystroke edits someone else's
  // search.
  React.useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  React.useEffect(() => {
    setActive(0);
  }, [query]);

  // Keep the highlighted row on screen when the arrows walk past the fold.
  React.useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, results.length]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(results.length - 1);
    }
  };

  const placeholder = directoryEnabled
    ? 'Search people, batches, branches or pages'
    : 'Search pages';

  let lastSection: string | null = null;

  return (
    <dialog
      ref={ref}
      aria-label="Search"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={() => open && onClose()}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'mb-auto mt-[8vh] w-[calc(100vw-1rem)] max-w-xl rounded-lg border border-line sm:mt-[12vh] sm:w-[calc(100vw-2rem)]',
        'bg-surface-raised p-0 text-primary shadow-lg',
        'backdrop:bg-[var(--overlay)] open:animate-scale-in',
      )}
    >
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const choice = results[active];
          if (choice) go(choice.href);
        }}
      >
        <label htmlFor={`${id}-input`} className="sr-only">
          {placeholder}
        </label>

        <div className="flex items-center gap-3 border-b border-line px-4 sm:pr-3">
          <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
          <input
            id={`${id}-input`}
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results[active] ? `${id}-opt-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="h-14 min-w-0 flex-1 bg-transparent text-base placeholder:text-muted focus:outline-none sm:text-md"
          />
          <button
            type="button"
            onClick={onClose}
            className="hidden shrink-0 rounded sm:block"
            aria-label="Close search"
          >
            <Kbd>Esc</Kbd>
          </button>
        </div>
      </form>

      {results.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-medium">Nothing matches “{query.trim()}”.</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-secondary">
            Try the name of a page{directoryEnabled ? ', a batch year or a branch code' : ''}.
          </p>
        </div>
      ) : (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Results"
          className="max-h-[60vh] overflow-y-auto p-1.5 sm:max-h-[55vh]"
        >
          {results.map((choice, i) => {
            const header = choice.section !== lastSection ? choice.section : null;
            lastSection = choice.section;

            return (
              <React.Fragment key={choice.id}>
                {header ? (
                  <li
                    role="presentation"
                    className="px-2.5 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-secondary first:pt-1.5"
                  >
                    {header}
                  </li>
                ) : null}

                <li role="presentation">
                  {/* A real anchor, so middle-click and ⌘-click still open a
                      tab; `role="option"` so the listbox announces correctly.
                      Plain clicks are intercepted for a client transition. */}
                  <a
                    href={choice.href}
                    id={`${id}-opt-${i}`}
                    role="option"
                    aria-selected={i === active}
                    data-index={i}
                    onMouseMove={() => setActive(i)}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                      e.preventDefault();
                      go(choice.href);
                    }}
                    className={cn(
                      'flex min-h-11 items-center gap-3 rounded px-2.5 py-2 text-sm no-underline',
                      'transition-colors duration-fast ease-brand',
                      i === active ? 'bg-brand-soft text-brand-soft-fg' : 'text-primary',
                    )}
                  >
                    <span className={cn('shrink-0', i === active ? '' : 'text-muted')} aria-hidden="true">
                      {choice.icon}
                    </span>
                    {/* Wraps on phones rather than cutting a branch or event name short. */}
                    <span className="min-w-0 flex-1 font-medium sm:truncate">{choice.label}</span>
                    {choice.hint ? (
                      <span
                        className={cn(
                          'shrink-0 whitespace-nowrap text-xs',
                          i === active ? 'text-brand-soft-fg' : 'text-secondary',
                        )}
                      >
                        {choice.hint}
                      </span>
                    ) : null}
                    {i === active ? (
                      <CornerDownLeft className="hidden size-3.5 shrink-0 sm:block" aria-hidden="true" />
                    ) : null}
                  </a>
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      )}

      {/* Phones have no Escape key: an explicit way out, where the key hints sit on a desk. */}
      <button
        type="button"
        onClick={onClose}
        className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-line bg-surface text-sm font-medium text-secondary hover:text-primary sm:hidden"
      >
        <X className="size-4" aria-hidden="true" />
        Close
      </button>

      <div className="hidden flex-wrap items-center gap-x-4 gap-y-2 border-t border-line bg-surface px-4 py-2.5 text-xs text-secondary sm:flex">
        <span className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          to move
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>↵</Kbd>
          to open
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>Esc</Kbd>
          to close
        </span>
      </div>

      <p className="sr-only" aria-live="polite">
        {results.length === 0
          ? 'No matches'
          : `${results.length} ${results.length === 1 ? 'result' : 'results'}`}
      </p>
    </dialog>
  );
}

// ---------------------------------------------------------------

function batchHref(year: string | number): string {
  return `/directory/batch/${year}`;
}

function branchHref(code: string): string {
  return `/directory/branch/${code}`;
}

function buildResults({
  raw,
  destinations,
  branches,
  batches,
  directoryEnabled,
  viewer,
  nextEvent,
  recent,
}: {
  raw: string;
  destinations: PaletteDestination[];
  branches: PaletteBranch[];
  batches: PaletteBatch[];
  directoryEnabled: boolean;
  viewer: PaletteViewer;
  nextEvent: PaletteEvent | null;
  recent: string[];
}): Choice[] {
  const query = raw.trim();
  const out: Choice[] = [];

  const pageRow = (d: PaletteDestination, section: string): Choice => ({
    id: `${section}:${d.href}`,
    section,
    label: d.label,
    hint: d.group,
    href: d.href,
    icon: <NavIcon name={d.icon} className="size-4" />,
  });

  const batchRow = (b: PaletteBatch, section: string): Choice => ({
    id: `${section}:batch:${b.label}`,
    section,
    label: `Batch of ${b.label}`,
    hint: `${b.value.toLocaleString('en-IN')} on the portal`,
    href: batchHref(b.label),
    icon: <GraduationCap className="size-4" />,
  });

  const branchRow = (b: PaletteBranch, section: string): Choice => ({
    id: `${section}:branch:${b.code}`,
    section,
    label: b.name,
    hint: b.code,
    href: branchHref(b.code),
    icon: <Users className="size-4" />,
  });

  // ---- Resting: the viewer's own places, then where they have been ----
  if (!query) {
    const shown = new Set<string>();

    if (directoryEnabled && viewer.batchYear) {
      const count = batches.find((b) => b.label === String(viewer.batchYear))?.value;
      const href = batchHref(viewer.batchYear);
      shown.add(href);
      out.push({
        id: 'mine:batch',
        section: 'For you',
        label: `Your batch — ${viewer.batchYear}`,
        hint: count ? `${count.toLocaleString('en-IN')} here` : undefined,
        href,
        icon: <GraduationCap className="size-4" />,
      });
    }

    if (directoryEnabled && viewer.departmentCode) {
      const branch = branches.find((b) => b.code === viewer.departmentCode);
      if (branch) {
        const href = branchHref(branch.code);
        shown.add(href);
        out.push({
          id: 'mine:branch',
          section: 'For you',
          label: `Your branch — ${branch.name}`,
          href,
          icon: <Users className="size-4" />,
        });
      }
    }

    if (nextEvent) {
      const href = `/events/${nextEvent.slug}`;
      shown.add(href);
      out.push({
        id: 'mine:event',
        section: 'For you',
        label: `Next event — ${nextEvent.title}`,
        hint: nextEvent.when,
        href,
        icon: <Calendar className="size-4" />,
      });
    }

    let recentCount = 0;
    for (const href of recent) {
      if (recentCount >= RECENT_SHOWN || shown.has(href)) continue;
      const d = destinations.find((x) => x.href === href);
      const b = directoryEnabled ? batches.find((x) => batchHref(x.label) === href) : undefined;
      const r = directoryEnabled ? branches.find((x) => branchHref(x.code) === href) : undefined;
      const row = d
        ? pageRow(d, 'Recently visited')
        : b
          ? batchRow(b, 'Recently visited')
          : r
            ? branchRow(r, 'Recently visited')
            : null;
      if (!row) continue;
      out.push({ ...row, hint: d ? undefined : row.hint, icon: <History className="size-4" /> });
      recentCount += 1;
    }

    // The section already says what these are; the nav group beside every
    // row would only repeat it.
    for (const d of destinations) out.push({ ...pageRow(d, 'Pages'), hint: undefined });

    if (directoryEnabled) {
      for (const b of batches.slice(0, RESTING_BATCHES)) out.push(batchRow(b, 'Batches'));
    }

    return out;
  }

  // ---- Typing: people first, then pages, batches and branches ----
  if (directoryEnabled) {
    out.push({
      id: 'search',
      section: 'People',
      label: `Search people for “${query}”`,
      href: `/directory?q=${encodeURIComponent(query)}`,
      icon: <Search className="size-4" />,
    });
  }

  for (const d of rank(
    destinations,
    query,
    // Label and description only: the group name and the href matched
    // almost any three letters, so "cse" offered Settings.
    (d) => `${d.label} ${d.description ?? ''}`,
    MATCHED_PER_SECTION,
  )) {
    out.push(pageRow(d, 'Pages'));
  }

  if (directoryEnabled) {
    const known = rank(batches, query, (b) => `batch of ${b.label} ${b.label}`, MATCHED_PER_SECTION);
    for (const b of known) out.push(batchRow(b, 'Batches'));

    // A year with nobody counted yet is still a real address — the batch
    // page says so plainly, which beats the palette pretending the year
    // does not exist. Final-year batches are the usual case.
    const typed = /^\d{4}$/.exec(query)?.[0];
    const typedYear = typed ? Number(typed) : null;
    if (
      typed &&
      typedYear !== null &&
      typedYear >= MIN_YEAR &&
      typedYear <= MAX_YEAR &&
      !known.some((b) => b.label === typed)
    ) {
      out.push({
        id: `Batches:batch:${typed}`,
        section: 'Batches',
        label: `Batch of ${typed}`,
        href: batchHref(typed),
        icon: <GraduationCap className="size-4" />,
      });
    }

    for (const b of rank(
      branches,
      query,
      (b) => `${b.code} ${b.name} branch department`,
      MATCHED_PER_SECTION,
    )) {
      out.push(branchRow(b, 'Branches'));
    }
  }

  return out;
}
