import { expect } from '@playwright/test';

import { state } from './state';

/**
 * What a leak looks like on the wire.
 *
 * A permission suite that only reads status codes proves nothing about
 * the thing it exists to prevent. The failure this codebase is built
 * against is a **200 containing data it should not** — a directory page
 * that renders an email address, an applicant list that carries a roll
 * number, a vendor console with a member's name in it. So these are the
 * detectors, and they look at values rather than at field names, because
 * a serializer that renames `email` to `contactEmail` is still a
 * serializer that leaked an email address.
 *
 * ── Two stages, and the second is the point ──────────────────────────
 *
 * A shape match alone ("this looks like an email address") produced a
 * false positive on the first run: the branding studio renders a *sample*
 * directory card from the demonstration packs, invented roll number and
 * `alumni@svu.example.ac.in` included, and the vendor-boundary test
 * reported it as ifBash reading a customer's member data.
 *
 * So a token only counts as a leak if it is actually in the dataset. The
 * candidate regexes below are deliberately loose; the intersection with
 * `state().secrets` — every real contact string, collected from the seed
 * — is what makes the answer true. One false positive in a suite like
 * this is worse than none of it, because the next person learns to skim
 * past a red test.
 */

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/** `22JN1A0401` — the JNTUK roll format the whole seed is built on. */
export const ROLL_NUMBER = /\b\d{2}[A-Z]{2}\d[A-Z]\d{4}\b/g;

/** `+91 7577226454`, with or without the space. */
export const MOBILE = /\+91[\s ]?[6-9]\d{9}\b/g;

let sets: { emails: Set<string>; mobiles: Set<string>; rolls: Set<string> } | null = null;

function known() {
  if (!sets) {
    const s = state().secrets;
    sets = {
      emails: new Set(s.emails.map((e) => e.toLowerCase())),
      // Whitespace is normalised on both sides: `+91 75…` in the seed can
      // render as `+91&nbsp;75…`, or with the space stripped by a formatter.
      mobiles: new Set(s.mobiles.map((m) => m.replace(/\s+/g, ''))),
      rolls: new Set(s.rollNumbers),
    };
  }
  return sets;
}

export function emailsIn(body: string): string[] {
  const found = body.match(EMAIL) ?? [];
  const real = known().emails;
  return [...new Set(found.map((e) => e.toLowerCase()))].filter((e) => real.has(e));
}

export function rollNumbersIn(body: string): string[] {
  const real = known().rolls;
  return [...new Set(body.match(ROLL_NUMBER) ?? [])].filter((r) => real.has(r));
}

export function mobilesIn(body: string): string[] {
  const real = known().mobiles;
  return [...new Set(body.match(MOBILE) ?? [])].filter((m) => real.has(m.replace(/\s+/g, '')));
}

/** Every key name anywhere in a JSON tree, however deep. */
export function keysIn(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) keysIn(v, into);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      into.add(k);
      keysIn(v, into);
    }
  }
  return into;
}

/**
 * The three assertions that carry most of this suite's weight, in one
 * call, with a message that says what the leak would be rather than what
 * the number was.
 *
 * `what` is the sentence a reader needs at 2am: "the alumni directory as
 * a final-year student sees it". `wouldMean` is the consequence.
 */
export function expectNoContactData(
  body: string,
  what: string,
  wouldMean: string,
): void {
  const emails = emailsIn(body);
  const rolls = rollNumbersIn(body);
  const mobiles = mobilesIn(body);

  expect(
    emails,
    [
      '',
      `EMAIL ADDRESSES IN ${what.toUpperCase()}`,
      `  found:  ${emails.slice(0, 8).join(', ')}${emails.length > 8 ? ` … and ${emails.length - 8} more` : ''}`,
      '',
      `  ${wouldMean}`,
      '',
      `  Contact data lives in \`member_contacts\`, a separate table, precisely so that`,
      `  reaching it is a join somebody had to write rather than a column somebody forgot`,
      `  to strip. If an address is in this response, either the projection was bypassed`,
      `  (\`src/lib/members/projection.ts\`) or \`releaseContact()\` was asked and said yes.`,
      '',
    ].join('\n'),
  ).toEqual([]);

  expect(
    rolls,
    [
      '',
      `ROLL NUMBERS IN ${what.toUpperCase()}`,
      `  found:  ${rolls.slice(0, 8).join(', ')}${rolls.length > 8 ? ` … and ${rolls.length - 8} more` : ''}`,
      '',
      `  ${wouldMean}`,
      '',
      `  A roll number is the key the whole degree register is joined on. Handing one out`,
      `  below the \`privileged\` tier turns "I know a name" into "I can look this person up`,
      `  in the examinations branch". It is in PRIVILEGED_EXTRA for that reason.`,
      '',
    ].join('\n'),
  ).toEqual([]);

  expect(
    mobiles,
    [
      '',
      `MOBILE NUMBERS IN ${what.toUpperCase()}`,
      `  found:  ${mobiles.slice(0, 8).join(', ')}`,
      '',
      `  ${wouldMean}`,
      '',
      `  Mobile is the WhatsApp channel. It is excluded even for entitled viewers on`,
      `  \`all_members\` visibility — it is released only on an accepted connection or to`,
      `  an admin holding directory.view.contact.`,
      '',
    ].join('\n'),
  ).toEqual([]);
}
