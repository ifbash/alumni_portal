import { z } from 'zod';
import { issueOtp } from '@/lib/auth/session';
import { OTP_ECHO, OTP_TTL_SECONDS } from '@/lib/config';
import { clientIp, fail, json, limit, readJson } from '../../_lib/http';
import { resetAttempts } from '../../_lib/otp-attempts';

/**
 * Issue a sign-in code.
 *
 * Three properties this endpoint must have, in order of how badly they
 * bite when missing:
 *
 *  1. **It is not a member-enumeration oracle.** The response for
 *     `someone@diet.ac.in` and `nobody@example.com` is byte-identical:
 *     same status, same fields, same timing profile — a code is minted
 *     either way and simply never delivered for the second. An endpoint
 *     that 404s on unknown addresses hands an attacker a free membership
 *     test against the whole college, and an alumni list is exactly the
 *     kind of thing people want to test against.
 *  2. **It is rate limited by email *and* by IP.** By email alone, one
 *     attacker walks the member list from a single address. By IP alone,
 *     a college computer lab behind one NAT locks out a whole batch. The
 *     per-identity limit is therefore tight and the per-network limit
 *     loose.
 *  3. **The code only ever leaks in fixture mode.** `OTP_ECHO` is
 *     `IS_FIXTURE && NODE_ENV !== 'production'`, computed once in
 *     `config.ts`. There is no request parameter, header or cookie that
 *     can turn it on.
 *
 * Email is the credential. Mobile is captured later, at profile
 * completion, and is used for recovery and WhatsApp — never to sign in.
 * An alumni list keyed on phone numbers locks out everyone who changed
 * operator, which is most of a 2014 batch.
 */

const Body = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter the email address the college has for you.')
    .max(254)
    .email('That does not look like an email address.'),
});

/** Long enough that a real inbox has time; short enough to be a second factor. */
const RESEND_AFTER_SECONDS = 30;

export async function POST(request: Request) {
  try {
    const { email } = await readJson(request, Body);
    const normalised = email.toLowerCase();
    const ip = clientIp(request);

    // Per network first: a burst from one address is the cheap signal, and
    // refusing it early means the tighter per-identity bucket is not being
    // spent by somebody else's traffic.
    limit(
      `otp:ip:${ip}`,
      30,
      15 * 60,
      'Too many codes have been requested from this network. Wait a few minutes and try again.',
    );

    limit(
      `otp:email:${normalised}`,
      5,
      15 * 60,
      'Five codes have already been sent to that address. Wait fifteen minutes, then try again — the most recent code still works until it expires.',
    );

    const { code, expiresAt } = issueOtp(normalised, OTP_TTL_SECONDS);

    // A fresh code resets the wrong-guess counter shown on the verify
    // screen, matching what `verifyOtp` does to the record itself.
    resetAttempts(normalised);

    if (OTP_ECHO) {
      console.info(`[otp] ${normalised} → ${code} (fixture mode; expires ${new Date(expiresAt).toISOString()})`);
    }

    // Identical for a known and an unknown address. The only branch below
    // is the fixture-mode echo, which is not conditional on the address
    // existing either.
    return json({
      ok: true,
      email: normalised,
      expiresAt,
      ttlSeconds: OTP_TTL_SECONDS,
      resendAfterSeconds: RESEND_AFTER_SECONDS,
      ...(OTP_ECHO ? { devCode: code } : {}),
    });
  } catch (err) {
    return fail(err);
  }
}
