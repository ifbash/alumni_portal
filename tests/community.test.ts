import { describe, expect, it } from 'vitest';
import type { Session } from '@/lib/auth/guard';
import { EVENT_KIND_VALUES, excerpt, normaliseTags, reunionMilestone, slugify, SLUG_PATTERN, upcomingReunionMilestones } from '@/lib/community';
import { canPostIn, countReportedPosts, getFeed, getFeedTags, getModerationQueue, getPostById } from '@/lib/data/feed';
import {
  canRunGroup,
  canSeeRoster,
  countGroupRequests,
  getGroupBySlug,
  getGroupMembers,
  getGroupRequests,
  getGroups,
  getMyGroups,
  joinVerdict,
} from '@/lib/data/groups';
import { getTicketForViewer, getTicketQueue, getMyTickets, countOpenTickets, nextTicketReference } from '@/lib/data/helpdesk';
import { getInviteQuota, getMyInvitations, INVITE_WEEKLY_LIMIT } from '@/lib/data/invites';
import {
  businessSlugTaken,
  countPendingBusinesses,
  getBusinessBySlug,
  getBusinesses,
  getPendingBusinesses,
  releasesBusinessContact,
} from '@/lib/data/businesses';
import { getAllPages, getFooterPages, getMemberPages, getPageBySlug } from '@/lib/data/pages';
import { findMemberById, getDemoAccounts, getEventBySlug, getEvents } from '@/lib/data/repo';
import { EVENTS, EVENT_REGISTRATIONS } from '@/lib/data/seed';
import { BUSINESSES, CMS_PAGES, GROUPS, GROUP_MEMBERSHIPS, INVITATIONS, POSTS, SHOWCASE, TICKETS } from '@/lib/data/seed-community';
import {
  countPendingShowcase,
  getPendingShowcase,
  getShowcase,
  getShowcaseBySlug,
  getShowcaseForCurator,
  publicationProblem,
} from '@/lib/data/showcase';
import { SEED_NOW } from '@/lib/clock';
import type { CmsPage } from '@/lib/data/types';

/**
 * The community modules, against the seeded college.
 *
 * Each block states a rule the module exists to keep and then tries to break
 * it from the viewpoint of someone who must not get through: a final-year
 * student, an ordinary alumnus, a member of staff who holds a role but not
 * the capability, and the vendor. The data layer is where these rules live
 * (every page and every route reads through it), so this is the suite that
 * proves them; the route tests prove the doors are shut as well.
 *
 * The seeded cast is deliberate and documented in `seed-community.ts`:
 * `post-13` is hidden after two reports; `post-14` is live with one;
 * the demo alumnus leads `hyderabad-chapter` and `startups-and-founders`
 * (the second by approval, with two requests waiting); the demo student is
 * in two interest groups and no chapter.
 */

function sessionFor(email: string): Session {
  const account = getDemoAccounts().find((a) => a.email === email);
  if (!account) throw new Error(`No demo account for ${email}`);
  const member = findMemberById(account.memberId);
  if (!member) throw new Error(`Demo account ${email} points at a missing member`);
  return {
    memberId: member.id,
    tenantId: 'ten-diet',
    status: member.status,
    roles: account.roles.map((r) => ({ role: r.role, departmentId: r.departmentCode })),
    departmentId: member.departmentCode,
    batchYear: member.batchYear,
  };
}

/** An ordinary alumnus who is not one of the demo accounts. */
function alumnusSession(memberId: string): Session {
  const member = findMemberById(memberId);
  if (!member) throw new Error(`No member ${memberId}`);
  return {
    memberId: member.id,
    tenantId: 'ten-diet',
    status: member.status,
    roles: [{ role: 'alumni', departmentId: null }],
    departmentId: member.departmentCode,
    batchYear: member.batchYear,
  };
}

const STUDENT = sessionFor('student@diet.ac.in');
const ALUMNUS = sessionFor('alumni@example.com');
const FACULTY = sessionFor('faculty.ece@diet.ac.in');
const HOD = sessionFor('hod.cse@diet.ac.in');
const PLACEMENT = sessionFor('tpo@diet.ac.in');
const OPERATOR = sessionFor('alumnicell@diet.ac.in');
const FINANCE = sessionFor('finance@diet.ac.in');
const ADMIN = sessionFor('admin@diet.ac.in');
const VENDOR = sessionFor('platform@ifbash.com');

const ALL_DEMO = getDemoAccounts().map((a) => ({ email: a.email, session: sessionFor(a.email) }));

const inGroup = (s: Session, slug: string) => {
  const g = GROUPS.find((x) => x.slug === slug);
  return Boolean(g && GROUP_MEMBERSHIPS.some((r) => r.groupId === g.id && r.memberId === s.memberId && r.state === 'active'));
};

const chapters = GROUPS.filter((g) => g.kind === 'chapter');
const interests = GROUPS.filter((g) => g.kind === 'interest');

// ---------------------------------------------------------------
// Groups and chapters
// ---------------------------------------------------------------

describe('groups: a chapter is for alumni', () => {
  it('has chapters and interest groups to test against', () => {
    expect(chapters.length).toBeGreaterThan(5);
    expect(interests.length).toBeGreaterThan(3);
  });

  it('does not let a student see that any chapter exists, by list or by address', () => {
    expect(getGroups(STUDENT).every((g) => g.kind === 'interest')).toBe(true);
    expect(getGroups(STUDENT, { kind: 'chapter' })).toEqual([]);
    for (const c of chapters) {
      expect(getGroupBySlug(STUDENT, c.slug), c.slug).toBeNull();
      expect(getGroupMembers(STUDENT, c.slug), c.slug).toEqual([]);
    }
  });

  it('leaves a student the interest groups', () => {
    const shown = getGroups(STUDENT).map((g) => g.slug);
    for (const g of interests) expect(shown).toContain(g.slug);
  });

  it('shows an alumnus both kinds', () => {
    const kinds = new Set(getGroups(ALUMNUS).map((g) => g.kind));
    expect(kinds).toEqual(new Set(['chapter', 'interest']));
  });

  it('shows nobody a group without a session', () => {
    expect(getGroups(null)).toEqual([]);
    expect(getGroupBySlug(null, 'ai-and-ml')).toBeNull();
  });

  it('refuses a student the join button for a chapter, with the reason', () => {
    const chapter = getGroupBySlug(ALUMNUS, 'hyderabad-chapter')!;
    const verdict = joinVerdict(STUDENT, { ...chapter, viewer: { state: null, role: null } });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toMatch(/alumni/i);
  });
});

describe('groups: a roster is for the group', () => {
  it('lets a member read the roster and a stranger not', () => {
    const stranger = chapters.find((c) => !inGroup(ALUMNUS, c.slug))!;
    expect(stranger).toBeDefined();

    expect(canSeeRoster(ALUMNUS, 'hyderabad-chapter')).toBe(true);
    expect(getGroupMembers(ALUMNUS, 'hyderabad-chapter').length).toBeGreaterThan(0);

    expect(canSeeRoster(ALUMNUS, stranger.slug)).toBe(false);
    expect(getGroupMembers(ALUMNUS, stranger.slug)).toEqual([]);
  });

  it('still tells a stranger how many are in it and who leads it', () => {
    const stranger = chapters.find((c) => !inGroup(ALUMNUS, c.slug))!;
    const item = getGroupBySlug(ALUMNUS, stranger.slug)!;
    expect(item.memberCount).toBeGreaterThan(0);
    expect(item.leads.length).toBeGreaterThan(0);
  });

  it('opens every roster to the staff who run groups, and to no one else outside the group', () => {
    const closed = chapters.find((c) => !inGroup(ALUMNUS, c.slug) && !inGroup(FACULTY, c.slug) && !inGroup(HOD, c.slug))!;
    for (const staff of [OPERATOR, ADMIN]) expect(canSeeRoster(staff, closed.slug)).toBe(true);
    for (const outsider of [ALUMNUS, FACULTY, HOD, PLACEMENT, FINANCE, VENDOR]) {
      expect(canSeeRoster(outsider, closed.slug), String(outsider.memberId)).toBe(false);
    }
  });

  it('lists a roster\'s leads first', () => {
    const roster = getGroupMembers(ALUMNUS, 'hyderabad-chapter');
    const firstMember = roster.findIndex((r) => r.role === 'member');
    const lastLead = roster.map((r) => r.role).lastIndexOf('lead');
    if (firstMember !== -1) expect(lastLead).toBeLessThan(firstMember);
  });
});

describe('groups: who may run one', () => {
  it('lets a lead run their group and no other', () => {
    expect(canRunGroup(ALUMNUS, 'hyderabad-chapter')).toBe(true);
    expect(canRunGroup(ALUMNUS, 'startups-and-founders')).toBe(true);
    const other = GROUPS.find((g) => !GROUP_MEMBERSHIPS.some((r) => r.groupId === g.id && r.memberId === ALUMNUS.memberId && r.role === 'lead'))!;
    expect(canRunGroup(ALUMNUS, other.slug)).toBe(false);
  });

  it('does not make an ordinary member a lead', () => {
    const membership = GROUP_MEMBERSHIPS.find((r) => r.role === 'member' && r.state === 'active' && r.groupId === 'grp-pune-chapter')!;
    const member = alumnusSession(membership.memberId);
    expect(canSeeRoster(member, 'pune-chapter')).toBe(true);
    expect(canRunGroup(member, 'pune-chapter')).toBe(false);
  });

  it('lets the alumni cell and the college admin run any group, and nobody else', () => {
    for (const g of GROUPS) {
      expect(canRunGroup(OPERATOR, g.slug), g.slug).toBe(true);
      expect(canRunGroup(ADMIN, g.slug), g.slug).toBe(true);
      expect(canRunGroup(VENDOR, g.slug), g.slug).toBe(false);
      expect(canRunGroup(FINANCE, g.slug), g.slug).toBe(false);
      expect(canRunGroup(PLACEMENT, g.slug), g.slug).toBe(false);
    }
  });

  it('shows join requests to the people who run the group and to no one else', () => {
    expect(getGroupRequests(ALUMNUS, 'startups-and-founders')).toHaveLength(2);
    expect(getGroupRequests(ADMIN, 'startups-and-founders')).toHaveLength(2);
    expect(getGroupRequests(OPERATOR, 'startups-and-founders')).toHaveLength(2);

    const ordinary = alumnusSession(GROUP_MEMBERSHIPS.find((r) => r.groupId === 'grp-startups-and-founders' && r.role === 'member' && r.state === 'active')!.memberId);
    expect(getGroupRequests(ordinary, 'startups-and-founders')).toEqual([]);
    expect(getGroupRequests(STUDENT, 'startups-and-founders')).toEqual([]);
    expect(getGroupRequests(VENDOR, 'startups-and-founders')).toEqual([]);
  });

  it('counts waiting requests across the groups a viewer runs', () => {
    expect(countGroupRequests(ALUMNUS)).toBe(2);
    expect(countGroupRequests(ADMIN)).toBe(2);
    expect(countGroupRequests(STUDENT)).toBe(0);
    expect(countGroupRequests(VENDOR)).toBe(0);
  });
});

describe('groups: joining', () => {
  const open = () => getGroupBySlug(ALUMNUS, 'cybersecurity')!;
  const byApproval = () => getGroupBySlug(ALUMNUS, 'startups-and-founders')!;
  const blank = { state: null, role: null } as const;

  it('lets anyone join an open group straight away and asks leads about an approval group', () => {
    expect(joinVerdict(ALUMNUS, { ...open(), viewer: blank })).toEqual({ ok: true, becomes: 'active' });
    expect(joinVerdict(ALUMNUS, { ...byApproval(), viewer: blank })).toEqual({ ok: true, becomes: 'requested' });
  });

  it('lets a student join an interest group', () => {
    expect(joinVerdict(STUDENT, { ...open(), viewer: blank }).ok).toBe(true);
  });

  it('refuses a second join, a request already waiting, and a closed group', () => {
    expect(joinVerdict(ALUMNUS, { ...open(), viewer: { state: 'active', role: 'member' } }).ok).toBe(false);
    expect(joinVerdict(ALUMNUS, { ...byApproval(), viewer: { state: 'requested', role: 'member' } }).ok).toBe(false);
    expect(joinVerdict(ALUMNUS, { ...open(), archived: true, viewer: blank })).toEqual({ ok: false, reason: 'This group is closed.' });
  });

  it('lists a viewer\'s own groups only', () => {
    const mine = getMyGroups(STUDENT).map((g) => g.slug).sort();
    expect(mine).toEqual(['ai-and-ml', 'cybersecurity']);
  });
});

// ---------------------------------------------------------------
// The feed
// ---------------------------------------------------------------

describe('feed: a group\'s post is for the group', () => {
  it('has group posts in the seed to test against', () => {
    expect(POSTS.filter((p) => p.groupSlug).length).toBeGreaterThan(5);
  });

  it('never returns a group post to somebody outside the group, from any demo account', () => {
    for (const { email, session } of ALL_DEMO) {
      const moderator = session.roles.some((r) => r.role === 'alumni_cell_operator' || r.role === 'college_admin');
      for (const post of getFeed(session, { perPage: 50 }).items) {
        if (!post.group) continue;
        expect(moderator || inGroup(session, post.group.slug), `${email} saw ${post.id} in ${post.group.slug}`).toBe(true);
      }
    }
  });

  it('hides a group post from a stranger by address as well as from the list', () => {
    const groupPost = POSTS.find((p) => p.groupSlug === 'pune-chapter')!;
    expect(inGroup(STUDENT, 'pune-chapter')).toBe(false);
    expect(getPostById(STUDENT, groupPost.id)).toBeNull();
    expect(getFeed(STUDENT, { group: 'pune-chapter' }).items).toEqual([]);
  });

  it('shows the same post to a member of the group', () => {
    const groupPost = POSTS.find((p) => p.groupSlug === 'hyderabad-chapter')!;
    expect(getPostById(ALUMNUS, groupPost.id)?.id).toBe(groupPost.id);
  });

  it('lets a student read the posts of an interest group they are in, and not of the others', () => {
    expect(getFeed(STUDENT, { group: 'ai-and-ml' }).items.length).toBeGreaterThan(0);
    expect(getFeed(STUDENT, { group: 'embedded-and-iot' }).items).toEqual([]);
  });
});

describe('feed: a hidden post and its reports', () => {
  const hidden = POSTS.find((p) => p.id === 'post-13')!;
  const author = alumnusSession(hidden.authorId);

  it('is hidden from everyone who is neither a moderator nor the author', () => {
    for (const s of [STUDENT, ALUMNUS, FACULTY, HOD, PLACEMENT, FINANCE]) {
      expect(getPostById(s, hidden.id), String(s.memberId)).toBeNull();
      expect(getFeed(s, { perPage: 50 }).items.map((p) => p.id)).not.toContain(hidden.id);
    }
  });

  it('is shown to its author with the reason and no count of who reported it', () => {
    const seen = getPostById(author, hidden.id)!;
    expect(seen.state).toBe('hidden');
    expect(seen.moderation?.hiddenReason).toMatch(/sales pitch/i);
    expect(seen.moderation?.reportCount).toBe(0);
  });

  it('never carries the reporters\' identities to the author', () => {
    const json = JSON.stringify(getPostById(author, hidden.id));
    for (const r of hidden.reports) expect(json).not.toContain(r.by);
    expect(json).not.toContain('Looks like a recruitment scheme');
  });

  it('is shown to the people who moderate, with the report count', () => {
    for (const s of [OPERATOR, ADMIN]) {
      const seen = getPostById(s, hidden.id)!;
      expect(seen.moderation?.reportCount).toBe(2);
    }
  });

  it('gives a moderator what the reporters wrote and never who they were', () => {
    const seen = getPostById(OPERATOR, hidden.id)!;
    expect(seen.moderation?.reportReasons).toEqual(hidden.reports.map((r) => r.reason));
    const json = JSON.stringify(seen);
    for (const r of hidden.reports) expect(json).not.toContain(r.by);
  });

  it('gives nobody else the reasons, the author included', () => {
    expect(getPostById(author, hidden.id)?.moderation?.reportReasons).toEqual([]);
    for (const s of [STUDENT, ALUMNUS, FACULTY, HOD, PLACEMENT, FINANCE, VENDOR]) {
      expect(getPostById(s, 'post-14')?.moderation ?? null, String(s.memberId)).toBeNull();
    }
  });

  it('keeps a hidden post\'s tags out of the tag cloud', () => {
    expect(getFeedTags(ALUMNUS, 100).map((t) => t.tag)).not.toContain('earn-from-home');
    expect(getFeedTags(ADMIN, 100).map((t) => t.tag)).not.toContain('earn-from-home');
  });

  it('puts the worst case first in the moderation queue, for moderators only', () => {
    const queue = getModerationQueue(ADMIN);
    expect(queue.map((p) => p.id).slice(0, 2)).toEqual(['post-13', 'post-14']);
    for (const s of [STUDENT, ALUMNUS, FACULTY, HOD, PLACEMENT, FINANCE, VENDOR]) {
      expect(getModerationQueue(s), String(s.memberId)).toEqual([]);
    }
  });

  it('counts only live reported posts as work', () => {
    expect(countReportedPosts(ADMIN)).toBe(1);
    expect(countReportedPosts(ALUMNUS)).toBe(0);
    expect(countReportedPosts(VENDOR)).toBe(0);
  });

  it('tells a reporter they reported, and nobody else', () => {
    const reporter = alumnusSession(hidden.reports[0]!.by);
    const live = POSTS.find((p) => p.id === 'post-14')!;
    const liveReporter = alumnusSession(live.reports[0]!.by);
    expect(getPostById(liveReporter, live.id)?.viewerReported).toBe(true);
    expect(getPostById(ALUMNUS, live.id)?.viewerReported).toBe(false);
    expect(reporter).toBeDefined();
  });
});

describe('feed: who may write', () => {
  it('turns a student away from writing anywhere', () => {
    expect(canPostIn(STUDENT, null)).toBe(false);
    expect(canPostIn(STUDENT, 'ai-and-ml')).toBe(false);
  });

  it('lets an alumnus write on the open feed and in their own groups only', () => {
    expect(canPostIn(ALUMNUS, null)).toBe(true);
    expect(canPostIn(ALUMNUS, 'hyderabad-chapter')).toBe(true);
    const stranger = chapters.find((c) => !inGroup(ALUMNUS, c.slug))!;
    expect(canPostIn(ALUMNUS, stranger.slug)).toBe(false);
  });

  it('gives roles with no post capability no voice', () => {
    for (const s of [FINANCE, VENDOR]) expect(canPostIn(s, null), String(s.memberId)).toBe(false);
  });

  it('lets faculty write, which includes the placement officer, who is faculty first', () => {
    expect(canPostIn(FACULTY, null)).toBe(true);
    expect(canPostIn(PLACEMENT, null)).toBe(true);
  });
});

describe('feed: paging', () => {
  it('clamps a page size and a page number rather than erroring', () => {
    const wide = getFeed(ALUMNUS, { perPage: 9999 });
    expect(wide.perPage).toBe(50);
    const tiny = getFeed(ALUMNUS, { perPage: 0 });
    expect(tiny.perPage).toBe(1);
    const far = getFeed(ALUMNUS, { perPage: 5, page: 9999 });
    expect(far.page).toBe(far.pageCount);
    expect(far.items.length).toBeGreaterThan(0);
  });

  it('puts the newest first', () => {
    const items = getFeed(ADMIN, { perPage: 50 }).items;
    const stamps = items.map((p) => p.createdAt);
    expect([...stamps].sort().reverse()).toEqual(stamps);
  });
});

// ---------------------------------------------------------------
// Business directory
// ---------------------------------------------------------------

describe('businesses: contact needs both gates', () => {
  const OWNER = ALUMNUS.memberId;
  const listing = (showContact: boolean) => ({ ownerId: OWNER, showContact });
  const as = (s: Session) => ({ memberId: s.memberId, roles: s.roles });

  it('never releases to a student, even when the owner shares', () => {
    expect(releasesBusinessContact(as(STUDENT), listing(true))).toBe(false);
  });

  it('never releases on a role alone: staff see nothing the owner did not share', () => {
    for (const s of [ADMIN, OPERATOR, HOD, PLACEMENT, FACULTY, FINANCE, VENDOR]) {
      expect(releasesBusinessContact(as(s), listing(false)), String(s.memberId)).toBe(false);
    }
  });

  it('releases to an entitled viewer when the owner shares', () => {
    for (const s of [FACULTY, HOD, OPERATOR, ADMIN]) {
      expect(releasesBusinessContact(as(s), listing(true)), String(s.memberId)).toBe(true);
    }
  });

  it('always releases to the owner', () => {
    expect(releasesBusinessContact(as(ALUMNUS), listing(false))).toBe(true);
  });

  it('applies the same rule through the read layer, for every viewer and every listing', () => {
    for (const { email, session } of ALL_DEMO) {
      for (const b of BUSINESSES) {
        const item = getBusinessBySlug(session, b.slug);
        if (!item) continue;
        const entitled = releasesBusinessContact(session, b);
        const hasDetails = Boolean(b.contactEmail || b.contactPhone);
        expect(item.contact !== null, `${email} / ${b.slug}`).toBe(entitled && hasDetails);
      }
    }
  });

  it('holds the contact details of a listing out of a student\'s list view as well', () => {
    const page = getBusinesses(STUDENT, { perPage: 50 });
    expect(page.items.length).toBeGreaterThan(0);
    for (const item of page.items) expect(item.contact, item.slug).toBeNull();
    expect(JSON.stringify(page)).not.toContain('nimbus.example');
  });
});

describe('businesses: only live listings are public', () => {
  const pending = BUSINESSES.filter((b) => b.status === 'pending_moderation');
  const rejected = BUSINESSES.filter((b) => b.status === 'rejected');

  it('has a pending and a refused listing to test against', () => {
    expect(pending.length).toBeGreaterThan(0);
    expect(rejected.length).toBeGreaterThan(0);
  });

  it('hides them from everyone but the owner and the moderators', () => {
    for (const b of [...pending, ...rejected]) {
      for (const s of [STUDENT, FACULTY, HOD, PLACEMENT, FINANCE, VENDOR]) {
        expect(getBusinessBySlug(s, b.slug), `${b.slug} / ${String(s.memberId)}`).toBeNull();
      }
      expect(getBusinessBySlug(ADMIN, b.slug)?.slug).toBe(b.slug);
      expect(getBusinessBySlug(OPERATOR, b.slug)?.slug).toBe(b.slug);
      expect(getBusinessBySlug(alumnusSession(b.ownerId), b.slug)?.slug).toBe(b.slug);
    }
  });

  it('keeps them out of the public list, even for a moderator', () => {
    const names = getBusinesses(ADMIN, { perPage: 50 }).items.map((i) => i.status);
    expect(new Set(names)).toEqual(new Set(['live']));
  });

  it('gives only the owner and moderators the reason a listing was refused', () => {
    const b = rejected[0]!;
    expect(getBusinessBySlug(alumnusSession(b.ownerId), b.slug)?.moderationNote).toBe(b.moderationNote);
    expect(getBusinessBySlug(ADMIN, b.slug)?.moderationNote).toBe(b.moderationNote);
  });

  it('shows the review queue to moderators alone', () => {
    expect(getPendingBusinesses(ADMIN).length).toBe(pending.length);
    expect(countPendingBusinesses(OPERATOR)).toBe(pending.length);
    for (const s of [STUDENT, ALUMNUS, FACULTY, HOD, PLACEMENT, FINANCE, VENDOR]) {
      expect(getPendingBusinesses(s), String(s.memberId)).toEqual([]);
      expect(countPendingBusinesses(s)).toBe(0);
    }
  });

  it('refuses \'all\' to someone who is not a moderator', () => {
    expect(getBusinesses(ALUMNUS, { status: 'all' }).items).toEqual([]);
  });

  it('treats an address in any state as taken', () => {
    for (const b of BUSINESSES) expect(businessSlugTaken(b.slug)).toBe(true);
    expect(businessSlugTaken('no-such-business')).toBe(false);
  });
});

describe('businesses: search', () => {
  it('requires every word to match', () => {
    const all = getBusinesses(ALUMNUS, { perPage: 50 }).total;
    const one = getBusinesses(ALUMNUS, { q: 'cloud', perPage: 50 }).total;
    const both = getBusinesses(ALUMNUS, { q: 'cloud zzzznotaword', perPage: 50 }).total;
    expect(one).toBeGreaterThan(0);
    expect(one).toBeLessThan(all);
    expect(both).toBe(0);
  });
});

// ---------------------------------------------------------------
// The showcase
// ---------------------------------------------------------------

describe('showcase: consent or a source', () => {
  it('has every seeded published entry passing its own publication check', () => {
    const published = SHOWCASE.filter((e) => e.state === 'published');
    expect(published.length).toBeGreaterThan(10);
    for (const e of published) expect(publicationProblem(e), e.slug).toBeNull();
  });

  it('needs a member\'s agreement on record', () => {
    expect(publicationProblem({ memberId: 'mem-1', sourceUrl: null, consentRecordedAt: null })).toMatch(/agreement/i);
    expect(publicationProblem({ memberId: 'mem-1', sourceUrl: null, consentRecordedAt: '2026-08-01T00:00:00Z' })).toBeNull();
  });

  it('does not accept a source in place of a member\'s agreement', () => {
    expect(publicationProblem({ memberId: 'mem-1', sourceUrl: 'https://example.com/press', consentRecordedAt: null })).not.toBeNull();
  });

  it('needs a public source for somebody who is not a member', () => {
    expect(publicationProblem({ memberId: null, sourceUrl: null, consentRecordedAt: null })).toMatch(/already published/i);
    expect(publicationProblem({ memberId: null, sourceUrl: 'https://example.com/press', consentRecordedAt: null })).toBeNull();
  });
});

describe('showcase: submissions wait for review', () => {
  const pending = SHOWCASE.filter((e) => e.state === 'pending_moderation');
  const declined = SHOWCASE.find((e) => e.state === 'rejected')!;

  it('has pending and declined entries to test against', () => {
    expect(pending.length).toBeGreaterThan(0);
    expect(declined).toBeDefined();
  });

  it('shows members published entries only', () => {
    for (const s of [STUDENT, FACULTY, HOD, PLACEMENT]) {
      expect(getShowcase(s).every((e) => e.state === 'published'), String(s.memberId)).toBe(true);
    }
  });

  it('hides a pending entry from everyone but its submitter and the curators', () => {
    for (const e of pending) {
      const submitter = alumnusSession(e.submittedById!);
      expect(getShowcaseBySlug(submitter, e.slug)?.slug).toBe(e.slug);
      expect(getShowcaseBySlug(ADMIN, e.slug)?.slug).toBe(e.slug);
      expect(getShowcaseBySlug(OPERATOR, e.slug)?.slug).toBe(e.slug);
      for (const s of [STUDENT, FACULTY, HOD, PLACEMENT, FINANCE, VENDOR]) {
        expect(getShowcaseBySlug(s, e.slug), `${e.slug} / ${String(s.memberId)}`).toBeNull();
      }
    }
  });

  it('keeps the reason for a decline between the submitter and the curators', () => {
    const submitter = alumnusSession(declined.submittedById!);
    expect(getShowcaseBySlug(submitter, declined.slug)?.moderationNote).toBe(declined.moderationNote);
    expect(getShowcaseBySlug(ADMIN, declined.slug)?.moderationNote).toBe(declined.moderationNote);
    expect(getShowcaseBySlug(ALUMNUS, declined.slug)).toBeNull();
  });

  it('gives the curators every state and everyone else nothing', () => {
    expect(getShowcaseForCurator(ADMIN).length).toBe(SHOWCASE.length);
    expect(getPendingShowcase(OPERATOR).length).toBe(pending.length);
    expect(countPendingShowcase(ADMIN)).toBe(pending.length);
    for (const s of [STUDENT, ALUMNUS, FACULTY, HOD, PLACEMENT, FINANCE, VENDOR]) {
      expect(getShowcaseForCurator(s), String(s.memberId)).toEqual([]);
      expect(getPendingShowcase(s)).toEqual([]);
      expect(countPendingShowcase(s)).toBe(0);
    }
  });

  it('puts what needs a decision first for a curator', () => {
    const states = getShowcaseForCurator(ADMIN).map((e) => e.state);
    const firstOther = states.findIndex((s) => s !== 'pending_moderation');
    expect(states.slice(0, firstOther).every((s) => s === 'pending_moderation')).toBe(true);
  });

  it('lists a member\'s own submissions in any state under mine', () => {
    const submitter = alumnusSession(declined.submittedById!);
    expect(getShowcase(submitter, { mine: true }).map((e) => e.slug)).toContain(declined.slug);
  });
});

// ---------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------

describe('invitations: a third party\'s details', () => {
  it('shows an inviter their own list and nobody else\'s', () => {
    const mine = getMyInvitations(ALUMNUS);
    expect(mine.length).toBe(INVITATIONS.filter((i) => i.inviterId === ALUMNUS.memberId).length);
    const others = INVITATIONS.filter((i) => i.inviterId !== ALUMNUS.memberId);
    expect(others.length).toBeGreaterThan(0);
    const json = JSON.stringify(mine);
    for (const o of others) expect(json).not.toContain(o.email);
  });

  it('shows the college, the vendor and a student an empty list', () => {
    for (const s of [ADMIN, OPERATOR, VENDOR, STUDENT, HOD]) expect(getMyInvitations(s), String(s.memberId)).toEqual([]);
  });

  it('counts only the last seven days against the weekly limit', () => {
    const q = getInviteQuota(ALUMNUS);
    // inv-1 (3 days ago) counts; inv-2 (21 days) and inv-3 (95 days) do not.
    expect(q.sentThisWeek).toBe(1);
    expect(q.weeklyLimit).toBe(INVITE_WEEKLY_LIMIT);
    expect(q.remaining).toBe(INVITE_WEEKLY_LIMIT - 1);
    expect(q.canSend).toBe(true);
    expect(q.reason).toBeNull();
  });

  it('frees the allowance as invitations age out of the week', () => {
    const later = new Date(SEED_NOW.getTime() + 8 * 86400000);
    expect(getInviteQuota(ALUMNUS, later).sentThisWeek).toBe(0);
  });

  it('refuses at the limit, with a sentence that says when it frees up', () => {
    // The seed holds one this week; add the rest, then take them out again.
    const added = Array.from({ length: INVITE_WEEKLY_LIMIT - 1 }, (_, i) => ({
      id: `inv-test-${i}`,
      inviterId: ALUMNUS.memberId,
      email: `test.${i}@example.com`,
      name: null,
      batchYear: null,
      message: null,
      state: 'sent' as const,
      createdAt: new Date(SEED_NOW.getTime() - 86400000).toISOString(),
    }));
    INVITATIONS.push(...added);
    try {
      const q = getInviteQuota(ALUMNUS);
      expect(q.sentThisWeek).toBe(INVITE_WEEKLY_LIMIT);
      expect(q.remaining).toBe(0);
      expect(q.canSend).toBe(false);
      expect(q.reason).toMatch(/seven days/);
      // Somebody else's allowance is their own.
      expect(getInviteQuota(HOD).canSend).toBe(true);
    } finally {
      INVITATIONS.splice(INVITATIONS.length - added.length, added.length);
    }
    expect(getInviteQuota(ALUMNUS).sentThisWeek).toBe(1);
  });
});

// ---------------------------------------------------------------
// The help desk
// ---------------------------------------------------------------

describe('help desk: a member describing their own account', () => {
  const ticket = TICKETS.find((t) => t.memberId === ALUMNUS.memberId)!;

  it('shows a member their own tickets and not other people\'s', () => {
    const mine = getMyTickets(ALUMNUS);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((t) => t.memberId === ALUMNUS.memberId)).toBe(true);
  });

  it('opens a ticket to its author and to the people who answer tickets', () => {
    expect(getTicketForViewer(ALUMNUS, ticket.id)?.id).toBe(ticket.id);
    expect(getTicketForViewer(OPERATOR, ticket.id)?.id).toBe(ticket.id);
    expect(getTicketForViewer(ADMIN, ticket.id)?.id).toBe(ticket.id);
  });

  it('answers by reference as well as by id', () => {
    expect(getTicketForViewer(ALUMNUS, ticket.reference)?.id).toBe(ticket.id);
  });

  it('turns everyone else away: other members, other staff, and the vendor', () => {
    for (const s of [STUDENT, FACULTY, HOD, PLACEMENT, FINANCE, VENDOR]) {
      expect(getTicketForViewer(s, ticket.id), String(s.memberId)).toBeNull();
    }
  });

  it('answers an unknown ticket the same way as a forbidden one', () => {
    expect(getTicketForViewer(STUDENT, ticket.id)).toBe(getTicketForViewer(STUDENT, 'HD-9999'));
  });

  it('gives the queue to the people who answer tickets alone', () => {
    expect(getTicketQueue(OPERATOR).length).toBeGreaterThan(0);
    expect(getTicketQueue(ADMIN).length).toBeGreaterThan(0);
    for (const s of [STUDENT, ALUMNUS, FACULTY, HOD, PLACEMENT, FINANCE, VENDOR]) {
      expect(getTicketQueue(s, { state: 'all' }), String(s.memberId)).toEqual([]);
      expect(countOpenTickets(s)).toEqual({ open: 0, oldestAt: null });
    }
  });

  it('works the open queue oldest first', () => {
    const open = getTicketQueue(OPERATOR);
    expect(open.every((t) => t.state === 'open')).toBe(true);
    const stamps = open.map((t) => t.createdAt);
    expect([...stamps].sort()).toEqual(stamps);
  });

  it('numbers the next reference after the highest existing one', () => {
    const highest = Math.max(...TICKETS.map((t) => Number(t.reference.replace(/\D/g, ''))));
    expect(nextTicketReference()).toBe(`HD-${highest + 1}`);
  });
});

// ---------------------------------------------------------------
// Pages the college edits
// ---------------------------------------------------------------

describe('pages: audiences and drafts', () => {
  const publicPage = CMS_PAGES.find((p) => p.audience === 'public' && p.published)!;
  const membersPage = CMS_PAGES.find((p) => p.audience === 'members' && p.published)!;
  const draft = CMS_PAGES.find((p) => !p.published)!;

  it('has one of each to test against', () => {
    expect(publicPage).toBeDefined();
    expect(membersPage).toBeDefined();
    expect(draft).toBeDefined();
  });

  it('shows a published public page to anyone, signed in or not', () => {
    expect(getPageBySlug(null, publicPage.slug)?.slug).toBe(publicPage.slug);
    expect(getPageBySlug(STUDENT, publicPage.slug)?.slug).toBe(publicPage.slug);
  });

  it('keeps a members page from the public and shows it to an active member', () => {
    expect(getPageBySlug(null, membersPage.slug)).toBeNull();
    expect(getPageBySlug(STUDENT, membersPage.slug)?.slug).toBe(membersPage.slug);
    expect(getPageBySlug(ALUMNUS, membersPage.slug)?.slug).toBe(membersPage.slug);
  });

  it('keeps a draft from everyone but the people who edit pages', () => {
    for (const s of [null, STUDENT, ALUMNUS, HOD, FINANCE, VENDOR]) {
      expect(getPageBySlug(s, draft.slug)).toBeNull();
    }
    expect(getPageBySlug(ADMIN, draft.slug)?.slug).toBe(draft.slug);
    expect(getPageBySlug(OPERATOR, draft.slug)?.slug).toBe(draft.slug);
  });

  it('answers an unknown address, a draft and a members page the same way for the public', () => {
    const answers = [getPageBySlug(null, 'no-such-page'), getPageBySlug(null, draft.slug), getPageBySlug(null, membersPage.slug)];
    expect(answers).toEqual([null, null, null]);
  });

  it('keeps a members-only page out of the public footer even if it is flagged for it', () => {
    const leaky: CmsPage = { ...membersPage, id: 'page-leak', slug: 'leaky', showInFooter: true };
    CMS_PAGES.push(leaky);
    try {
      expect(getFooterPages().map((p) => p.slug)).not.toContain('leaky');
      expect(getMemberPages().map((p) => p.slug)).toContain('leaky');
    } finally {
      CMS_PAGES.pop();
    }
  });

  it('puts only published, public, flagged pages in the footer', () => {
    const footer = getFooterPages().map((p) => p.slug);
    expect(footer).toContain(publicPage.slug);
    expect(footer).not.toContain(draft.slug);
    expect(footer).not.toContain(membersPage.slug);
  });

  it('gives the console to the people who edit pages and nobody else', () => {
    expect(getAllPages(ADMIN).length).toBe(CMS_PAGES.length);
    expect(getAllPages(OPERATOR).length).toBe(CMS_PAGES.length);
    for (const s of [STUDENT, ALUMNUS, FACULTY, HOD, PLACEMENT, FINANCE, VENDOR]) expect(getAllPages(s), String(s.memberId)).toEqual([]);
  });
});

// ---------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------

describe('reunion milestones', () => {
  it('finds the anniversaries colleges actually keep', () => {
    expect(reunionMilestone(2016, 2026)?.label).toBe('Decade reunion');
    expect(reunionMilestone(2001, 2026)?.label).toBe('Silver jubilee');
    expect(reunionMilestone(1976, 2026)?.label).toBe('Golden jubilee');
  });

  it('finds none in between', () => {
    for (const years of [1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 16]) {
      expect(reunionMilestone(2026 - years, 2026), String(years)).toBeNull();
    }
  });

  it('looks at this year and next, soonest first, and never invents a batch', () => {
    // 2016 is ten years on in 2026, 2021 is five, 2017 is ten in 2027. 2015 (11) and 2020 (6) are no milestone.
    const found = upcomingReunionMilestones([2017, 2016, 2015, 2021, 2020, 2016], 2026);
    expect(found.map((m) => [m.batchYear, m.year])).toEqual([
      [2016, 2026],
      [2021, 2026],
      [2017, 2027],
    ]);
    expect(upcomingReunionMilestones([], 2026)).toEqual([]);
    // 2016 appears once even though the register listed it twice.
    expect(found.filter((m) => m.batchYear === 2016)).toHaveLength(1);
  });

  it('reaches into next year', () => {
    const found = upcomingReunionMilestones([2017], 2026);
    expect(found).toEqual([expect.objectContaining({ batchYear: 2017, year: 2027, years: 10 })]);
  });
});

describe('normaliseTags', () => {
  it('lowercases, strips hashes and joins words with hyphens', () => {
    expect(normaliseTags(['#Hiring', 'Open Source', 'BATCH of 2014'])).toEqual(['hiring', 'open-source', 'batch-of-2014']);
  });

  it('accepts a comma or newline separated string', () => {
    expect(normaliseTags('go, rust\nzig')).toEqual(['go', 'rust', 'zig']);
  });

  it('drops accents and symbols, empties and duplicates', () => {
    expect(normaliseTags(['Café', 'cafe', '   ', '!!!', 'c++'])).toEqual(['cafe', 'c']);
  });

  it('keeps at most five, and each at most 24 characters with no trailing hyphen', () => {
    expect(normaliseTags(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toHaveLength(5);
    const [long] = normaliseTags(['x'.repeat(23) + '-yyyy']);
    expect(long!.length).toBeLessThanOrEqual(24);
    expect(long).not.toMatch(/-$/);
  });

  it('copes with nothing', () => {
    expect(normaliseTags(undefined)).toEqual([]);
    expect(normaliseTags(null)).toEqual([]);
    expect(normaliseTags('')).toEqual([]);
  });
});

describe('slugify and excerpt', () => {
  it('makes addresses that satisfy the slug pattern', () => {
    for (const s of ['Nimbus Cloud Labs', "Kolli's Interiors", 'Ünïcode  &  Spaces!!', '---', '', 'a'.repeat(200)]) {
      expect(slugify(s), s).toMatch(SLUG_PATTERN);
    }
  });

  it('drops apostrophes instead of splitting on them', () => {
    expect(slugify("Kolli's Interiors")).toBe('kollis-interiors');
    expect(slugify('Kolli’s Interiors')).toBe('kollis-interiors');
  });

  it('falls back when nothing usable is left, and honours its limit', () => {
    expect(slugify('!!!', 64, 'page')).toBe('page');
    expect(slugify('word '.repeat(40), 20).length).toBeLessThanOrEqual(20);
  });

  it('cuts at a word, not in the middle of one, and says so', () => {
    const text = 'The monthly meetup is on. Same place as last time; the exact venue is on the event page.';
    const cut = excerpt(text, 40);
    expect(cut.endsWith('…')).toBe(true);
    expect(cut.length).toBeLessThanOrEqual(41);
    expect(text.startsWith(cut.slice(0, -1))).toBe(true);
    expect(excerpt('Short.', 40)).toBe('Short.');
  });
});

describe('the event kinds the database and the app agree on', () => {
  it('are exactly the values of the event_kind enum', () => {
    expect([...EVENT_KIND_VALUES].sort()).toEqual(['campus', 'hackathon', 'meetup', 'other', 'reunion', 'webinar', 'workshop']);
  });
});

// ---------------------------------------------------------------
// The seeded stories fit the people they are about
// ---------------------------------------------------------------

describe('seeded stories fit the people they are about', () => {
  const entry = (slug: string) => SHOWCASE.find((e) => e.slug === slug)!;
  const person = (slug: string) => findMemberById(entry(slug).memberId!)!;

  it('puts the earliest ECE batch behind "the first batch the ECE department sent out"', () => {
    const m = person('managing-director-semiconductor');
    expect(m.departmentCode).toBe('ECE');
    expect(m.batchYear).toBe(2013);
  });

  it('gives each career story a graduate with the years and the branch behind it', () => {
    const fits: Array<[string, string, number]> = [
      ['collector-civil-services', 'CIVIL', 2015],
      ['professor-iit', 'ECE', 2016],
      ['scientist-space-agency', 'ECE', 2018],
      ['chief-engineer-power-utility', 'EEE', 2015],
    ];
    for (const [slug, dept, latest] of fits) {
      const m = person(slug);
      expect(m.departmentCode, slug).toBe(dept);
      expect(m.batchYear!, slug).toBeLessThanOrEqual(latest);
    }
  });

  it('keeps the promotion post and its achievement about one person, nine years out, with the batch the text names', () => {
    const post = POSTS.find((p) => p.id === 'post-2')!;
    const e = entry('promoted-vice-president');
    expect(post.authorId).toBe(e.memberId);
    const m = person('promoted-vice-president');
    expect(m.batchYear).toBe(SEED_NOW.getUTCFullYear() - 9);
    expect(post.body).toContain(`batch of ${m.batchYear}`);
    expect(e.summary).toContain(`batch of ${m.batchYear}`);
    expect(post.tags).toContain(`batch-of-${m.batchYear}`);
  });

  it('features nobody twice', () => {
    const ids = SHOWCASE.map((e) => e.memberId).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('refers to nobody by a pronoun, because the seed does not know how anyone is referred to', () => {
    const PRONOUN = /\b(she|he|his|her|hers|him)\b/i;
    for (const e of SHOWCASE) {
      expect(`${e.headline} ${e.summary} ${e.story ?? ''}`, e.slug).not.toMatch(PRONOUN);
    }
  });

  it('shows a featured person\'s batch and branch and not a job title that could contradict the headline', async () => {
    // The card and the page print what the entry says; a profile\'s designation can disagree with it.
    const { readFileSync } = await import('node:fs');
    const card = readFileSync('src/components/community/ShowcaseCard.tsx', 'utf8');
    expect(card).not.toMatch(/designation|currentCompany/);
  });
});

// ---------------------------------------------------------------
// An event's join link
// ---------------------------------------------------------------

describe('an event\'s join link', () => {
  const online = EVENTS.filter((e) => e.mode !== 'in_person' && e.meetingUrl && e.published && e.reviewState === 'approved');
  const registered = (s: Session, eventId: string) => EVENT_REGISTRATIONS.some((r) => r.eventId === eventId && r.memberId === s.memberId);
  const organiser = (s: Session) => s.roles.some((r) => r.role === 'alumni_cell_operator' || r.role === 'college_admin');

  it('has online events with a link to test against', () => {
    expect(online.length).toBeGreaterThan(0);
  });

  it('reaches a registrant or an organiser, and nobody else, by address and by list', () => {
    for (const e of online) {
      for (const { email, session } of ALL_DEMO) {
        const entitled = registered(session, e.id) || organiser(session);
        const byAddress = getEventBySlug(session, e.slug)?.meetingUrl ?? null;
        const inList = getEvents(session, { when: 'all' }).find((x) => x.id === e.id)?.meetingUrl ?? null;
        expect(byAddress, `${email} by address: ${e.slug}`).toBe(entitled ? e.meetingUrl : null);
        expect(inList, `${email} in the list: ${e.slug}`).toBe(entitled ? e.meetingUrl : null);
      }
    }
  });

  it('is never in what a stranger is sent, however the page is built', () => {
    for (const e of online) {
      const url = e.meetingUrl!;
      for (const s of [STUDENT, ALUMNUS, FACULTY, HOD, FINANCE, VENDOR]) {
        if (registered(s, e.id)) continue;
        expect(JSON.stringify(getEvents(s, { when: 'all' })), `${String(s.memberId)}: ${e.slug}`).not.toContain(url);
        expect(JSON.stringify(getEventBySlug(s, e.slug)), `${String(s.memberId)}: ${e.slug}`).not.toContain(url);
      }
    }
  });

  it('reaches a member who registers, which is what registering is for', () => {
    const e = online.find((x) => EVENT_REGISTRATIONS.some((r) => r.eventId === x.id));
    expect(e, 'an online event with a registrant').toBeDefined();
    const reg = EVENT_REGISTRATIONS.find((r) => r.eventId === e!.id)!;
    const member = alumnusSession(reg.memberId);
    expect(getEventBySlug(member, e!.slug)?.meetingUrl).toBe(e!.meetingUrl);
  });

  it('lists a proposal waiting for review to the organisers who ask for drafts', () => {
    const waiting = EVENTS.filter((e) => e.reviewState === 'pending');
    expect(waiting.length).toBeGreaterThan(0);
    for (const e of waiting) expect(getEvents(ADMIN, { when: 'all', includeDrafts: true }).some((x) => x.id === e.id)).toBe(true);
  });
});
