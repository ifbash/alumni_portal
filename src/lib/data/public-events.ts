import { getDegreeRegisterStats, getDepartments, getEvents } from './repo';
import { IS_FIXTURE } from '../config';
import { DEMO_PACK_IDS, HOUSE_PACK_ID } from '../branding/registry';
import type { EventItem } from './types';

/**
 * Events as a signed-out visitor may see them.
 *
 * Shared by every public surface — the landing page and `/campus-events` —
 * because each used to apply its own filter, and the landing page applied
 * none: it put registration counts on the open internet, and an
 * alumni-only reunion at a named hotel was one date change away from
 * joining them.
 *
 * Two rules, both load-bearing:
 *
 *  - **Alumni-only events are dropped.** `getEvents()` filters those for
 *    *students*, not for anonymous callers — an anonymous session has no
 *    student role, so they fall straight through.
 *  - **Rows are narrowed into a projection**, not rendered selectively.
 *    Whole `EventItem`s passed to a component land in the RSC payload
 *    embedded in the page's HTML, `registeredCount` and `capacity` with
 *    them. How many people are coming to a batch dinner is an attendance
 *    list by another name.
 */

/**
 * Everything about an event that a signed-out visitor may see, and
 * nothing else. Notably absent: `registeredCount`, `capacity`,
 * `published`, `alumniOnly` and `viewerRegistration`.
 */
export interface PublicEvent {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  venue: string | null;
  startsAt: string;
  endsAt: string | null;
  departmentCode: string | null;
  studentEligible: boolean;
  ticketPrice: number;
}

function toPublic(e: EventItem): PublicEvent {
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    description: e.description,
    venue: e.venue,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    departmentCode: e.departmentCode,
    studentEligible: e.studentEligible,
    ticketPrice: e.ticketPrice,
  };
}

/** `null` session: published events only, no drafts, no viewer registration. */
export function getPublicEvents(when: 'upcoming' | 'past'): PublicEvent[] {
  return getEvents(null, { when })
    .filter((e) => !e.alumniOnly)
    // A chapter's or a group's own event is for its members and the portal's
    // other signed-in members, not for the open internet: its address and
    // its turnout belong with the group that hosts it.
    .filter((e) => e.groupSlug === null)
    .map(toPublic);
}

/**
 * Whether a venue string describes an online event.
 *
 * Whole words and whole phrases only. The pages' own
 * `/online|zoom|meet|webinar|link/` matched "meet" inside "Alumni Meet
 * Hall" and tagged the college's own reunion as a video call.
 */
export function isOnlineVenue(venue: string | null): boolean {
  return Boolean(
    venue && /\bonline\b|\bzoom\b|\bgoogle meet\b|\bwebinar\b|\bteams\b|\blink (?:sent|shared)\b/i.test(venue),
  );
}

/** The event the landing pill features: first college-wide, in-person one; else the first upcoming. */
export function pickLeadEvent(upcoming: PublicEvent[]): { event: PublicEvent; onCampus: boolean } | null {
  const onCampus = upcoming.find((e) => e.departmentCode === null && !isOnlineVenue(e.venue));
  if (onCampus) return { event: onCampus, onCampus: true };
  return upcoming[0] ? { event: upcoming[0], onCampus: false } : null;
}

// ---------------------------------------------------------------
// The degree register, as a signed-out visitor may see it
// ---------------------------------------------------------------

/** Totals below this read as empty rather than impressive (research §3), so they are not stated. */
export const PUBLIC_COUNT_FLOOR = 500;

/**
 * Nor is a total whose batches average fewer graduates than this. 834
 * across fourteen batches is sixty a year: stated on a public page it
 * reads as a college nobody went to, not as a network worth joining.
 */
export const PUBLIC_PER_BATCH_FLOOR = 200;

export interface PublicRegister {
  /** Years on the register, oldest first. The batch chips; never with counts. */
  years: number[];
  /** The register's size, or null when it must not be stated. */
  total: number | null;
  /** First and last batch, or null when the range must not be stated. */
  span: { first: number; last: number } | null;
  /** How many branches the register covers, or null when that must not be stated. */
  branches: number | null;
  /**
   * Whether these figures describe the college. False in fixture mode for
   * a real customer's pack: the seeded register stands in for one the
   * college has not supplied yet, and its size, range and branch count are
   * not facts about that college. The years still drive the batch chips,
   * because the registration form needs them to work at all.
   */
  factual: boolean;
}

/**
 * The register's public face: its years, and — only when they are the
 * college's own and worth stating — its size, range and branch count.
 * Never who has registered: `claimed`, `unclaimed` and `coverage` do not
 * leave this function.
 */
export function getPublicRegister(packId: string): PublicRegister {
  const stats = getDegreeRegisterStats();
  const years = stats.byYear.map((y) => y.year);
  const factual = registerIsFactual(packId);

  if (!factual || years.length === 0) {
    return { years, total: null, span: null, branches: null, factual };
  }

  const worthStating =
    stats.total >= PUBLIC_COUNT_FLOOR && stats.total / years.length >= PUBLIC_PER_BATCH_FLOOR;

  return {
    years,
    total: worthStating ? stats.total : null,
    span: { first: Math.min(...years), last: Math.max(...years) },
    branches: getDepartments().length,
    factual,
  };
}

/**
 * Whether the register this deployment reads is the college's own. Always
 * in database mode; in fixture mode only for the demonstration packs and
 * the house pack, which have no real college behind them to misdescribe.
 */
export function registerIsFactual(packId: string): boolean {
  if (!IS_FIXTURE) return true;
  return packId === HOUSE_PACK_ID || (DEMO_PACK_IDS as readonly string[]).includes(packId);
}
