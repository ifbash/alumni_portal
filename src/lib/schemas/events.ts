import { z } from 'zod';
import { EVENT_KIND_VALUES, SLUG_PATTERN } from '../community';
import type { EventKind, EventMode } from '../data/types';

/**
 * What makes an event a webinar, a reunion or a chapter meetup, shared by
 * the staff composer's route and the member proposal route so the two can
 * never disagree about what a valid online event is.
 *
 * Kept out of the route files because Next.js refuses any export from
 * `route.ts` that is not an HTTP method.
 */

export const EVENT_MODE_VALUES = ['in_person', 'online', 'hybrid'] as const satisfies readonly EventMode[];

/** An https address with no credentials in it: the only thing a join link may be. */
export function isJoinLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const eventKindShape = {
  kind: z.enum(EVENT_KIND_VALUES).default('other'),
  mode: z.enum(EVENT_MODE_VALUES).default('in_person'),
  /** The join link. Stored with the event and shown only to people who are registered. */
  meetingUrl: z.string().trim().max(500).optional(),
  /** The chapter or group hosting it, by slug. */
  groupSlug: z.string().trim().regex(SLUG_PATTERN, 'Pick a group from the list.').max(80).optional(),
  /** The batch a reunion is for. A reunion for everyone leaves it out. */
  batchYear: z.number().int().min(1960).max(2100).optional(),
};

interface KindFields {
  kind: EventKind;
  mode: EventMode;
  meetingUrl?: string | undefined;
  batchYear?: number | undefined;
}

/** The cross-field rules. Call from a `superRefine`. */
export function checkEventKindFields(value: KindFields, ctx: z.RefinementCtx): void {
  const online = value.mode === 'online' || value.mode === 'hybrid';

  if (online && !value.meetingUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['meetingUrl'],
      message: 'An online event needs the link people join with. It is shown only to those who register.',
    });
  }

  if (value.meetingUrl && !online) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['meetingUrl'],
      message: 'This event is held in person, so it has no join link. Change how it is held, or remove the link.',
    });
  }

  if (value.meetingUrl && !isJoinLink(value.meetingUrl)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['meetingUrl'],
      message: 'Use an https link, for example the Google Meet or Zoom address, with no password in it.',
    });
  }

  if (value.batchYear && value.kind !== 'reunion') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['batchYear'],
      message: 'Only a reunion is for a particular batch. Change the type to Reunion, or leave the batch out.',
    });
  }
}

// ---------------------------------------------------------------
// A member putting an event forward
// ---------------------------------------------------------------

const ISO = 'Send the date and time as an ISO 8601 instant, e.g. 2027-09-24T10:00:00.000Z.';

const instant = (message: string) =>
  z
    .string()
    .trim()
    .min(1)
    .max(40)
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: `${message} ${ISO}` });

/** The notice the alumni cell needs to look at a proposal properly. */
export const PROPOSAL_LEAD_DAYS = 7;

export const EventProposal = z
  .object({
    title: z.string().trim().min(4, 'Give the event a title members will recognise in a list.').max(140),
    description: z
      .string()
      .trim()
      .min(40, 'Say what it is, who it is for and what happens. A line and a date is not enough for the alumni cell to decide on.')
      .max(4000),
    venue: z.string().trim().min(2, 'Say where it is, even if that is “Online”.').max(240),
    startsAt: instant('That start date and time could not be read.'),
    endsAt: instant('That end date and time could not be read.').optional(),
    audience: z.enum(['both', 'alumni_only']).default('both'),
    capacity: z.number().int('Capacity is a whole number of seats.').positive().max(100000).optional(),
    ticketPrice: z.number().int('Ticket prices are whole rupees.').min(0).max(500000).default(0),
    /** A branch, for an event that is for one. Blank is college-wide. */
    departmentCode: z.string().trim().max(12).optional(),
    ...eventKindShape,
  })
  .superRefine((value, ctx) => {
    checkEventKindFields(value, ctx);
    if (value.endsAt && Date.parse(value.endsAt) <= Date.parse(value.startsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsAt'],
        message: 'The event cannot finish before it starts. Check the end date as well as the time.',
      });
    }
  });

export type EventProposalInput = z.infer<typeof EventProposal>;

/** What the alumni cell may do with a proposal. A refusal always carries a reason the proposer reads. */
export const ProposalDecision = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({
    action: z.literal('decline'),
    message: z
      .string()
      .trim()
      .min(12, 'Write something the proposer can act on. A sentence naming what would make it workable beats a form letter.')
      .max(1200),
  }),
]);
