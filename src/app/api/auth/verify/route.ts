import { z } from 'zod';
import { createSession, verifyOtp } from '@/lib/auth/session';
import { OTP_MAX_ATTEMPTS } from '@/lib/config';
import { findMemberById, findMemberByEmail } from '@/lib/data/repo';
import { getTenant } from '@/lib/tenant';
import type { Session } from '@/lib/auth/guard';
import type { Role } from '@/lib/auth/permissions';
import { clientIp, fail, HttpError, json, limit, readJson } from '../../_lib/http';
import { noteFailedAttempt, resetAttempts } from '../../_lib/otp-attempts';
import { sessionView } from '../../_lib/session-view';

/**
 * Exchange a code for a session.
 *
 * `verifyOtp` does the security-relevant work: constant-time comparison,
 * single use, attempt cap, expiry. This handler's job is to rate limit
 * the guessing, to turn the outcome into something the sign-in screen can
 * say out loud, and to mint the cookie.
 *
 * The failure reasons are deliberately specific — "expired", "invalid",
 * "too_many_attempts" — because at this point the caller has already
 * proved possession of the address the code was sent to, so telling them
 * *which* thing went wrong reveals nothing they could not already
 * determine. `unknown_email` is the one exception, and it is only ever
 * reachable by someone holding a valid code for that address.
 */

const Body = z.object({
  email: z.string().trim().min(1).max(254).email('That does not look like an email address.'),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter all six digits from the email.'),
});

const MESSAGES: Record<string, string> = {
  expired: 'That code has expired. Send yourself a new one and it will work.',
  invalid: 'That code is not right. Check the six digits in the most recent email.',
  too_many_attempts: 'Too many wrong codes, so this one has been cancelled. Ask for a new code.',
  unknown_email: 'There is no account on that address yet. Claim your profile with your roll number instead.',
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = Body.safeParse(body);

    if (!parsed.success) {
      // Reported as `invalid` rather than a generic validation failure so
      // the sign-in screen shows the same "check the six digits" copy for
      // a five-digit entry as for a wrong one.
      throw new HttpError(422, 'invalid', parsed.error.issues[0]?.message ?? 'Enter all six digits from the email.');
    }

    const email = parsed.data.email.toLowerCase();
    const ip = clientIp(request);

    limit(
      `verify:ip:${ip}`,
      40,
      15 * 60,
      'Too many sign-in attempts from this network. Wait a few minutes before trying again.',
    );
    limit(
      `verify:email:${email}`,
      12,
      15 * 60,
      'Too many attempts on that address. Wait fifteen minutes, then ask for a fresh code.',
    );

    const result = verifyOtp(email, parsed.data.code, OTP_MAX_ATTEMPTS);

    if (!result.ok) {
      const attemptsLeft =
        result.reason === 'invalid' ? noteFailedAttempt(email, OTP_MAX_ATTEMPTS) : undefined;

      if (result.reason !== 'invalid') resetAttempts(email);

      throw new HttpError(
        401,
        result.reason,
        MESSAGES[result.reason] ?? 'We could not check that code just now.',
        {
          reason: result.reason,
          ...(attemptsLeft === undefined ? {} : { attemptsLeft }),
        },
      );
    }

    resetAttempts(email);

    const tenant = await getTenant();
    if (!tenant) {
      throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');
    }

    const member = findMemberById(result.memberId) ?? findMemberByEmail(email);
    if (!member) {
      throw new HttpError(404, 'unknown_email', MESSAGES.unknown_email);
    }

    await createSession(member.id, tenant.id);

    // Built from storage rather than read back out of the cookie: roles are
    // resolved per request by design, and the cookie carries only an id.
    const session: Session = {
      memberId: member.id,
      tenantId: tenant.id,
      status: member.status,
      roles: member.roles.map((r) => ({ role: r.role as Role, departmentId: r.departmentCode })),
      departmentId: member.departmentCode,
      batchYear: member.batchYear,
    };

    return json({
      ok: true,
      session: sessionView(session),
      // A member who has not finished verification signs in successfully
      // and still has nowhere to go but their own pending screen.
      next: session.status === 'pending' ? '/pending' : '/dashboard',
    });
  } catch (err) {
    return fail(err);
  }
}
