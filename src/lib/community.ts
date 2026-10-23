import type {
  BusinessState,
  EventKind,
  EventMode,
  EventReviewState,
  GroupKind,
  PostKind,
  ShowcaseCategory,
  ShowcaseKind,
  ShowcaseState,
  TicketCategory,
  TicketKind,
  TicketState,
} from './data/types';

/**
 * Labels and pure helpers for the community modules.
 *
 * Client-safe on purpose: nothing here imports the seed or the repository,
 * so a composer or a filter bar can use the same words as the server
 * without bundling a fixture dataset to learn what "workshop" is called.
 */

// ---------------------------------------------------------------
// Events
// ---------------------------------------------------------------

export const EVENT_KINDS: ReadonlyArray<{ value: EventKind; label: string; plural: string; blurb: string }> = [
  { value: 'reunion', label: 'Reunion', plural: 'Reunions', blurb: 'A batch or the whole college, back together.' },
  { value: 'meetup', label: 'Meetup', plural: 'Meetups', blurb: 'A chapter or a group meeting in person.' },
  { value: 'webinar', label: 'Webinar', plural: 'Webinars', blurb: 'A talk or panel online.' },
  { value: 'workshop', label: 'Workshop', plural: 'Workshops', blurb: 'Hands-on or a career session.' },
  { value: 'hackathon', label: 'Hackathon', plural: 'Hackathons', blurb: 'Teams building something against the clock.' },
  { value: 'campus', label: 'Campus event', plural: 'Campus events', blurb: 'On campus: convocations, lectures, open days.' },
  { value: 'other', label: 'Other', plural: 'Other', blurb: 'Anything that does not fit the rest.' },
];

export const EVENT_KIND_VALUES = EVENT_KINDS.map((k) => k.value) as [EventKind, ...EventKind[]];

export function eventKindLabel(kind: EventKind): string {
  return EVENT_KINDS.find((k) => k.value === kind)?.label ?? 'Event';
}

export const EVENT_MODES: ReadonlyArray<{ value: EventMode; label: string; hint: string }> = [
  { value: 'in_person', label: 'In person', hint: 'Everyone comes to a place.' },
  { value: 'online', label: 'Online', hint: 'A link, shown to people who register.' },
  { value: 'hybrid', label: 'In person and online', hint: 'A place and a link.' },
];

export function eventModeLabel(mode: EventMode): string {
  return EVENT_MODES.find((m) => m.value === mode)?.label ?? 'In person';
}

export const REVIEW_STATE_LABELS: Record<EventReviewState, string> = {
  approved: 'Approved',
  pending: 'Waiting for the alumni cell',
  rejected: 'Not approved',
};

// ---------------------------------------------------------------
// Reunions
// ---------------------------------------------------------------

/**
 * The anniversaries a reunion is usually built around, counted from the year
 * a batch passed out. A college decides for itself which ones it keeps;
 * these are the ones every alumni office already knows.
 */
const MILESTONES: ReadonlyArray<{ years: number; label: string }> = [
  { years: 5, label: 'Five-year reunion' },
  { years: 10, label: 'Decade reunion' },
  { years: 15, label: 'Fifteen-year reunion' },
  { years: 20, label: 'Twenty-year reunion' },
  { years: 25, label: 'Silver jubilee' },
  { years: 30, label: 'Pearl jubilee' },
  { years: 40, label: 'Ruby jubilee' },
  { years: 50, label: 'Golden jubilee' },
];

export interface ReunionMilestone {
  batchYear: number;
  /** Years since the batch passed out, in `year`. */
  years: number;
  label: string;
  /** The calendar year the anniversary falls in. */
  year: number;
}

/** The milestone a batch reaches in `year`, or null if it reaches none. */
export function reunionMilestone(batchYear: number, year: number): ReunionMilestone | null {
  const years = year - batchYear;
  const hit = MILESTONES.find((m) => m.years === years);
  return hit ? { batchYear, years, label: hit.label, year } : null;
}

/**
 * Batches reaching a milestone this year or the next, soonest and oldest
 * first. Drives the "worth planning" prompt on the batch page and the staff
 * console; it never invents a batch the register does not have.
 */
export function upcomingReunionMilestones(batchYears: readonly number[], year: number): ReunionMilestone[] {
  const out: ReunionMilestone[] = [];
  for (const b of new Set(batchYears)) {
    for (const y of [year, year + 1]) {
      const m = reunionMilestone(b, y);
      if (m) out.push(m);
    }
  }
  return out.sort((a, b) => a.year - b.year || a.batchYear - b.batchYear);
}

// ---------------------------------------------------------------
// Groups and the feed
// ---------------------------------------------------------------

export const GROUP_KINDS: ReadonlyArray<{ value: GroupKind; label: string; plural: string; blurb: string }> = [
  { value: 'chapter', label: 'Chapter', plural: 'Chapters', blurb: 'Alumni in one city or country.' },
  { value: 'interest', label: 'Interest group', plural: 'Interest groups', blurb: 'People who share a field or a cause.' },
];

export const POST_KINDS: ReadonlyArray<{ value: PostKind; label: string; plural: string; blurb: string }> = [
  { value: 'update', label: 'Update', plural: 'Updates', blurb: 'News from you or about the college.' },
  { value: 'achievement', label: 'Achievement', plural: 'Achievements', blurb: 'Something you are proud of.' },
  { value: 'question', label: 'Question', plural: 'Questions', blurb: 'Ask the network.' },
  { value: 'opportunity', label: 'Opportunity', plural: 'Opportunities', blurb: 'A role, an internship or a collaboration.' },
];

export const POST_KIND_VALUES = POST_KINDS.map((k) => k.value) as [PostKind, ...PostKind[]];

export function postKindLabel(kind: PostKind): string {
  return POST_KINDS.find((k) => k.value === kind)?.label ?? 'Update';
}

export const POST_MAX_LENGTH = 1200;
export const POST_MAX_TAGS = 5;

/**
 * Tags as members type them become tags as the feed filters on them:
 * lower case, words joined by hyphens, letters, digits and hyphens only,
 * no duplicates, at most five. "Open Source!" and "open-source" are one tag.
 */
export function normaliseTags(input: readonly string[] | string | undefined | null): string[] {
  const raw = typeof input === 'string' ? input.split(/[,\n]/) : [...(input ?? [])];
  const out: string[] = [];
  for (const item of raw) {
    const tag = item
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/^#+/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24)
      .replace(/-+$/g, '');
    if (tag && !out.includes(tag)) out.push(tag);
    if (out.length >= POST_MAX_TAGS) break;
  }
  return out;
}

// ---------------------------------------------------------------
// Showcase
// ---------------------------------------------------------------

export const SHOWCASE_KINDS: ReadonlyArray<{ value: ShowcaseKind; label: string; plural: string; blurb: string }> = [
  { value: 'prominent', label: 'Prominent alumnus', plural: 'Prominent alumni', blurb: 'People who have gone a long way.' },
  { value: 'achievement', label: 'Achievement', plural: 'Achievements', blurb: 'An award, a milestone, a thing finished.' },
  { value: 'story', label: 'Success story', plural: 'Success stories', blurb: 'How somebody got there, in their own terms.' },
];

export const SHOWCASE_CATEGORIES: ReadonlyArray<{ value: ShowcaseCategory; label: string }> = [
  { value: 'leadership', label: 'Leadership' },
  { value: 'entrepreneur', label: 'Entrepreneurs' },
  { value: 'civil_services', label: 'Civil services' },
  { value: 'academia', label: 'Academia' },
  { value: 'public_sector', label: 'Public sector' },
  { value: 'defence_space', label: 'Defence and space' },
  { value: 'research', label: 'Research' },
  { value: 'arts_sports', label: 'Arts and sports' },
  { value: 'social_impact', label: 'Social impact' },
];

export const SHOWCASE_KIND_VALUES = SHOWCASE_KINDS.map((k) => k.value) as [ShowcaseKind, ...ShowcaseKind[]];
export const SHOWCASE_CATEGORY_VALUES = SHOWCASE_CATEGORIES.map((c) => c.value) as [ShowcaseCategory, ...ShowcaseCategory[]];

export function showcaseCategoryLabel(category: ShowcaseCategory): string {
  return SHOWCASE_CATEGORIES.find((c) => c.value === category)?.label ?? 'Other';
}

export function showcaseKindLabel(kind: ShowcaseKind): string {
  return SHOWCASE_KINDS.find((k) => k.value === kind)?.label ?? 'Entry';
}

export const SHOWCASE_STATE_LABELS: Record<ShowcaseState, string> = {
  pending_moderation: 'Waiting for review',
  published: 'Published',
  rejected: 'Not published',
};

// ---------------------------------------------------------------
// Businesses
// ---------------------------------------------------------------

export const BUSINESS_INDUSTRIES = [
  'Software and IT',
  'Manufacturing',
  'Architecture and interiors',
  'Advertising and marketing',
  'Agriculture and food',
  'Automotive',
  'Consulting and management',
  'Education and training',
  'Energy and utilities',
  'Construction and real estate',
  'Finance and accounting',
  'Healthcare',
  'Hospitality and travel',
  'Retail and e-commerce',
  'Other',
] as const;

export const BUSINESS_STATE_LABELS: Record<BusinessState, string> = {
  pending_moderation: 'Waiting for review',
  live: 'Listed',
  rejected: 'Not listed',
  closed: 'Closed',
};

// ---------------------------------------------------------------
// Help desk
// ---------------------------------------------------------------

export const TICKET_CATEGORIES: ReadonlyArray<{ value: TicketCategory; label: string }> = [
  { value: 'account', label: 'Signing in or my account' },
  { value: 'verification', label: 'Registration or verification' },
  { value: 'profile', label: 'My profile' },
  { value: 'privacy', label: 'Privacy and my data' },
  { value: 'events', label: 'Events and tickets' },
  { value: 'jobs', label: 'Jobs' },
  { value: 'other', label: 'Something else' },
];

export const TICKET_CATEGORY_VALUES = TICKET_CATEGORIES.map((c) => c.value) as [TicketCategory, ...TicketCategory[]];

export function ticketCategoryLabel(category: TicketCategory): string {
  return TICKET_CATEGORIES.find((c) => c.value === category)?.label ?? 'Something else';
}

export const TICKET_KIND_LABELS: Record<TicketKind, string> = {
  help: 'Question',
  feedback: 'Feedback',
  bug: 'Problem',
};

export const TICKET_STATE_LABELS: Record<TicketState, string> = {
  open: 'Waiting for the alumni office',
  answered: 'Answered',
  closed: 'Closed',
};

// ---------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------

/**
 * Title to address. Diacritics are stripped rather than dropped, so a title
 * with "’26" in it does not produce an address with a hole in the middle.
 */
export function slugify(value: string, max = 64, fallback = 'item'): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return slug || fallback;
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A single line from the start of a longer text, cut at a word, never mid-link. */
export function excerpt(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, '')}…`;
}
