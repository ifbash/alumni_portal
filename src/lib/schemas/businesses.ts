import { z } from 'zod';
import { BUSINESS_INDUSTRIES, SLUG_PATTERN } from '../community';

/**
 * A business listing. Shared by the member routes, the staff routes and the
 * tests (Next.js refuses non-method exports from `route.ts`).
 *
 * Every listing is moderated before anyone sees it, and the rules a
 * moderator applies are written into the validation where they can be:
 * no promised returns in the description, no contact details the owner
 * has not chosen to share, and a website that is a real https address.
 */

const list = (label: string) =>
  z
    .array(z.string().trim().min(2, `Each ${label} needs a few characters.`).max(60))
    .max(8, `Eight ${label}s is plenty. Say the rest on your website.`)
    .default([]);

/** A promise of returns is the shape of a scheme, not a business to be found at a reunion. */
const RETURNS_CLAIM = /\b(guaranteed|assured)\s+(returns?|income|profit)|\b\d{2,3}\s*%\s*(returns?|per\s+(year|annum|month))/i;

export const BUSINESS_PHONE = /^\+?[0-9][0-9 ()-]{6,19}$/;

const fields = {
  name: z.string().trim().min(2, 'What is the business called?').max(100),
  industry: z.enum(BUSINESS_INDUSTRIES, { errorMap: () => ({ message: 'Pick the closest industry from the list.' }) }),
  description: z
    .string()
    .trim()
    .min(40, 'Say what the business does and who it is for. A line and a name is not enough for a member to decide on.')
    .max(1200)
    .refine((v) => !RETURNS_CLAIM.test(v), {
      message: 'A promise of guaranteed returns cannot be listed here. Describe what the business does and sells.',
    }),
  city: z.string().trim().min(2).max(60).optional(),
  region: z.string().trim().min(2).max(60).optional(),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Two letters, for example IN or AE.')
    .optional(),
  website: z
    .string()
    .trim()
    .max(300)
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === 'https:' && !u.username && !u.password;
      } catch {
        return false;
      }
    }, 'Use an https address, for example https://example.com.')
    .optional(),
  products: list('product'),
  services: list('service'),
  showContact: z.boolean().default(false),
  contactEmail: z.string().trim().email('That email address does not look right.').max(160).optional(),
  contactPhone: z.string().trim().regex(BUSINESS_PHONE, 'A phone number, with the country code if it is outside India.').optional(),
};

function contactRules(v: { showContact?: boolean | undefined; contactEmail?: string | undefined; contactPhone?: string | undefined }, ctx: z.RefinementCtx) {
  const has = Boolean(v.contactEmail || v.contactPhone);
  if (v.showContact && !has) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['contactEmail'],
      message: 'You chose to show contact details but gave none. Add an email or a phone number, or turn sharing off.',
    });
  }
  if (!v.showContact && has) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['showContact'],
      message: 'Contact details are only shown if you choose to share them. Turn sharing on, or remove them.',
    });
  }
}

export const BusinessCreate = z
  .object({
    ...fields,
    slug: z.string().trim().regex(SLUG_PATTERN, 'Lowercase words separated by hyphens.').min(3).max(80).optional(),
  })
  .superRefine(contactRules);

/** A resubmission replaces the content and always goes back for review. */
export const BusinessResubmit = z.object({ ...fields }).superRefine(contactRules);

export const BusinessOwnerAction = z.discriminatedUnion('action', [
  z.object({ action: z.literal('close') }),
  z.object({ action: z.literal('resubmit'), business: z.object({ ...fields }).superRefine(contactRules) }),
]);

/** What a moderator may do. A refusal carries a reason the owner reads as written. */
export const BusinessDecision = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({
    action: z.literal('decline'),
    message: z
      .string()
      .trim()
      .min(12, 'Write something the owner can act on. Name what to change, so a resubmission can succeed.')
      .max(1200),
  }),
]);

export type BusinessCreateInput = z.infer<typeof BusinessCreate>;
