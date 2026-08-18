import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getJobById } from '@/lib/data/repo';
import { logAudit } from '@/lib/audit/log';
import type { JobState } from '@/lib/data/types';
import { fail, fixtureWrite, HttpError, json, readJson } from '../../../_lib/http';

/**
 * Publish, refuse or close a posting.
 *
 * Held by the placement officer and the college admin, and by nobody
 * else. Every decision is written to `audit_log` with a before and after
 * snapshot, because "why was this taken down" is asked about the posting
 * that mattered, months later, by someone who was not in the room.
 *
 * A rejection requires a written reason. The author is told what was
 * wrong with the post — a board that refuses silently teaches alumni that
 * posting here is a waste of their time.
 */

const Body = z
  .object({
    action: z.enum(['approve', 'reject', 'close', 'reopen']),
    note: z.string().trim().max(600).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === 'reject' && (value.note?.length ?? 0) < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['note'],
        message:
          'Say what is wrong with the posting. The author sees this, and "rejected" on its own is not something they can act on.',
      });
    }
  });

const NEXT_STATE: Record<z.infer<typeof Body>['action'], JobState> = {
  approve: 'live',
  reject: 'rejected',
  close: 'closed',
  reopen: 'live',
};

/** Which states each action is a legal move from. */
const ALLOWED_FROM: Record<z.infer<typeof Body>['action'], JobState[]> = {
  approve: ['pending_moderation', 'draft', 'rejected'],
  reject: ['pending_moderation', 'live'],
  close: ['live', 'pending_moderation'],
  reopen: ['closed'],
};

const PAST: Record<z.infer<typeof Body>['action'], string> = {
  approve: 'approved',
  reject: 'rejected',
  close: 'closed',
  reopen: 'reopened',
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    requireCap(session, 'job.moderate');

    const resolved = await getTenantBrand();
    if (!resolved) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');
    if (!resolved.brand.pack.features.jobs) {
      throw new HttpError(404, 'feature_off', 'The jobs board is not enabled for this college.');
    }

    const { id } = await params;
    const body = await readJson(request, Body);

    const job = getJobById(session, id);
    if (!job) {
      throw new HttpError(404, 'not_found', 'There is no posting with that id.');
    }

    if (!ALLOWED_FROM[body.action].includes(job.state)) {
      throw new HttpError(
        409,
        'invalid_transition',
        `A posting that is ${job.state.replace('_', ' ')} cannot be ${PAST[body.action]}.`,
        { state: job.state },
      );
    }

    const before = {
      state: job.state,
      moderationNote: job.moderationNote,
      title: job.title,
      company: job.company,
    };
    const after = {
      ...before,
      state: NEXT_STATE[body.action],
      moderationNote: body.note ?? null,
    };

    // Before/after snapshots stored whole rather than as a diff:
    // reconstructing state from a diff chain during an incident is exactly
    // when you cannot afford the extra step.
    await logAudit({
      tenantId: resolved.tenant.id,
      session,
      action: `job.${body.action}`,
      resource: 'job_posting',
      resourceId: job.id,
      before,
      after,
      reason: body.note ?? null,
      ip: request.headers.get('x-forwarded-for'),
    });

    const write = fixtureWrite();

    return json({
      ok: true,
      ...write,
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        state: after.state,
        previousState: before.state,
        moderationNote: after.moderationNote,
        moderatedAt: new Date().toISOString(),
      },
      note:
        body.action === 'approve'
          ? `${job.postedBy.fullName} is told the posting is live, and it now appears on the board.`
          : body.action === 'reject'
            ? `${job.postedBy.fullName} is sent your note. They can correct the posting and resubmit it.`
            : body.action === 'close'
              ? 'The posting is off the board. Applications already sent are unaffected.'
              : 'The posting is back on the board.',
    });
  } catch (err) {
    return fail(err);
  }
}
