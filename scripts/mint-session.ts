#!/usr/bin/env tsx
import { createHmac } from 'node:crypto';
import { getDemoAccounts, findMemberByEmail } from '../src/lib/data/repo';
import { TENANTS } from '../src/lib/data/seed';

/**
 * Mint a session cookie for a demo account, without the OTP round trip.
 *
 *   npx tsx scripts/mint-session.ts admin@diet.ac.in
 *
 * Exists for one reason: `OTP_ECHO` is correctly false in a production
 * build, so `scripts/smoke.ts` — which signs in through the real endpoint —
 * only works against a dev server. Verifying the authorisation boundaries
 * on the artefact that actually ships needs a way in that does not depend
 * on reading an email.
 *
 * It is not a back door. It reproduces exactly what `createSession` does,
 * using the same secret the server is already running with; anyone who can
 * run this can already read that secret. In production `SESSION_SECRET` is
 * a real value and this prints a cookie no deployed server will accept.
 */

const email = process.argv[2];

if (!email) {
  console.error('Usage: tsx scripts/mint-session.ts <email>\n');
  console.error('Demo accounts:');
  for (const a of getDemoAccounts()) {
    console.error(`  ${a.email.padEnd(26)} ${a.label}`);
  }
  process.exit(1);
}

const member = findMemberByEmail(email);
if (!member) {
  console.error(`No member with the address ${email}.`);
  process.exit(1);
}

const SECRET = process.env.SESSION_SECRET || 'fixture-mode-development-secret';
const tenantId = TENANTS.find((t) => t.subdomain === (process.env.TENANT ?? 'diet'))?.id ?? 'ten-diet';

const payload = { memberId: member.id, tenantId, issuedAt: Date.now() };
const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
const mac = createHmac('sha256', SECRET).update(body).digest('base64url');

const cookieName = process.env.SESSION_COOKIE_NAME ?? 'alumni_session';
process.stdout.write(`${cookieName}=${body}.${mac}`);
