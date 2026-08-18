import { expect, test } from '@playwright/test';

import { stableGet } from './lib/http';
import { cookieFor, state } from './lib/state';
import type { VisibilityTarget } from './lib/state-types';

/**
 * The two-gate contact release.
 *
 * "The viewer must be entitled **and** the owner must have consented via
 * their visibility setting. Role alone is never sufficient — that is DPDP
 * purpose limitation, and the thing most implementations get wrong."
 *
 * Both halves are asserted for each of the four settings, because a test
 * that only checks the refusals passes just as happily against an
 * endpoint that has stopped releasing contact data to anybody — which is
 * an outage, not a win. Each case therefore names a viewer who must be
 * refused and a viewer who must be served.
 *
 * The targets are found in the seed at collection time, never hardcoded:
 * visibility is assigned by weighted pick, and a hardcoded slug goes
 * stale the first time somebody edits a pool.
 */

async function profile(request: import('@playwright/test').APIRequestContext, caller: string, slug: string) {
  const res = await request.get(`/api/members/${slug}`, { headers: cookieFor(caller), maxRedirects: 0 });
  expect(res.status(), `${caller} could not open /api/members/${slug} at all (${res.status()}).`).toBe(200);
  const body = await res.json();
  return { released: body.contactReleased as boolean, raw: JSON.stringify(body) };
}

function refusedMessage(caller: string, target: VisibilityTarget, setting: string, why: string): string {
  return [
    '',
    `CONTACT RELEASED AGAINST THE OWNER'S SETTING`,
    `  owner:      ${target.fullName} (${target.slug}), visibility "${setting}"`,
    `  viewer:     ${caller}`,
    '',
    `  ${why}`,
    '',
    `  What this would mean: the owner set a preference, the portal showed it to them, and`,
    `  the portal then ignored it. Under the DPDP Act that is a purpose-limitation failure,`,
    `  not a UI bug — and it is the specific failure \`releaseContact()\` exists to prevent.`,
    '',
    `  Both gates are in src/lib/members/projection.ts. Check whether the viewer branch`,
    `  widened (an extra role counted as \`viewerIsMember\`) or the switch on \`visibility\``,
    `  gained a fallthrough.`,
    '',
  ].join('\n');
}

test.describe('contact release runs both gates', () => {
  test('private: nobody but an admin, whatever their role', async ({ request }) => {
    const t = state().ids.visibilityPrivate;

    for (const caller of ['student', 'alumni', 'faculty', 'hod', 'tpo', 'operator'] as const) {
      const { released, raw } = await profile(request, caller, t.slug);
      expect(
        released,
        refusedMessage(
          caller,
          t,
          'private',
          '`private` is the setting a member picks when they want to be findable and not contactable. ' +
            'There is no viewer below `directory.view.contact` for whom it releases.',
        ),
      ).toBe(false);
      if (t.email) expect(raw, `${t.email} appeared in the payload served to ${caller}.`).not.toContain(t.email);
      if (t.mobile) expect(raw, `${t.mobile} appeared in the payload served to ${caller}.`).not.toContain(t.mobile);
    }

    const admin = await profile(request, 'admin', t.slug);
    expect(
      admin.released,
      [
        '',
        `The college admin cannot read a private member's contact row.`,
        '',
        '  This is a LOCKOUT, not a leak. `directory.view.contact` is the documented exception —',
        '  an administrator answering a DPDP request or chasing a bounced address needs the row,',
        '  and the export they would otherwise fall back to is the audited one. If this fails,',
        '  the capability was dropped or `releaseContact()` stopped checking it first.',
        '',
      ].join('\n'),
    ).toBe(true);
  });

  test('alumni_only: released to alumni and faculty, refused to a student', async ({ request }) => {
    const t = state().ids.visibilityAlumniOnly;

    const student = await profile(request, 'student', t.slug);
    expect(
      student.released,
      refusedMessage(
        'student',
        t,
        'alumni_only',
        'The name of the setting is the whole assertion: this member agreed to be contactable by ' +
          'alumni and faculty. A student is neither.',
      ),
    ).toBe(false);
    if (t.email) {
      expect(
        student.raw,
        `${t.email} — the owner's actual address — reached a final-year student who was told the block was withheld.`,
      ).not.toContain(t.email);
    }

    for (const caller of ['alumni', 'faculty'] as const) {
      const { released } = await profile(request, caller, t.slug);
      expect(
        released,
        [
          '',
          `An ${caller} was refused a contact row set to "alumni_only".`,
          '',
          '  LOCKOUT, not a leak. `viewerIsMember` is `roles.includes("alumni") || roles.includes("faculty")`.',
          '  If this fails the role check narrowed, and the setting now releases to nobody but admins —',
          '  which quietly turns every "alumni_only" member into a "private" one without telling them.',
          '',
        ].join('\n'),
      ).toBe(true);
    }

    const admin = await profile(request, 'admin', t.slug);
    expect(admin.released, 'The college admin holds directory.view.contact and must see this row.').toBe(true);
  });

  test('all_members: a student still gets nothing, and mobile is withheld even from those entitled', async ({
    request,
  }) => {
    const t = state().ids.visibilityAllMembers;

    const student = await profile(request, 'student', t.slug);
    expect(
      student.released,
      refusedMessage(
        'student',
        t,
        'all_members',
        '"All members" means all *alumni and faculty*, never students. A student reaching this branch ' +
          'used to receive an email address; the route from a student to an alumnus is a connection ' +
          'request the owner can accept, and that route is the product.',
      ),
    ).toBe(false);

    const alumni = await request.get(`/api/members/${t.slug}`, { headers: cookieFor('alumni'), maxRedirects: 0 });
    const body = await alumni.json();
    expect(body.contactReleased, 'An alumnus must get the block on "all_members" — otherwise the setting means nothing.').toBe(
      true,
    );
    expect(
      body.member.contact.mobile,
      [
        '',
        'A MOBILE NUMBER WAS RELEASED ON "all_members".',
        `  owner: ${t.fullName}`,
        '',
        '  Mobile is excluded even for entitled viewers on this setting. A phone number is never',
        '  bulk-visible: it is released only on an accepted connection or to an admin holding',
        '  directory.view.contact. Mobile is also the WhatsApp channel — the comms channel this',
        '  product is designed around — so a leaked number is a leaked broadcast list.',
        '',
      ].join('\n'),
    ).toBeNull();
  });

  test('on_accept: refused to everyone without an accepted connection', async ({ request }) => {
    const t = state().ids.visibilityOnAccept;

    for (const caller of ['student', 'alumni', 'faculty', 'hod', 'tpo', 'operator'] as const) {
      const { released, raw } = await profile(request, caller, t.slug);
      expect(
        released,
        refusedMessage(
          caller,
          t,
          'on_accept',
          'This member said "ask me first". Nobody in the demo set holds an accepted connection to them, ' +
            'so nobody may have the block — including three staff roles that can read the rest of the record.',
        ),
      ).toBe(false);
      if (t.email) expect(raw, `${t.email} reached ${caller} on an "on_accept" profile.`).not.toContain(t.email);
    }

    const admin = await profile(request, 'admin', t.slug);
    expect(admin.released, 'The audited admin exception must still work.').toBe(true);
  });

  test('the rendered profile page agrees with the API', async ({ request }) => {
    const t = state().ids.visibilityAlumniOnly;

    const page = await stableGet(request, `/directory/${t.slug}`, cookieFor('student'));
    expect(page.status()).toBe(200);
    const html = await page.text();

    if (t.email) {
      expect(
        html,
        [
          '',
          `THE PROFILE PAGE RENDERED A CONTACT ROW THE API WITHHELD.`,
          `  owner:  ${t.fullName} (${t.slug}), visibility "alumni_only"`,
          `  viewer: a final-year student`,
          `  found:  ${t.email}`,
          '',
          '  The projection is clean and the template reached past it. This is exactly the case a',
          '  JSON-only assertion cannot see, and the reason this test exists alongside the API one.',
          '',
        ].join('\n'),
      ).not.toContain(t.email);
    }
    if (t.mobile) expect(html).not.toContain(t.mobile);
    if (t.rollNumber) {
      expect(
        html,
        `The roll number ${t.rollNumber} was rendered to a student. Roll numbers are a privileged-tier field.`,
      ).not.toContain(t.rollNumber);
    }
  });
});
