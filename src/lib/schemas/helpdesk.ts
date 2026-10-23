import { z } from 'zod';
import { TICKET_CATEGORY_VALUES } from '../community';

/**
 * Help desk and feedback. Shared by the routes and the tests (Next.js
 * refuses non-method exports from `route.ts`).
 */

export const TicketCreate = z.object({
  category: z.enum(TICKET_CATEGORY_VALUES, { errorMap: () => ({ message: 'Pick what it is about.' }) }),
  subject: z.string().trim().min(8, 'A few words on what it is about, so the right person picks it up.').max(120),
  body: z
    .string()
    .trim()
    .min(20, 'Say what happened and what you expected. A line is rarely enough for someone to help.')
    .max(2000),
});

export const TicketReply = z.object({
  body: z.string().trim().min(2, 'Write a reply.').max(2000),
});

export const TicketMemberAction = z.object({ action: z.literal('close') });

/** Staff answering. They choose where the ticket goes next, so it never closes by accident. */
export const StaffReply = z.object({
  body: z.string().trim().min(2, 'Write a reply.').max(2000),
  state: z.enum(['answered', 'closed']),
});

/**
 * A path on this site and nothing else: no query string, no host. The
 * feedback button records the page it was pressed on, and a path is all
 * that is ever wanted. A query string could carry a token.
 */
const PATH = /^\/[A-Za-z0-9\-._~%!$&'()*+,;=:@/]{0,198}$/;

export const Feedback = z.object({
  message: z.string().trim().min(10, 'Say a little more, so we know what you mean.').max(1500),
  pagePath: z.string().trim().regex(PATH, 'That is not a page on this site.').optional(),
});

export type TicketCreateInput = z.infer<typeof TicketCreate>;
