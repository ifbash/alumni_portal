import { inSentence } from './branding/copy';
import type { BrandPack } from './branding/pack';

/**
 * The words that go into a share: a WhatsApp message, a copied link, the
 * Web Share sheet.
 *
 * Pure and client-safe. Each function returns the text only; the page
 * adds the URL, because which URL is the decision that matters:
 *
 *  - Links for people who have not registered yet point at public pages.
 *    A batch share goes to `/claim?year={year}`, a general invite to `/`.
 *  - Links for members (a story, an event, a job) point at the signed-in
 *    page, and the recipient signs in first.
 *
 * Every line ends ready for a URL after it (a colon, or a closing
 * bracket), and none of them names anything the pack does not supply.
 */

type ShareFact = Pick<BrandPack, 'copy' | 'locale'>;

/** The general invitation. The college's own line when the pack sets one. URL: `/`. */
export function portalShareText(pack: ShareFact): string {
  const { copy } = pack;
  return (
    copy.shareText ??
    `${copy.portalName}, the alumni network of ${copy.institutionName}. Find your batch and register with your ${inSentence(copy.rollNumberLabel)}:`
  );
}

/** To a batch group. URL: `${origin}/claim?year={year}`, which an unregistered batchmate can open. */
export function batchShareText(pack: ShareFact, year: number): string {
  const { copy } = pack;
  return `Batch of ${year} is on ${copy.portalName}. Register with your ${inSentence(copy.rollNumberLabel)} and find your batchmates:`;
}

/**
 * One event: "Annual Alumni Meet 2026 · Thu 24 Sept, 9:30 am · Main
 * Auditorium (DIET alumni)". The date is set in the tenant's time zone.
 */
export function eventShareText(
  pack: ShareFact,
  event: { title: string; startsAt: string; venue: string | null },
  timeZone: string = pack.locale.timeZone,
): string {
  const when = new Intl.DateTimeFormat(pack.locale.locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(event.startsAt));
  return `${event.title} · ${when} · ${event.venue ?? 'Venue to be announced'} (${pack.copy.shortName} alumni)`;
}

/** One story from the news desk. */
export function storyShareText(pack: ShareFact, story: { title: string }): string {
  return `${story.title} (${pack.copy.shortName} alumni news):`;
}

/** One photo album. */
export function albumShareText(pack: ShareFact, album: { title: string; photoCount?: number }): string {
  const count = album.photoCount && album.photoCount > 0 ? ` · ${album.photoCount} photos` : '';
  return `${album.title}${count} (${pack.copy.shortName} alumni photos):`;
}

/** One job posting. The poster is a graduate; the portal is where it lives. */
export function jobShareText(pack: ShareFact, job: { title: string; company: string }): string {
  return `${job.title} at ${job.company}, posted on ${pack.copy.portalName} by a ${pack.copy.shortName} graduate:`;
}

/** One giving campaign. States what it is, never what anyone gave. */
export function campaignShareText(pack: ShareFact, campaign: { title: string }): string {
  return `${campaign.title}, a ${pack.copy.shortName} alumni campaign on ${pack.copy.portalName}:`;
}
