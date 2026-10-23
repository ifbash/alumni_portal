/**
 * Shared content cards.
 *
 * One rendering of an event, a story, an album and a job, used by the
 * member pages, the home page and the staff console's previews alike, so
 * what staff preview is exactly what members see.
 *
 * Isomorphic by rule: no hooks, no `server-only`, no repo imports. Pages
 * supply the status and action slots; the cards never decide what a
 * viewer may do.
 */

export { EventSummary, EventDateBlock, SeatBadge, eventMetaLine, type EventSummaryData } from './EventSummary';
export { StoryCard, type StoryCardData } from './StoryCard';
export { AlbumCard, parseContributor, isContributed, type AlbumCardData } from './AlbumCard';
export { JobSummary, closesLabel, posterLine, type JobSummaryData } from './JobSummary';
export { RichText } from './RichText';
