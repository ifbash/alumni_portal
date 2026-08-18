import type { DataRequest } from '@/lib/data/types';

/**
 * The statutory clock, and the words the queue uses for it.
 *
 * Colocated with the two routes that need it. The rules here are legal
 * facts about a DPDP request, not presentation choices — if the response
 * window changes, it changes in one place and both screens follow.
 */

/**
 * The fixture instant, matching `SEED_NOW` in the data layer.
 *
 * Duplicated rather than imported because a page must not reach into
 * `data/seed`. It has to be the *same* instant that `formatRelative()`
 * measures against, or a request could read “Due in 4 days” beside a badge
 * that says overdue. See the note in the final report: the right fix is a
 * reference clock exported from a module a page is allowed to import.
 */
const REFERENCE_NOW = new Date('2026-08-17T09:30:00+05:30').getTime();

/** Days from receipt to the statutory deadline. */
export const RESPONSE_WINDOW_DAYS = 30;

/** The window inside which a request stops being routine. */
const WARNING_DAYS = 7;

const DAY_MS = 86400000;

export type Tone = 'neutral' | 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

/** Received and in progress are open. Fulfilled and refused stopped the clock. */
function isOpen(request: DataRequest): boolean {
  return request.state === 'received' || request.state === 'in_progress';
}

export interface DueStatus {
  /** Whole days to the deadline. Negative once it has passed. */
  days: number;
  overdue: boolean;
  open: boolean;
  tone: Tone;
  /** Short enough for a table cell: “Overdue by 3 days”. */
  label: string;
  /** The sentence a person acts on. */
  detail: string;
}

export function dueStatus(request: DataRequest): DueStatus {
  const days = Math.ceil((new Date(request.dueAt).getTime() - REFERENCE_NOW) / DAY_MS);
  const open = isOpen(request);

  if (!open) {
    return {
      days,
      overdue: false,
      open: false,
      tone: 'neutral',
      label: 'Clock stopped',
      detail:
        request.state === 'fulfilled'
          ? 'Answered. The statutory clock stopped when the request was fulfilled.'
          : 'Closed as refused. The reason given to the member is part of the record.',
    };
  }

  if (days < 0) {
    const late = Math.abs(days);
    return {
      days,
      overdue: true,
      open: true,
      tone: 'danger',
      label: `Overdue by ${late} day${late === 1 ? '' : 's'}`,
      detail: `The ${RESPONSE_WINDOW_DAYS}-day window closed ${late} day${late === 1 ? '' : 's'} ago. This is already a reportable failure — answer it today and record why it slipped.`,
    };
  }

  if (days === 0) {
    return {
      days,
      overdue: false,
      open: true,
      tone: 'danger',
      label: 'Due today',
      detail: 'The window closes at end of day. Anything not answered tonight is late tomorrow.',
    };
  }

  if (days <= WARNING_DAYS) {
    return {
      days,
      overdue: false,
      open: true,
      tone: 'warning',
      label: `Due in ${days} day${days === 1 ? '' : 's'}`,
      detail: `Inside the last week of the ${RESPONSE_WINDOW_DAYS}-day window. If it needs the examinations branch or finance, start now — they do not turn work around in a day.`,
    };
  }

  return {
    days,
    overdue: false,
    open: true,
    tone: 'neutral',
    label: `Due in ${days} days`,
    detail: `${days} days left of the ${RESPONSE_WINDOW_DAYS}-day window.`,
  };
}

// ---------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------

export const KIND_LABEL: Record<DataRequest['kind'], string> = {
  export: 'Access copy',
  correction: 'Correction',
  deletion: 'Erasure',
};

/** What the member actually asked for, in one line. */
export const KIND_SUMMARY: Record<DataRequest['kind'], string> = {
  export: 'A copy of everything the college holds about them, in a portable form.',
  correction: 'A field the college holds about them is wrong and they want it put right.',
  deletion: 'Erasure of their personal data, subject to what the law requires us to keep.',
};

export const STATE_LABEL: Record<DataRequest['state'], string> = {
  received: 'Received',
  in_progress: 'In progress',
  fulfilled: 'Fulfilled',
  refused: 'Refused',
};

export const STATE_TONE: Record<DataRequest['state'], Tone> = {
  received: 'info',
  in_progress: 'warning',
  fulfilled: 'success',
  refused: 'neutral',
};
