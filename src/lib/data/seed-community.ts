import { SEED, SEED_NOW, type SeedMember } from './seed';
import type {
  BusinessState,
  CmsPage,
  GroupJoinPolicy,
  GroupKind,
  GroupMemberRole,
  GroupMembershipState,
  InvitationState,
  PostKind,
  PostState,
  ShowcaseCategory,
  ShowcaseKind,
  ShowcaseState,
  TicketCategory,
  TicketKind,
  TicketState,
} from './types';

/**
 * Fixtures for the community modules: groups, the feed, the business
 * directory, the showcase, invitations, the help desk and the college's own
 * pages.
 *
 * Two rules the rest of the seed follows, and this file follows too:
 *
 *  - **No random draws.** `seed.ts` shares one seeded generator, so a single
 *    extra draw anywhere shifts every job, connection and notification
 *    generated after it. Everything here is assigned by rule or by index,
 *    which also makes it readable: you can see why a person is in a group.
 *  - **Records hold ids, not summaries.** A member is named by id and turned
 *    into a `MemberSummary` at read time, through the repository's
 *    projection, for the viewer in front of it. A copy of a summary stored
 *    here would be a copy that ignored the viewer's tier.
 */

const daysAgo = (d: number) => new Date(SEED_NOW.getTime() - d * 86400000).toISOString();

// ---------------------------------------------------------------
// Who is who
// ---------------------------------------------------------------

const emailOf = (m: SeedMember) => m.emailLower;
const demo = (email: string): SeedMember => {
  const m = SEED.members.find((x) => emailOf(x) === email);
  if (!m) throw new Error(`seed-community: no demo member for ${email}`);
  return m;
};

const ALUMNUS = demo('alumni@example.com');
const STUDENT = demo('student@diet.ac.in');
const OPERATOR = demo('alumnicell@diet.ac.in');
const FACULTY = demo('faculty.ece@diet.ac.in');

/**
 * Staff and the vendor are not group members by default. A chapter roster
 * that lists the Dean and the platform operator is a roster nobody
 * recognises, and the vendor in particular is never a member of a college's
 * community.
 */
const STAFF_IDS = new Set(
  ['admin@diet.ac.in', 'alumnicell@diet.ac.in', 'hod.cse@diet.ac.in', 'tpo@diet.ac.in', 'finance@diet.ac.in', 'platform@ifbash.com'].map(
    (e) => demo(e).id,
  ),
);

const isActive = (m: SeedMember) => m.status === 'active_alumni' || m.status === 'active_student';
const ordinary = (m: SeedMember) => isActive(m) && !STAFF_IDS.has(m.id);

const ALUMNI = SEED.alumni.filter(ordinary);
const STUDENTS = SEED.students.filter(ordinary);

// ---------------------------------------------------------------
// People who fit their stories
// ---------------------------------------------------------------

/**
 * A story that says "the first ECE batch" or "nine years after joining" is
 * only credible beside a person whose record agrees. Picking by array index
 * put a 2023 graduate behind a District Collector, so a story chooses its
 * subject by what it claims.
 *
 * Still no random draw: the candidates are sorted (earliest batch, then id)
 * and the first one not already used is taken, so the choice is stable and
 * the seeded generator's stream is untouched. Nobody is used twice. The
 * people the other stories keep by index are reserved first, so a pick can
 * never land on one of them.
 *
 * No story below uses a pronoun for its subject: a name says nothing about
 * how a person is referred to, and the seed has no field for it.
 */
const TAKEN = new Set<string>([24, 36, 48, 55, 61, 67, 72].map((i) => ALUMNI[i]!.id).concat(ALUMNUS.id));
const SEED_YEAR = SEED_NOW.getUTCFullYear();

function pickAlumnus(story: string, fits: { dept?: string; batch?: number; to?: number }): SeedMember {
  const found = ALUMNI.filter((m) => !TAKEN.has(m.id))
    .filter((m) => !fits.dept || m.departmentCode === fits.dept)
    .filter((m) => fits.batch === undefined || m.batchYear === fits.batch)
    .filter((m) => fits.to === undefined || (m.batchYear ?? Number.MAX_SAFE_INTEGER) <= fits.to)
    .sort((a, b) => (a.batchYear ?? 0) - (b.batchYear ?? 0) || a.id.localeCompare(b.id))[0];
  if (!found) throw new Error(`seed-community: nobody in the seed fits "${story}" (${JSON.stringify(fits)})`);
  TAKEN.add(found.id);
  return found;
}

/** "The first batch the ECE department sent out": the earliest ECE batch there is. */
const SEMICONDUCTOR_MD = pickAlumnus('a managing director from the first ECE batch', { dept: 'ECE', to: 2013 });
/** Civil services after a second attempt, while working as a site engineer: a civil graduate, a decade on. */
const COLLECTOR = pickAlumnus('a district collector, a civil engineer', { dept: 'CIVIL', to: 2015 });
/** An associate professor with a doctoral cohort, working on analogue circuits. */
const PROFESSOR = pickAlumnus('an associate professor of analogue circuits', { dept: 'ECE', to: 2016 });
/** Launch vehicle avionics, and four years of talks to the incoming electronics batch. */
const SPACE_SCIENTIST = pickAlumnus('an avionics scientist', { dept: 'ECE', to: 2018 });
/** A chief engineer leading a substation programme. */
const POWER_ENGINEER = pickAlumnus('a chief engineer at a power utility', { dept: 'EEE', to: 2015 });
/** A paper on microgrid fault detection. */
const PAPER_AUTHOR = pickAlumnus('a paper on microgrid fault detection', { dept: 'EEE', to: 2024 });
/** "Nine years after joining as a developer": the batch that graduated nine years before the seed's today. */
const PROMOTED = pickAlumnus('promoted to Director nine years in', { batch: SEED_YEAR - 9 });

// ---------------------------------------------------------------
// Groups
// ---------------------------------------------------------------

export interface GroupRecord {
  id: string;
  slug: string;
  name: string;
  kind: GroupKind;
  description: string;
  city: string | null;
  country: string | null;
  joinPolicy: GroupJoinPolicy;
  archived: boolean;
  createdAt: string;
}

export interface GroupMembershipRecord {
  groupId: string;
  memberId: string;
  role: GroupMemberRole;
  state: GroupMembershipState;
  joinedAt: string;
}

interface GroupSpec extends Omit<GroupRecord, 'id' | 'createdAt' | 'archived'> {
  /** Who belongs, by rule. Students are only ever matched into interest groups. */
  match: (m: SeedMember, i: number) => boolean;
  createdDaysAgo: number;
}

const AI_SKILLS = new Set(['Python', 'PyTorch', 'TensorFlow', 'NLP', 'Computer Vision', 'MLOps', 'LLMs', 'Scikit-learn']);
const EMBEDDED_SKILLS = new Set(['IoT', 'Embedded C', 'RTOS', 'FPGA', 'VLSI']);

const chapter = (
  slug: string,
  name: string,
  city: string | null,
  country: string,
  description: string,
  match: (m: SeedMember) => boolean,
  createdDaysAgo: number,
): GroupSpec => ({
  slug,
  name,
  kind: 'chapter',
  description,
  city,
  country,
  joinPolicy: 'open',
  match: (m) => !m.isStudent && match(m),
  createdDaysAgo,
});

const GROUP_SPECS: GroupSpec[] = [
  chapter('hyderabad-chapter', 'Hyderabad chapter', 'Hyderabad', 'IN',
    'Alumni working in and around Hyderabad. A monthly meetup, a shared list of who is hiring, and an introduction for anyone moving to the city.',
    (m) => m.city === 'Hyderabad', 620),
  chapter('bengaluru-chapter', 'Bengaluru chapter', 'Bengaluru', 'IN',
    'Alumni in Bengaluru. Meetups follow the tech calendar, and the noticeboard is the place to ask who has switched to a product company and how.',
    (m) => m.city === 'Bengaluru', 580),
  chapter('chennai-chapter', 'Chennai chapter', 'Chennai', 'IN',
    'Alumni in Chennai, from automotive and manufacturing to software. Quarterly get-togethers and plant visits.',
    (m) => m.city === 'Chennai', 540),
  chapter('pune-chapter', 'Pune chapter', 'Pune', 'IN',
    'Alumni in Pune and Mumbai. A small, active group; most introductions happen on the noticeboard.',
    (m) => m.city === 'Pune' || m.city === 'Mumbai', 500),
  chapter('visakhapatnam-chapter', 'Visakhapatnam chapter', 'Visakhapatnam', 'IN',
    'Alumni in Visakhapatnam: the port, the steel plant, the IT park. Walks on the beach road count as meetups.',
    (m) => m.city === 'Visakhapatnam', 470),
  chapter('vijayawada-guntur-chapter', 'Vijayawada and Guntur chapter', 'Vijayawada', 'IN',
    'Alumni who stayed close to home. This chapter hosts the batch dinners and is first to know about campus events.',
    (m) => m.city === 'Vijayawada' || m.city === 'Guntur', 700),
  chapter('delhi-ncr-chapter', 'Delhi NCR chapter', 'Delhi NCR', 'IN',
    'Alumni in Noida and Gurugram. Weekday evening meetups, and a standing offer to put up a batchmate who is in town for an interview.',
    (m) => m.city === 'Noida' || m.city === 'Gurugram', 430),
  chapter('usa-chapter', 'USA chapter', null, 'US',
    'Alumni across the United States. Time-zone friendly calls, and the first place to ask about visas, university applications and moving.',
    (m) => m.country === 'US', 410),
  chapter('uk-and-europe-chapter', 'UK and Europe chapter', null, 'GB',
    'Alumni in the United Kingdom, Ireland and continental Europe.',
    (m) => m.country === 'GB' || m.country === 'DE' || m.country === 'IE' || m.country === 'CH', 390),
  chapter('gulf-chapter', 'Gulf chapter', null, 'AE',
    'Alumni in the UAE and Qatar. Meetups around the long weekends.',
    (m) => m.country === 'AE' || m.country === 'QA', 360),

  {
    slug: 'ai-and-ml', name: 'AI and machine learning', kind: 'interest', city: null, country: null, joinPolicy: 'open',
    description: 'Practitioners and the curious: papers, projects, job moves and honest accounts of what worked in production.',
    match: (m) => m.departmentCode === 'AIML' || m.skills.some((s) => AI_SKILLS.has(s)),
    createdDaysAgo: 300,
  },
  {
    slug: 'cybersecurity', name: 'Cybersecurity', kind: 'interest', city: null, country: null, joinPolicy: 'open',
    description: 'Security engineers and students heading that way. Capture-the-flag teams are put together here.',
    match: (_m, i) => i % 11 === 3, createdDaysAgo: 280,
  },
  {
    slug: 'embedded-and-iot', name: 'Embedded systems and IoT', kind: 'interest', city: null, country: null, joinPolicy: 'open',
    description: 'Firmware, hardware and the devices in between. Datasheet recommendations and the occasional teardown.',
    match: (m) => m.departmentCode === 'ECE' || m.skills.some((s) => EMBEDDED_SKILLS.has(s)),
    createdDaysAgo: 260,
  },
  {
    slug: 'civil-and-infrastructure', name: 'Civil and infrastructure', kind: 'interest', city: null, country: null, joinPolicy: 'open',
    description: 'Site engineers, designers and project managers. Tenders, codes of practice and who is looking for a good site supervisor.',
    match: (m) => m.departmentCode === 'CIVIL', createdDaysAgo: 240,
  },
  {
    slug: 'startups-and-founders', name: 'Startups and founders', kind: 'interest', city: null, country: null, joinPolicy: 'approval',
    description: 'Founders and early employees. Membership is approved by a lead so the noticeboard stays a place for people who are building something.',
    match: (m, i) => /founder/i.test(m.designation ?? '') || i % 13 === 5,
    createdDaysAgo: 220,
  },
  {
    slug: 'higher-studies-abroad', name: 'Higher studies abroad', kind: 'interest', city: null, country: null, joinPolicy: 'open',
    description: 'Applying, funding and settling in. Alumni who have done it answer questions from those about to.',
    match: (m, i) => (!m.isStudent && m.country !== null && m.country !== 'IN') || (m.isStudent && i % 4 === 1),
    createdDaysAgo: 200,
  },
  {
    slug: 'women-in-engineering', name: 'Women in engineering', kind: 'interest', city: null, country: null, joinPolicy: 'open',
    description: 'Careers, career breaks and coming back. Run by alumnae, open to anyone who wants to take part.',
    match: (_m, i) => i % 6 === 2, createdDaysAgo: 180,
  },
];

const GROUP_ID = (slug: string) => `grp-${slug}`;

export const GROUPS: GroupRecord[] = GROUP_SPECS.map((s) => ({
  id: GROUP_ID(s.slug),
  slug: s.slug,
  name: s.name,
  kind: s.kind,
  description: s.description,
  city: s.city,
  country: s.country,
  joinPolicy: s.joinPolicy,
  archived: false,
  createdAt: daysAgo(s.createdDaysAgo),
}));

export const GROUP_MEMBERSHIPS: GroupMembershipRecord[] = (() => {
  const out: GroupMembershipRecord[] = [];

  for (const spec of GROUP_SPECS) {
    const pool: SeedMember[] = spec.kind === 'chapter' ? ALUMNI : [...ALUMNI, ...STUDENTS];
    const matched = pool.filter((m, i) => spec.match(m, i));

    // A chapter with nobody in the seeded city would render as an empty
    // room on day one, which is a state worth being able to see but not the
    // only one on offer. Pad thin groups so the lead tools have a roster.
    const members = [...matched];
    for (let k = 0; members.length < 4 && k < ALUMNI.length; k++) {
      const filler = ALUMNI[(GROUP_SPECS.indexOf(spec) * 17 + k * 5) % ALUMNI.length]!;
      if (!members.some((x) => x.id === filler.id)) members.push(filler);
    }

    // The demo alumnus leads two groups: one open (so there is nothing to
    // approve) and one that is by approval (so there is a request to answer).
    const forcedLead = spec.slug === 'hyderabad-chapter' || spec.slug === 'startups-and-founders';
    if (forcedLead && !members.some((x) => x.id === ALUMNUS.id)) members.unshift(ALUMNUS);

    const leadIds = new Set<string>();
    if (forcedLead) leadIds.add(ALUMNUS.id);
    for (const m of members) {
      if (leadIds.size >= 2) break;
      if (!m.isStudent) leadIds.add(m.id);
    }

    members.forEach((m, i) => {
      out.push({
        groupId: GROUP_ID(spec.slug),
        memberId: m.id,
        role: leadIds.has(m.id) ? 'lead' : 'member',
        state: 'active',
        joinedAt: daysAgo(Math.max(3, spec.createdDaysAgo - ((i * 37) % Math.max(10, spec.createdDaysAgo - 2)))),
      });
    });

    // Two people waiting on a lead, in the one group that asks.
    if (spec.joinPolicy === 'approval') {
      const waiting = ALUMNI.filter((m) => !members.some((x) => x.id === m.id)).slice(20, 22);
      for (const [i, m] of waiting.entries()) {
        out.push({ groupId: GROUP_ID(spec.slug), memberId: m.id, role: 'member', state: 'requested', joinedAt: daysAgo(2 + i * 3) });
      }
    }
  }

  // The demo student sits in two interest groups and no chapter, so both the
  // joined and the not-joined states are one click away from the sign-in page.
  for (const slug of ['ai-and-ml', 'cybersecurity']) {
    if (!out.some((r) => r.groupId === GROUP_ID(slug) && r.memberId === STUDENT.id)) {
      out.push({ groupId: GROUP_ID(slug), memberId: STUDENT.id, role: 'member', state: 'active', joinedAt: daysAgo(40) });
    }
  }
  return out;
})();

// ---------------------------------------------------------------
// The community feed
// ---------------------------------------------------------------

export interface PostRecord {
  id: string;
  kind: PostKind;
  body: string;
  tags: string[];
  authorId: string;
  groupSlug: string | null;
  state: PostState;
  hiddenReason: string | null;
  createdAt: string;
  likedBy: string[];
  reports: Array<{ by: string; reason: string; at: string }>;
}

const membersOf = (slug: string): SeedMember[] =>
  GROUP_MEMBERSHIPS.filter((r) => r.groupId === GROUP_ID(slug) && r.state === 'active')
    .map((r) => SEED.members.find((m) => m.id === r.memberId)!)
    .filter((m) => !m.isStudent);

/** The k-th grown-up in a group, so a group's post is always by one of its members. */
const inGroup = (slug: string, k: number): SeedMember => {
  const list = membersOf(slug);
  return list[k % list.length]!;
};

const likes = (from: number, n: number): string[] => ALUMNI.slice(from, from + n).map((m) => m.id);

export const POSTS: PostRecord[] = [
  {
    id: 'post-1', kind: 'opportunity', authorId: ALUMNUS.id, groupSlug: null, tags: ['hiring', 'referrals', 'hyderabad'],
    body: 'My team is hiring two backend engineers in Hyderabad, 3 to 6 years of experience. If you know Java and have run something in production, message me through the portal and I will pass your resume on. Freshers: the internship postings are on the jobs board.',
    state: 'published', hiddenReason: null, createdAt: daysAgo(1), likedBy: likes(30, 9), reports: [],
  },
  {
    id: 'post-2', kind: 'achievement', authorId: PROMOTED.id, groupSlug: null, tags: ['promotion', `batch-of-${PROMOTED.batchYear}`],
    body: `After nine years I have been made a Director. The first six were as a developer who said yes to everything; the rest were learning to say no. Thank you to the batch of ${PROMOTED.batchYear} for the group chat that kept me honest.`,
    state: 'published', hiddenReason: null, createdAt: daysAgo(2), likedBy: likes(10, 17), reports: [],
  },
  {
    id: 'post-3', kind: 'question', authorId: inGroup('pune-chapter', 0).id, groupSlug: 'pune-chapter', tags: ['relocation', 'housing'],
    body: 'Moving to Pune next month with family. Which areas worked for those of you with school-age children and an office near Hinjewadi? Honest answers about commute welcome.',
    state: 'published', hiddenReason: null, createdAt: daysAgo(3), likedBy: likes(60, 4), reports: [],
  },
  {
    id: 'post-4', kind: 'update', authorId: inGroup('hyderabad-chapter', 1).id, groupSlug: 'hyderabad-chapter', tags: ['meetup'],
    body: 'The monthly meetup is on. Same place as last time; the exact venue is in the event page for those registered. Bring a batchmate who has not been before.',
    state: 'published', hiddenReason: null, createdAt: daysAgo(4), likedBy: likes(5, 12), reports: [],
  },
  {
    id: 'post-5', kind: 'update', authorId: ALUMNI[26]!.id, groupSlug: null, tags: ['open-source', 'mentoring'],
    body: 'Two years of weekend mentoring on a small open-source project, and three of this year\'s final-years have their first merged pull requests. If your team maintains something and wants careful first-time contributors, tell me and I will connect you.',
    state: 'published', hiddenReason: null, createdAt: daysAgo(5), likedBy: likes(40, 14), reports: [],
  },
  {
    id: 'post-6', kind: 'question', authorId: inGroup('ai-and-ml', 2).id, groupSlug: 'ai-and-ml', tags: ['production', 'llm'],
    body: 'For those running language models in production: how are you evaluating changes before a release? A spreadsheet of fifty prompts is what we have, and I suspect it is not enough.',
    state: 'published', hiddenReason: null, createdAt: daysAgo(6), likedBy: likes(70, 8), reports: [],
  },
  {
    id: 'post-7', kind: 'achievement', authorId: inGroup('startups-and-founders', 1).id, groupSlug: 'startups-and-founders', tags: ['funding', 'founders'],
    body: 'We closed our seed round this week. Eighteen months, two pivots, and a customer who paid us before the product worked. If you are in the first year of building something, I am glad to tell you what I would do differently.',
    state: 'published', hiddenReason: null, createdAt: daysAgo(7), likedBy: likes(20, 19), reports: [],
  },
  {
    id: 'post-8', kind: 'opportunity', authorId: inGroup('bengaluru-chapter', 0).id, groupSlug: 'bengaluru-chapter', tags: ['hiring', 'embedded'],
    body: 'An automotive supplier in Bengaluru is hiring embedded engineers, 2 to 5 years. The work is on motor control, and they will take someone strong in C who has not touched automotive before.',
    state: 'published', hiddenReason: null, createdAt: daysAgo(8), likedBy: likes(50, 6), reports: [],
  },
  {
    id: 'post-9', kind: 'update', authorId: FACULTY.id, groupSlug: null, tags: ['campus', 'lab'],
    body: 'The VLSI lab funded by the 2013 and 2014 batches now has all twelve workstations running. Alumni are welcome to visit; write to the department first so someone is there to open it.',
    state: 'published', hiddenReason: null, createdAt: daysAgo(10), likedBy: likes(15, 22), reports: [],
  },
  {
    id: 'post-10', kind: 'question', authorId: inGroup('higher-studies-abroad', 3).id, groupSlug: 'higher-studies-abroad', tags: ['masters', 'funding'],
    body: 'Which universities were generous with teaching assistantships for computer science masters students in the last two years? Collecting answers for the final-years who ask me every week.',
    state: 'published', hiddenReason: null, createdAt: daysAgo(11), likedBy: likes(80, 11), reports: [],
  },
  {
    id: 'post-11', kind: 'update', authorId: inGroup('civil-and-infrastructure', 0).id, groupSlug: 'civil-and-infrastructure', tags: ['tenders', 'highways'],
    body: 'A reminder that the state tender portal changed its registration process this month. If your firm bids on road works, re-register before the next cycle or your bids will be rejected without explanation.',
    state: 'published', hiddenReason: null, createdAt: daysAgo(13), likedBy: likes(100, 5), reports: [],
  },
  {
    id: 'post-12', kind: 'opportunity', authorId: ALUMNI[33]!.id, groupSlug: null, tags: ['internship', 'summer'],
    body: 'We take four summer interns every year and never find them on job boards. This year I would like all four to come from our own college. Data work, mostly SQL and Python; the stipend is fair and there is a real offer for the best two.',
    state: 'published', hiddenReason: null, createdAt: daysAgo(15), likedBy: likes(45, 25), reports: [],
  },
  {
    // Hidden by a moderator after two reports. Visible to moderators only,
    // with the reason, so the moderation screen has a real case to show.
    id: 'post-13', kind: 'opportunity', authorId: ALUMNI[58]!.id, groupSlug: null, tags: ['earn-from-home'],
    body: 'Earn a guaranteed income from home with no investment. Message me for the link to join.',
    state: 'hidden', hiddenReason: 'A sales pitch with no role, employer or detail. The feed is for specific opportunities from people who can be asked about them.',
    createdAt: daysAgo(17), likedBy: [],
    reports: [
      { by: ALUMNI[12]!.id, reason: 'Looks like a recruitment scheme, not a job.', at: daysAgo(17) },
      { by: ALUMNI[19]!.id, reason: 'Spam.', at: daysAgo(16) },
    ],
  },
  {
    // Reported once and still live, waiting on a moderator's decision.
    id: 'post-14', kind: 'update', authorId: ALUMNI[41]!.id, groupSlug: null, tags: ['opinion'],
    body: 'Honestly, anyone still choosing a service company over a product company in 2026 is leaving a lot on the table. Change my mind.',
    state: 'published', hiddenReason: null, createdAt: daysAgo(18), likedBy: likes(90, 3),
    reports: [{ by: ALUMNI[27]!.id, reason: 'Needlessly dismissive of batchmates who work at those companies.', at: daysAgo(18) }],
  },
  {
    id: 'post-15', kind: 'achievement', authorId: inGroup('usa-chapter', 1).id, groupSlug: 'usa-chapter', tags: ['green-card', 'milestone'],
    body: 'Green card approved after seven years. For anyone in the queue: keep every document, answer every request the same day, and do not trust a forum over your lawyer.',
    state: 'published', hiddenReason: null, createdAt: daysAgo(20), likedBy: likes(25, 15), reports: [],
  },
  {
    id: 'post-16', kind: 'update', authorId: inGroup('embedded-and-iot', 2).id, groupSlug: 'embedded-and-iot', tags: ['teardown', 'firmware'],
    body: 'Wrote up the firmware update failure we spent a month chasing: a watchdog that fed itself during a flash erase. Happy to share the notes with anyone who works on bootloaders.',
    state: 'published', hiddenReason: null, createdAt: daysAgo(22), likedBy: likes(65, 7), reports: [],
  },
];

// ---------------------------------------------------------------
// Businesses
// ---------------------------------------------------------------

export interface BusinessRecord {
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
  ownerId: string;
  status: BusinessState;
  moderationNote: string | null;
  createdAt: string;
  /** The owner's say-so. Without it nobody sees the contact fields. */
  showContact: boolean;
  contactEmail: string | null;
  contactPhone: string | null;
}

const biz = (
  n: number,
  owner: SeedMember,
  fields: Omit<BusinessRecord, 'id' | 'ownerId' | 'createdAt' | 'moderationNote' | 'status'> &
    Partial<Pick<BusinessRecord, 'status' | 'moderationNote'>>,
  createdDaysAgo: number,
): BusinessRecord => ({
  id: `biz-${n}`,
  ownerId: owner.id,
  createdAt: daysAgo(createdDaysAgo),
  status: 'live',
  moderationNote: null,
  ...fields,
});

export const BUSINESSES: BusinessRecord[] = [
  biz(1, ALUMNUS, {
    slug: 'nimbus-cloud-labs', name: 'Nimbus Cloud Labs', industry: 'Software and IT',
    description: 'A small cloud engineering studio. We move companies off ageing servers and keep their bills honest afterwards, and we take on two student interns every summer.',
    city: 'Hyderabad', region: 'Telangana', country: 'IN', website: 'https://example.com/nimbus-cloud-labs',
    products: ['Managed Kubernetes'], services: ['Cloud migration', 'DevOps consulting', 'Cost reviews'],
    showContact: true, contactEmail: 'hello@nimbus.example', contactPhone: '+91 90000 00001',
  }, 210),
  biz(2, ALUMNI[16]!, {
    slug: 'kolli-interiors', name: 'Kolli Interiors', industry: 'Architecture and interiors',
    description: 'Residential and small-office interiors in Vijayawada. Design, carpentry and site supervision under one roof, with a fixed quote before work starts.',
    city: 'Vijayawada', region: 'Andhra Pradesh', country: 'IN', website: 'https://example.com/kolli-interiors',
    products: ['Modular kitchens', 'Wardrobes'], services: ['Interior design', 'Turnkey fit-outs'],
    showContact: true, contactEmail: 'studio@kolliinteriors.example', contactPhone: '+91 90000 00002',
  }, 190),
  biz(3, ALUMNI[22]!, {
    slug: 'sagi-precision-works', name: 'Sagi Precision Works', industry: 'Manufacturing',
    description: 'CNC machined parts for automotive and pump makers, from a single prototype to a few thousand a month. ISO 9001 audited.',
    city: 'Chennai', region: 'Tamil Nadu', country: 'IN', website: 'https://example.com/sagi-precision',
    products: ['CNC machined components', 'Jigs and fixtures'], services: ['Prototyping', 'Contract manufacturing'],
    showContact: false, contactEmail: null, contactPhone: null,
  }, 170),
  biz(4, ALUMNI[29]!, {
    slug: 'tummala-brand-studio', name: 'Tummala Brand Studio', industry: 'Advertising and marketing',
    description: 'Brand identity and launch campaigns for early-stage companies. We start with a one-day workshop and only then quote.',
    city: 'Bengaluru', region: 'Karnataka', country: 'IN', website: 'https://example.com/tummala-brand',
    products: [], services: ['Brand identity', 'Launch campaigns', 'Founder workshops'],
    showContact: true, contactEmail: 'start@tummalabrand.example', contactPhone: null,
  }, 150),
  biz(5, ALUMNI[35]!, {
    slug: 'vadlamudi-agri-tech', name: 'Vadlamudi AgriTech', industry: 'Agriculture and food',
    description: 'Soil sensors and an irrigation advisory app for chilli and cotton growers in Guntur district. Pilots with farmer groups run on a seasonal contract.',
    city: 'Guntur', region: 'Andhra Pradesh', country: 'IN', website: 'https://example.com/vadlamudi-agritech',
    products: ['Soil moisture sensors', 'Irrigation advisory app'], services: ['Farm pilots'],
    showContact: true, contactEmail: 'pilots@vadlamudiagri.example', contactPhone: '+91 90000 00005',
  }, 130),
  biz(6, ALUMNI[44]!, {
    slug: 'uppalapati-ev-service', name: 'Uppalapati EV Service', industry: 'Automotive',
    description: 'Service and battery diagnostics for two- and three-wheeler electric vehicles, with a pickup service inside the city.',
    city: 'Visakhapatnam', region: 'Andhra Pradesh', country: 'IN', website: null,
    products: ['Battery packs (refurbished)'], services: ['EV servicing', 'Battery diagnostics'],
    showContact: true, contactEmail: null, contactPhone: '+91 90000 00006',
  }, 110),
  biz(7, ALUMNI[51]!, {
    slug: 'konduru-consulting-dubai', name: 'Konduru Engineering Consultants', industry: 'Consulting and management',
    description: 'Structural design review and independent checking for residential towers in the UAE. Chartered engineers, and a standing offer of a site visit for any batchmate starting out in the Gulf.',
    city: 'Dubai', region: null, country: 'AE', website: 'https://example.com/konduru-consultants',
    products: [], services: ['Structural design review', 'Independent checking'],
    showContact: true, contactEmail: 'review@kondurueng.example', contactPhone: null,
  }, 95),
  biz(8, ALUMNI[57]!, {
    slug: 'pallapothu-learning', name: 'Pallapothu Learning', industry: 'Education and training',
    description: 'Evening and weekend courses in data structures and system design for working engineers, taught in small groups by people who ship software for a living.',
    city: 'Pune', region: 'Maharashtra', country: 'IN', website: 'https://example.com/pallapothu-learning',
    products: ['Cohort courses'], services: ['Interview preparation', 'Corporate training'],
    showContact: true, contactEmail: 'cohorts@pallapothulearning.example', contactPhone: null,
  }, 70),
  biz(9, ALUMNI[63]!, {
    slug: 'rayudu-solar-works', name: 'Rayudu Solar Works', industry: 'Energy and utilities',
    description: 'Rooftop solar for homes and small factories: survey, design, net metering paperwork and a five-year service plan.',
    city: 'Vijayawada', region: 'Andhra Pradesh', country: 'IN', website: 'https://example.com/rayudu-solar',
    products: ['Rooftop solar systems'], services: ['Site survey', 'Net metering support', 'Annual maintenance'],
    status: 'pending_moderation',
    showContact: true, contactEmail: 'quotes@rayudusolar.example', contactPhone: '+91 90000 00009',
  }, 4),
  biz(10, ALUMNI[69]!, {
    slug: 'battula-realty', name: 'Battula Realty', industry: 'Construction and real estate',
    description: 'Plots and apartments, guaranteed returns of thirty percent a year.',
    city: 'Guntur', region: 'Andhra Pradesh', country: 'IN', website: null,
    products: [], services: [],
    status: 'rejected',
    moderationNote: 'A return guarantee cannot be listed here. Resubmit with the project, the approvals and the registration number, and without the promised return.',
    showContact: false, contactEmail: null, contactPhone: null,
  }, 25),
];

// ---------------------------------------------------------------
// Showcase
// ---------------------------------------------------------------

export interface ShowcaseRecord {
  id: string;
  slug: string;
  kind: ShowcaseKind;
  category: ShowcaseCategory;
  headline: string;
  summary: string;
  story: string | null;
  displayName: string;
  memberId: string | null;
  batchYear: number | null;
  departmentCode: string | null;
  achievedOn: string | null;
  sourceUrl: string | null;
  featured: boolean;
  source: 'curated' | 'submitted';
  submittedById: string | null;
  state: ShowcaseState;
  moderationNote: string | null;
  createdAt: string;
  /**
   * For a curated entry about somebody who is on the portal: that the member
   * agreed to be featured. A profile written about a person is personal data
   * published about them, and "the college wanted to" is not consent.
   */
  consentRecordedAt: string | null;
}

const show = (
  n: number,
  fields: Partial<ShowcaseRecord> &
    Pick<ShowcaseRecord, 'slug' | 'kind' | 'category' | 'headline' | 'summary' | 'displayName'>,
  createdDaysAgo: number,
): ShowcaseRecord => ({
  id: `show-${n}`,
  story: null,
  memberId: null,
  batchYear: null,
  departmentCode: null,
  achievedOn: null,
  sourceUrl: null,
  featured: false,
  source: 'curated',
  submittedById: null,
  state: 'published',
  moderationNote: null,
  createdAt: daysAgo(createdDaysAgo),
  consentRecordedAt: null,
  ...fields,
});

const person = (m: SeedMember) => ({
  memberId: m.id,
  displayName: m.fullName,
  batchYear: m.batchYear,
  departmentCode: m.departmentCode,
});

export const SHOWCASE: ShowcaseRecord[] = [
  // ---- Prominent alumni ------------------------------------------------
  show(1, {
    slug: 'managing-director-semiconductor', kind: 'prominent', category: 'leadership', ...person(SEMICONDUCTOR_MD),
    headline: 'Managing Director of a semiconductor design company',
    summary: 'Began as a verification engineer in the first batch the ECE department sent out, and now runs a three-hundred-person design centre.',
    story: 'The lab culture of the early years stays with them: one oscilloscope between four people, and nobody left until it worked. They still return every year to judge the final-year project exhibition.',
    featured: true, consentRecordedAt: daysAgo(120),
  }, 120),
  show(2, {
    slug: 'founder-agri-logistics', kind: 'prominent', category: 'entrepreneur', ...person(ALUMNI[24]!),
    headline: 'Founder of an agricultural logistics company',
    summary: 'Built a cold-chain network connecting farmers in coastal Andhra Pradesh to city markets within a day.',
    story: 'The company began as a final-year project on spoilage in transit. It now moves produce for several thousand farmers, and still hires its first-year engineers from the college.',
    featured: true, consentRecordedAt: daysAgo(110),
  }, 110),
  show(3, {
    slug: 'collector-civil-services', kind: 'prominent', category: 'civil_services', ...person(COLLECTOR),
    headline: 'District Collector, Indian Administrative Service',
    summary: 'Cleared the civil services examination on a second attempt while working full time as a site engineer.',
    story: 'The habit that carried the preparation was the one from the college hostel: a fixed two hours every night, and a batchmate who checked.',
    consentRecordedAt: daysAgo(95),
  }, 95),
  show(4, {
    slug: 'professor-iit', kind: 'prominent', category: 'academia', ...person(PROFESSOR),
    headline: 'Associate Professor at an Indian Institute of Technology',
    summary: 'Research on low-power analogue circuits, with students from the college among the first doctoral cohort.',
    consentRecordedAt: daysAgo(90),
  }, 90),
  show(5, {
    slug: 'scientist-space-agency', kind: 'prominent', category: 'defence_space', ...person(SPACE_SCIENTIST),
    headline: 'Scientist at the national space agency',
    summary: 'Works on launch vehicle avionics. Has spoken to every incoming electronics batch for four years running.',
    consentRecordedAt: daysAgo(85),
  }, 85),
  show(6, {
    slug: 'chief-engineer-power-utility', kind: 'prominent', category: 'public_sector', ...person(POWER_ENGINEER),
    headline: 'Chief Engineer at a state power utility',
    summary: 'Leads the substation modernisation programme across three districts.',
    consentRecordedAt: daysAgo(80),
  }, 80),
  show(7, {
    // A public figure who is not on the portal: needs a public source, not consent.
    slug: 'olympic-sailor', kind: 'prominent', category: 'arts_sports', displayName: 'A national-level sailor',
    headline: 'Represented India at an international sailing championship',
    summary: 'Studied mechanical engineering at the college before taking up competitive sailing full time.',
    sourceUrl: 'https://example.com/press/sailing-championship', batchYear: 2012, departmentCode: 'MECH',
  }, 60),

  // ---- Achievements ----------------------------------------------------
  show(8, {
    slug: 'best-paper-ieee-conference', kind: 'achievement', category: 'research', ...person(PAPER_AUTHOR),
    headline: 'Best paper award at an IEEE conference',
    summary: 'For work on fault detection in microgrids, written with two final-year students from the department.',
    achievedOn: '2026-06-18', consentRecordedAt: daysAgo(40),
  }, 40),
  show(9, {
    slug: 'national-award-rural-startup', kind: 'achievement', category: 'social_impact', ...person(ALUMNI[36]!),
    headline: 'National award for a rural innovation start-up',
    summary: 'Recognised for a low-cost water purification unit now in use across forty villages.',
    achievedOn: '2026-05-02', consentRecordedAt: daysAgo(70), featured: true,
  }, 70),
  show(10, {
    slug: 'promoted-vice-president', kind: 'achievement', category: 'leadership', ...person(PROMOTED),
    headline: 'Promoted to Director, nine years after joining as a developer',
    summary: `From the batch of ${PROMOTED.batchYear}; leads a platform team of sixty.`,
    achievedOn: '2026-08-10', consentRecordedAt: daysAgo(6),
  }, 6),
  show(11, {
    slug: 'gold-medal-state-sports-meet', kind: 'achievement', category: 'arts_sports', displayName: 'A mechanical engineering graduate',
    headline: 'Gold medal at the state athletics meet',
    summary: 'Third consecutive year of a medal in the 400 metres hurdles.',
    sourceUrl: 'https://example.com/press/state-athletics', batchYear: 2019, departmentCode: 'MECH', achievedOn: '2026-07-14',
  }, 33),

  // ---- Success stories -------------------------------------------------
  show(12, {
    slug: 'from-final-year-project-to-company', kind: 'story', category: 'entrepreneur', ...person(ALUMNI[48]!),
    headline: 'From a final-year project to a company with forty people',
    summary: 'A fire-alarm project for the hostel became a fire-safety products company.',
    story: 'The first customer was the hostel warden. The second was the college canteen. By the third year the company had a factory unit and its first export order.\n\nThe advice to students: put the project in front of a real customer before you graduate, even if the customer is only the person who runs the building you live in.',
    consentRecordedAt: daysAgo(55),
  }, 55),
  show(13, {
    slug: 'first-in-family-masters-abroad', kind: 'story', category: 'academia', ...person(ALUMNI[55]!),
    headline: 'First in the family to leave the district, now a research scientist',
    summary: 'A scholarship, a masters abroad, and a research career begun after a conversation with an alumnus.',
    story: 'It began with a mentorship request sent through this portal in the final year. The reply took two days and changed which universities were on the list.',
    consentRecordedAt: daysAgo(48),
  }, 48),
  show(14, {
    slug: 'rebuilding-after-layoff', kind: 'story', category: 'social_impact', ...person(ALUMNI[61]!),
    headline: 'Rebuilding a career after a layoff, with help from a batchmate',
    summary: 'A referral posted on the jobs board led to an interview in a week and an offer in a month.',
    consentRecordedAt: daysAgo(36),
  }, 36),

  // ---- Awaiting review: submitted by members ---------------------------
  show(15, {
    slug: 'patent-granted-embedded', kind: 'achievement', category: 'research', ...person(ALUMNUS),
    headline: 'Patent granted for a firmware update method',
    summary: 'Granted after three years; co-inventors are two batchmates from the ECE department.',
    achievedOn: '2026-07-30', source: 'submitted', submittedById: ALUMNUS.id, state: 'pending_moderation',
    consentRecordedAt: daysAgo(3),
  }, 3),
  show(16, {
    slug: 'ten-years-teaching-village-school', kind: 'achievement', category: 'social_impact', ...person(ALUMNI[67]!),
    headline: 'Ten years of weekend teaching at a village school',
    summary: 'Started with five children and a borrowed classroom; now two teachers and a small library.',
    achievedOn: '2026-08-01', source: 'submitted', submittedById: ALUMNI[67]!.id, state: 'pending_moderation',
    consentRecordedAt: daysAgo(2),
  }, 2),
  show(17, {
    slug: 'startup-ranking-claim', kind: 'achievement', category: 'entrepreneur', ...person(ALUMNI[72]!),
    headline: 'Named the best startup in India',
    summary: 'We were told we are the best startup in India this year.',
    source: 'submitted', submittedById: ALUMNI[72]!.id, state: 'rejected',
    moderationNote: 'There is no source for this. Resubmit with the name of the award and a link to where it was announced.',
    consentRecordedAt: daysAgo(14),
  }, 14),
];

// ---------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------

export interface InvitationRecord {
  id: string;
  inviterId: string;
  email: string;
  name: string | null;
  batchYear: number | null;
  message: string | null;
  state: InvitationState;
  createdAt: string;
}

export const INVITATIONS: InvitationRecord[] = [
  { id: 'inv-1', inviterId: ALUMNUS.id, email: 'ravi.kumar@example.com', name: 'Ravi Kumar', batchYear: 2017, message: 'Batchmate, ECE. Registers late for everything.', state: 'sent', createdAt: daysAgo(3) },
  { id: 'inv-2', inviterId: ALUMNUS.id, email: 'sneha.reddy@example.com', name: 'Sneha Reddy', batchYear: 2017, message: null, state: 'joined', createdAt: daysAgo(21) },
  { id: 'inv-3', inviterId: ALUMNUS.id, email: 'old.friend@example.com', name: null, batchYear: 2016, message: null, state: 'expired', createdAt: daysAgo(95) },
  { id: 'inv-4', inviterId: ALUMNI[14]!.id, email: 'colleague@example.com', name: 'A colleague', batchYear: 2014, message: null, state: 'sent', createdAt: daysAgo(9) },
];

// ---------------------------------------------------------------
// Help desk
// ---------------------------------------------------------------

export interface TicketRecord {
  id: string;
  reference: string;
  kind: TicketKind;
  category: TicketCategory;
  subject: string;
  pagePath: string | null;
  state: TicketState;
  createdAt: string;
  updatedAt: string;
  memberId: string;
  messages: Array<{ id: string; authorId: string; fromStaff: boolean; body: string; createdAt: string }>;
}

let ticketNo = 1040;
const ticket = (
  fields: Omit<TicketRecord, 'id' | 'reference'>,
): TicketRecord => {
  const n = ticketNo++;
  return { id: `tkt-${n}`, reference: `HD-${n}`, ...fields };
};

export const TICKETS: TicketRecord[] = [
  ticket({
    kind: 'help', category: 'verification', subject: 'My claim has been pending for two weeks', pagePath: null, state: 'answered',
    createdAt: daysAgo(14), updatedAt: daysAgo(12), memberId: ALUMNI[75]!.id,
    messages: [
      { id: 'm1', authorId: ALUMNI[75]!.id, fromStaff: false, createdAt: daysAgo(14), body: 'I registered with my roll number and personal email two weeks ago and the status still says pending. Is something missing?' },
      { id: 'm2', authorId: OPERATOR.id, fromStaff: true, createdAt: daysAgo(12), body: 'Thank you for writing. Your roll number matched two rows in the register because of a spelling difference in the surname. We have confirmed it is you and approved the claim; you can sign in now.' },
    ],
  }),
  ticket({
    kind: 'help', category: 'profile', subject: 'Cannot change my city', pagePath: '/profile/edit', state: 'open',
    createdAt: daysAgo(2), updatedAt: daysAgo(2), memberId: ALUMNUS.id,
    messages: [
      { id: 'm1', authorId: ALUMNUS.id, fromStaff: false, createdAt: daysAgo(2), body: 'I moved to Bengaluru last month. The city field on my profile will not accept the change and shows no error.' },
    ],
  }),
  ticket({
    kind: 'help', category: 'privacy', subject: 'Please hide my phone number from everyone', pagePath: '/settings/privacy', state: 'open',
    createdAt: daysAgo(5), updatedAt: daysAgo(5), memberId: ALUMNI[84]!.id,
    messages: [
      { id: 'm1', authorId: ALUMNI[84]!.id, fromStaff: false, createdAt: daysAgo(5), body: 'I set my contact visibility to private but a batchmate says they could still see my number. Can you check what is shown?' },
    ],
  }),
  ticket({
    kind: 'feedback', category: 'other', subject: 'The directory would be easier with a batch filter on the first screen', pagePath: '/directory', state: 'open',
    createdAt: daysAgo(6), updatedAt: daysAgo(6), memberId: STUDENT.id,
    messages: [
      { id: 'm1', authorId: STUDENT.id, fromStaff: false, createdAt: daysAgo(6), body: 'I only ever want alumni from the last ten years. Scrolling past everyone else takes a while. A batch range at the top would help.' },
    ],
  }),
  ticket({
    kind: 'bug', category: 'events', subject: 'Ticket page shows the wrong time zone', pagePath: '/events/alumni-meet-2026/ticket', state: 'answered',
    createdAt: daysAgo(9), updatedAt: daysAgo(8), memberId: ALUMNI[90]!.id,
    messages: [
      { id: 'm1', authorId: ALUMNI[90]!.id, fromStaff: false, createdAt: daysAgo(9), body: 'I am in London and the ticket shows the start time in my local time with no mention of IST. I nearly missed the live stream.' },
      { id: 'm2', authorId: OPERATOR.id, fromStaff: true, createdAt: daysAgo(8), body: 'Thank you, this is a fair point and we have passed it on. For now, the event page lists the time in IST; the ticket will say so too.' },
    ],
  }),
  ticket({
    kind: 'help', category: 'account', subject: 'I never received a sign-in code', pagePath: null, state: 'closed',
    createdAt: daysAgo(30), updatedAt: daysAgo(29), memberId: ALUMNI[96]!.id,
    messages: [
      { id: 'm1', authorId: ALUMNI[96]!.id, fromStaff: false, createdAt: daysAgo(30), body: 'No code arrives at my old college address.' },
      { id: 'm2', authorId: OPERATOR.id, fromStaff: true, createdAt: daysAgo(29), body: 'College addresses are switched off after graduation. We have replaced it with the personal address you registered with. Please request a code again.' },
    ],
  }),
];

// ---------------------------------------------------------------
// Pages the college edits itself
// ---------------------------------------------------------------

/**
 * Written to be true of any college: no names, places or numbers. The alumni
 * cell replaces them from the console, which is the point of the module.
 */
export const CMS_PAGES: CmsPage[] = [
  {
    id: 'page-1', slug: 'about-the-alumni-network', title: 'About the alumni network',
    audience: 'public', published: true, showInFooter: true, sortOrder: 10, updatedAt: daysAgo(30), updatedBy: 'Sridevi Kandula',
    body: [
      '## Who this is for',
      '',
      'This network is for everyone who has studied here: graduates of every batch, final-year students about to become one, and the faculty who taught them.',
      '',
      '## What you can do here',
      '',
      '- Find batchmates and alumni by branch, batch, company or city.',
      '- Ask an alumnus for advice, a referral or a talk, and get an answer from a person.',
      '- Hear about events, reunions and news from the college.',
      '- Post and find jobs and internships.',
      '',
      '## How we treat your details',
      '',
      'Your contact details are yours. Nobody sees them unless you have said they may, and the alumni office can only see what you have shared. You can change your choices at any time from **Settings**, and you can ask for a copy of your data or for it to be erased.',
      '',
      'Questions? Write to the alumni office through the [help desk](/help).',
    ].join('\n'),
  },
  {
    id: 'page-2', slug: 'community-guidelines', title: 'Community guidelines',
    audience: 'members', published: true, showInFooter: false, sortOrder: 20, updatedAt: daysAgo(14), updatedBy: 'Sridevi Kandula',
    body: [
      'The community works because people treat each other the way they would want a batchmate to treat them. Four things we ask of everyone.',
      '',
      '1. **Be specific.** A job post names the role, the employer and how to apply. A question says what you have already tried.',
      '2. **Be kind to people who are starting out.** Every final-year here is somebody who will be a colleague in five years.',
      '3. **Do not sell.** Businesses belong in the business directory. Schemes that promise returns, and recruitment that charges a fee, are removed.',
      '4. **Respect privacy.** Do not post anyone\'s phone number, address or photograph without their say-so, and do not ask for them in public.',
      '',
      '> A post that breaks these rules is hidden by the alumni cell, with a reason. If you think we got it wrong, write to the help desk and we will look again.',
      '',
      'Anyone can report a post from its menu. Reports are read by people at the college, not by the people involved.',
    ].join('\n'),
  },
  {
    id: 'page-3', slug: 'message-from-the-director', title: 'A message from the Director',
    audience: 'public', published: false, showInFooter: false, sortOrder: 5, updatedAt: daysAgo(3), updatedBy: 'Sridevi Kandula',
    body: [
      'Draft, not yet published.',
      '',
      'Replace this with the Director\'s own words to the alumni. A short note in the first person, signed with a name and a role, reads better than a brochure paragraph.',
    ].join('\n'),
  },
];
