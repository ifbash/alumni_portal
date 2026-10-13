'use client';

import * as React from 'react';
import { Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * The check-in code.
 *
 * A short string a volunteer can read out and type into the desk's search,
 * which matches it (`CheckInPanel` derives the same code from the same
 * registration id). There is no scannable pattern: nothing at the desk
 * scans, and a pass that looks scannable sends volunteers hunting for a
 * scanner. The holder's name leads the pass, because that is what the desk
 * finds people by first.
 *
 * Derived from the registration id alone, with no clock and no randomness.
 * The same registration renders the same code on every device and reload,
 * and the server and browser renders agree.
 */

/** 32 symbols. I, O, 0 and 1 are absent: they are the pairs people mistype. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** FNV-1a over the id, then xorshift32 — a few lines, and enough spread. */
function stream(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }

  let x = h >>> 0 || 0x9e3779b9;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x;
  };
}

/** "KP4-M9T-BXR" — nine characters, grouped so it can be read aloud. */
export function checkInCode(registrationId: string): string {
  const next = stream(registrationId);
  const chars = Array.from({ length: 9 }, () => ALPHABET[next() % ALPHABET.length] ?? 'A');
  return `${chars.slice(0, 3).join('')}-${chars.slice(3, 6).join('')}-${chars.slice(6).join('')}`;
}

/** The code on the pass, set so it can be read across a table. */
export function TicketCode({ registrationId }: { registrationId: string }) {
  const code = checkInCode(registrationId);

  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Check-in code</p>
      <p className="whitespace-nowrap font-mono text-xl font-bold tracking-wider">{code}</p>
    </div>
  );
}

/**
 * "Show at desk": the pass, full screen, with the code as large as the
 * phone allows. A native modal `<dialog>`, so focus, Escape and the inert
 * background come from the platform. While it is open the screen is asked
 * to stay awake, where the browser supports that; a phone that dims in the
 * queue is the usual reason a code cannot be read.
 */
export function ShowAtDesk({
  registrationId,
  holderName,
  holderLine,
  eventTitle,
  guests,
  brand,
  className,
}: {
  registrationId: string;
  holderName: string;
  /** "CSE · Batch of 2017", or null when there is nothing to add. */
  holderLine?: string | null;
  eventTitle: string;
  guests: number;
  /** The college's wordmark, rendered on the server, for the band strip at the top. */
  brand?: React.ReactNode;
  className?: string;
}) {
  const code = checkInCode(registrationId);
  const [open, setOpen] = React.useState(false);
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const triggerRef = React.useRef<HTMLSpanElement>(null);
  const headingId = React.useId();

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) {
      el.close();
      triggerRef.current?.querySelector('button')?.focus();
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    type Lock = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<Lock> } };
    let lock: Lock | null = null;
    let cancelled = false;
    nav.wakeLock
      ?.request('screen')
      .then((l) => {
        if (cancelled) void l.release().catch(() => {});
        else lock = l;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      void lock?.release().catch(() => {});
    };
  }, [open]);

  return (
    <>
      <span ref={triggerRef} className="contents">
        <Button onClick={() => setOpen(true)} className={cn('min-h-11', className)}>
          <Maximize2 className="size-4 shrink-0" aria-hidden="true" />
          Show at desk
        </Button>
      </span>

      <dialog
        ref={dialogRef}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
        aria-labelledby={headingId}
        className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-surface-raised p-0 text-primary backdrop:bg-[var(--overlay)]"
      >
        {open ? (
          <div className="flex min-h-full flex-col">
            <div className="band-surface flex min-h-14 items-center justify-between gap-3 px-4 py-2.5">
              <span className="min-w-0">{brand}</span>
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-band-accent">Event pass</span>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10 text-center">
              <div className="space-y-2">
                <h2 id={headingId} className="font-display text-display-sm font-bold">
                  {holderName}
                </h2>
                <p className="text-lg text-secondary">
                  {[holderLine, guests > 0 ? `+ ${guests} guest${guests === 1 ? '' : 's'}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p className="text-sm text-secondary">{eventTitle}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold uppercase tracking-wider text-secondary">Check-in code</p>
                <p className="whitespace-nowrap font-mono text-display-sm font-bold tracking-wider">{code}</p>
              </div>
              <Button variant="secondary" onClick={() => setOpen(false)} className="min-h-11 min-w-40" autoFocus>
                Done
              </Button>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
