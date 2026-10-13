/**
 * The three "open to" settings, in the words a member reads them.
 *
 * One source for the profile form, the home availability card, the
 * mentorship page and the directory chips, so the promise a member makes
 * by switching one on is described the same way everywhere.
 *
 * Every line is a description of what the product does today. No day,
 * place or programme names: those are the college's facts, not ours.
 */

export type AvailabilityKey = 'mentoring' | 'referrals' | 'speaking';

export interface AvailabilityContext {
  /**
   * `faculty` means faculty without the alumni role. They mentor and
   * speak, but a referral is an alumnus vouching for a student at their
   * own employer, so faculty get no referrals entry.
   */
  audience: 'alumni' | 'faculty';
  /** The member's current employer, when known. */
  company?: string | null;
  /** The pack's `officeName`, mid-sentence ("alumni cell"). */
  officeName: string;
  /** The per-student open-request limit (`CONNECTION_LIMITS.studentOpenRequests`). */
  openLimit: number;
}

export interface AvailabilityCopy {
  /** The switch label: "Open to mentoring". */
  label: string;
  /** The chip on a card: "Mentors", "Refers at Amazon", "Speaks". */
  chip: string;
  /** One sentence under the switch. */
  line: string;
  /** The longer explanation, for a disclosure. */
  detail: string;
}

/** Days after which an unanswered request closes by itself (the connections API). */
export const REQUEST_EXPIRY_DAYS = 14;

export const AVAILABILITY_KEYS: readonly AvailabilityKey[] = ['mentoring', 'referrals', 'speaking'];

/** The copy for one setting, or null when it does not apply to this audience. */
export function availabilityCopy(key: AvailabilityKey, ctx: AvailabilityContext): AvailabilityCopy | null {
  switch (key) {
    case 'mentoring':
      return {
        label: 'Open to mentoring',
        chip: 'Mentors',
        line: 'Final-year students can ask you for advice. You choose which requests to accept.',
        detail:
          `Each request arrives with the student's message. Accept it or decline it from Requests. ` +
          `A request you do not answer closes by itself after ${REQUEST_EXPIRY_DAYS} days.`,
      };
    case 'referrals': {
      if (ctx.audience === 'faculty') return null;
      const company = ctx.company?.trim();
      return {
        label: 'Open to referrals',
        chip: company ? `Refers at ${company}` : 'Refers',
        line: company
          ? `Students may ask you to refer them at ${company}.`
          : 'Students may ask you for a referral.',
        detail: `A student can have at most ${ctx.openLimit} open requests across the whole portal.`,
      };
    }
    case 'speaking':
      return {
        label: 'Open to speaking',
        chip: 'Speaks',
        line: `The ${ctx.officeName} may invite you to speak to students, on campus or online.`,
        detail: 'An invitation, not a booking. You can say no.',
      };
  }
}

/** Every setting that applies to this audience, in display order. */
export function availabilityEntries(ctx: AvailabilityContext): Array<AvailabilityCopy & { key: AvailabilityKey }> {
  return AVAILABILITY_KEYS.flatMap((key) => {
    const c = availabilityCopy(key, ctx);
    return c ? [{ key, ...c }] : [];
  });
}
