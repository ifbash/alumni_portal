import type { MemberDetail } from '@/lib/data/types';

/**
 * Profile completeness, as a list of named gaps.
 *
 * A bare "62% complete" teaches nobody anything and moves nothing. What
 * moves a profile is being told the one specific thing that is missing
 * and being handed the field that fills it — so every check carries a
 * label, a reason, and a deep link to the input.
 *
 * The weights are not equal on purpose. A city and a company are what the
 * directory can actually be searched on; a photo is nice. Ordering by
 * weight means the first thing suggested is the thing worth doing.
 */

export interface ProfileCheck {
  id: string;
  /** Named as an outcome, not a field name. */
  label: string;
  /** Why anyone should bother. One clause, honest. */
  why: string;
  done: boolean;
  weight: number;
  href: string;
}

export function profileChecks(
  profile: Pick<
    MemberDetail,
    | 'photoUrl'
    | 'bio'
    | 'city'
    | 'skills'
    | 'currentCompany'
    | 'designation'
    | 'employment'
    | 'education'
    | 'openToMentoring'
    | 'openToReferrals'
    | 'openToSpeaking'
    | 'contact'
    | 'isStudent'
  >,
): ProfileCheck[] {
  const contact = profile.contact ?? {};
  const edit = (anchor: string) => `/profile/edit#${anchor}`;

  const shared: ProfileCheck[] = [
    {
      id: 'bio',
      label: profile.isStudent ? 'Say what you are looking for' : 'Write two lines about yourself',
      why: profile.isStudent
        ? 'An alumnus decides whether to reply based on this and nothing else.'
        : 'This is what a student reads before deciding whether to ask you anything.',
      done: Boolean(profile.bio && profile.bio.trim().length > 20),
      weight: 3,
      href: edit('bio'),
    },
    {
      id: 'skills',
      label: 'Add at least three skills',
      why: 'Skills are how the directory is filtered. Without them you appear only in name searches.',
      done: profile.skills.length >= 3,
      weight: 3,
      href: edit('skills'),
    },
    {
      id: 'linkedin',
      label: 'Link your LinkedIn profile',
      why: 'Released only to people your visibility setting already allows.',
      done: Boolean(contact.linkedin),
      weight: 2,
      href: edit('linkedin'),
    },
    {
      id: 'mobile',
      label: 'Add a mobile number',
      why: 'Used for account recovery and WhatsApp. Never for signing in, and never shown in the directory.',
      done: Boolean(contact.mobile),
      weight: 2,
      href: edit('mobile'),
    },
    {
      id: 'photo',
      label: 'Upload a photo',
      why: 'A directory of initials is harder to scan. Optional, and it stays optional.',
      done: Boolean(profile.photoUrl),
      weight: 1,
      href: edit('photo'),
    },
  ];

  if (profile.isStudent) {
    return sort([
      {
        id: 'links',
        label: 'Add a GitHub or portfolio link',
        why: 'The one thing a referring alumnus will actually open before forwarding your name.',
        done: Boolean(contact.github ?? contact.portfolio),
        weight: 3,
        href: edit('github'),
      },
      ...shared,
    ]);
  }

  return sort([
    {
      id: 'work',
      label: 'Add where you work now',
      why: 'Company and designation are the two fields students search on most.',
      done: Boolean(profile.currentCompany && profile.designation),
      weight: 4,
      href: edit('company'),
    },
    {
      id: 'city',
      label: 'Add the city you live in',
      why: 'Batch meets are organised city by city. An unlisted city gets no invitation.',
      done: Boolean(profile.city),
      weight: 3,
      href: edit('city'),
    },
    {
      id: 'availability',
      label: 'Say what you are open to',
      why: 'Mentoring, referrals or speaking. All three off means students are told not to ask.',
      done: profile.openToMentoring || profile.openToReferrals || profile.openToSpeaking,
      weight: 3,
      href: edit('availability'),
    },
    ...shared,
    {
      id: 'employment',
      label: 'Add your previous roles',
      why: 'A student changing tracks wants to see somebody who already made that jump.',
      done: profile.employment.length > 1,
      weight: 1,
      href: edit('employment'),
    },
  ]);
}

function sort(checks: ProfileCheck[]): ProfileCheck[] {
  return [...checks].sort((a, b) => b.weight - a.weight);
}

export function completenessScore(checks: ProfileCheck[]): number {
  const total = checks.reduce((n, c) => n + c.weight, 0) || 1;
  const done = checks.filter((c) => c.done).reduce((n, c) => n + c.weight, 0);
  return Math.round((done / total) * 100);
}
