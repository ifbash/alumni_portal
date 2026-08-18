import { expect, test } from '@playwright/test';

import { expectNoContactData } from './lib/leaks';
import { cookieFor, state } from './lib/state';

/**
 * One alumnus's posting never opens another's.
 *
 * The applicants handler checks two things as an OR, deliberately not as
 * a hierarchy: the person who *posted* the role (an identity comparison
 * against the session, which no role can widen) or a holder of
 * `job.applicants.export` (the placement officer, whose capability no
 * single posting can narrow).
 *
 * The negative alone would pass against an endpoint that refuses
 * everybody, so the poster's own 200 is asserted in the same test. The
 * poster is found in the seed and a cookie is minted for them — the demo
 * alumnus posts nothing, which is what makes them the right *stranger*
 * for this test and a useless subject for the positive half.
 */

test.describe('job applicants', () => {
  test('a stranger is refused, the poster is not', async ({ request }) => {
    const s = state();
    const jobId = s.ids.jobPostedByOther;

    // ---- the negative -------------------------------------------
    const stranger = await request.get(`/api/jobs/${jobId}/applicants`, {
      headers: cookieFor('alumni'),
      maxRedirects: 0,
    });

    expect(
      stranger.status(),
      [
        '',
        "AN ALUMNUS READ THE APPLICANT LIST FOR SOMEBODY ELSE'S POSTING.",
        `  posting:  ${jobId}, posted by ${s.foreignPoster.fullName} (${s.foreignPoster.memberId})`,
        `  reader:   the demo alumnus (${s.sessions.alumni!.memberId}), who posted nothing`,
        `  observed: ${stranger.status()}`,
        '',
        '  What this would mean: every alumnus on the board can read the names of the students',
        '  who applied to every other alumnus’s role. The jobs board is the one place students',
        '  volunteer their interest in leaving, and a competitor’s hiring manager is an alumnus',
        '  too. `isPoster` is an identity comparison against the session for exactly this reason.',
        '',
        '  If this fails, look for a role-based check that replaced the identity comparison —',
        '  most likely `job.post` or `job.moderate` being accepted as sufficient. Moderating',
        '  the board decides whether a posting belongs on it; it does not come with the names.',
        '',
      ].join('\n'),
    ).toBe(403);

    const strangerBody = await stranger.text();
    expect(strangerBody, 'The refusal body carried applicant data with it.').not.toContain('"items"');

    // ---- the positive, without which the negative proves nothing --
    const poster = await request.get(`/api/jobs/${jobId}/applicants`, {
      headers: { cookie: s.foreignPoster.cookie },
      maxRedirects: 0,
    });

    expect(
      poster.status(),
      [
        '',
        'The person who posted the role cannot see who applied to it.',
        '',
        '  LOCKOUT, not a leak — and it makes the board a form that sends applications nowhere.',
        '  It also means the assertion above passed for the wrong reason: an endpoint that refuses',
        '  everybody refuses strangers too.',
        '',
      ].join('\n'),
    ).toBe(200);

    const body = await poster.json();
    expect(body.viewerIs, 'The poster should be identified as the poster, not as an exporter.').toBe('poster');
    expect(body.total, 'The fixture job was chosen because it has applicants.').toBeGreaterThan(0);

    // ---- and no contact data on the way through ------------------
    expectNoContactData(
      JSON.stringify(body),
      "the applicant list served to the person who posted the role",
      'The poster is entitled to know who applied and not to their contact details. Contact release ' +
        'needs both gates — viewer entitled AND owner consented — and an applicant list is not a side ' +
        'door into either. To reach an applicant, the connection flow is the route, and the applicant decides.',
    );
  });

  test('the CSV export path is gated separately from reading the list', async ({ request }) => {
    const s = state();
    const jobId = s.ids.jobPostedByOther;

    const posterCsv = await request.get(`/api/jobs/${jobId}/applicants?format=csv&reason=${encodeURIComponent(
      'Checking the export gate from the permission suite, which is not a real reason to export.',
    )}`, {
      headers: { cookie: s.foreignPoster.cookie },
      maxRedirects: 0,
    });

    expect(
      posterCsv.status(),
      [
        '',
        'The poster downloaded the applicant list as a file.',
        '',
        '  Reading the list on screen and downloading it are different acts with different',
        '  half-lives. `job.applicants.export` is the placement cell’s capability and carries an',
        '  audit row with a written reason; a poster reading their own page carries neither.',
        '  A file leaves the building.',
        '',
      ].join('\n'),
    ).toBe(403);

    const moderator = await request.get(`/api/jobs/${jobId}/applicants`, {
      headers: cookieFor('tpo'),
      maxRedirects: 0,
    });
    expect(
      moderator.status(),
      'The placement officer holds job.applicants.export and runs the season across postings. ' +
        'A refusal here is a lockout.',
    ).toBe(200);
    expect((await moderator.json()).viewerIs).toBe('exporter');
  });

  test('moderating the board does not come with the applicant names', async ({ request }) => {
    // college_admin holds job.moderate AND job.applicants.export, deliberately —
    // so the honest test of "moderation is not enough" is a caller who holds
    // job.moderate and nothing else. In the demo set that is nobody, so this
    // asserts the documented consequence instead: the two capabilities are
    // separate, and the one that opens the list is the export one.
    const s = state();
    const res = await request.get(`/api/jobs/${s.ids.jobId}/applicants`, {
      headers: cookieFor('hod'),
      maxRedirects: 0,
    });
    expect(
      res.status(),
      [
        '',
        'An HOD read the applicant list for a posting they neither made nor moderate.',
        '',
        '  The HOD holds no job capability at all. If this is a 200, the endpoint has stopped',
        '  checking anything specific and is admitting on staff-ness alone.',
        '',
      ].join('\n'),
    ).toBe(403);
  });
});
