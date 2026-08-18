'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input, Spinner } from '@/components/ui';
import { buildDirectoryHref, type DirectoryParams } from './query';

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
  placeholder = 'Search by name, company, city or skill',
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
              className="grid size-6 place-items-center rounded-full text-muted transition-colors duration-fast ease-brand hover:bg-surface-sunken hover:text-primary"
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
