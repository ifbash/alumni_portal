import 'server-only';
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { SESSION_COOKIE, IS_FIXTURE } from '../config';
import { findMemberById, findMemberByEmail } from '../data/repo';
import type { Session } from './guard';
import type { Role } from './permissions';

/**
 * Session cookie.
 *
 * The payload is signed, not encrypted — it holds a member id and nothing
 * secret, and a signature is what stops someone editing the id to
 * somebody else's. Roles are *not* carried in the cookie: they are
 * resolved from storage on every request, so revoking an HOD takes effect
 * on their next page load rather than whenever their cookie happens to
 * expire.
 *
 * `HttpOnly` and `SameSite=Lax` are not negotiable. A token readable by
 * JavaScript is a token that leaves with the first XSS.
 */

const SECRET = process.env.SESSION_SECRET || (IS_FIXTURE ? 'fixture-mode-development-secret' : '');
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

if (!SECRET && !IS_FIXTURE) {
  throw new Error('SESSION_SECRET must be set outside fixture mode');
}

interface Payload {
  memberId: string;
  tenantId: string;
  issuedAt: number;
}

function sign(value: string): string {
  return createHmac('sha256', SECRET).update(value).digest('base64url');
}

function encode(payload: Payload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

function decode(token: string): Payload | null {
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;

  const expected = sign(body);
  // Constant-time compare: a length-sensitive `===` on a MAC is a timing
  // oracle, and forging a session is the whole game.
  if (mac.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as Payload;
    if (Date.now() - payload.issuedAt > MAX_AGE * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(memberId: string, tenantId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encode({ memberId, tenantId, issuedAt: Date.now() }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/**
 * Resolve the current session.
 *
 * Returns `null` rather than throwing, so a page can decide between
 * redirecting to sign-in and rendering a public view. Guards that *must*
 * have a session use `requireSession()` from `guard.ts`.
 */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = decode(token);
  if (!payload) return null;

  /**
   * The cookie is bound to the college it was issued for.
   *
   * A signature proves the payload was not edited. It does not prove the
   * payload belongs on *this* host — and without this check it did not
   * have to: a `college_admin` cookie minted on `diet.localhost` was
   * accepted on `northgate.localhost` and returned 21 KB of DIET member
   * rows under a tenant that had no business seeing them. The isolation
   * story is "one deployment, many colleges, separated by subdomain", and
   * a session that travels between them is that story failing at the
   * first hop.
   *
   * Row-level security would have caught the database read, but only if
   * `app.tenant_id` had been set from the resolved host rather than from
   * the session — and it is set from the session. Two layers that both
   * trust the same wrong value are one layer.
   *
   * Imported lazily: `tenant.ts` pulls in branding resolution and the
   * fixture dataset, and this module is on the path of every request.
   */
  const { getTenant } = await import('../tenant');
  const tenant = await getTenant();
  if (!tenant || tenant.id !== payload.tenantId) return null;

  const member = findMemberById(payload.memberId);
  if (!member) return null;

  return {
    memberId: member.id,
    tenantId: payload.tenantId,
    status: member.status,
    roles: member.roles.map((r) => ({ role: r.role as Role, departmentId: r.departmentCode })),
    departmentId: member.departmentCode,
    batchYear: member.batchYear,
  };
}

/** Convenience for pages that need the member record as well as the session. */
export async function getSessionMember() {
  const session = await getSession();
  if (!session) return { session: null, member: null };
  return { session, member: findMemberById(session.memberId) };
}

// ---------------------------------------------------------------
// OTP
// ---------------------------------------------------------------

interface OtpRecord {
  codeHash: string;
  email: string;
  expiresAt: number;
  attempts: number;
}

/**
 * In-process OTP store.
 *
 * Correct for fixture mode and for a single-instance dev server, and
 * deliberately wrong for production — the real implementation puts these
 * in Redis behind the same interface, because two app instances must not
 * disagree about whether a code has already been used.
 *
 * Pinned to `globalThis` rather than left as a module-scoped `Map`. Next
 * gives route handlers their own module instances, and in dev it
 * re-evaluates modules on change — so `/api/auth/otp` and
 * `/api/auth/verify` end up holding two different Maps, and every code
 * reads as expired the moment it is submitted. Same reason the Prisma
 * client is pinned in `lib/db/client.ts`.
 */
const globalForOtp = globalThis as unknown as {
  __otpStore?: Map<string, OtpRecord>;
  __rateLimits?: Map<string, { count: number; resetAt: number }>;
};

const otpStore = (globalForOtp.__otpStore ??= new Map<string, OtpRecord>());

const hashCode = (code: string, email: string) =>
  createHmac('sha256', SECRET).update(`${email}:${code}`).digest('base64url');

export function issueOtp(email: string, ttlSeconds: number): { code: string; expiresAt: number } {
  const normalised = email.trim().toLowerCase();
  // 6 digits, from a CSPRNG. `Math.random()` is predictable enough that a
  // login code drawn from it is not a second factor at all.
  const code = String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
  const expiresAt = Date.now() + ttlSeconds * 1000;

  otpStore.set(normalised, {
    codeHash: hashCode(code, normalised),
    email: normalised,
    expiresAt,
    attempts: 0,
  });

  return { code, expiresAt };
}

export type OtpResult =
  | { ok: true; memberId: string }
  | { ok: false; reason: 'expired' | 'invalid' | 'too_many_attempts' | 'unknown_email' };

export function verifyOtp(email: string, code: string, maxAttempts: number): OtpResult {
  const normalised = email.trim().toLowerCase();
  const record = otpStore.get(normalised);

  if (!record || Date.now() > record.expiresAt) {
    otpStore.delete(normalised);
    return { ok: false, reason: 'expired' };
  }

  if (record.attempts >= maxAttempts) {
    otpStore.delete(normalised);
    return { ok: false, reason: 'too_many_attempts' };
  }

  record.attempts++;

  const expected = Buffer.from(record.codeHash);
  const actual = Buffer.from(hashCode(code.trim(), normalised));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, reason: 'invalid' };
  }

  // Single use. A code that still works after a successful login is a code
  // that works for whoever else read the SMS.
  otpStore.delete(normalised);

  const member = findMemberByEmail(normalised);
  if (!member) return { ok: false, reason: 'unknown_email' };

  return { ok: true, memberId: member.id };
}

/**
 * Rate limiting, keyed by email *and* by IP.
 *
 * By email alone, one attacker walks the whole member list from one
 * address. By IP alone, a college computer lab shares a NAT and locks
 * out an entire batch at once.
 */
const attempts = (globalForOtp.__rateLimits ??= new Map<string, { count: number; resetAt: number }>());

export function rateLimit(key: string, limit: number, windowSeconds: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const rec = attempts.get(key);

  if (!rec || now > rec.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true, retryAfter: 0 };
  }

  rec.count++;
  if (rec.count > limit) {
    return { ok: false, retryAfter: Math.ceil((rec.resetAt - now) / 1000) };
  }

  return { ok: true, retryAfter: 0 };
}
