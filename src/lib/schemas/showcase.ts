import { z } from 'zod';
import { SHOWCASE_CATEGORY_VALUES, SHOWCASE_KIND_VALUES, SLUG_PATTERN } from '../community';

/**
 * The showcase. Shared by the member route, the staff routes and the tests
 * (Next.js refuses non-method exports from `route.ts`).
 *
 * The rule that shapes the staff side: an entry is *about a person*, so it
 * has to be able to say why the college may publish it. For somebody on the
 * portal that is their agreement, recorded; for somebody who is not, a link
 * to where the same thing was already public. Without one of those, the
 * entry cannot be published.
 */

const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === 'https:' && !u.username && !u.password;
    } catch {
      return false;
    }
  }, 'Use an https link to where it was published.');

const shared = {
  category: z.enum(SHOWCASE_CATEGORY_VALUES, { errorMap: () => ({ message: 'Pick the closest category.' }) }),
  headline: z.string().trim().min(10, 'Say what it is in a line: “Best paper award at an IEEE conference”.').max(140),
  summary: z.string().trim().min(30, 'A sentence or two on what happened and why it matters.').max(400),
  story: z.string().trim().max(3000).optional(),
  achievedOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date it happened, as YYYY-MM-DD.')
    .optional(),
};

/** A member putting their own achievement forward. */
export const ShowcaseSubmit = z.object({
  ...shared,
  slug: z.string().trim().regex(SLUG_PATTERN, 'Lowercase words separated by hyphens.').min(4).max(90).optional(),
});

/** Staff adding an entry. */
export const ShowcaseCurate = z
  .object({
    ...shared,
    slug: z.string().trim().regex(SLUG_PATTERN, 'Lowercase words separated by hyphens.').min(4).max(90).optional(),
    kind: z.enum(SHOWCASE_KIND_VALUES),
    displayName: z.string().trim().min(3, 'The name as it should read.').max(120),
    /** The member this is about, when they are on the portal. */
    memberId: z.string().trim().min(1).max(80).optional(),
    /** Staff attest that the member agreed to be featured. Required with a memberId. */
    consentConfirmed: z.boolean().default(false),
    sourceUrl: httpsUrl.optional(),
    batchYear: z.number().int().min(1960).max(2100).optional(),
    departmentCode: z.string().trim().max(12).optional(),
    featured: z.boolean().default(false),
    publish: z.boolean({
      required_error: 'Say whether this goes live now or waits.',
      invalid_type_error: 'publish is true or false.',
    }),
  })
  .superRefine((v, ctx) => {
    if (v.memberId && !v.consentConfirmed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['consentConfirmed'],
        message: 'This is about a member of the portal. Confirm they have agreed to be featured before it can be saved.',
      });
    }
    if (!v.memberId && !v.sourceUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceUrl'],
        message: 'This is about somebody who is not on the portal, so it needs a link to where it was already published.',
      });
    }
  });

/** Deciding a submission, or taking a published entry down. */
export const ShowcaseDecision = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({
    action: z.literal('decline'),
    message: z
      .string()
      .trim()
      .min(12, 'Write something the member can act on. Name what is missing, so a resubmission can succeed.')
      .max(1200),
  }),
  z.object({
    action: z.literal('unpublish'),
    message: z.string().trim().min(8, 'Record why it came down, for the audit trail.').max(600),
  }),
]);

export type ShowcaseCurateInput = z.infer<typeof ShowcaseCurate>;
