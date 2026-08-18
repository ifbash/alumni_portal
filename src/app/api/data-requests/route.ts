import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { requireSession } from '@/lib/auth/guard';
import { getTenant } from '@/lib/tenant';
import { getDataRequests } from '@/lib/data/repo';
import { logAudit } from '@/lib/audit/log';
import { NOTICE_VERSION } from '@/lib/config';
import { draftId, fail, fixtureWrite, HttpError, json, limit, readJson } from '../_lib/http';

/**
 * DPDP data requests — export, deletion, correction.
 *
 * These are statutory, not a courtesy feature. Three properties follow
 * from that and none of them is optional:
 *
 *  1. **The clock starts on receipt.** `dueAt` is stamped here, thirty
 *     days out, and it is returned to the requester so the deadline is
 *     not something only the college can see.
 *  2. **You see your own requests and nobody else's.** `GET` filters to
 *     the signed-in member. The staff queue is a different screen behind
 *     a different capability.
 *  3. **Deletion is described accurately before it is accepted.** Some
 *     records survive a deletion request — the degree register is the
 *     college's own statutory record and is not the member's to erase,
 *     and audit rows are append-only by design. Saying that up front is
 *     the difference between a lawful refusal and a broken promise.
 */

const KINDS = ['export', 'deletion', 'correction'] as const;

const Body = z.object({
  kind: z.enum(KINDS, { errorMap: () => ({ message: 'Choose export, deletion or correction.' }) }),
  details: z
    .string()
    .trim()
    .max(2000, 'Keep it under 2,000 characters. The alumni cell will write back if they need more.')
    .optional(),
  /** Required for deletion: it is not reversible and it ends the account. */
  acknowledged: z.boolean().optional(),
});

/** Statutory response window, in days. */
const DUE_DAYS = 30;

const SCOPE: Record<(typeof KINDS)[number], { summary: string; excluded: string[] }> = {
  export: {
    summary:
      'A machine-readable copy of your profile, contact record, connection history, event registrations, job applications and consent records.',
    excluded: ['Private message bodies, which no role can read', 'Other members’ records that mention you'],
  },
  deletion: {
    summary:
      'Your profile, contact record, availability settings, connections and registrations are erased, and your account stops working.',
    excluded: [
      'The degree register entry, which is the college’s own statutory record of your qualification',
      'Audit log rows, which are append-only and are how the deletion itself is evidenced',
      'Donation receipts, which the Income Tax Act requires the trust to retain',
    ],
  },
  correction: {
    summary: 'A correction to a specific field, checked against the degree register where identity is involved.',
    excluded: ['Nothing — but a correction to your roll number, branch or batch is verified before it is applied'],
  },
};

export async function GET() {
  try {
    const session = await getSession();
    requireSession(session);

    // Scoped to the signed-in member. The staff-side queue is behind
    // `data_request.manage` on a different screen — deliberately not
    // `tenant.configure`, which the vendor's platform admin also holds.
    const mine = getDataRequests().filter((r) => r.memberId === session.memberId);

    return json({
      items: mine,
      total: mine.length,
      dueWindowDays: DUE_DAYS,
      noticeVersion: NOTICE_VERSION,
    });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireSession(session);

    const body = await readJson(request, Body);

    limit(
      `data-request:${session.memberId}`,
      3,
      24 * 60 * 60,
      'You have already raised three requests today. The alumni cell answers each one by hand — give them a working day.',
    );

    if (body.kind === 'deletion' && body.acknowledged !== true) {
      throw new HttpError(
        422,
        'acknowledgement_required',
        'Deletion ends your account and cannot be undone. Confirm you have read what is and is not erased.',
        { scope: SCOPE.deletion },
      );
    }

    if (body.kind === 'correction' && !body.details?.trim()) {
      throw new HttpError(422, 'invalid_input', 'Say what is wrong and what it should be.', {
        fieldErrors: { details: 'Name the field and the correct value.' },
      });
    }

    const open = getDataRequests().filter(
      (r) => r.memberId === session.memberId && r.kind === body.kind && r.state !== 'fulfilled' && r.state !== 'refused',
    );
    if (open.length > 0) {
      throw new HttpError(
        409,
        'already_open',
        `You already have a ${body.kind} request open. It is due by ${open[0]!.dueAt.slice(0, 10)}.`,
        { requestId: open[0]!.id },
      );
    }

    const createdAt = new Date();
    const dueAt = new Date(createdAt.getTime() + DUE_DAYS * 86400000);

    const tenant = await getTenant();
    if (tenant) {
      await logAudit({
        tenantId: tenant.id,
        session,
        action: `data_request.${body.kind}`,
        resource: 'data_requests',
        resourceId: session.memberId,
        after: {
          kind: body.kind,
          state: 'received',
          createdAt: createdAt.toISOString(),
          dueAt: dueAt.toISOString(),
          noticeVersion: NOTICE_VERSION,
        },
        reason: body.details ?? null,
        ip: request.headers.get('x-forwarded-for'),
      });
    }

    const write = fixtureWrite();

    return json(
      {
        ok: true,
        ...write,
        request: {
          id: draftId('dr'),
          kind: body.kind,
          state: 'received' as const,
          details: body.details ?? null,
          createdAt: createdAt.toISOString(),
          fulfilledAt: null,
          dueAt: dueAt.toISOString(),
        },
        scope: SCOPE[body.kind],
        note: `The college has ${DUE_DAYS} days to answer. You will get a reply on your registered email address, and the request is on the audit log either way.`,
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(err);
  }
}
