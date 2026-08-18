'use client';

import * as React from 'react';
import { RotateCcw } from 'lucide-react';
import { Badge, Field, Input, describedBy } from '@/components/ui';
import { cn } from '@/lib/cn';
import { contrastRatio } from '@/lib/branding/color';

/**
 * One seed colour.
 *
 * A swatch that opens the operating system's own colour picker, and a hex
 * box next to it. Nothing else — no eyedropper, no gradient plane, no
 * palette wheel. A registrar arrives holding a style guide that says
 * "#1F3864" and a crest; the job of this control is to accept that value
 * without an argument, and to say clearly when the value cannot be made
 * readable.
 *
 * Optional seeds render a "derive" reset rather than a blank box. Leaving
 * accent, ink or marker empty is a legitimate, usually better answer —
 * most colleges have exactly one colour, and a second badly chosen one is
 * worse than none — so the empty state has to look deliberate.
 */

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** `abc` / `#ABC` / `#aabbcc` → `#aabbcc`. `null` when it is not a colour. */
export function normaliseHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (!HEX.test(withHash)) return null;
  if (withHash.length === 4) {
    const r = withHash[1] ?? '';
    const g = withHash[2] ?? '';
    const b = withHash[3] ?? '';
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return withHash.toLowerCase();
}

export interface ColourFieldProps {
  id: string;
  label: string;
  hint?: string;
  /** Empty string means "not set" — derived, for optional seeds. */
  value: string;
  onChange: (next: string) => void;
  /**
   * The colour actually in use when `value` is empty. Comes from the
   * derived token set, so the swatch shows what the portal is really
   * rendering rather than a grey placeholder.
   */
  fallback?: string;
  optional?: boolean;
  /** One line explaining what happens when this is left empty. */
  derivedNote?: string;
  /** Marks a seed the browser form cannot persist. See the studio's notice. */
  packOnly?: boolean;
  /**
   * Live readout of a derived pair this seed decides — not of the seed
   * itself. The seed is rarely rendered anywhere; what matters is the
   * token it produced.
   */
  contrast?: { from: string; to: string; label: string; required: number };
  className?: string;
}

export function ColourField({
  id,
  label,
  hint,
  value,
  onChange,
  fallback,
  optional = false,
  derivedNote,
  packOnly = false,
  contrast,
  className,
}: ColourFieldProps) {
  const normalised = normaliseHex(value);
  const invalid = value.trim().length > 0 && normalised === null;
  const swatch = normalised ?? normaliseHex(fallback);
  const isDerived = value.trim().length === 0;

  const error = invalid ? 'That is not a hex colour. Use a form like #1F3864 or #B23A2B.' : null;
  const shownHint = hint ?? (isDerived ? derivedNote : undefined);

  // The native picker needs a resolvable value. Holding the last good one
  // keeps the swatch steady while somebody is halfway through typing a
  // hex, rather than making it flicker out on every intermediate keystroke.
  const lastValid = React.useRef('');
  if (swatch) lastValid.current = swatch;
  const pickerValue = swatch ?? lastValid.current;

  return (
    <Field
      htmlFor={id}
      label={label}
      hint={shownHint}
      error={error}
      className={className}
      notice={
        packOnly ? (
          <span className="inline-flex items-center gap-1.5">
            <Badge tone="outline">pack file</Badge>
            <span>Travels in the exported JSON, not in the browser form.</span>
          </span>
        ) : undefined
      }
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'relative grid h-control w-control shrink-0 place-items-center overflow-hidden rounded',
            'border border-line-strong',
            'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus-ring)]',
            isDerived && 'border-dashed',
          )}
          style={swatch ? { background: swatch } : undefined}
        >
          {pickerValue ? (
            <input
              type="color"
              // A separate control from the hex box, so it gets its own
              // name rather than borrowing the field label and reading as a
              // duplicate to a screen reader.
              aria-label={`${label} — pick a colour`}
              value={pickerValue}
              onChange={(e) => onChange(e.target.value.toUpperCase())}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          ) : null}
        </span>

        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={optional ? 'derived' : '#1F3864'}
          invalid={invalid}
          spellCheck={false}
          autoComplete="off"
          inputMode="text"
          aria-describedby={describedBy(id, { hint: Boolean(shownHint), error: Boolean(error) })}
          className="font-mono uppercase"
        />

        {optional && !isDerived ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className={cn(
              'grid h-control w-control shrink-0 place-items-center rounded text-muted',
              'transition-colors duration-fast ease-brand hover:bg-surface-sunken hover:text-primary',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
            )}
            aria-label={`Clear ${label} and let it be derived`}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {contrast ? (
        <ContrastChip
          from={contrast.from}
          to={contrast.to}
          label={contrast.label}
          required={contrast.required}
        />
      ) : null}
    </Field>
  );
}

/**
 * The one number that decides whether a colour can ship.
 *
 * Shown next to the seed rather than only in the report, because the seed
 * is where it gets fixed. Colour is never the only carrier here — the
 * ratio and the word "passes"/"fails" say it in text.
 */
function ContrastChip({
  from,
  to,
  label,
  required,
}: {
  from: string;
  to: string;
  label: string;
  required: number;
}) {
  let ratio: number;
  try {
    ratio = contrastRatio(from, to);
  } catch {
    return null;
  }

  const passes = ratio >= required;

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 text-xs text-secondary">
      <Badge tone={passes ? 'success' : 'danger'} dot>
        {ratio.toFixed(2)}:1 {passes ? 'passes' : 'fails'}
      </Badge>
      <span>
        {label} · needs {required}:1
      </span>
    </p>
  );
}
