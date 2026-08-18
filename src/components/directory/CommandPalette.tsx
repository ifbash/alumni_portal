'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, GraduationCap, Search, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Kbd } from '@/components/ui';
import { NavIcon } from '@/components/shell/Icon';
import type { IconName } from '@/lib/navigation';

/**
 * Ctrl/⌘-K.
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

interface Choice {
  id: string;
  section: string;
  label: string;
  hint?: string;
  href: string;
  icon: React.ReactNode;
}

const RESTING_BATCHES = 4;
const RESTING_BRANCHES = 4;
const MATCHED_PER_SECTION = 5;

/** Same window the directory's batch filter accepts. */
const MIN_YEAR = 1950;
const MAX_YEAR = 2100;

/**
 * Subsequence match with a score, not a substring test.
 *
 * People type "conn" for Connections and "cse17" for nothing at all, so
 * the scorer rewards a prefix hit hardest, then a substring, then letters
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
}: {
  open: boolean;
  onClose: () => void;
  destinations: PaletteDestination[];
  branches: PaletteBranch[];
  batches: PaletteBatch[];
  /** False when the viewer has no directory surface at all. */
  directoryEnabled: boolean;
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
    () => buildResults(query, destinations, branches, batches, directoryEnabled),
    [query, destinations, branches, batches, directoryEnabled],
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

  let lastSection: string | null = null;

  return (
    <dialog
      ref={ref}
      aria-label="Command palette"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={() => open && onClose()}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'mb-auto mt-[10vh] w-[calc(100vw-2rem)] max-w-xl rounded-lg border border-line',
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
          Search the portal — pages, batches and branches
        </label>

        <div className="flex items-center gap-3 border-b border-line px-4">
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to a page, a batch year, or a branch code"
            className="h-control-lg w-full bg-transparent text-md placeholder:text-muted focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="hidden shrink-0 sm:block"
            aria-label="Close the command palette"
          >
            <Kbd>Esc</Kbd>
          </button>
        </div>
      </form>

      {results.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-medium">Nothing here matches “{query}”</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-secondary">
            This box jumps to pages, to a graduating year, and to a branch code. To look for a
            person, search the directory instead.
          </p>
        </div>
      ) : (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Results"
          className="max-h-[55vh] overflow-y-auto p-1.5"
        >
          {results.map((choice, i) => {
            const header = choice.section !== lastSection ? choice.section : null;
            lastSection = choice.section;

            return (
              <React.Fragment key={choice.id}>
                {header ? (
                  <li
                    role="presentation"
                    className="px-2.5 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted first:pt-1"
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
                      'flex items-center gap-3 rounded px-2.5 py-2 text-sm no-underline',
                      'transition-colors duration-fast ease-brand',
                      i === active ? 'bg-brand-soft text-brand-soft-fg' : 'text-primary',
                    )}
                  >
                    <span className="shrink-0 text-muted" aria-hidden="true">
                      {choice.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{choice.label}</span>
                    {choice.hint ? (
                      <span className="shrink-0 text-xs text-muted">{choice.hint}</span>
                    ) : null}
                    {i === active ? (
                      <CornerDownLeft className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                    ) : null}
                  </a>
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line bg-surface px-4 py-2.5 text-xs text-muted">
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

function buildResults(
  raw: string,
  destinations: PaletteDestination[],
  branches: PaletteBranch[],
  batches: PaletteBatch[],
  directoryEnabled: boolean,
): Choice[] {
  const query = raw.trim();
  const limit = query ? MATCHED_PER_SECTION : Number.MAX_SAFE_INTEGER;
  const out: Choice[] = [];

  for (const d of rank(
    destinations,
    query,
    (d) => `${d.label} ${d.group} ${d.description ?? ''} ${d.href}`,
    limit,
  )) {
    out.push({
      id: `nav:${d.href}`,
      section: 'Go to',
      label: d.label,
      hint: d.group,
      href: d.href,
      icon: <NavIcon name={d.icon} className="size-4" />,
    });
  }

  if (directoryEnabled) {
    const known = rank(
      batches,
      query,
      (b) => `batch of ${b.label} ${b.label}`,
      query ? MATCHED_PER_SECTION : RESTING_BATCHES,
    );

    for (const b of known) {
      out.push({
        id: `batch:${b.label}`,
        section: 'Jump to a batch',
        label: `Batch of ${b.label}`,
        hint: `${b.value.toLocaleString('en-IN')} on the portal`,
        href: `/directory/batch/${b.label}`,
        icon: <GraduationCap className="size-4" />,
      });
    }

    // A year nobody has claimed yet is still a real address — the page says
    // so honestly, which beats the palette pretending the year does not
    // exist. Final-year batches are the usual case: they are in the portal
    // but not in the alumni batch counts.
    const typed = /^\d{4}$/.exec(query)?.[0];
    const typedYear = typed ? Number(typed) : null;
    if (
      typedYear !== null &&
      typedYear >= MIN_YEAR &&
      typedYear <= MAX_YEAR &&
      !known.some((b) => b.label === typed)
    ) {
      out.push({
        id: `batch:${typed}`,
        section: 'Jump to a batch',
        label: `Batch of ${typed}`,
        hint: 'not counted yet',
        href: `/directory/batch/${typed}`,
        icon: <GraduationCap className="size-4" />,
      });
    }

    for (const b of rank(
      branches,
      query,
      (b) => `${b.code} ${b.name} branch department`,
      query ? MATCHED_PER_SECTION : RESTING_BRANCHES,
    )) {
      out.push({
        id: `branch:${b.code}`,
        section: 'Jump to a branch',
        label: b.name,
        hint: b.code,
        href: `/directory/branch/${b.code}`,
        icon: <Users className="size-4" />,
      });
    }

    // Always last, and always offered: the palette knows pages, not people,
    // and the one thing it cannot answer is "who is Sravani from ECE".
    if (query) {
      out.push({
        id: 'search',
        section: 'Search',
        label: `Search the directory for “${query}”`,
        href: `/directory?q=${encodeURIComponent(query)}`,
        icon: <Search className="size-4" />,
      });
    }
  }

  return out;
}
