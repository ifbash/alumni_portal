import { z } from 'zod';
import { SLUG_PATTERN } from '../community';

/**
 * Groups and chapters. Shared by the member routes, the staff routes and
 * the tests (Next.js refuses non-method exports from `route.ts`).
 */

const name = z.string().trim().min(3, 'Give the group a name members will recognise.').max(80);
const description = z
  .string()
  .trim()
  .min(20, 'Say what the group is for in a sentence or two, so somebody can decide whether to join.')
  .max(600);

export const GroupCreate = z
  .object({
    name,
    slug: z.string().trim().regex(SLUG_PATTERN, 'Lowercase words separated by hyphens.').min(3).max(80).optional(),
    kind: z.enum(['chapter', 'interest']),
    description,
    /** A chapter's city. A chapter for a whole country leaves it out. */
    city: z.string().trim().min(2).max(60).optional(),
    /** ISO 3166 alpha-2, upper case. */
    country: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, 'Two letters, for example IN or US.')
      .optional(),
    joinPolicy: z.enum(['open', 'approval']).default('open'),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'chapter' && !v.city && !v.country) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['city'],
        message: 'A chapter is for a place. Give a city, a country, or both.',
      });
    }
    if (v.kind === 'interest' && (v.city || v.country)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['city'],
        message: 'An interest group is not tied to a place. Leave the city and country out, or make it a chapter.',
      });
    }
  });

export const GroupUpdate = z
  .object({
    name: name.optional(),
    description: description.optional(),
    joinPolicy: z.enum(['open', 'approval']).optional(),
    archived: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change.' });

export const GroupLead = z.object({
  memberId: z.string().trim().min(1).max(80),
  role: z.enum(['lead', 'member']),
});

export const Membership = z.object({ action: z.enum(['join', 'leave']) });

export const JoinDecision = z.object({
  memberId: z.string().trim().min(1).max(80),
  action: z.enum(['approve', 'decline']),
});
