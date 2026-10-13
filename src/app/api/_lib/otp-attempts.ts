/**
 * How many tries are left on the current code.
 *
 * `verifyOtp()` counts attempts internally and cancels the code at the
 * limit, but it does not report the running total — and "that code is not
 * right" without a count is how a user burns their last attempt without
 * realising there was one. This mirrors the same counter so the sign-in
 * screen can say "2 more tries before it is cancelled".
 *
 * In-process, like the OTP store it shadows, and reset the moment a new
 * code is issued. The Redis implementation keeps the counter next to the
 * code itself, which is where it belongs once there is more than one app
 * instance.
 */

import { OTP_TTL_SECONDS } from '@/lib/config';

interface Failures {
  used: number;
  /** When the code this counter belongs to expires; after that the counter is dead weight. */
  expiresAt: number;
}

// Pinned to `globalThis` for the same reason the OTP store is: route
// handlers get their own module instances, so a plain module-scoped Map
// is a different Map in `/otp` and in `/verify`, and the attempt counter
// silently resets between them.
const failures = ((globalThis as unknown as { __otpFailures?: Map<string, Failures> }).__otpFailures ??=
  new Map<string, Failures>());

const MAX_TRACKED = 50_000;

/** Drops expired counters, then the oldest ones if a flood has outrun expiry. */
function prune(now: number): void {
  for (const [k, f] of failures) if (now > f.expiresAt) failures.delete(k);
  for (const k of failures.keys()) {
    if (failures.size <= MAX_TRACKED) break;
    failures.delete(k);
  }
}

const key = (email: string) => email.trim().toLowerCase();

export function resetAttempts(email: string): void {
  failures.delete(key(email));
}

/** Records one wrong code and returns how many tries remain. */
export function noteFailedAttempt(email: string, maxAttempts: number): number {
  const now = Date.now();
  if (failures.size >= MAX_TRACKED) prune(now);

  const k = key(email);
  const current = failures.get(k);
  const used = (current && now <= current.expiresAt ? current.used : 0) + 1;
  failures.set(k, { used, expiresAt: now + OTP_TTL_SECONDS * 1000 });
  return Math.max(0, maxAttempts - used);
}
