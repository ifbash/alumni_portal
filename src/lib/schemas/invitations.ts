import { z } from 'zod';

/**
 * Invitations. Shared by the route and the tests (Next.js refuses
 * non-method exports from `route.ts`).
 *
 * An invitation records a name and an address, given by a third party, for
 * somebody who has agreed to nothing yet. So it is small: five at a time,
 * no free-text beyond a short note, and an address is validated for shape
 * and nothing else (whether it belongs to a registered member is never
 * something this endpoint says).
 */

export const INVITE_BATCH_MAX = 5;

const person = z.object({
  email: z.string().trim().toLowerCase().email('That email address does not look right.').max(160),
  name: z.string().trim().max(80).optional(),
  batchYear: z.number().int().min(1960).max(2100).optional(),
});

export const InvitationCreate = z.object({
  invitations: z
    .array(person)
    .min(1, 'Add at least one address.')
    .max(INVITE_BATCH_MAX, `At most ${INVITE_BATCH_MAX} at a time. Send the rest in a few minutes, or share the link instead.`),
  message: z.string().trim().max(300, 'Keep the note to a couple of lines.').optional(),
});

export type InvitationCreateInput = z.infer<typeof InvitationCreate>;
