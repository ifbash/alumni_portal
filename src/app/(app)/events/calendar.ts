import { formatTimeZoneLabel } from '@/lib/format';
import { isOnlineVenue } from '@/lib/event-status';
import type { EventItem } from '@/lib/data/types';

/**
 * Event dates in words, and the two ways to put an event in a calendar.
 *
 * Pure and client-safe. Every date is set in the college's time zone, so
 * the server render and the browser agree and a reunion in Vijayawada does
 * not move by five and a half hours on a UTC server.
 *
 * The calendar file is built here as a `data:` URI rather than served from
 * a route: it holds nothing the viewer cannot already see on the page, and
 * a link with a `download` attribute is the one "Add to calendar" that
 * works in every mail and calendar app without a script.
 */

type Dated = Pick<EventItem, 'startsAt' | 'endsAt'>;

function parts(iso: string, locale: string, timeZone: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone }).formatToParts(new Date(iso));
}

/** "Thu 24 Sept". */
export function dayLabel(iso: string, locale: string, timeZone: string): string {
  const p = parts(iso, locale, timeZone, { weekday: 'short', day: 'numeric', month: 'short' });
  const get = (type: Intl.DateTimeFormatPartTypes) => p.find((x) => x.type === type)?.value ?? '';
  return [get('weekday'), get('day'), get('month')].filter(Boolean).join(' ');
}

/** "9:30 am". */
export function timeLabel(iso: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(iso));
}

/**
 * When an event happens, in one line, without the venue:
 *  - "Thu 24 Sept · 9:30 am – 7:00 pm IST"
 *  - "Fri 11 Sept, 9:30 am – Sat 12 Sept, 9:30 am IST" when it runs over a night
 *  - "Sun 4 Oct · 9:30 am IST" when no end time is set
 */
export function whenLine(event: Dated, locale: string, timeZone: string): string {
  const tz = formatTimeZoneLabel(timeZone, locale);
  const startDay = dayLabel(event.startsAt, locale, timeZone);
  const startTime = timeLabel(event.startsAt, locale, timeZone);
  if (!event.endsAt) return `${startDay} · ${startTime} ${tz}`;

  const endDay = dayLabel(event.endsAt, locale, timeZone);
  const endTime = timeLabel(event.endsAt, locale, timeZone);
  return endDay === startDay
    ? `${startDay} · ${startTime} – ${endTime} ${tz}`
    : `${startDay}, ${startTime} – ${endDay}, ${endTime} ${tz}`;
}

/** Where, in one phrase: the venue, "Online" or "Venue to be announced". */
export function venueLabel(venue: string | null): string {
  if (!venue) return 'Venue to be announced';
  return venue;
}

/**
 * The address a calendar app should search for. A room name ("Main
 * Auditorium") gets the college's own address lines after it, the same
 * rule `directionsUrl` follows, so the calendar entry lands on the campus.
 */
function calendarLocation(venue: string | null, addressLines: readonly string[]): string {
  const v = venue?.trim() ?? '';
  if (!v) return '';
  if (isOnlineVenue(v) || v.includes(',') || addressLines.length === 0) return v;
  return [v, ...addressLines].join(', ');
}

/** "20260924T040000Z", the UTC form both calendar formats accept. */
function utcStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** An event with no end time is put in the calendar as two hours long. */
function endOf(event: Dated): string {
  return event.endsAt ?? new Date(new Date(event.startsAt).getTime() + 2 * 3600000).toISOString();
}

/** RFC 5545 text escaping. */
function icsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** RFC 5545 folds content lines at 75 octets; continuation lines start with a space. */
function fold(line: string): string {
  if (line.length <= 73) return line;
  const out: string[] = [];
  for (let i = 0; i < line.length; i += 73) out.push((i === 0 ? '' : ' ') + line.slice(i, i + 73));
  return out.join('\r\n');
}

export interface CalendarLinks {
  /** A `data:` URI for an .ics file. Use on a link with `download={icsFilename}`. */
  icsHref: string;
  icsFilename: string;
  /** Google Calendar's own "add event" page, prefilled. Opens in a new tab. */
  googleHref: string;
}

export function calendarLinks(
  event: Pick<EventItem, 'slug' | 'title' | 'description' | 'venue' | 'startsAt' | 'endsAt'>,
  opts: { url: string; addressLines?: readonly string[]; timeZone: string },
): CalendarLinks {
  const start = utcStamp(event.startsAt);
  const end = utcStamp(endOf(event));
  const location = calendarLocation(event.venue, opts.addressLines ?? []);
  const details = [event.description?.trim(), opts.url].filter(Boolean).join('\n\n');
  const host = (() => {
    try {
      return new URL(opts.url).host;
    } catch {
      return 'alumni.portal';
    }
  })();

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Alumni Portal//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.slug}@${host}`,
    `DTSTAMP:${start}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${icsText(event.title)}`,
    location ? `LOCATION:${icsText(location)}` : null,
    details ? `DESCRIPTION:${icsText(details)}` : null,
    `URL:${opts.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter((l): l is string => l !== null)
    .map(fold)
    .join('\r\n');

  const google = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
    details,
    location,
    ctz: opts.timeZone,
  });

  return {
    icsHref: `data:text/calendar;charset=utf-8,${encodeURIComponent(`${ics}\r\n`)}`,
    icsFilename: `${event.slug}.ics`,
    googleHref: `https://calendar.google.com/calendar/render?${google.toString()}`,
  };
}
