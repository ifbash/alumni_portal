import { can, type Session } from '../auth/guard';
import { findMemberById, projectMemberSummary } from './repo';
import { BUSINESSES, type BusinessRecord } from './seed-community';
import type { BusinessFacets, BusinessItem, BusinessState, Paged } from './types';

/**
 * The alumni business directory.
 *
 * A listing is a business with a named owner, so it follows the two rules
 * that govern every other place a member's details appear:
 *
 *  - **Contact needs both gates.** The viewer must be entitled (a student is
 *    not; alumni, faculty and the people who run the portal are) *and* the
 *    owner must have chosen to show contact details on the listing. A role
 *    alone is never enough. The listing itself (name, what it does, where,
 *    a website) is public to members, because the owner wrote it to be found.
 *  - **Only live listings are public.** One awaiting review, or refused, is
 *    for its owner and for the people who review them.
 */

function visibleTo(b: BusinessRecord, session: Session): boolean {
  if (b.status === 'live') return true;
  return b.ownerId === session.memberId || can(session, 'business.moderate');
}

/** The two-gate release. Pure, so it can be tested without a listing. */
export function releasesBusinessContact(
  session: Pick<Session, 'memberId' | 'roles'>,
  listing: Pick<BusinessRecord, 'ownerId' | 'showContact'>,
): boolean {
  if (session.memberId === listing.ownerId) return true;
  if (session.roles.some((r) => r.role === 'student')) return false;
  return listing.showContact;
}

function shape(b: BusinessRecord, session: Session): BusinessItem | null {
  const owner = findMemberById(b.ownerId);
  if (!owner) return null;

  const owns = b.ownerId === session.memberId;
  const moderator = can(session, 'business.moderate');
  const released = releasesBusinessContact(session, b);

  return {
    id: b.id,
    slug: b.slug,
    name: b.name,
    industry: b.industry,
    description: b.description,
    city: b.city,
    region: b.region,
    country: b.country,
    website: b.website,
    products: b.products,
    services: b.services,
    owner: projectMemberSummary(owner, session),
    status: b.status,
    moderationNote: owns || moderator ? b.moderationNote : null,
    createdAt: b.createdAt,
    contact: released && (b.contactEmail || b.contactPhone) ? { email: b.contactEmail, phone: b.contactPhone } : null,
    contactShared: b.showContact,
  };
}

export interface BusinessQuery {
  q?: string;
  industry?: string;
  city?: string;
  /** The viewer's own listings, in any state. */
  mine?: boolean;
  status?: BusinessState | 'all';
  page?: number;
  perPage?: number;
}

export function getBusinesses(session: Session, query: BusinessQuery = {}): Paged<BusinessItem> {
  const perPage = Math.min(Math.max(query.perPage ?? 12, 1), 50);
  const needle = query.q?.trim().toLowerCase();
  const wanted = query.status ?? 'live';
  const moderator = can(session, 'business.moderate');

  const rows = BUSINESSES.filter((b) => visibleTo(b, session))
    .filter((b) => {
      if (query.mine) return b.ownerId === session.memberId;
      if (wanted === 'all') return moderator;
      return b.status === wanted;
    })
    .filter((b) => !query.industry || b.industry === query.industry)
    .filter((b) => !query.city || b.city === query.city)
    .filter(
      (b) =>
        !needle ||
        needle
          .split(/\s+/)
          .every((t) => `${b.name} ${b.industry} ${b.description} ${b.city ?? ''} ${b.products.join(' ')} ${b.services.join(' ')}`.toLowerCase().includes(t)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(query.page ?? 1, 1), pageCount);
  const items = rows
    .slice((page - 1) * perPage, page * perPage)
    .map((b) => shape(b, session))
    .filter((b): b is BusinessItem => b !== null);

  return { items, total, page, perPage, pageCount };
}

export function getBusinessBySlug(session: Session, slug: string): BusinessItem | null {
  const b = BUSINESSES.find((x) => x.slug === slug);
  if (!b || !visibleTo(b, session)) return null;
  return shape(b, session);
}

/** Counts over live listings, for the filter sidebar. */
export function getBusinessFacets(): BusinessFacets {
  const tally = (get: (b: BusinessRecord) => string | null) => {
    const map = new Map<string, number>();
    for (const b of BUSINESSES) {
      if (b.status !== 'live') continue;
      const v = get(b);
      if (v) map.set(v, (map.get(v) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, count }));
  };
  return { industries: tally((b) => b.industry), cities: tally((b) => b.city) };
}

/** Listings waiting on a moderator. Empty for anyone without `business.moderate`. */
export function getPendingBusinesses(session: Session): BusinessItem[] {
  if (!can(session, 'business.moderate')) return [];
  return BUSINESSES.filter((b) => b.status === 'pending_moderation')
    .map((b) => shape(b, session))
    .filter((b): b is BusinessItem => b !== null);
}

export function countPendingBusinesses(session: Session): number {
  return can(session, 'business.moderate') ? BUSINESSES.filter((b) => b.status === 'pending_moderation').length : 0;
}

/** Whether a slug is taken, in any state, so a new listing cannot shadow one. */
export function businessSlugTaken(slug: string): boolean {
  return BUSINESSES.some((b) => b.slug === slug);
}

/** Every address in use, in any state, for a form to warn about before the server has to refuse. */
export function businessSlugs(): string[] {
  return BUSINESSES.map((b) => b.slug);
}
