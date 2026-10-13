import type { EventItem, JobPosting } from './data/types';

/**
 * Pure status helpers for events and jobs. Client-safe: the content cards
 * render in staff previews as well as on server pages.
 */

export interface SeatStatus {
  /** False for an event with no capacity. Nothing else here means anything then. */
  capped: boolean;
  capacity: number | null;
  registered: number;
  /** Seats left, never below 0. Null when uncapped. */
  left: number | null;
  full: boolean;
  /** registered / capacity, 0 when uncapped. */
  ratio: number;
}

export function seatStatus(event: Pick<EventItem, 'capacity' | 'registeredCount'>): SeatStatus {
  const registered = Math.max(0, event.registeredCount);
  if (!event.capacity || event.capacity <= 0) {
    return { capped: false, capacity: null, registered, left: null, full: false, ratio: 0 };
  }
  const left = Math.max(0, event.capacity - registered);
  return {
    capped: true,
    capacity: event.capacity,
    registered,
    left,
    full: left === 0,
    ratio: registered / event.capacity,
  };
}

/**
 * Whether a posting is open to someone graduating this year: an
 * internship, an experience range that starts at 0, or one that says
 * "Fresher".
 */
export function isFresherFriendly(job: Pick<JobPosting, 'isInternship' | 'experienceYears'>): boolean {
  if (job.isInternship) return true;
  const exp = job.experienceYears?.trim() ?? '';
  if (!exp) return false;
  return /^0(?!\d)/.test(exp) || /fresher/i.test(exp);
}

/**
 * Whether a venue string describes an online event. Whole words and whole
 * phrases only: "Alumni Meet Hall" is not a video call.
 *
 * The same rule as `isOnlineVenue` in `src/lib/data/public-events.ts`,
 * kept here because that module reads the repo and cannot be imported by
 * client-safe code. `tests/format.test.ts` pins the two together.
 */
export function isOnlineVenue(venue: string | null | undefined): boolean {
  return Boolean(
    venue && /\bonline\b|\bzoom\b|\bgoogle meet\b|\bwebinar\b|\bteams\b|\blink (?:sent|shared)\b/i.test(venue),
  );
}
