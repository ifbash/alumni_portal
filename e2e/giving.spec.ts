import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import { KNOWN_WRONG } from './lib/expectations';
import { cookieFor, state } from './lib/state';

/**
 * Students never see the donations module.
 *
 * "Asking a final-year for money on the portal that is meant to help them
 * find work poisons the whole product, and no capability grant may
 * override it."
 *
 * ── The honest limitation, stated up front ───────────────────────────
 *
 * The brief for this suite asks for "a student must never reach /giving
 * **even with the feature flag on**". That variant cannot be exercised
 * from here: no brand pack in `brands/` sets `features.donations: true`,
 * and `brands/` is not a file this work owns. So the flag-on path is
 * asserted the two ways that *are* available:
 *
 *  1. **At the API, where the gates are ordered and visible.** A student
 *     is refused with `403` while a capability holder gets the `404` that
 *     means "module off". The student never learns the flag's state, so
 *     flipping it changes nothing about their path.
 *  2. **By pinning the premise.** The last test asserts that no shipped
 *     pack enables donations. When a college turns it on, that test fails
 *     and tells the next person the flag-on case is finally testable and
 *     must be written.
 *
 * That is a real gap and it is written down rather than papered over.
 */

/** `__dirname` — Playwright loads specs as CommonJS. See e2e/global-setup.ts. */
const BRANDS = resolve(__dirname, '..', 'brands');

test.describe('the donations module and the student cohort', () => {
  test('/giving is withheld from a student, and the body proves it', async ({ request }) => {
    const res = await request.get('/giving', { headers: cookieFor('student'), maxRedirects: 0 });
    const body = await res.text();

    expect(
      res.status(),
      [
        '',
        `A student's /giving returned ${res.status()}.`,
        `  asserted: 200 — the known-wrong status, tagged KW-FEATURE-FLAG.`,
        `  contract: ${KNOWN_WRONG['KW-FEATURE-FLAG'].shouldBe} (${KNOWN_WRONG['KW-FEATURE-FLAG'].doc})`,
        '',
        `  ${KNOWN_WRONG['KW-FEATURE-FLAG'].why}`,
        '',
        '  If this now says 404, the flush fix landed: update this test and strike the ⚠ row from',
        '  docs/STATUS-CODES.md §1.',
        '',
      ].join('\n'),
    ).toBe(200);

    expect(
      body.includes('NEXT_HTTP_ERROR_FALLBACK;404'),
      [
        '',
        'THE GIVING PAGE RENDERED FOR A STUDENT.',
        '',
        '  The 200 is expected and harmless only because the body carries the not-found signal',
        '  instead of the page. Without that marker, the 200 is a real 200 and a final-year is',
        '  looking at a donation form.',
        '',
      ].join('\n'),
    ).toBe(true);

    // Scripts stripped: React 19 serialises the whole route tree into the
    // flight payload, so a `<script>` block quotes the page's own copy
    // whether or not the page rendered. What is left is what a reader sees.
    // The `<meta name="description">` survives this and is checked separately
    // below, because what is in it turned out to be its own small finding.
    const rendered = body.replace(/<script[\s\S]*?<\/script>/gi, '');
    for (const marker of ['Give to the college', 'Campaigns run by the alumni cell', 'Contribute now']) {
      expect(
        rendered.includes(marker),
        `The giving page's copy ("${marker}") reached a student. The module must be absent, not disabled.`,
      ).toBe(false);
    }
  });

  test('a feature-gated page does not name the module in its head', async ({ request }) => {
    // The regression this pins: a static `metadata` export runs whether or
    // not the page below calls notFound(), so /giving on a pack with
    // donations off still shipped `<title>Giving · DIET Connect</title>`
    // and a description naming 80G receipts and foreign contributions. A
    // student saw the module in their browser tab; a crawler indexed a
    // description of something the college has not bought.
    const res = await request.get('/giving', { headers: cookieFor('student'), maxRedirects: 0 });
    const doc = await res.text();

    // React 19 floats <title> and <meta> into the document from wherever the
    // route emitted them, so this looks at the whole response rather than at
    // a <head> block that no longer contains them.
    const advertises =
      /<title>Giving/.test(doc) || /<meta name="description" content="[^"]*80G/.test(doc);

    expect(
      advertises,
      [
        '',
        'A SWITCHED-OFF MODULE IS ADVERTISING ITSELF AGAIN.',
        '  /giving emitted its own title or an 80G description on a tenant with donations off.',
        '  Anything that renders outside the guard — metadata, OpenGraph, the manifest — has to',
        '  consult the feature flag separately. generateMetadata() is where this belongs.',
        '',
      ].join('
'),
    ).toBe(false);
  });

  test('a student is refused at the donations API before the feature flag is ever consulted', async ({ request }) => {
    const student = await request.post('/api/donations', {
      headers: cookieFor('student'),
      data: { campaignSlug: state().ids.campaignSlug, amount: 1000, sourceCountry: 'IN' },
      maxRedirects: 0,
    });

    expect(
      student.status(),
      [
        '',
        'A STUDENT WAS NOT REFUSED THE DONATIONS ENDPOINT.',
        `  observed: ${student.status()}`,
        '',
        '  The student cohort is refused on identity, not on the tenant flag. That ordering is what',
        '  makes the rule survive a college turning donations on: `requireCap(donation.give)` runs',
        '  first and the student holds no such grant, and a second explicit cohort check sits behind',
        '  it for the case where a role set somehow acquires one.',
        '',
      ].join('\n'),
    ).toBe(403);

    const code = (await student.json()).code as string;
    expect(
      code,
      [
        '',
        `A student's refusal came back as "${code}".`,
        '',
        '  It must be an identity refusal (`forbidden` from the capability gate, or `student_cohort`',
        '  from the explicit one) — never `feature_off`. A student who is told the module is merely',
        '  switched off has been told the refusal is temporary, and it is not.',
        '',
      ].join('\n'),
    ).not.toBe('feature_off');

    // The contrast that makes the point: somebody who DOES hold donation.give
    // is refused by the flag instead, with a different status and a different code.
    const alumnus = await request.post('/api/donations', {
      headers: cookieFor('alumni'),
      data: { campaignSlug: state().ids.campaignSlug, amount: 1000, sourceCountry: 'IN' },
      maxRedirects: 0,
    });
    expect(
      alumnus.status(),
      'An alumnus holds `donation.give`, so their refusal should come from the tenant flag (404), not ' +
        'from the capability gate. If this is 403, the capability was dropped and the two gates can no ' +
        'longer be told apart — at which point the student assertion above stops proving anything.',
    ).toBe(404);
    expect((await alumnus.json()).code).toBe('feature_off');
  });

  test('no brand pack enables donations — which is why the flag-on case is untested', async () => {
    const packs = readdirSync(BRANDS).filter((f) => f.endsWith('.json'));
    const enabled = packs.filter((f) => {
      const pack = JSON.parse(readFileSync(join(BRANDS, f), 'utf8')) as { features?: { donations?: boolean } };
      return pack.features?.donations === true;
    });

    expect(
      enabled,
      [
        '',
        'A BRAND PACK NOW ENABLES DONATIONS — AND THIS SUITE HAS NEVER TESTED THAT PATH.',
        `  packs with features.donations = true: ${enabled.join(', ')}`,
        '',
        '  Good news and a gap at the same time. Until now every shipped pack had donations off,',
        '  so "a student must not reach /giving with the flag ON" could not be exercised: the flag',
        '  check (gate 1) fired before the student check (gate 2) for everybody.',
        '',
        '  What to do: add a test that signs in as a student against a tenant on this pack and',
        '  asserts /giving is refused. Gate 2 in src/app/(app)/giving/page.tsx is the line that',
        '  must hold, and it has never had a test behind it.',
        '',
        '  Also check FCRA: donations must not be enabled for a trust whose registration status',
        '  the college has not confirmed. `source_country` and `is_foreign_contribution` are',
        '  structural, and the endpoint refuses foreign money outright when fcraRegistered is false.',
        '',
      ].join('\n'),
    ).toEqual([]);
  });
});
