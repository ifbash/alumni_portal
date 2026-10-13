import { createHmac, timingSafeEqual } from 'node:crypto';
import { IS_FIXTURE } from '../config';

/**
 * The session cookie's wire format and the secret that signs it.
 *
 * One module, imported by both `session.ts` (which issues and reads the
 * cookie inside the app) and `route-policy.ts` (which reads it in
 * middleware). They used to carry a copy each, with a comment asking
 * whoever edited one to remember the other — which is how a cookie the app
 * just issued ends up bounced to /login by a gate that cannot read it.
 *
 * Deliberately free of `server-only`, `next/headers` and the repository, so
 * middleware can import it without dragging the fixture dataset into a
 * bundle that runs on every request.
 *
 * Format: `base64url(JSON payload) "." base64url(HMAC-SHA256(payload))`.
 * The payload is signed, not encrypted: it holds a member id and a tenant
 * id, nothing secret. Roles are never in it — see `session.ts`.
 */

export interface SessionTokenPayload {
  memberId: string;
  tenantId: string;
  /** Epoch milliseconds. */
  issuedAt: number;
}

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

/** A clock running slightly ahead of ours must not invalidate a fresh cookie. */
const CLOCK_SKEW_MS = 60 * 1000;

/**
 * Published in this repository. Only ever used in fixture mode, where the
 * data is invented and the point is that `npm install && npm run dev`
 * works with no setup.
 */
const FIXTURE_SECRET = 'fixture-mode-development-secret';

/** 32 characters is 192 bits of base64 — comfortably past brute force. */
export const MIN_SECRET_LENGTH = 32;

const IS_PROD = process.env.NODE_ENV === 'production';

let cachedSecret: string | undefined;
let warnedAboutFixtureSecret = false;

/**
 * The signing secret, resolved once.
 *
 * Throws when there is nothing safe to sign with:
 *
 *  - no `SESSION_SECRET` outside fixture mode;
 *  - a `SESSION_SECRET` shorter than {@link MIN_SECRET_LENGTH} in
 *    production, because `SESSION_SECRET=changeme` passes a presence check
 *    and forges a session for anyone who guesses it.
 *
 * Fixture mode with no secret falls back to {@link FIXTURE_SECRET}. That is
 * fine on a laptop and wrong on the internet, so a production process using
 * it says so, once, in the log: anyone who has read this repository can
 * forge a session for that deployment.
 */
export function sessionSecret(): string {
  if (cachedSecret !== undefined) return cachedSecret;

  const configured = process.env.SESSION_SECRET;

  if (configured) {
    if (IS_PROD && configured.length < MIN_SECRET_LENGTH) {
      throw new Error(
        `SESSION_SECRET is ${configured.length} characters; production needs at least ${MIN_SECRET_LENGTH}. ` +
          'Generate one with: openssl rand -base64 32',
      );
    }
    return (cachedSecret = configured);
  }

  if (!IS_FIXTURE) {
    throw new Error('SESSION_SECRET must be set outside fixture mode');
  }

  if (IS_PROD && !warnedAboutFixtureSecret) {
    warnedAboutFixtureSecret = true;
    console.warn(
      '[session] SESSION_SECRET is unset in a production build running in fixture mode. ' +
        'Sessions are signed with a secret published in the source repository. ' +
        'Set SESSION_SECRET unless this is a throwaway demo.',
    );
  }
  return (cachedSecret = FIXTURE_SECRET);
}

/**
 * Whether a secret is available, without throwing. Middleware uses this to
 * decline to gate rather than 500 every request when the app is already
 * misconfigured — the page guards still refuse.
 */
export function canVerifySessions(): boolean {
  try {
    return sessionSecret().length > 0;
  } catch {
    return false;
  }
}

function sign(body: string): string {
  return createHmac('sha256', sessionSecret()).update(body).digest('base64url');
}

export function encodeSessionToken(payload: SessionTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

/**
 * Verify and parse a cookie value. Returns `null` for anything that is not
 * a validly signed, well-formed, unexpired token — never throws, because
 * this is the first code to touch attacker-controlled input on every
 * request and a thrown error here is a 500 for anyone sending junk.
 */
export function decodeSessionToken(token: string | null | undefined): SessionTokenPayload | null {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, mac] = parts;
  if (!body || !mac) return null;

  try {
    const expected = sign(body);
    // Length first: `timingSafeEqual` throws on a mismatch. Constant-time
    // compare after that, because a length-sensitive `===` on a MAC is a
    // timing oracle and forging a session is the whole game.
    if (mac.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as Partial<SessionTokenPayload> | null;
    if (!payload || typeof payload !== 'object') return null;

    const { memberId, tenantId, issuedAt } = payload;
    if (typeof memberId !== 'string' || !memberId) return null;
    if (typeof tenantId !== 'string' || !tenantId) return null;
    if (typeof issuedAt !== 'number' || !Number.isFinite(issuedAt)) return null;

    const age = Date.now() - issuedAt;
    if (age > SESSION_MAX_AGE_MS) return null;
    if (age < -CLOCK_SKEW_MS) return null;

    return { memberId, tenantId, issuedAt };
  } catch {
    return null;
  }
}
