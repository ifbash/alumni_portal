'use client';

import * as React from 'react';
import { Check, Copy, ScanLine } from 'lucide-react';
import { Button, useToast } from '@/components/ui';

/**
 * The check-in code.
 *
 * Deliberately not a QR image. A QR library is a dependency, a canvas and
 * a rasterised blob that has to be regenerated for dark mode; what the
 * desk at a DIET reunion actually needs is a short string a volunteer can
 * read out and type when the scanner app on a borrowed phone refuses to
 * focus. So the code is the primary artefact, large and monospaced, and
 * the block pattern beside it is a visual checksum — two tickets that
 * differ by one character look obviously different across a table.
 *
 * Both are derived from the registration id alone, with no clock and no
 * randomness. The same registration renders the same ticket on every
 * device, on every reload, and — because the derivation is pure — the
 * server render and the browser render agree, so the code cannot flicker
 * between two values while someone is holding their phone out.
 */

/** 32 symbols. I, O, 0 and 1 are absent: they are the pairs people mistype. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const GRID = 7;

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
function checkInCode(registrationId: string): string {
  const next = stream(registrationId);
  const chars = Array.from({ length: 9 }, () => ALPHABET[next() % ALPHABET.length] ?? 'A');
  return `${chars.slice(0, 3).join('')}-${chars.slice(3, 6).join('')}-${chars.slice(6).join('')}`;
}

/**
 * A 7×7 block pattern drawn from the code's own characters, mirrored down
 * the middle so it reads as a mark rather than as noise.
 */
function blocks(code: string): boolean[][] {
  const letters = code.replace(/-/g, '');
  const rows: boolean[][] = [];

  for (let r = 0; r < GRID; r++) {
    const half: boolean[] = [];
    for (let c = 0; c < 4; c++) {
      const ch = letters[(r * 4 + c) % letters.length] ?? 'A';
      const v = Math.max(0, ALPHABET.indexOf(ch));
      half.push(((v >> ((r + c) % 5)) & 1) === 1);
    }
    rows.push([...half, half[2] ?? false, half[1] ?? false, half[0] ?? false]);
  }

  return rows;
}

export function TicketCode({
  registrationId,
  eventTitle,
  holderName,
}: {
  registrationId: string;
  eventTitle: string;
  holderName: string;
}) {
  const toast = useToast();
  const [copied, setCopied] = React.useState(false);

  const code = checkInCode(registrationId);
  const pattern = React.useMemo(() => blocks(code), [code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Check-in code copied', `${code} — ${eventTitle}`);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard access is refused outright on some in-app browsers, and
      // a silent no-op there looks like a broken button. The code is on
      // screen either way, so say so rather than failing quietly.
      toast.info('Could not reach the clipboard', 'Read the code off the screen instead.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4 rounded-lg border border-line-strong bg-surface-sunken p-card text-center sm:flex-row sm:text-left">
        <svg
          viewBox={`0 0 ${GRID} ${GRID}`}
          shapeRendering="crispEdges"
          role="img"
          aria-label={`Block pattern for check-in code ${code}`}
          className="size-28 shrink-0 rounded border border-line bg-surface-raised p-1.5 text-primary"
        >
          {pattern.map((row, r) =>
            row.map((on, c) =>
              on ? (
                <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="currentColor" />
              ) : null,
            ),
          )}
        </svg>

        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Check-in code
          </p>
          {/* The one thing on this page somebody reads across a table. */}
          <p className="font-mono text-display-sm font-bold tracking-widest">{code}</p>
          <p className="text-xs text-muted">
            {holderName} · {eventTitle}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={copy}>
          {copied ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
          {copied ? 'Copied' : 'Copy the code'}
        </Button>

        <p className="flex min-w-0 flex-1 items-start gap-2 text-xs text-muted">
          <ScanLine className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            The alumni cell scans this at the registration desk, or types the nine characters into
            the check-in list if the scanner is being difficult. Either way it is your name that is
            marked present.
          </span>
        </p>
      </div>
    </div>
  );
}
