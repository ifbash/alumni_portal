import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenant } from '@/lib/tenant';
import { getDataRequests } from '@/lib/data/repo';
import { logAudit } from '@/lib/audit/log';
import { clientIp, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../_lib/http';

/**
 * Acting on a DPDP request — start, fulfil, refuse.
 *
 * The queue side of `/api/data-requests`. That route is the member raising
 * a request about themselves; this one is the college answering it, and
 * the two are separated because the authorisation is nothing alike.
 *
 * Four things here are not negotiable:
 *
 *  1. **`data_request.manage`, and only that.** Deliberately *not*
 *     `tenant.configure`, which the vendor's `platform_admin` also holds.
 *     A request names a member and says what they want erased; gating it
 *     on tenant configuration would put the vendor inside the customer's
 *     subject-rights process. See the note on the capability in
 *     `permissions.ts` — the split exists for this endpoint.
 *  2. **A refusal carries a written reason.** The member is told it
 *     verbatim, and "not possible" is not a reason. Optional means empty.
 *  3. **An erasure is not unconditional, and the endpoint says what it
 *     kept.** Financial records cannot be erased — the trust has to
 *     produce them at audit — so a deletion is a hard delete of
 *     everything else *plus* a recorded exception, and the response names
 *     the exception rather than leaving it in a policy document the
 *     operator never opens. `RETAINED_ON_ERASURE` is server-owned: the
 *     body schema is strict, so there is no parameter through which an
 *     operator, or a member, could ask for the financial rows to go too.
 *  4. **The state machine is checked here, not in the browser.** A second
 *     tab holding a stale page must not be able to fulfil a request that
 *     was refused ten minutes ago.
 */

const MIN_REASON = 15;

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start') }).strict(),

  z
    .object({
      action: z.literal('fulfil'),
      note: z.string().trim().max(600).optional(),
      /**
       * Erasures only. The operator confirming they were shown the
       * retention exception before the row went. Recorded in the audit
       * entry, because "nobody told me donations survive an erasure" is
       * the defence this field exists to remove.
       */
      acknowledgedRetention: z.boolean().optional(),
    })
    .strict(),

  z
    .object({
      action: z.literal('refuse'),
      reason: z
        .string()
        .trim()
        .min(
          MIN_REASON,
          'Give a reason a person can act on — at least a sentence. The member is sent your words as they are written.',
        )
        .max(600),
    })
    .strict(),
]);

/** Received and in progress are open. Fulfilled and refused stopped the clock. */
const OPEN = new Set(['received', 'in_progress']);

/**
 * The retention exception, in the one place that enforces it.
 *
 * Not derived from anything the caller sends and not overridable by any
 * capability in the matrix. An erasure removes everything else; these
 * three survive it, and the member is told so in the same reply.
 */
const RETAINED_ON_ERASURE = [
  {
    table: 'donations',
    what: 'Donations, 80G receipts and every row carrying is_foreign_contribution',
    why: 'Income-tax receipting and, for foreign contributions, FCRA reporting. The trust has to produce these at audit; a member cannot consent them away and neither can this endpoint.',
  },
  {
    table: 'audit_log',
    what: 'Actor, action and timestamp — with the personal fields stripped out of the before and after snapshots',
    why: 'An erasure that erased the record of itself could never be shown to have happened, which is the one thing a regulator asks for.',
  },
  {
    table: 'degree_register',
    what: 'The examinations-branch row for the degree conferred',
    why: "The college's own statutory record of a qualification. It is not portal data and it is not the member's to erase.",
  },
] as const;

/** Everything that does go, named so the reply to the member can list it. */
const ERASED_ON_ERASURE = [
  'members',
  'member_contacts',
  'member_employment',
  'consent_records',
  'connections',
  'messages',
  'event_registrations',
  'job_applications',
  'profile media in S3 ap-south-1',
] as const;

const FULFIL_NOTE: Record<'export' | 'deletion' | 'correction', string> = {
  export:
    'The package goes to the member’s verified email address as a time-limited link. It is never rendered in this console and never downloadable from it — an access copy an operator can read on screen is a bulk contact export wearing a different name.',
  deletion:
    'Hard delete, not a hidden flag. Everything listed under “erased” is removed from Postgres and from object storage in ap-south-1; the three retention exceptions stay and the member is told exactly which, in writing. Backups age out on their own schedule, so the erasure is not complete until the last backup holding the row expires — tell them that window rather than “immediately”.',
  correction:
    'The previous values stay in the audit log. Roll number, branch and year of passing are not correctable here — they come from the degree register, and a portal that edits them on request is a portal whose verification proves nothing.',
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    // The queue lists members by name alongside what they have asked the
    // college to erase. One capability opens it; do not add a fallback.
    requireCap(session, 'data_request.manage');

    const tenant = await getTenant();
    if (!tenant) {
      throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');
    }

    const { id } = await params;

    const dataRequest = getDataRequests().find((r) => r.id === id);
    if (!dataRequest) {
      throw new HttpError(404, 'not_found', 'There is no data request with that id in this college’s queue.');
    }

    const body = await readJson(request, Body);

    // Generous: a fulfilment officer working down an overdue queue on a
    // Monday morning is the normal case, not an attack. The cap stops a
    // loop, it does not police the officer.
    limit(
      `data-request-manage:${session.memberId}`,
      40,
      60 * 60,
      'Forty request actions in an hour is the limit. If you are working through a backlog, take them in batches — nothing here is lost.',
    );

    if (body.action === 'start' && dataRequest.state !== 'received') {
      throw new HttpError(
        409,
        'already_started',
        dataRequest.state === 'in_progress'
          ? 'Somebody has already started this one. Refresh the page to see who holds it before you work on it twice.'
          : `This request is already ${dataRequest.state}. The statutory clock stopped when it was answered — a member who wants more raises a fresh request, which starts a fresh window.`,
        { state: dataRequest.state },
      );
    }

    if (body.action !== 'start' && !OPEN.has(dataRequest.state)) {
      throw new HttpError(
        409,
        'already_closed',
        `This request was already ${dataRequest.state} and cannot be reopened. The reason given to the member is part of the permanent record.`,
        { state: dataRequest.state },
      );
    }

    const isErasure = dataRequest.kind === 'deletion';

    if (body.action === 'fulfil' && isErasure && body.acknowledgedRetention !== true) {
      // Refused rather than quietly retained. The exception is the part of
      // an erasure that gets contested afterwards, so it is confirmed
      // before the row goes, on the record, by name.
      throw new HttpError(
        422,
        'retention_acknowledgement_required',
        'An erasure keeps three things and you cannot waive them. Confirm you have read the retention exception before the record is deleted.',
        { retained: RETAINED_ON_ERASURE },
      );
    }

    const now = new Date().toISOString();

    const nextState =
      body.action === 'start' ? 'in_progress' : body.action === 'fulfil' ? 'fulfilled' : 'refused';

    const before = {
      state: dataRequest.state,
      fulfilledAt: dataRequest.fulfilledAt,
    };

    const after = {
      state: nextState,
      fulfilledAt: body.action === 'fulfil' ? now : dataRequest.fulfilledAt,
      memberId: dataRequest.memberId,
      kind: dataRequest.kind,
      dueAt: dataRequest.dueAt,
      // Answered late is a reportable failure. Recording it at the moment
      // of the decision is the only time anybody can be sure of it.
      answeredLate: body.action !== 'start' && new Date(dataRequest.dueAt).getTime() < Date.now(),
      ...(body.action === 'fulfil' && isErasure
        ? {
            erased: [...ERASED_ON_ERASURE],
            retained: RETAINED_ON_ERASURE.map((r) => r.table),
            retentionAcknowledged: true,
          }
        : {}),
    };

    // An erasure gets its own action string rather than hiding inside
    // `data_request.fulfil`: it is the one entry an auditor filters for,
    // and it has to be findable without reading every fulfilment.
    const action =
      body.action === 'fulfil' && isErasure ? 'data_request.erase' : `data_request.${body.action}`;

    // Written before the member is notified, not after.
    await logAudit({
      tenantId: tenant.id,
      session,
      action,
      resource: 'data_requests',
      resourceId: dataRequest.id,
      before,
      after,
      reason: body.action === 'refuse' ? body.reason : (body.action === 'fulfil' ? body.note ?? null : null),
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();

    return json({
      ok: true,
      ...write,
      request: {
        id: dataRequest.id,
        kind: dataRequest.kind,
        state: nextState,
        fulfilledAt: after.fulfilledAt,
        dueAt: dataRequest.dueAt,
      },
      // Named on the response, so the screen where somebody approves an
      // erasure can show what was kept instead of pointing at a policy
      // page nobody opens.
      retention:
        body.action === 'fulfil' && isErasure
          ? {
              erased: [...ERASED_ON_ERASURE],
              retained: RETAINED_ON_ERASURE.map((r) => ({ ...r })),
              note: 'These three survive the erasure and the member is told so, in writing, in the same reply. Nothing in this console can waive them.',
            }
          : null,
      note:
        body.action === 'start'
          ? 'Assigned to you and marked in progress. The clock does not stop until the request is answered — picking it up is not answering it.'
          : body.action === 'refuse'
            ? 'The member is sent your reason verbatim, with a route to appeal. A refusal is only defensible on narrow grounds: the request is not from the data principal, it is repetitive, or answering it would disclose another member’s personal data. Volume of work is not a ground.'
            : FULFIL_NOTE[dataRequest.kind],
    });
  } catch (err) {
    return fail(err);
  }
}
