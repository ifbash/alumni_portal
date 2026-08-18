import { expect, test } from '@playwright/test';

import { stableGet } from './lib/http';
import { expectNoContactData, keysIn } from './lib/leaks';
import { cookieFor, state } from './lib/state';

/**
 * The directory, as a final-year student sees it.
 *
 * This is the rule the whole product is built around and the one with the
 * shortest fuse: *if 400 final-years can email 8,000 alumni directly, the
 * alumni disengage within a month and the network is dead.* A status code
 * proves nothing about it — `/api/directory` answers 200 for a student on
 * purpose. What has to be true is what is **in** that 200.
 *
 * The JSON is asserted first because it is unambiguous: a key is present
 * or it is not. The page is asserted second, because a projection that is
 * clean and a template that interpolates `member.privateContact.email`
 * anyway is still a leak, and only the rendered HTML catches that.
 */

const PRIVILEGED_FIELDS = ['cgpa', 'placementStatus', 'rollNumber'];
const CONTACT_FIELDS = ['email', 'mobile', 'contact', 'privateContact', 'emailLower', 'visibility'];

test.describe('the directory as a student', () => {
  test('/api/directory carries no contact field, no academic field and no student row', async ({ request }) => {
    const res = await request.get('/api/directory?perPage=60', {
      headers: cookieFor('student'),
      maxRedirects: 0,
    });

    expect(res.status(), 'A student is entitled to search alumni — this must be a 200, not a refusal.').toBe(200);

    const body = await res.json();
    const raw = JSON.stringify(body);

    expect(
      body.tier,
      [
        '',
        'The directory projected a student at the wrong tier.',
        `  observed tier: ${body.tier}`,
        '',
        '  `tierFor()` returns "student" for a session holding neither directory.view.contact',
        '  nor directory.view.cgpa and neither the alumni nor the faculty role. Any other value',
        '  here means the field list widened, and every assertion below is now checking a',
        '  projection that is no longer the one being applied.',
        '',
      ].join('\n'),
    ).toBe('student');

    // ---- keys ----------------------------------------------------
    const keys = keysIn(body.items);
    const forbidden = [...PRIVILEGED_FIELDS, ...CONTACT_FIELDS].filter((k) => keys.has(k));

    expect(
      forbidden,
      [
        '',
        'PRIVILEGED FIELDS IN A STUDENT’S DIRECTORY RESPONSE',
        `  present: ${forbidden.join(', ')}`,
        `  all keys: ${[...keys].sort().join(', ')}`,
        '',
        '  What this would mean: 400 final-years hold, in one paginated JSON response, either',
        '  the contact details of every alumnus (the network dies within a month) or the CGPA',
        '  and placement status of their own cohort (placement-side data, never theirs).',
        '',
        '  Directory responses are built by selecting *into* a projection, never by fetching a',
        '  full record and deleting keys — see FIELDS in src/lib/members/projection.ts. A field',
        '  appearing here means something bypassed `project()`, most likely a spread of the raw',
        '  row after the projection ran.',
        '',
      ].join('\n'),
    ).toEqual([]);

    // ---- values, independent of what the keys are called ---------
    expectNoContactData(
      raw,
      "a student's /api/directory response",
      'A student would be holding a machine-readable contact list of the alumni network. ' +
        'This is the single failure the directory exists to prevent, and a competitor shipped it.',
    );

    // ---- cohort --------------------------------------------------
    const students = (body.items as Array<{ isStudent?: boolean; fullName: string }>).filter((m) => m.isStudent);
    expect(
      students.map((m) => m.fullName),
      [
        '',
        'STUDENTS LISTED IN A STUDENT’S DIRECTORY',
        `  ${students.length} of ${body.items.length} rows on this page are final-years.`,
        '',
        '  Students may not enumerate students. `visibleStatusesFor()` returns ["active_alumni"]',
        '  for anyone without directory.search.students, which the student role does not hold —',
        '  so a student row reaching this page means the status filter was widened or skipped.',
        '',
        '  Consequence: a roster of a named cohort of minors-adjacent young adults, downloadable',
        '  by any one of them, is a DPDP problem before it is a product problem.',
        '',
      ].join('\n'),
    ).toEqual([]);

    // ---- the coarse status ---------------------------------------
    const statuses = [...new Set((body.items as Array<{ status: string }>).map((m) => m.status))];
    expect(
      statuses.filter((s) => s !== 'active_alumni' && s !== 'active_student'),
      [
        '',
        'A RAW MEMBER STATUS REACHED A STUDENT',
        `  distinct statuses in the response: ${statuses.join(', ')}`,
        '',
        '  `status` sits in PRIVILEGED_EXTRA and is narrowed to the coarse cohort below that',
        '  tier on purpose: the real column also carries `pending`, `lapsed`, `rejected` and',
        '  `deceased`, and none of those is a thing one member is entitled to learn about',
        '  another. Seeing one of them here means projectSummary() put the raw column back.',
        '',
      ].join('\n'),
    ).toEqual([]);
  });

  test('a student cannot ask for the student cohort', async ({ request }) => {
    const res = await request.get('/api/directory?cohort=students', {
      headers: cookieFor('student'),
      maxRedirects: 0,
    });

    expect(
      res.status(),
      [
        '',
        'A student asked the directory for the student cohort and was not refused.',
        `  observed: ${res.status()}`,
        '',
        '  Even if the repository would have filtered the rows out anyway, the endpoint must say no.',
        '  A silently-empty page and a refusal look identical to an attacker and completely',
        '  different to a developer — and the day the filter is widened, the silent version',
        '  starts returning the whole cohort with nothing in the code path to stop it.',
        '',
      ].join('\n'),
    ).toBe(403);
  });

  test('the rendered /directory page leaks nothing the JSON withheld', async ({ request }) => {
    const res = await stableGet(request, '/directory', cookieFor('student'));
    expect(res.status()).toBe(200);
    const html = await res.text();

    expectNoContactData(
      html,
      'the /directory page rendered for a student',
      'The API withheld it and the page put it back. This is the failure mode a JSON-only test ' +
        'cannot see: a clean projection and a template that reaches past it.',
    );

    for (const marker of ['cgpa', 'placementStatus', 'placement status']) {
      expect(
        html.toLowerCase().includes(marker.toLowerCase()),
        [
          '',
          `The word "${marker}" appears in the directory page served to a student.`,
          '',
          '  CGPA and placement status are placement-side data. Even a column header is a',
          '  statement that the page knows about them; the value is one render away.',
          '',
        ].join('\n'),
      ).toBe(false);
    }
  });

  test('an alumnus gets city and industry but still no academic data', async ({ request }) => {
    const res = await request.get('/api/directory?perPage=60', { headers: cookieFor('alumni'), maxRedirects: 0 });
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body.tier, 'An alumnus is the `member` tier — bio, city, industry, and nothing academic.').toBe('member');

    const keys = keysIn(body.items);
    const academic = ['cgpa', 'placementStatus', 'rollNumber'].filter((k) => keys.has(k));
    expect(
      academic,
      [
        '',
        'ACADEMIC DATA REACHED AN ALUMNUS',
        `  present: ${academic.join(', ')}`,
        '',
        '  Alumni post jobs here. A searchable CGPA list is a recruiting shortcut nobody agreed',
        '  to, and `directory.view.cgpa` is deliberately placement-side only — see the',
        '  "deliberate omissions" note in src/lib/auth/permissions.ts.',
        '',
      ].join('\n'),
    ).toEqual([]);

    expectNoContactData(
      JSON.stringify(body),
      "an alumnus's /api/directory response",
      'A bulk contact list for the whole network, handed to every alumnus. Contact release is ' +
        'per-profile and two-gated; the directory search is neither.',
    );
  });

  test('the placement officer is the one role that does see CGPA — and only on students', async ({ request }) => {
    const s = state();

    const student = await request.get(`/api/members/${s.ids.studentSlug}`, {
      headers: cookieFor('tpo'),
      maxRedirects: 0,
    });
    expect(
      student.status(),
      'The placement officer holds directory.view.cgpa and directory.search.students. If this is a ' +
        'refusal, the one role that exists to read placement data cannot do its job — a lockout, not a leak.',
    ).toBe(200);

    const body = await student.json();
    expect(
      typeof body.member.cgpa,
      'CGPA is missing for the placement officer. `tierFor()` reaches `privileged` through ' +
        'directory.view.cgpa as well as directory.view.contact; if only the latter is checked, this breaks.',
    ).toBe('number');

    // …and the negative half, without which the positive proves nothing.
    for (const caller of ['student', 'alumni'] as const) {
      const res = await request.get(`/api/members/${s.ids.studentSlug}`, {
        headers: cookieFor(caller),
        maxRedirects: 0,
      });
      expect(
        res.status(),
        [
          '',
          `A ${caller} resolved a student's profile directly by slug.`,
          '',
          '  Students may not enumerate students, and the profile endpoint answers 404 for both',
          '  "no such slug" and "not one you may open" precisely so nobody can walk the student',
          '  roll by trying URLs. A 200 here means the slug route is a way around the directory',
          '  filter — the cohort list is then enumerable one URL at a time.',
          '',
        ].join('\n'),
      ).toBe(404);
    }
  });
});
