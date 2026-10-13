'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpDown, Check, Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button, Input, Sheet, Spinner } from '@/components/ui';
import { buildDirectoryHref, type DirectoryParams } from './query';

/**
 * The directory's client leaves: the search box, the sort menu and the
 * phone filter sheet. Everything else on the page is server-rendered.
 */

/**
 * The search box.
 *
 * Typing rewrites the URL rather than holding a value in state, so the
 * address bar is always the truth and the result on screen is always
 * shareable. `router.replace` rather than `push`: a debounced `push`
 * writes one history entry per keystroke pause and turns the back button
 * into a re-typing simulator.
 *
 * The debounce is 350ms, which is roughly the gap between words on a
 * phone keyboard. Shorter and every partial word fires a navigation on a
 * connection that may be 3G in a hostel.
 */
export function SearchBar({
  params,
  placeholder = 'Name, company or skill',
  autoFocus = false,
}: {
  params: DirectoryParams;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(params.q ?? '');
  const [pending, startTransition] = React.useTransition();
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // The URL can change underneath us — a filter chip removed, the back
  // button, a link pasted into the tab. The box follows the URL.
  React.useEffect(() => {
    setValue(params.q ?? '');
  }, [params.q]);

  const navigate = React.useCallback(
    (next: string) => {
      startTransition(() => {
        router.replace(buildDirectoryHref(params, { q: next.trim() || null }), { scroll: false });
      });
    },
    [params, router],
  );

  const schedule = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => navigate(next), 350);
  };

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const submitNow = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    navigate(next);
  };

  return (
    <form
      role="search"
      // Enter should not wait out the debounce, and it must not reload.
      onSubmit={(e) => {
        e.preventDefault();
        submitNow(value);
      }}
    >
      <label htmlFor="directory-search" className="sr-only">
        Search the directory
      </label>

      <Input
        id="directory-search"
        name="q"
        type="search"
        inputMode="search"
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        sizeVariant="lg"
        leading={<Search className="size-4" />}
        trailing={
          pending ? (
            <Spinner className="size-4 text-muted" />
          ) : value ? (
            <button
              type="button"
              aria-label="Clear the search"
              onClick={() => {
                setValue('');
                submitNow('');
              }}
              className="grid size-8 place-items-center rounded-full text-muted transition-colors duration-fast ease-brand hover:bg-surface-sunken hover:text-primary"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null
        }
        onChange={(e) => {
          setValue(e.target.value);
          schedule(e.target.value);
        }}
      />

      <p className="sr-only" aria-live="polite">
        {pending ? 'Updating results' : ''}
      </p>
    </form>
  );
}

/** Close on an outside pointerdown and on Escape, returning focus to the trigger. */
function useDismiss(open: boolean, close: () => void) {
  const root = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        root.current?.querySelector<HTMLButtonElement>('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return root;
}

/**
 * The sort order, as a button that opens a short list of links.
 *
 * Links, because a sort is a URL like every other directory state. Not
 * the kit `Menu`: its trigger is a `display: contents` button that
 * browsers leave out of the tab order. This is the disclosure pattern — a
 * real button with `aria-expanded`, and ordinary links inside.
 */
export function SortMenu({
  id,
  items,
  placement = 'below',
  className,
}: {
  /** The list's id. Fixed rather than `useId`, so it cannot drift between server and client. */
  id: string;
  items: Array<{ label: string; href: string; active: boolean }>;
  /** `above` when the trigger sits in a bar pinned to the bottom of the screen. */
  placement?: 'below' | 'above';
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const root = useDismiss(open, close);
  const current = items.find((i) => i.active) ?? items[0];

  // Also close when the order changes some other way (back, forward).
  const signature = items.map((i) => i.href).join('|');
  React.useEffect(() => {
    setOpen(false);
  }, [signature]);

  return (
    <div ref={root} className={cn('relative', className)}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="min-h-11 w-full lg:min-h-0 lg:w-auto"
      >
        <ArrowUpDown className="size-4 text-muted" aria-hidden="true" />
        <span className="sr-only">Sort: </span>
        {current?.label}
      </Button>

      {open ? (
        <ul
          id={id}
          className={cn(
            'absolute right-0 z-40 min-w-48 rounded-lg border border-line bg-surface-raised p-1 shadow-lg',
            placement === 'above' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          )}
        >
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                scroll={false}
                aria-current={item.active ? 'true' : undefined}
                onClick={close}
                className={cn(
                  'flex min-h-11 items-center justify-between gap-3 rounded px-2.5 text-sm transition-colors duration-fast ease-brand hover:bg-surface-sunken lg:min-h-9',
                  item.active ? 'font-semibold text-primary' : 'text-secondary',
                )}
              >
                {item.label}
                {item.active ? <Check className="size-4 text-brand-fg" aria-hidden="true" /> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * "Filters (n)" on a phone: opens the same server-rendered panel in a
 * sheet. Choosing anything in it is a navigation, so the sheet closes on
 * the way out rather than sitting over the new results.
 */
export function FiltersSheet({
  count,
  children,
  className,
}: {
  count: number;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn('min-h-11 w-full', className)}
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        Filters
        {count > 0 ? <span className="tabular">({count})</span> : null}
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Filters" side="right">
        <div
          onClickCapture={(e) => {
            if ((e.target as HTMLElement).closest('a[href]')) setOpen(false);
          }}
        >
          {children}
        </div>
      </Sheet>
    </>
  );
}
