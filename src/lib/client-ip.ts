import { isIP } from 'node:net';

/**
 * Which address a request came from, given the headers a reverse proxy set.
 *
 * `X-Forwarded-For` is a list that every proxy *appends* to. The entries on
 * the left are whatever the client chose to send; the entries on the right
 * were added by proxies we operate. The leftmost entry is therefore the one
 * an attacker controls, and trusting it makes every per-IP rate limit and
 * every audit-row `ip` a value the caller picks.
 *
 * The correct entry is counted from the *right*, by the number of proxies
 * we run in front of the app (`TRUSTED_PROXY_HOPS`, default 1: one load
 * balancer, or Vercel's edge, which overwrites the header with the single
 * address it saw). With no header at all — local development — there is
 * one shared bucket, which is why per-IP limits are generous and
 * per-identity limits are tight.
 */

export const LOCAL_IP = 'local';
export const UNKNOWN_IP = 'unknown';

function trustedHops(): number {
  const n = Number(process.env.TRUSTED_PROXY_HOPS ?? 1);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** The client address in an `X-Forwarded-For` value, or null if it has no usable entry. */
export function addressFromForwardedFor(header: string | null | undefined): string | null {
  if (!header) return null;
  const entries = header
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) return null;

  // Fewer entries than hops means the request skipped a proxy we expected,
  // so the leftmost entry is the best remaining evidence, not a forgery.
  const index = Math.max(0, entries.length - trustedHops());
  return entries[index] ?? null;
}

export function clientIpFrom(headers: Pick<Headers, 'get'>): string {
  const forwarded = addressFromForwardedFor(headers.get('x-forwarded-for'));
  if (forwarded) return forwarded;
  return headers.get('x-real-ip')?.trim() || LOCAL_IP;
}

/**
 * An address the `audit_log.ip` (`inet`) column will accept, or null.
 * `clientIp()` also returns the sentinels 'local' and 'unknown', and an
 * attacker-supplied header can be any string; either one rejects the whole
 * audit row if it reaches Postgres, taking the audit entry with it.
 */
export function auditIpFrom(value: string | null | undefined): string | null {
  const address = addressFromForwardedFor(value ?? null);
  return address && isIP(address) ? address : null;
}
