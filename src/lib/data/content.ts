import { SEED, SEED_NOW, DEPARTMENTS } from './seed';
import { projectMemberSummary } from './repo';
import type { Session } from '../auth/guard';
import type { MemberSummary } from './types';

/**
 * Editorial content: gallery, news, and the mentorship hub.
 *
 * These three are the reason an alumnus opens the portal in a month when
 * they are not job-hunting. A directory alone is a phone book — people
 * consult it and leave. Photographs of a batch they were in, news about
 * someone they sat next to, and a standing offer to help a student are
 * what make the tab worth keeping open, and they are what the engagement
 * numbers in the admin dashboard are actually measuring.
 *
 * All three are feature-flagged per tenant (`features.gallery`,
 * `features.news`, `features.mentorship`), because a college running its
 * own website will often want news to live there instead.
 */

const daysFromNow = (d: number) => new Date(SEED_NOW.getTime() + d * 86400000).toISOString();

// ---------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------

export interface GalleryAlbum {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  eventSlug: string | null;
  departmentCode: string | null;
  batchYear: number | null;
  coverImage: string | null;
  photoCount: number;
  takenOn: string;
  /** Uploaded by the alumni cell, or contributed by a member. */
  contributedBy: string | null;
  published: boolean;
}

export interface GalleryPhoto {
  id: string;
  albumId: string;
  url: string | null;
  caption: string | null;
  /**
   * Members a contributor has tagged. Tagging is opt-out per member and
   * never releases contact details — it is a link to a profile, and the
   * profile applies its own rules.
   */
  taggedMemberIds: string[];
  width: number;
  height: number;
}

export const ALBUMS: GalleryAlbum[] = [
  {
    id: 'alb-1', slug: 'alumni-meet-2025', title: 'Annual Alumni Meet 2025',
    description: 'Four hundred and twelve graduates came back for the day. Department sessions in the morning, the general body meeting after lunch, and the cultural evening that overran by an hour and nobody minded.',
    eventSlug: null, departmentCode: null, batchYear: null,
    coverImage: null, photoCount: 148, takenOn: daysFromNow(-330),
    contributedBy: 'Alumni Cell', published: true,
  },
  {
    id: 'alb-2', slug: 'convocation-2026', title: 'Convocation 2026',
    description: 'The 2026 batch collecting their degrees. Photographs are grouped by branch.',
    eventSlug: 'convocation-2026', departmentCode: null, batchYear: 2026,
    coverImage: null, photoCount: 236, takenOn: daysFromNow(-22),
    contributedBy: 'Alumni Cell', published: true,
  },
  {
    id: 'alb-3', slug: 'cse-block-then-and-now', title: 'The CSE Block, 2011 and Now',
    description: 'Contributed by the 2015 batch. The old lab in the first eight photographs no longer exists — the block was rebuilt in 2019.',
    eventSlug: null, departmentCode: 'CSE', batchYear: 2015,
    coverImage: null, photoCount: 34, takenOn: daysFromNow(-140),
    contributedBy: 'Sandeep Kolli (CSE, 2015)', published: true,
  },
  {
    id: 'alb-4', slug: 'ece-vlsi-lab-inauguration', title: 'VLSI Lab Inauguration',
    description: 'The lab funded by the 2013 and 2014 ECE batches, opened in March.',
    eventSlug: null, departmentCode: 'ECE', batchYear: null,
    coverImage: null, photoCount: 52, takenOn: daysFromNow(-160),
    contributedBy: 'Alumni Cell', published: true,
  },
  {
    id: 'alb-5', slug: 'sports-day-2026', title: 'Sports Day 2026',
    description: null,
    eventSlug: null, departmentCode: null, batchYear: null,
    coverImage: null, photoCount: 91, takenOn: daysFromNow(-75),
    contributedBy: 'Physical Education Department', published: true,
  },
  {
    id: 'alb-6', slug: 'batch-2016-reunion', title: 'Batch of 2016 — Informal Reunion',
    description: 'Submitted by the batch WhatsApp group. Awaiting review before it goes live.',
    eventSlug: null, departmentCode: null, batchYear: 2016,
    coverImage: null, photoCount: 27, takenOn: daysFromNow(-12),
    contributedBy: 'Rakesh Sri Gollapudi (MECH, 2016)', published: false,
  },
];

/**
 * Photographs carry no image URLs in fixture mode.
 *
 * The gallery has to be designed for the state it will actually be in on
 * day one — an album a college has created and not yet filled — and a
 * layout that only works once real photographs arrive is a layout nobody
 * has tested. Every surface renders a labelled placeholder at the right
 * aspect ratio instead.
 */
export const PHOTOS: GalleryPhoto[] = ALBUMS.flatMap((album) =>
  Array.from({ length: Math.min(album.photoCount, 12) }, (_, i) => ({
    id: `${album.id}-p${i}`,
    albumId: album.id,
    url: null,
    caption: i === 0 ? album.title : null,
    taggedMemberIds: i % 4 === 0 ? [SEED.alumni[(i * 7) % SEED.alumni.length]!.id] : [],
    // Mixed orientations, so the masonry layout is exercised rather than
    // being a uniform grid that happens to look fine.
    width: i % 3 === 0 ? 1200 : 1600,
    height: i % 3 === 0 ? 1600 : 1067,
  })),
);

export function getAlbums(opts: { includeDrafts?: boolean; departmentCode?: string } = {}): GalleryAlbum[] {
  return ALBUMS.filter((a) => {
    if (!a.published && !opts.includeDrafts) return false;
    if (opts.departmentCode && a.departmentCode && a.departmentCode !== opts.departmentCode) return false;
    return true;
  }).sort((a, b) => b.takenOn.localeCompare(a.takenOn));
}

export function getAlbumBySlug(slug: string, opts: { includeDrafts?: boolean } = {}): GalleryAlbum | null {
  const album = ALBUMS.find((a) => a.slug === slug);
  if (!album) return null;
  if (!album.published && !opts.includeDrafts) return null;
  return album;
}

export function getAlbumPhotos(albumId: string): GalleryPhoto[] {
  return PHOTOS.filter((p) => p.albumId === albumId);
}

// ---------------------------------------------------------------
// News
// ---------------------------------------------------------------

export type NewsKind = 'achievement' | 'announcement' | 'obituary' | 'milestone' | 'press';

export interface NewsItem {
  id: string;
  slug: string;
  kind: NewsKind;
  title: string;
  summary: string;
  body: string;
  /** The member the story is about, when there is one. */
  aboutMemberId: string | null;
  departmentCode: string | null;
  publishedAt: string | null;
  coverImage: string | null;
  author: string;
  pinned: boolean;
  /** Draft items are visible only to staff who can publish. */
  published: boolean;
}

export const NEWS: NewsItem[] = [
  {
    id: 'news-1', slug: 'ece-2014-batch-funds-vlsi-lab', kind: 'milestone',
    title: 'The 2013 and 2014 ECE batches funded the new VLSI lab',
    summary: 'Forty-one graduates contributed ₹18.4 lakh over eleven months. The lab opened in March with sixteen workstations.',
    body:
      'The proposal started in a batch WhatsApp group in April 2025 and took eleven months to fund.\n\n' +
      'Forty-one graduates of the 2013 and 2014 ECE batches contributed a total of ₹18,40,000. The largest single contribution was ₹2,00,000 and the smallest was ₹2,500; the median was ₹21,000. The college matched a third of the total from the development fund.\n\n' +
      'The lab has sixteen workstations running the standard EDA toolchain, and is timetabled for third and fourth year ECE. Two alumni working in semiconductor firms have agreed to run a workshop each semester.\n\n' +
      'The batch representatives have asked us to record that the fund was administered by the college trust and that receipts under section 80G were issued to every contributor.',
    aboutMemberId: null, departmentCode: 'ECE',
    publishedAt: daysFromNow(-158), coverImage: null,
    author: 'Alumni Cell', pinned: false, published: true,
  },
  {
    id: 'news-2', slug: 'placement-season-2026-summary', kind: 'announcement',
    title: 'Placement season 2026: what the alumni network changed',
    summary: 'Sixty-eight offers this season came through a referral from a graduate. That is up from nine two years ago.',
    body:
      'The placement cell has closed the 2026 season. Of 388 students in the graduating batch, 341 received at least one offer.\n\n' +
      'Sixty-eight of those offers came through a referral from a DIET graduate — either a direct referral into a company, or a posting an alumnus put on this portal. Two years ago the equivalent number was nine, and it was tracked on a spreadsheet.\n\n' +
      'We are stating this number plainly because it is the only honest measure of whether an alumni network is working. A directory nobody uses is a mailing list. Sixty-eight people started a career because a graduate answered a message.\n\n' +
      'If you are willing to be asked, turn on "open to referrals" in your profile. Two hundred and forty-one graduates have. The students can see exactly who, which is the point.',
    aboutMemberId: null, departmentCode: null,
    publishedAt: daysFromNow(-34), coverImage: null,
    author: 'Training & Placement Cell', pinned: true, published: true,
  },
  {
    id: 'news-3', slug: 'alumna-appointed-cto', kind: 'achievement',
    title: 'Sravani Yalamanchili (CSE, 2013) appointed CTO at a Hyderabad fintech',
    summary: 'She was in the second CSE batch the college graduated.',
    body:
      'Sravani Yalamanchili, of the 2013 CSE batch, has been appointed Chief Technology Officer at a Hyderabad payments company.\n\n' +
      'She was in the second CSE batch the college graduated, and has spoken at the Industry Connect session twice.\n\n' +
      'Asked what she would tell a final-year, she said: "Learn to read somebody else\'s code without complaining about it. That is most of the first two years of any job, and nobody teaches it."',
    aboutMemberId: null, departmentCode: 'CSE',
    publishedAt: daysFromNow(-9), coverImage: null,
    author: 'Alumni Cell', pinned: false, published: true,
  },
  {
    id: 'news-4', slug: 'annual-meet-2026-registration-open', kind: 'announcement',
    title: 'Annual Alumni Meet 2026 — registration is open',
    summary: 'Saturday 24 September, on campus. ₹500 including lunch. Batch tables are being organised by year of passing.',
    body:
      'Registration for the Annual Alumni Meet is open on the events page.\n\n' +
      'The day runs from 9:30am. Department sessions in the morning, the general body meeting after lunch, and the cultural evening in the open-air auditorium from 6pm.\n\n' +
      'Tables are organised by year of passing. If your batch has a coordinator, they will have your table number at the registration desk; if it does not, tell us and we will make one of you responsible for it.\n\n' +
      'Bring family. The ₹500 covers one lunch; additional guests can be added when you register.',
    aboutMemberId: null, departmentCode: null,
    publishedAt: daysFromNow(-16), coverImage: null,
    author: 'Alumni Cell', pinned: true, published: true,
  },
  {
    id: 'news-5', slug: 'in-memoriam-prof-narasimha-rao', kind: 'obituary',
    title: 'In memoriam: Prof. K. Narasimha Rao',
    summary: 'Head of Mechanical Engineering from 2011 to 2021. He taught the first four batches that graduated from the department.',
    body:
      'Professor K. Narasimha Rao, who headed the Mechanical Engineering department from 2011 to 2021, died on the 2nd of August after a short illness. He was 68.\n\n' +
      'He taught thermodynamics to the first four batches the department graduated, and supervised the workshop that most MECH graduates of that decade remember him standing in.\n\n' +
      'A condolence book is open at the department office. Graduates who wish to contribute to the memorial scholarship the family has asked for can contact the alumni cell.',
    aboutMemberId: null, departmentCode: 'MECH',
    publishedAt: daysFromNow(-15), coverImage: null,
    author: 'Office of the Principal', pinned: false, published: true,
  },
  {
    id: 'news-6', slug: 'portal-replaces-previous-system', kind: 'announcement',
    title: 'This portal replaces the previous alumni system',
    summary: 'Your profile has been matched against the college degree register. Contact details are only released with your consent.',
    body:
      'The college\'s previous alumni subscription lapsed, and this portal replaces it.\n\n' +
      'Two things are different, and both are deliberate.\n\n' +
      'First, every account is matched against the degree register held by the examinations branch before it can see anybody. That is why claiming a profile asks for your roll number and the name on your certificate.\n\n' +
      'Second, your contact details are not visible by default. You choose who can see them in your privacy settings, and students never see them in bulk — they can send you a request, and you decide. If you would rather not be contacted at all, that setting exists too and nobody will override it.\n\n' +
      'Data is held on infrastructure inside India. You can export or delete everything the college holds about you from your settings.',
    aboutMemberId: null, departmentCode: null,
    publishedAt: daysFromNow(-58), coverImage: null,
    author: 'Alumni Cell', pinned: false, published: true,
  },
  {
    id: 'news-7', slug: 'nirf-2027-data-collection', kind: 'announcement',
    title: 'Draft: NIRF 2027 data collection',
    summary: 'Not yet published.',
    body: 'Draft. The graduation-outcomes section needs the placement cell numbers before this can go out.',
    aboutMemberId: null, departmentCode: null,
    publishedAt: null, coverImage: null,
    author: 'Office of the Principal', pinned: false, published: false,
  },
];

export function getNews(opts: { kind?: NewsKind; departmentCode?: string; includeDrafts?: boolean } = {}): NewsItem[] {
  return NEWS.filter((n) => {
    if (!n.published && !opts.includeDrafts) return false;
    if (opts.kind && n.kind !== opts.kind) return false;
    if (opts.departmentCode && n.departmentCode && n.departmentCode !== opts.departmentCode) return false;
    return true;
  }).sort((a, b) => {
    // Pinned first, then newest. A pinned draft still sorts with drafts.
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '');
  });
}

export function getNewsBySlug(slug: string, opts: { includeDrafts?: boolean } = {}): NewsItem | null {
  const item = NEWS.find((n) => n.slug === slug);
  if (!item) return null;
  if (!item.published && !opts.includeDrafts) return null;
  return item;
}

// ---------------------------------------------------------------
// Mentorship
// ---------------------------------------------------------------

export interface MentorTopic {
  id: string;
  label: string;
  description: string;
  mentorCount: number;
}

/**
 * Topics, not job titles.
 *
 * A final-year does not know they want "a Senior Software Engineer at a
 * product company" — they know they want to understand whether to take
 * the service-company offer in hand or wait. Naming the question rather
 * than the seniority is what makes the hub usable by the person who needs
 * it most.
 */
export const MENTOR_TOPICS: MentorTopic[] = [
  { id: 'interviews', label: 'Interview preparation', description: 'What to study, in what order, and how long it actually takes.', mentorCount: 0 },
  { id: 'first-job', label: 'Choosing a first job', description: 'Service company or product company, and what the difference means five years later.', mentorCount: 0 },
  { id: 'higher-studies', label: 'Higher studies', description: 'GATE, GRE, applications, funding, and whether it is worth it for your field.', mentorCount: 0 },
  { id: 'core-vs-software', label: 'Core versus software', description: 'For ECE, EEE, MECH and CIVIL graduates weighing a switch.', mentorCount: 0 },
  { id: 'abroad', label: 'Working abroad', description: 'Visas, timelines, and what nobody tells you about the first year.', mentorCount: 0 },
  { id: 'startups', label: 'Startups and founding', description: 'From graduates who have done it, including the ones it did not work out for.', mentorCount: 0 },
  { id: 'resume', label: 'Resume and portfolio review', description: 'A read-through from somebody who screens them.', mentorCount: 0 },
  { id: 'career-change', label: 'Changing direction', description: 'Moving between functions, returning after a break, or starting over.', mentorCount: 0 },
];

/**
 * Mentors, grouped by the topic their skills and history suggest.
 *
 * Derived rather than self-declared: asking every alumnus to tick eight
 * boxes produces eight empty boxes. The topic assignment is a heuristic
 * the member can correct, which is a far easier ask than filling in a
 * form from nothing.
 */
export function getMentorsByTopic(session: Session, topicId: string, limit = 12): MemberSummary[] {
  const mentors = SEED.alumni.filter((m) => m.openToMentoring);

  const matches = mentors.filter((m) => {
    const skills = m.skills.join(' ').toLowerCase();
    const software = ['CSE', 'IT', 'AIML'].includes(m.departmentCode ?? '');
    const yearsOut = 2026 - (m.batchYear ?? 2026);

    switch (topicId) {
      case 'interviews': return software && yearsOut >= 2;
      case 'first-job': return yearsOut >= 3 && yearsOut <= 8;
      case 'higher-studies': return m.education.length > 1;
      case 'core-vs-software': return !software;
      case 'abroad': return m.country !== 'IN';
      case 'startups': return /founder|co-founder/i.test(m.designation ?? '');
      case 'resume': return yearsOut >= 5;
      case 'career-change': return m.employment.length > 1;
      default: return skills.length > 0;
    }
  });

  // Projected for the viewer, exactly as the directory would. Returning
  // `toSummary()` directly made the mentorship pages wider than /directory
  // for the same person — a student saw city and country here and not
  // there. Two lists of the same people under two different rules is how a
  // projection stops being a guarantee.
  return matches.slice(0, limit).map((m) => projectMemberSummary(m, session));
}

/**
 * Counts are viewer-independent — how many mentors exist is not a
 * projected field, and computing it needs no member data to leave here.
 */
export function getMentorTopics(): MentorTopic[] {
  return MENTOR_TOPICS.map((t) => ({ ...t, mentorCount: countMentorsByTopic(t.id) }));
}

function countMentorsByTopic(topicId: string): number {
  return SEED.alumni.filter((m) => {
    if (!m.openToMentoring) return false;
    const software = ['CSE', 'IT', 'AIML'].includes(m.departmentCode ?? '');
    const yearsOut = 2026 - (m.batchYear ?? 2026);
    switch (topicId) {
      case 'interviews': return software && yearsOut >= 2;
      case 'first-job': return yearsOut >= 3 && yearsOut <= 8;
      case 'higher-studies': return m.education.length > 1;
      case 'core-vs-software': return !software;
      case 'abroad': return m.country !== 'IN';
      case 'startups': return /founder|co-founder/i.test(m.designation ?? '');
      case 'resume': return yearsOut >= 5;
      case 'career-change': return m.employment.length > 1;
      default: return m.skills.length > 0;
    }
  }).length;
}

/** Mentors in a student's own department first — the strongest signal. */
export function getMentorsForDepartment(
  session: Session,
  departmentCode: string | null,
  limit = 8,
): MemberSummary[] {
  const pool = SEED.alumni.filter((m) => m.openToMentoring);
  const own = pool.filter((m) => m.departmentCode === departmentCode);
  const rest = pool.filter((m) => m.departmentCode !== departmentCode);
  return [...own, ...rest].slice(0, limit).map((m) => projectMemberSummary(m, session));
}

export function getMentorshipStats() {
  const mentors = SEED.alumni.filter((m) => m.openToMentoring);
  const referrers = SEED.alumni.filter((m) => m.openToReferrals);
  const speakers = SEED.alumni.filter((m) => m.openToSpeaking);

  const byDept = DEPARTMENTS.map((d) => ({
    label: d.code,
    value: mentors.filter((m) => m.departmentCode === d.code).length,
  })).filter((d) => d.value > 0);

  return {
    mentors: mentors.length,
    referrers: referrers.length,
    speakers: speakers.length,
    /** Alumni abroad who mentor — the hardest cohort to reach any other way. */
    abroad: mentors.filter((m) => m.country !== 'IN').length,
    byDepartment: byDept.sort((a, b) => b.value - a.value),
  };
}
