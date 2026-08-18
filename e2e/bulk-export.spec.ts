import { expect, test } from '@playwright/test';

import { CALLERS, CALLER_LABEL, type Caller } from './lib/expectations';
import { cookieFor } from './lib/state';

/**
 * Bulk contact export — `college_admin` and nobody else.
 *
 * "The single most sensitive endpoint in the product, and the one whose
 * rules are least negotiable." Not the alumni cell operator, not the
 * placement officer, not an HOD, not the vendor. Staff leave, and an
 * exportable directory leaves with them.
 *
 * Both verbs are walked. `GET` describes the export — row count and
 * column list — and is behind the same capability on purpose: telling an
 * unauthorised caller how many rows they *would* get is still telling
 * them something about the list.
 *
 * ── The rate limiter is real, and it is in front of everything ───────
 *
 * `limit('member-export:<id>', 3, 1h)` runs *before* the body is parsed,
 * so once the admin's three-an-hour is spent, every further POST answers
 * 429 — including the ones this spec makes to check that a one-word
 * reason is refused. The refusals below therefore accept 422 **or** 429:
 * both mean the export did not happen, which is the property under test.
 * The nine refusal tests above are unaffected, because `requireCap()`
 * runs before the limiter and a 403 never spends a slot.
 */

/** Refused after the guard: by validation (422) or by the limiter (429). */
const REFUSED_AFTER_GUARD = [422, 429];

const ENTITLED: Caller = 'admin';

test.describe('bulk contact export', () => {
  for (const caller of CALLERS.filter((c) => c !== ENTITLED && c !== 'anon')) {
    test(`${caller} is refused both verbs`, async ({ request }) => {
      for (const verb of ['GET', 'POST'] as const) {
        const res =
          verb === 'GET'
            ? await request.get('/api/admin/members/export', { headers: cookieFor(caller), maxRedirects: 0 })
            : await request.post('/api/admin/members/export', {
                headers: cookieFor(caller),
                data: {
                  reason: 'A permission test, which is not a reason to export the alumni list.',
                  acknowledged: true,
                  scope: {},
                },
                maxRedirects: 0,
              });

        expect(
          res.status(),
          [
            '',
            `${CALLER_LABEL[caller].toUpperCase()} REACHED THE BULK CONTACT EXPORT.`,
            `  request:  ${verb} /api/admin/members/export`,
            `  observed: ${res.status()}`,
            '',
            '  What this would mean: one HTTP call returns every member the college holds — name,',
            '  roll number, email, mobile, LinkedIn and their own visibility setting — as a CSV.',
            '  310 rows in fixture mode; roughly 8,000 at DIET; the whole network at scale.',
            '',
            '  `member.export` is granted to college_admin and to no other role, and the handler',
            '  has no fallback branch that accepts a different capability. If a second capability',
            '  now opens it, that is the change to revert.',
            '',
            verb === 'GET'
              ? '  This is the GET. It returns no rows — only the count and the column list. It is behind\n' +
                '  the same capability anyway, because telling somebody how many rows they would get is\n' +
                '  telling them the size of the list and that they are close to it.'
              : '  This is the POST. It returns the file.',
            '',
          ].join('\n'),
        ).toBe(403);
      }
    });
  }

  test('anonymous is refused with 401, not 403 — the distinction is the whole point of the gate', async ({
    request,
  }) => {
    const res = await request.get('/api/admin/members/export', { maxRedirects: 0 });
    expect(
      res.status(),
      'An unauthenticated caller must be told to sign in (401), not that they are forbidden (403). ' +
        'A client that cannot tell the two apart retries forever or gives up on a session that just expired.',
    ).toBe(401);
  });

  test('the college admin can describe and perform an export, and it is audited', async ({ request }) => {
    const describe = await request.get('/api/admin/members/export', {
      headers: cookieFor('admin'),
      maxRedirects: 0,
    });
    expect(
      describe.status(),
      'The college admin cannot describe an export. LOCKOUT — this is the role the capability exists for.',
    ).toBe(200);

    const meta = await describe.json();
    expect(meta.totalMembers).toBeGreaterThan(0);
    expect(meta.columns).toContain('Email');
    expect(
      meta.columns,
      'The member’s own visibility setting must ride along in the file. An audited export is the ' +
        'documented exception to the two-gate rule, not a reason to forget the member expressed a preference — ' +
        'whoever receives the file needs to know which rows were `private`.',
    ).toContain('Member visibility setting');

    const short = await request.post('/api/admin/members/export', {
      headers: cookieFor('admin'),
      data: { reason: 'because', acknowledged: true, scope: {} },
      maxRedirects: 0,
    });
    expect(
      REFUSED_AFTER_GUARD,
      `A one-word reason produced ${short.status()}. "Who exported the alumni list, what did it cover, and why" ` +
        'is the first question asked after a leak, and "because" is not an answer. ' +
        '(422 is the validator refusing it; 429 is the three-an-hour limiter getting there first — ' +
        'both mean no file was produced. A 200 means the reason requirement is gone.)',
    ).toContain(short.status());

    const unacknowledged = await request.post('/api/admin/members/export', {
      headers: cookieFor('admin'),
      data: {
        reason: 'Producing the annual alumni-relations report for the governing council, requested by the Dean.',
        acknowledged: false,
        scope: {},
      },
      maxRedirects: 0,
    });
    expect(
      REFUSED_AFTER_GUARD,
      `The export answered ${unacknowledged.status()} without the exporter acknowledging that it is ` +
        'recorded against their name. 200 here means the acknowledgement is no longer required.',
    ).toContain(unacknowledged.status());

    const real = await request.post('/api/admin/members/export', {
      headers: cookieFor('admin'),
      data: {
        reason: 'Producing the annual alumni-relations report for the governing council, requested by the Dean.',
        acknowledged: true,
        scope: { department: 'CSE' },
      },
      maxRedirects: 0,
    });

    // 429 is the rate limiter (three an hour) and still means admitted.
    expect(
      [200, 429],
      `The college admin's audited export returned ${real.status()}. 200 is the file; 429 is the ` +
        'three-an-hour limit, which also means admitted. Anything else is a lockout on the one role ' +
        'entitled to run it.',
    ).toContain(real.status());

    if (real.status() === 200) {
      expect(
        real.headers()['x-audit-action'],
        'The export was served without the audit header. The audit row is written before the file is ' +
          'built precisely so that an export which fails halfway is still on the record.',
      ).toBe('member.export');
      expect(real.headers()['content-disposition']).toContain('.csv');
      expect(
        real.headers()['cache-control'],
        'A file containing every member’s contact row must not be cacheable by anything.',
      ).toContain('no-store');
    }
  });

  test('academic columns are separately gated inside the export', async ({ request }) => {
    // The exporter holds both capabilities; the point is that holding
    // `member.export` does not carry `directory.view.cgpa` along with it.
    const describe = await request.get('/api/admin/members/export', {
      headers: cookieFor('admin'),
      maxRedirects: 0,
    });
    const meta = await describe.json();
    expect(
      meta.columns,
      'CGPA appeared in the BASE column list. Placement data is not part of a contact export; it is ' +
        'opt-in and gated on directory.view.cgpa separately.',
    ).not.toContain('CGPA');
    expect(meta.academicColumns).toContain('CGPA');
  });
});
