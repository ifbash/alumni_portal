#!/usr/bin/env tsx
import { createHmac } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { getDemoAccounts, findMemberByEmail } from '../src/lib/data/repo';
import { TENANTS } from '../src/lib/data/seed';

/**
 * Mint a session cookie for every demo account, in one process.
 *
 *   npx tsx scripts/mint-all.ts > cookies.env
 *
 * `mint-session.ts` does one account per invocation, and each invocation
 * loads the whole fixture dataset. Calling it four times in a row beside
 * a running dev server is enough memory pressure to get the dev server
 * killed on a laptop — which looks exactly like the app crashing, and
 * cost an hour of debugging the wrong thing. Mint once, reuse.
 *
 * Emits shell-assignable lines: SESSION_STUDENT=..., SESSION_ADMIN=...
 */

const SECRET = process.env.SESSION_SECRET || 'fixture-mode-development-secret';
const COOKIE = process.env.SESSION_COOKIE_NAME ?? 'alumni_session';
const tenantId = TENANTS.find((t) => t.subdomain === (process.env.TENANT ?? 'diet'))?.id ?? 'ten-diet';

/** Stable shell-safe names, so probe scripts can hardcode them. */
const VAR_NAMES: Record<string, string> = {
  'student@diet.ac.in': 'SESSION_STUDENT',
  'alumni@example.com': 'SESSION_ALUMNI',
  'faculty.ece@diet.ac.in': 'SESSION_FACULTY',
  'hod.cse@diet.ac.in': 'SESSION_HOD',
  'tpo@diet.ac.in': 'SESSION_TPO',
  'alumnicell@diet.ac.in': 'SESSION_OPERATOR',
  'finance@diet.ac.in': 'SESSION_FINANCE',
  'admin@diet.ac.in': 'SESSION_ADMIN',
  'platform@ifbash.com': 'SESSION_PLATFORM',
};

const lines: string[] = [];

for (const account of getDemoAccounts()) {
  const member = findMemberByEmail(account.email);
  if (!member) continue;

  const payload = { memberId: member.id, tenantId, issuedAt: Date.now() };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', SECRET).update(body).digest('base64url');

  const name = VAR_NAMES[account.email] ?? `SESSION_${account.email.replace(/[^a-z]/gi, '_').toUpperCase()}`;
  lines.push(`${name}='${COOKIE}=${body}.${mac}'`);
}

const out = `${lines.join('\n')}\n`;
process.stdout.write(out);

if (process.argv[2]) {
  writeFileSync(process.argv[2], out, 'utf8');
  process.stderr.write(`\nWrote ${lines.length} cookies to ${process.argv[2]}\n`);
}
