import { expect, test } from '@playwright/test';

import { stableGet, warm } from './lib/http';
import { emailsIn, mobilesIn, rollNumbersIn } from './lib/leaks';
import { CALLER_LABEL, KNOWN_WRONG, type Caller } from './lib/expectations';
import { cookieFor } from './lib/state';

/**
 * The 200s inside the staff console that are refusals.
 *
 * `docs/STATUS-CODES.md` §5.1 says a per-screen refusal inside a console
 * the viewer *is* admitted to answers 200 and withholds the content. The
 * status half of that claim is asserted by the matrix. This file asserts
 * the half that actually matters — that the content really is withheld —
 * because "wrong on the status line only" is a sentence that stops being
 * true the moment somebody moves a `require()` below a repository read,
 * and nothing else in the suite would notice.
 *
 * Each row names a screen, the data behind it, and a role admitted to the
 * console who does not hold that screen's capability.
 */

interface Case {
  path: string;
  holds: string;
  /** Roles admitted to /admin who must NOT see this screen's content. */
  refused: Caller[];
  /** A role that must — so a screen that broke for everyone shows up as a failure, not a pass. */
  entitled: Caller;
  /** Text that only appears when the real screen rendered. */
  contentMarker?: string;
}

const CASES: Case[] = [
  {
    path: '/admin/members',
    holds: 'every member record the college holds, with roll numbers',
    refused: ['tpo', 'finance', 'platform'],
    entitled: 'admin',
  },
  {
    path: '/admin/roles',
    holds: 'the capability matrix and every member holding a grant',
    refused: ['hod', 'tpo', 'operator', 'finance', 'platform'],
    entitled: 'admin',
  },
  {
    path: '/admin/degree-register',
    holds: 'the degree register — every graduate since ~2013, keyed on roll number',
    refused: ['hod', 'tpo', 'finance', 'platform'],
    entitled: 'admin',
  },
  {
    path: '/admin/verification',
    holds: "the verification queue — claimants' emails and roll numbers",
    refused: ['tpo', 'finance', 'platform'],
    entitled: 'admin',
  },
  {
    path: '/admin/data-requests',
    holds: 'the DPDP fulfilment queue — members by name beside what they asked the college to erase',
    refused: ['hod', 'tpo', 'operator', 'finance', 'platform'],
    entitled: 'admin',
  },
  {
    path: '/admin/audit',
    holds: 'the audit log — who did what to whom',
    refused: ['hod', 'tpo', 'operator'],
    entitled: 'admin',
  },
  {
    path: '/admin/rollover',
    holds: 'the annual batch rollover and its dry-run preview',
    refused: ['hod', 'tpo', 'operator', 'finance', 'platform'],
    entitled: 'admin',
  },
  {
    path: '/admin/branding',
    holds: "the tenant's brand pack",
    refused: ['hod', 'tpo', 'operator', 'finance'],
    entitled: 'admin',
  },
];

test.describe('a console 200 that is really a refusal withholds its content', () => {
  for (const c of CASES) {
    test(`${c.path} — refused roles get no data`, async ({ request }) => {
      // Compiled before it is measured. On a cold `next dev` the first
      // request to a route can answer with an error page smaller than the
      // refusal it is about to be compared against, which reads as a leak
      // and is a compiler.
      await warm(request, c.path, cookieFor(c.entitled));

      // The entitled reader first, so a screen that is simply broken cannot
      // masquerade as a screen that is well guarded.
      const entitled = await stableGet(request, c.path, cookieFor(c.entitled));
      expect(entitled.status()).toBe(200);
      const entitledBody = await entitled.text();
      const entitledSize = entitledBody.length;

      expect(
        entitledSize,
        `The entitled reader (${c.entitled}) got ${entitledSize} bytes from ${c.path} — too small to be ` +
          'the rendered screen. Every size comparison below would then be meaningless, so this fails first.',
      ).toBeGreaterThan(50_000);

      for (const caller of c.refused) {
        const res = await stableGet(request, c.path, cookieFor(caller));
        const body = await res.text();

        expect(
          res.status(),
          [
            '',
            `${c.path} answered ${res.status()} for ${CALLER_LABEL[caller]}.`,
            `  asserted: 200 (KW-CONSOLE-SCREEN, ${KNOWN_WRONG['KW-CONSOLE-SCREEN'].doc})`,
            '',
            `  ${KNOWN_WRONG['KW-CONSOLE-SCREEN'].why}`,
            '',
            '  A 403 here means the fix landed — update this file and the matrix.',
            '',
          ].join('\n'),
        ).toBe(200);

        const found = [
          ...emailsIn(body).map((v) => `email ${v}`),
          ...rollNumbersIn(body).map((v) => `roll ${v}`),
          ...mobilesIn(body).map((v) => `mobile ${v}`),
        ];

        expect(
          found,
          [
            '',
            'A CONSOLE SCREEN SERVED ITS DATA TO SOMEBODY WHO CANNOT OPEN IT.',
            `  screen:   ${c.path}`,
            `  holds:    ${c.holds}`,
            `  reader:   ${CALLER_LABEL[caller]}`,
            `  status:   ${res.status()}  ← still a 200, which is why nothing else catches this`,
            `  leaked:   ${found.slice(0, 6).join(' | ')}${found.length > 6 ? ` … and ${found.length - 6} more` : ''}`,
            '',
            '  This is the exact failure the "wrong on the status line only" note in',
            '  docs/STATUS-CODES.md §5.1 promises does not happen. If it is happening, the guard',
            '  now runs after the repository read — the page fetched, then refused, and the fetch',
            '  is what streamed.',
            '',
            `  For scale: the entitled reader (${c.entitled}) gets ${entitledSize.toLocaleString()} bytes here;`,
            `  this refused reader got ${body.length.toLocaleString()}.`,
            '',
          ].join('\n'),
        ).toEqual([]);

        expect(
          body.length,
          [
            '',
            `${CALLER_LABEL[caller]} received a full-sized ${c.path}.`,
            `  entitled reader: ${entitledSize.toLocaleString()} bytes`,
            `  refused reader:  ${body.length.toLocaleString()} bytes`,
            '',
            '  A refused screen is the console shell and a loading frame; an entitled one is the',
            '  shell plus the data. When the two are the same size, the data rendered — even if',
            '  the leak detectors above happened not to match the shape of it.',
            '',
          ].join('\n'),
        ).toBeLessThan(entitledSize);
      }
    });
  }

  test('the HOD verification queue is narrower than the operator’s — department scope is real', async ({
    request,
  }) => {
    await warm(request, '/admin/verification', cookieFor('operator'));
    const hod = await stableGet(request, '/admin/verification', cookieFor('hod'));
    const operator = await stableGet(request, '/admin/verification', cookieFor('operator'));

    const hodClaims = rollNumbersIn(await hod.text()).length;
    const operatorClaims = rollNumbersIn(await operator.text()).length;

    expect(
      hodClaims,
      [
        '',
        'THE HOD OF CSE IS SEEING THE WHOLE VERIFICATION QUEUE.',
        `  HOD sees:      ${hodClaims} claims`,
        `  operator sees: ${operatorClaims} claims`,
        '',
        '  `verification.review.department` is department-scoped: the HOD of CSE reviewing an ECE',
        '  claim holds the capability and must still be refused. A queue of equal size means the',
        '  scope check was dropped, and every head of department can now read the claim details —',
        '  name, email, roll number — of every other branch’s graduates.',
        '',
        '  See DEPARTMENT_SCOPED in src/lib/auth/permissions.ts and canInDepartment() in guard.ts.',
        '',
      ].join('\n'),
    ).toBeLessThan(operatorClaims);

    expect(
      hodClaims,
      'The HOD sees no claims at all. LOCKOUT, not a leak — the CSE queue should not be empty in the seed.',
    ).toBeGreaterThan(0);
  });
});
