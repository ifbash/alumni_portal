import { can, type Session } from '../auth/guard';
import { findMemberById, projectMemberSummary } from './repo';
import { SHOWCASE, type ShowcaseRecord } from './seed-community';
import type { ShowcaseCategory, ShowcaseEntry, ShowcaseKind } from './types';

/**
 * Prominent alumni, achievements and success stories.
 *
 * Content *about* named people, so two things are checked before an entry
 * is shown and again before it is published:
 *
 *  - An entry about a person who is on the portal needs their consent on
 *    record. "The college wanted to" is not consent.
 *  - An entry about a person who is not needs a public source, so the
 *    portal is repeating something already published rather than
 *    publishing it first.
 *
 * Members read published entries. Submissions awaiting review are for the
 * member who sent them and for the staff who curate the showcase.
 */

function visibleTo(e: ShowcaseRecord, session: Session): boolean {
  if (e.state === 'published') return true;
  return e.submittedById === session.memberId || can(session, 'showcase.manage');
}

function shape(e: ShowcaseRecord, session: Session): ShowcaseEntry {
  const person = e.memberId ? findMemberById(e.memberId) : null;
  const sees = e.submittedById === session.memberId || can(session, 'showcase.manage');

  return {
    id: e.id,
    slug: e.slug,
    kind: e.kind,
    category: e.category,
    headline: e.headline,
    summary: e.summary,
    story: e.story,
    displayName: e.displayName,
    member: person ? projectMemberSummary(person, session) : null,
    batchYear: e.batchYear,
    departmentCode: e.departmentCode,
    achievedOn: e.achievedOn,
    sourceUrl: e.sourceUrl,
    featured: e.featured,
    source: e.source,
    state: e.state,
    moderationNote: sees ? e.moderationNote : null,
    createdAt: e.createdAt,
  };
}

export interface ShowcaseQuery {
  kind?: ShowcaseKind;
  category?: ShowcaseCategory;
  q?: string;
  /** The viewer's own submissions, in any state. */
  mine?: boolean;
}

export function getShowcase(session: Session, query: ShowcaseQuery = {}): ShowcaseEntry[] {
  const needle = query.q?.trim().toLowerCase();
  return SHOWCASE.filter((e) => visibleTo(e, session))
    .filter((e) => (query.mine ? e.submittedById === session.memberId : e.state === 'published'))
    .filter((e) => !query.kind || e.kind === query.kind)
    .filter((e) => !query.category || e.category === query.category)
    .filter((e) => !needle || `${e.displayName} ${e.headline} ${e.summary}`.toLowerCase().includes(needle))
    .sort((a, b) => Number(b.featured) - Number(a.featured) || b.createdAt.localeCompare(a.createdAt))
    .map((e) => shape(e, session));
}

export function getShowcaseBySlug(session: Session, slug: string): ShowcaseEntry | null {
  const e = SHOWCASE.find((x) => x.slug === slug);
  if (!e || !visibleTo(e, session)) return null;
  return shape(e, session);
}

/** How many published entries sit in each category, for the category chips. */
export function getShowcaseCategoryCounts(kind?: ShowcaseKind): Array<{ category: ShowcaseCategory; count: number }> {
  const counts = new Map<ShowcaseCategory, number>();
  for (const e of SHOWCASE) {
    if (e.state !== 'published' || (kind && e.kind !== kind)) continue;
    counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  }
  return [...counts.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
}

export function getShowcaseKindCounts(): Array<{ kind: ShowcaseKind; count: number }> {
  const counts = new Map<ShowcaseKind, number>();
  for (const e of SHOWCASE) if (e.state === 'published') counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  return [...counts.entries()].map(([kind, count]) => ({ kind, count }));
}

/** Submissions waiting on the people who curate the showcase. */
export function getPendingShowcase(session: Session): ShowcaseEntry[] {
  if (!can(session, 'showcase.manage')) return [];
  return SHOWCASE.filter((e) => e.state === 'pending_moderation').map((e) => shape(e, session));
}

export function countPendingShowcase(session: Session): number {
  return can(session, 'showcase.manage') ? SHOWCASE.filter((e) => e.state === 'pending_moderation').length : 0;
}

export function showcaseSlugTaken(slug: string): boolean {
  return SHOWCASE.some((e) => e.slug === slug);
}

/**
 * The publication check: whether an entry has what it needs to go live.
 * Returned as a sentence so the console can say what is missing.
 */
export function publicationProblem(
  entry: Pick<ShowcaseRecord, 'memberId' | 'sourceUrl' | 'consentRecordedAt'>,
): string | null {
  if (entry.memberId && !entry.consentRecordedAt) {
    return 'This is about a member of the portal, and their agreement to be featured is not recorded yet.';
  }
  if (!entry.memberId && !entry.sourceUrl) {
    return 'This is about somebody who is not on the portal, so it needs a link to where it was already published.';
  }
  return null;
}

/**
 * Why a stored entry cannot go live yet, or null. Reads the record itself,
 * because the consent timestamp is not part of what a page is shown.
 */
export function publicationProblemFor(slug: string): string | null {
  const record = SHOWCASE.find((e) => e.slug === slug);
  return record ? publicationProblem(record) : null;
}

/** Every entry in every state, for the people who curate the showcase. Empty for anyone else. */
export function getShowcaseForCurator(session: Session): ShowcaseEntry[] {
  if (!can(session, 'showcase.manage')) return [];
  return SHOWCASE.map((e) => shape(e, session)).sort(
    (a, b) => Number(b.state === 'pending_moderation') - Number(a.state === 'pending_moderation') || b.createdAt.localeCompare(a.createdAt),
  );
}
