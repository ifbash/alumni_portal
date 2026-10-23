import { can, type Session } from '../auth/guard';
import { CMS_PAGES } from './seed-community';
import type { CmsPage } from './types';

/**
 * Pages the college edits itself.
 *
 * Two audiences. A `public` page is readable by anyone (About, a director's
 * message). A `members` page is readable by an active member and is never
 * indexable or linked from the public footer. Drafts are for the people who
 * edit pages and for nobody else, and an unknown address and an address the
 * viewer may not read answer the same way, so a member-only page's existence
 * is not an oracle.
 */

const isActiveMember = (s: Session | null): boolean =>
  Boolean(s && (s.status === 'active_alumni' || s.status === 'active_student'));

export function getPageBySlug(session: Session | null, slug: string): CmsPage | null {
  const page = CMS_PAGES.find((p) => p.slug === slug);
  if (!page) return null;
  const editor = Boolean(session && can(session, 'page.manage'));
  if (!page.published && !editor) return null;
  if (page.audience === 'members' && !isActiveMember(session) && !editor) return null;
  return page;
}

/** Pages to link from the public footer: published, public, flagged for it. */
export function getFooterPages(): Array<Pick<CmsPage, 'slug' | 'title'>> {
  return CMS_PAGES.filter((p) => p.published && p.audience === 'public' && p.showInFooter)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => ({ slug: p.slug, title: p.title }));
}

/** Pages to link from inside the portal: published, members-only, flagged for it. */
export function getMemberPages(): Array<Pick<CmsPage, 'slug' | 'title'>> {
  return CMS_PAGES.filter((p) => p.published && p.audience === 'members')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => ({ slug: p.slug, title: p.title }));
}

/** Every page, drafts included, for the console. Empty without `page.manage`. */
export function getAllPages(session: Session): CmsPage[] {
  if (!can(session, 'page.manage')) return [];
  return [...CMS_PAGES].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}

export function pageSlugTaken(slug: string): boolean {
  return CMS_PAGES.some((p) => p.slug === slug);
}
