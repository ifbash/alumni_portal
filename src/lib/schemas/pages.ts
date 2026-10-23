import { z } from 'zod';
import { MARKDOWN_MAX_LENGTH } from '../content/markdown';
import { SLUG_PATTERN } from '../community';

/**
 * The shape of a page the college edits itself.
 *
 * Shared by the create route and the update route, and importable by tests.
 * It lives here rather than in a route file because Next.js refuses any
 * export from `route.ts` that is not an HTTP method.
 */

export const PAGE_TITLE_MAX = 120;

const title = z.string().trim().min(3, 'Give the page a title readers will recognise.').max(PAGE_TITLE_MAX);

const body = z
  .string()
  .min(10, 'A page with no words in it is not a page. Write a paragraph, or save the title as a draft later.')
  .max(MARKDOWN_MAX_LENGTH, 'That is longer than a page should be. Split it into two pages.');

const fields = {
  audience: z.enum(['public', 'members']),
  showInFooter: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
};

export const PageCreate = z.object({
  title,
  slug: z.string().trim().regex(SLUG_PATTERN, 'Lowercase words separated by hyphens.').min(3).max(80).optional(),
  body,
  audience: fields.audience,
  showInFooter: fields.showInFooter.default(false),
  sortOrder: fields.sortOrder.default(100),
  publish: z.boolean({
    required_error: 'Say whether this page goes live now or stays a draft.',
    invalid_type_error: 'publish is true or false.',
  }),
});

/** An update names only what it changes. The address never changes: links get forwarded. */
export const PageUpdate = z
  .object({
    title: title.optional(),
    body: body.optional(),
    audience: fields.audience.optional(),
    showInFooter: fields.showInFooter.optional(),
    sortOrder: fields.sortOrder.optional(),
    publish: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change.' });

export type PageCreateInput = z.infer<typeof PageCreate>;
export type PageUpdateInput = z.infer<typeof PageUpdate>;
