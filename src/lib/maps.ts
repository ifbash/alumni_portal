import { isOnlineVenue } from './event-status';

/**
 * A Google Maps search link for an event venue, for the "Directions" link
 * under an event. Plain URL, no embed and no API key.
 *
 * A venue with no comma ("Main Auditorium") names a room, not a place, so
 * the college's own address lines from the pack are appended to make the
 * search land on the campus. Online and empty venues get no link.
 */
export function directionsUrl(venue: string | null | undefined, addressLines: readonly string[] = []): string | null {
  const v = venue?.trim();
  if (!v || isOnlineVenue(v)) return null;

  const query = v.includes(',') || addressLines.length === 0 ? v : [v, ...addressLines].join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
