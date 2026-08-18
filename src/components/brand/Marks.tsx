import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * The hand-drawn layer.
 *
 * A small number of marker strokes per page is part of the identity: one
 * circled phrase, one scribbled underline, one margin note. They are the
 * human counterweight to an otherwise engineered layout.
 *
 * Three rules, and they are not stylistic preferences:
 *
 *  1. **At most two per viewport.** More and they stop reading as
 *     annotation and start reading as texture.
 *  2. **Always the marker token, never a fill.** `--marker` is a
 *     highlighter colour. It fails contrast as body text on every
 *     surface in the system, which is precisely why it is reserved for
 *     decoration.
 *  3. **They annotate meaning.** A circled number, a promise, a
 *     differentiator — never decoration for its own sake.
 *
 * Every mark is `aria-hidden`. The words underneath carry the meaning; a
 * screen reader announcing "squiggle" is noise.
 */

interface MarkProps {
  className?: string;
  /** Skip the draw-on animation — useful above the fold on slow devices. */
  static?: boolean;
}

const STROKE = 'stroke-[var(--marker)]';

/** Ellipse around a short phrase. Wrap the phrase in `<CircleMark>`. */
export function CircleMark({
  children,
  className,
  ...mark
}: MarkProps & { children: React.ReactNode }) {
  return (
    <span className={cn('relative inline-block', className)}>
      {children}
      <svg
        viewBox="0 0 240 60"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-3 -inset-y-2 h-[calc(100%+1rem)] w-[calc(100%+1.5rem)]"
      >
        <path
          d="M232 27C232 12 180 5 118 5S6 13 6 29s54 26 114 26 104-9 110-21c2-5-6-11-18-15"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          className={cn(STROKE, !mark.static && 'animate-draw-stroke')}
          style={{ strokeDasharray: 480 }}
        />
      </svg>
    </span>
  );
}

/** Scribbled underline. Sits under a word without changing its box. */
export function Scribble({ className, ...mark }: MarkProps) {
  return (
    <svg
      viewBox="0 0 200 12"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn('block h-2.5 w-full', className)}
    >
      <path
        d="M2 8c26-4 52-6 78-5s52 4 78 2c14-2 26-4 40-3"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        className={cn(STROKE, !mark.static && 'animate-draw-stroke')}
        style={{ strokeDasharray: 480 }}
      />
    </svg>
  );
}

/** Curved arrow for pointing at one thing from a margin note. */
export function SquiggleArrow({
  className,
  direction = 'right',
  ...mark
}: MarkProps & { direction?: 'right' | 'left' | 'down' }) {
  const rotate = { right: '', left: 'scale-x-[-1]', down: 'rotate-90' }[direction];

  return (
    <svg
      viewBox="0 0 84 40"
      fill="none"
      aria-hidden="true"
      className={cn('h-8 w-20', rotate, className)}
    >
      <path
        d="M4 30c14-6 24-20 40-22 12-2 22 6 24 16"
        strokeWidth="2.5"
        strokeLinecap="round"
        className={cn(STROKE, !mark.static && 'animate-draw-stroke')}
        style={{ strokeDasharray: 480 }}
      />
      <path d="M60 24l8 2 2-9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={STROKE} />
    </svg>
  );
}

/**
 * A margin note in the italic face — the written-in-the-margin voice.
 * Used for the honest aside a marketing page would normally omit.
 */
export function MarginNote({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn('font-body text-sm italic leading-relaxed text-secondary', className)}>{children}</p>
  );
}

/**
 * Decorative grid backdrop for hero sections. Pure CSS, masked so it
 * fades out rather than ending on a hard line.
 */
export function GridBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 grid-fade', className)}
      style={{
        backgroundImage:
          'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
        backgroundSize: '56px 56px',
        opacity: 0.5,
      }}
    />
  );
}
