import type { MemberSummary } from './types';

/**
 * The shapes the community modules hand to the UI.
 *
 * Same rule as `types.ts`: these are not database rows. A member is only
 * ever carried as a `MemberSummary`, which the repository has already
 * narrowed to what the viewer's tier may see, so a list of group members
 * or a feed of posts can never be one careless spread away from a contact
 * detail. Where a contact detail *is* part of the product (a business a
 * member chose to list), it is its own optional field and is present only
 * when both release gates have passed.
 */

// ---------------------------------------------------------------
// Events: the parts added for webinars, reunions and chapter meetups
// ---------------------------------------------------------------

export type EventKind = 'reunion' | 'meetup' | 'webinar' | 'workshop' | 'hackathon' | 'campus' | 'other';

/** Where it happens. Hybrid events have a venue and a link. */
export type EventMode = 'in_person' | 'online' | 'hybrid';

/**
 * Where an event stands in review. Staff-created events are `approved`
 * from the start. A member's proposal is `pending` until the alumni cell
 * decides, and `published` on the event stays false until then, so every
 * existing listing that filters on it keeps hiding a proposal.
 */
export type EventReviewState = 'approved' | 'pending' | 'rejected';

// ---------------------------------------------------------------
// Groups
// ---------------------------------------------------------------

export type GroupKind = 'chapter' | 'interest';
export type GroupJoinPolicy = 'open' | 'approval';
export type GroupMemberRole = 'member' | 'lead';
export type GroupMembershipState = 'active' | 'requested';

export interface GroupItem {
  id: string;
  slug: string;
  name: string;
  kind: GroupKind;
  description: string | null;
  /** A chapter's place. Null for an interest group. */
  city: string | null;
  /** ISO 3166 alpha-2, as on a member's profile. */
  country: string | null;
  joinPolicy: GroupJoinPolicy;
  /** Active members only. A pending request is not a member. */
  memberCount: number;
  archived: boolean;
  createdAt: string;
  /** The viewer's own standing, so a card can say "Joined" without a second call. */
  viewer: { state: GroupMembershipState | null; role: GroupMemberRole | null };
  /** Narrowed to the viewer's tier like every other member list. */
  leads: MemberSummary[];
}

export interface GroupMemberItem {
  member: MemberSummary;
  role: GroupMemberRole;
  state: GroupMembershipState;
  joinedAt: string;
}

// ---------------------------------------------------------------
// The community feed
// ---------------------------------------------------------------

export type PostKind = 'update' | 'achievement' | 'question' | 'opportunity';
export type PostState = 'published' | 'hidden';

export interface PostGroupRef {
  id: string;
  slug: string;
  name: string;
}

export interface PostItem {
  id: string;
  kind: PostKind;
  body: string;
  tags: string[];
  author: MemberSummary;
  group: PostGroupRef | null;
  state: PostState;
  createdAt: string;
  likeCount: number;
  viewerLiked: boolean;
  /**
   * Moderators only. Null for everyone else, including the author.
   *
   * `reportReasons` is what reporters wrote, in the order they wrote it, and
   * never who they are: a moderator needs the reason to decide, and a reporter
   * needs the author not to learn they reported.
   */
  moderation: { reportCount: number; reportReasons: string[]; hiddenReason: string | null } | null;
  viewerReported: boolean;
}

// ---------------------------------------------------------------
// The business directory
// ---------------------------------------------------------------

export type BusinessState = 'pending_moderation' | 'live' | 'rejected' | 'closed';

export interface BusinessItem {
  id: string;
  slug: string;
  name: string;
  industry: string;
  description: string;
  city: string | null;
  region: string | null;
  country: string | null;
  website: string | null;
  products: string[];
  services: string[];
  owner: MemberSummary;
  status: BusinessState;
  /** Shown to the owner and to moderators only. */
  moderationNote: string | null;
  createdAt: string;
  /**
   * The owner's published way to be reached about the business. Present only
   * when both gates pass: the viewer is not a student, and the owner chose to
   * show it. Never populated speculatively.
   */
  contact: { email: string | null; phone: string | null } | null;
  /** Whether the owner has chosen to show contact details at all. */
  contactShared: boolean;
}

export interface BusinessFacets {
  industries: Array<{ value: string; count: number }>;
  cities: Array<{ value: string; count: number }>;
}

// ---------------------------------------------------------------
// Showcase: prominent alumni, achievements, success stories
// ---------------------------------------------------------------

export type ShowcaseKind = 'prominent' | 'achievement' | 'story';

export type ShowcaseCategory =
  | 'leadership'
  | 'entrepreneur'
  | 'civil_services'
  | 'academia'
  | 'public_sector'
  | 'defence_space'
  | 'research'
  | 'arts_sports'
  | 'social_impact';

export type ShowcaseState = 'pending_moderation' | 'published' | 'rejected';

export interface ShowcaseEntry {
  id: string;
  slug: string;
  kind: ShowcaseKind;
  category: ShowcaseCategory;
  headline: string;
  summary: string;
  story: string | null;
  /** The name as it should read. Always present; the member link is optional. */
  displayName: string;
  /** Set when the person is on the portal. The profile applies its own rules. */
  member: MemberSummary | null;
  batchYear: number | null;
  departmentCode: string | null;
  achievedOn: string | null;
  /** A public source, for a person who is not on the portal. */
  sourceUrl: string | null;
  featured: boolean;
  source: 'curated' | 'submitted';
  state: ShowcaseState;
  /** Moderators and the submitter only. */
  moderationNote: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------

export type InvitationState = 'sent' | 'joined' | 'expired';

export interface InvitationItem {
  id: string;
  email: string;
  name: string | null;
  batchYear: number | null;
  message: string | null;
  state: InvitationState;
  createdAt: string;
}

export interface InviteQuota {
  sentThisWeek: number;
  weeklyLimit: number;
  remaining: number;
  canSend: boolean;
  reason: string | null;
}

// ---------------------------------------------------------------
// Help desk
// ---------------------------------------------------------------

export type TicketKind = 'help' | 'feedback' | 'bug';
export type TicketCategory = 'account' | 'verification' | 'profile' | 'privacy' | 'events' | 'jobs' | 'other';
export type TicketState = 'open' | 'answered' | 'closed';

export interface TicketMessage {
  id: string;
  authorName: string;
  fromStaff: boolean;
  body: string;
  createdAt: string;
}

export interface TicketItem {
  id: string;
  /** What the member quotes: HD-1042. */
  reference: string;
  kind: TicketKind;
  category: TicketCategory;
  subject: string;
  /** The page the feedback button was pressed on, for feedback only. */
  pagePath: string | null;
  state: TicketState;
  createdAt: string;
  updatedAt: string;
  memberId: string;
  memberName: string;
  messages: TicketMessage[];
}

// ---------------------------------------------------------------
// Pages the college edits itself
// ---------------------------------------------------------------

export type PageAudience = 'public' | 'members';

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  /** A small, safe Markdown subset. See `lib/content/markdown.tsx`. */
  body: string;
  audience: PageAudience;
  published: boolean;
  showInFooter: boolean;
  sortOrder: number;
  updatedAt: string;
  updatedBy: string | null;
}
