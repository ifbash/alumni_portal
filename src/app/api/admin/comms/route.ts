import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { AuthzError, can, require as requireCap, requireSession } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getDepartments, searchDirectory } from '@/lib/data/repo';
import { logAudit } from '@/lib/audit/log';
import type { DirectoryQuery } from '@/lib/data/types';
import { clientIp, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../_lib/http';

/**
 * Broadcasts.
 *
 * Three grants, and the difference between them is the whole point:
 *
 *  - `comms.send.department` — an HOD, writing to their own branch. The
 *    department is clamped to theirs on the server before the recipients
 *    are counted, so it cannot be widened by editing the payload.
 *  - `comms.send.segment` — the alumni cell and the placement cell,
 *    writing to a slice. A slice means at least one filter; a "segment"
 *    with no filters in it is the whole list under another name, and this
 *    endpoint refuses it.
 *  - `comms.send.all` — the college admin, and only the college admin.
 *
 * **The recipient count is resolved through the directory, with this
 * sender's own scope applied.** It is not estimated, and it is not taken
 * from the client. A count computed anywhere other than the query that
 * selects the recipients is the reason "it said 400" turns into 4,000
 * delivered — and a broadcast cannot be recalled. That number is what
 * goes in the audit entry.
 *
 * The message body is a broadcast, not correspondence: it is logged.
 * Private member-to-member message bodies are a different thing entirely
 * and no role can read them — there is no capability for it, deliberately.
 */

const Segment = z
  .object({
    cohort: z.enum(['all', 'alumni', 'students']).default('all'),
    department: z.string().trim().max(12).optional(),
    batchFrom: z.number().int().min(1990).max(2100).optional(),
    batchTo: z.number().int().min(1990).max(2100).optional(),
    city: z.string().trim().max(80).optional(),
    availability: z.enum(['mentoring', 'referrals', 'speaking']).optional(),
  })
  .default({});

const Body = z.object({
  channel: z.enum(['email', 'whatsapp']),
  subject: z
    .string()
    .trim()
    .min(4, 'Write a subject line. It is the only part most recipients will read.')
    .max(150),
  body: z
    .string()
    .trim()
    .min(20, 'Write the message. A broadcast with two words in it costs the college more trust than it is worth.')
    .max(8000),
  segment: Segment,
  acknowledged: z.boolean().refine((v) => v === true, {
    message:
      'Confirm you have read the recipient count. A broadcast cannot be recalled, and a list that stops trusting the college’s mail is not won back by the next one.',
  }),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireSession(session);

    // Composed rather than nested: three separate grants reach this
    // endpoint, and requiring any single one would lock out two of the
    // three roles that legitimately hold it. The refusal is expressed as
    // the narrowest of them, so an unauthorised caller is told which
    // grant they are missing rather than the widest one they will never
    // be given.
    const wide = can(session, 'comms.send.all');
    const segmentCap = can(session, 'comms.send.segment');
    const departmentCap = can(session, 'comms.send.department');
    if (!wide && !segmentCap && !departmentCap) requireCap(session, 'comms.send.department');

    const resolved = await getTenantBrand();
    if (!resolved) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');
    const pack = resolved.brand.pack;

    const body = await readJson(request, Body);

    limit(
      `comms-send:${session.memberId}`,
      6,
      60 * 60,
      'Six broadcasts in an hour is the limit. Nothing the college has to say is worth a seventh mail to the same list on the same day.',
    );

    if (body.channel === 'whatsapp' && !pack.features.whatsapp) {
      throw new HttpError(
        422,
        'channel_unavailable',
        'WhatsApp is not connected for this college yet. It needs a WhatsApp Business API provider account and an approved template — which matters, because email open rates on alumni lists this old are poor and WhatsApp is the channel most of them actually read.',
        { fieldErrors: { channel: 'Send this one by email, or ask the alumni cell to finish the WhatsApp setup.' } },
      );
    }

    const tier: 'all' | 'segment' | 'department' = wide ? 'all' : segmentCap ? 'segment' : 'department';
    const myDepartment = session.roles.find((r) => r.role === 'hod')?.departmentId ?? session.departmentId;

    const segment = { ...body.segment };

    if (tier === 'department') {
      if (!myDepartment) {
        throw new AuthzError(
          403,
          'no_department_scope',
          'Your grant addresses one branch, and no branch is recorded against your account. Ask the college admin to set your department before sending.',
        );
      }
      if (segment.department && segment.department !== myDepartment) {
        throw new AuthzError(
          403,
          'outside_department_scope',
          `Your grant is comms.send.department for ${myDepartment}. It does not reach ${segment.department}, and it does not reach everyone — that is comms.send.all, which the college admin holds.`,
        );
      }
      // Clamped rather than assumed. Narrowing a request is safe;
      // widening one is the failure this endpoint exists to prevent.
      segment.department = myDepartment;
    }

    const filterCount = [
      segment.cohort !== 'all',
      Boolean(segment.department),
      Boolean(segment.batchFrom),
      Boolean(segment.batchTo),
      Boolean(segment.city),
      Boolean(segment.availability),
    ].filter(Boolean).length;

    if (tier === 'segment' && filterCount === 0) {
      throw new AuthzError(
        403,
        'segment_required',
        'comms.send.segment addresses a slice of the list, never the list. Narrow the audience with at least one filter — cohort, branch, batch range, city or availability.',
      );
    }

    if (segment.batchFrom && segment.batchTo && segment.batchFrom > segment.batchTo) {
      throw new HttpError(422, 'invalid_input', 'The batch range starts after it ends.', {
        fieldErrors: { batchFrom: 'This year is later than the "to" year.' },
      });
    }

    if (segment.cohort === 'students' && !can(session, 'directory.search.students')) {
      throw new AuthzError(
        403,
        'forbidden',
        'Your account cannot address the student cohort — it cannot see it in the directory either. Ask the placement cell or the college admin to send to students.',
      );
    }

    if (segment.department && !getDepartments().some((d) => d.code === segment.department)) {
      throw new HttpError(422, 'invalid_input', 'That branch does not exist on this tenant.', {
        fieldErrors: { department: 'Pick a branch from the list.' },
      });
    }

    const query: DirectoryQuery = {
      cohort: segment.cohort,
      ...(segment.department ? { department: segment.department } : {}),
      ...(segment.batchFrom ? { batchFrom: segment.batchFrom } : {}),
      ...(segment.batchTo ? { batchTo: segment.batchTo } : {}),
      ...(segment.city ? { city: segment.city } : {}),
      ...(segment.availability === 'mentoring' ? { mentoring: true } : {}),
      ...(segment.availability === 'referrals' ? { referrals: true } : {}),
      ...(segment.availability === 'speaking' ? { speaking: true } : {}),
      perPage: 3,
      sort: 'name',
    };

    // The real count, from the same query that would select the
    // recipients, narrowed by this sender's own directory scope.
    const audience = searchDirectory(session, query);

    if (audience.total === 0) {
      throw new HttpError(
        422,
        'empty_segment',
        'No member matches this segment, so there is nobody to send to. Loosen a filter — the batch range and the city together are usually what empties it.',
        { segment },
      );
    }

    const segmentLabel = [
      segment.cohort === 'alumni'
        ? 'Alumni'
        : segment.cohort === 'students'
          ? 'Final-year students'
          : 'Alumni and students',
      segment.department ? `in ${segment.department}` : null,
      segment.batchFrom || segment.batchTo
        ? `batches ${segment.batchFrom ?? 'earliest'}–${segment.batchTo ?? 'latest'}`
        : null,
      segment.city ? `living in ${segment.city}` : null,
      segment.availability ? `open to ${segment.availability}` : null,
    ]
      .filter(Boolean)
      .join(', ');

    await logAudit({
      tenantId: resolved.tenant.id,
      session,
      action: `comms.send.${tier}`,
      resource: 'communications',
      resourceId: null,
      reason: null,
      before: null,
      after: {
        channel: body.channel,
        subject: body.subject,
        // The count is the field this entry exists for: "who was written
        // to, how many of them, and by whom" is the question asked after a
        // broadcast goes to the wrong list.
        recipientCount: audience.total,
        segment,
        segmentLabel,
        senderTier: tier,
        bodyLength: body.body.length,
        bodyPreview: body.body.slice(0, 280),
      },
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();

    return json(
      {
        ok: true,
        ...write,
        channel: body.channel,
        subject: body.subject,
        recipientCount: audience.total,
        segment,
        segmentLabel,
        senderTier: tier,
        sampleNames: audience.items.slice(0, 3).map((m) => m.fullName),
        auditedAs: `comms.send.${tier}`,
        note:
          body.channel === 'whatsapp'
            ? `Queued as a WhatsApp template to ${audience.total.toLocaleString('en-IN')} recipients. Members who have not verified a mobile number fall back to email.`
            : `Queued to ${audience.total.toLocaleString('en-IN')} recipients. Bounces are recorded against the member, and an address that bounces twice is marked unreachable rather than retried forever.`,
      },
      { status: 202 },
    );
  } catch (err) {
    return fail(err);
  }
}
