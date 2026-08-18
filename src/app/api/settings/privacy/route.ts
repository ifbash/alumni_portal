import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenant } from '@/lib/tenant';
import { getOwnProfile } from '@/lib/data/repo';
import { logAudit } from '@/lib/audit/log';
import { NOTICE_VERSION } from '@/lib/config';
import { fail, fixtureWrite, HttpError, json, readJson } from '../../_lib/http';

/**
 * Contact visibility — the owner's half of the contact-release rule.
 *
 * Release needs two gates: the viewer must be entitled *and* the owner
 * must have consented. This endpoint writes the second one, and it writes
 * it as a **new consent record**, never as an edit to the previous one.
 * `consent_records` is append-only with the notice version attached,
 * because "what did they agree to, and to which version of the notice"
 * is a question asked long after the setting was changed.
 *
 * Changing the setting narrows what is released *next*. It does not claw
 * back a detail already given to somebody whose request was accepted, and
 * the response says so rather than implying an undo that does not exist.
 */

const VISIBILITY = ['private', 'on_accept', 'alumni_only', 'all_members'] as const;

const Body = z.object({
  visibility: z.enum(VISIBILITY, {
    errorMap: () => ({ message: 'Pick one of the four visibility options.' }),
  }),
  /**
   * Optional client echo of the notice it displayed. When present it must
   * match the current version — otherwise the member is consenting to
   * text they were never shown.
   */
  noticeVersion: z.string().trim().max(32).optional(),
});

const CONSEQUENCE: Record<(typeof VISIBILITY)[number], string> = {
  private:
    'No member sees your email or mobile through the portal. People can still send you a connection request, and you can reply from your own inbox.',
  on_accept:
    'Your email and mobile go to one person, once you accept their request. Everyone else sees a masked address and is told why.',
  alumni_only:
    'Alumni and faculty see your email and mobile without asking. Students cannot, whatever they ask for.',
  all_members:
    'Every verified member, students included, sees your email. Your mobile number is still never listed in the directory, at any setting.',
};

async function handle(request: Request) {
  const session = await getSession();
  requireCap(session, 'profile.write.own');

  const body = await readJson(request, Body);

  if (body.noticeVersion && body.noticeVersion !== NOTICE_VERSION) {
    throw new HttpError(
      409,
      'notice_changed',
      'The privacy notice has been updated since this page was opened. Reload it and read the current version before changing the setting.',
      { currentNoticeVersion: NOTICE_VERSION },
    );
  }

  const current = getOwnProfile(session);
  if (!current) {
    throw new HttpError(404, 'not_found', 'Your member record could not be loaded.');
  }

  const before = current.privateContact?.visibility ?? 'on_accept';
  const recordedAt = new Date().toISOString();
  const tenant = await getTenant();

  if (tenant) {
    await logAudit({
      tenantId: tenant.id,
      session,
      action: 'privacy.visibility.change',
      resource: 'member_contacts',
      resourceId: session.memberId,
      before: { visibility: before },
      after: { visibility: body.visibility },
      ip: request.headers.get('x-forwarded-for'),
    });

    // Appended, never updated. The previous record stays exactly as it was.
    await logAudit({
      tenantId: tenant.id,
      session,
      action: 'consent.record',
      resource: 'consent_records',
      resourceId: session.memberId,
      after: {
        purpose: 'contact_visibility',
        value: body.visibility,
        noticeVersion: NOTICE_VERSION,
        recordedAt,
      },
      ip: request.headers.get('x-forwarded-for'),
    });
  }

  const write = fixtureWrite();

  return json({
    ok: true,
    ...write,
    visibility: body.visibility,
    previousVisibility: before,
    consent: {
      purpose: 'contact_visibility',
      noticeVersion: NOTICE_VERSION,
      recordedAt,
      appendOnly: true,
    },
    effect: CONSEQUENCE[body.visibility],
    note: 'This changes what is released from now on. Contact details already released to someone whose request you accepted are not withdrawn by it.',
  });
}

export async function PATCH(request: Request) {
  try {
    return await handle(request);
  } catch (err) {
    return fail(err);
  }
}

/** The settings form saves with POST. Same handler, same guards. */
export async function POST(request: Request) {
  try {
    return await handle(request);
  } catch (err) {
    return fail(err);
  }
}
