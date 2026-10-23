import { z } from 'zod';
import { POST_KIND_VALUES, POST_MAX_LENGTH, POST_MAX_TAGS, SLUG_PATTERN, normaliseTags } from '../community';

/**
 * What a post may be.
 *
 * Kept out of the route files (Next refuses non-method exports from
 * `route.ts`) and shared with tests.
 */

/** Links in a post. A third is the shape of a spam post, not a conversation. */
export const POST_MAX_LINKS = 2;

export function countLinks(text: string): number {
  return (text.match(/\bhttps?:\/\/\S+|\bwww\.\S+/gi) ?? []).length;
}

export const PostCreate = z.object({
  kind: z.enum(POST_KIND_VALUES),
  body: z
    .string()
    .trim()
    .min(10, 'Say a little more. A post under ten characters is a reaction, and reactions are the heart on someone else’s post.')
    .max(POST_MAX_LENGTH, `Keep it under ${POST_MAX_LENGTH.toLocaleString('en-IN')} characters. A longer piece belongs in a document you link to.`)
    .refine((v) => countLinks(v) <= POST_MAX_LINKS, {
      message: `At most ${POST_MAX_LINKS} links in a post.`,
    }),
  tags: z
    .array(z.string().trim().max(40))
    .max(POST_MAX_TAGS + 3, `${POST_MAX_TAGS} tags is plenty.`)
    .default([])
    .transform((tags) => normaliseTags(tags)),
  /** The group it is written in. Absent is the open feed. */
  groupSlug: z.string().trim().regex(SLUG_PATTERN, 'Pick a group from the list.').max(80).optional(),
});

export type PostCreateInput = z.infer<typeof PostCreate>;

export const PostReport = z.object({
  reason: z
    .string()
    .trim()
    .min(8, 'Say what is wrong with it, in a few words, so the person reading the report knows what to look at.')
    .max(300),
});

export const PostLike = z.object({ liked: z.boolean() });

export const PostModeration = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('hide'),
    reason: z
      .string()
      .trim()
      .min(12, 'Write the reason the author will read. A sentence naming the rule beats “removed”.')
      .max(600),
  }),
  z.object({ action: z.literal('restore') }),
]);
