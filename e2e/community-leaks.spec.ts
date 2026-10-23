import { expect, test } from '@playwright/test';

import { stableGet, warm } from './lib/http';
import { CALLER_LABEL, type Caller } from './lib/expectations';
import { cookieFor } from './lib/state';

/**
 * What the community modules withhold, proved on the wire.
 *
 * For most of these pages the status proves nothing. A page that refuses
 * its caller does so from inside the stream, so the answer is a 200 whether
 * the caller was shown the content or turned away from it (the matrix tags
 * those cells KW-FEATURE-FLAG and KW-CONSOLE-SCREEN, and says so). The
 * claim that matters is about the body: a refused caller's response must
 * not contain the text the page exists to show.
 *
 * Each case names a piece of text that belongs to one record, the callers
 * who must never receive it, and one who must. The last half is not a
 * formality. A page that is broken for everyone also contains no withheld
 * text, and would read as perfectly guarded; the entitled reader going
 * first is what stops a broken page passing as a safe one.
 *
 * The needles are seed text (`src/lib/data/seed-community.ts`). If the seed
 * is reworded, the control fails first and says which one to update.
 */

interface Case {
  what: string;
  path: string;
  /** Text that appears only where the record was actually shown. */
  needle: string;
  /** Callers who must not receive it. `anon` is allowed here. */
  withheldFrom: Caller[];
  /** A caller who must receive it. */
  entitled: Caller;
  /**
   * Where the control reads the needle, when the page under test is one that
   * nobody is entitled to see it on. A pending showcase entry is on no
   * member-facing list for anyone, so the control proves it exists on the
   * console page and the case proves it is on the public one for nobody.
   */
  controlPath?: string;
}

/** Everyone the console gate admits who holds none of the six community staff capabilities. */
const STAFF_WITHOUT_COMMUNITY: Caller[] = ['hod', 'tpo', 'finance', 'platform'];
/** Every signed-in role. */
const EVERYONE_SIGNED_IN: Caller[] = ['student', 'alumni', 'faculty', 'hod', 'tpo', 'operator', 'finance', 'admin', 'platform'];

const without = (list: Caller[], ...drop: Caller[]) => list.filter((c) => !drop.includes(c));

const CASES: Case[] = [
  // ---- The college's own pages -----------------------------------
  {
    what: 'an unpublished draft reaches only the people who edit pages',
    path: '/p/message-from-the-director',
    needle: 'Draft, not yet published',
    withheldFrom: ['anon', 'student', 'alumni', 'faculty', 'hod', 'tpo', 'finance', 'platform'],
    entitled: 'admin',
  },
  {
    what: 'a members-only page does not reach the public',
    path: '/p/community-guidelines',
    needle: 'Be specific',
    withheldFrom: ['anon'],
    entitled: 'student',
  },
  {
    what: 'the page console shows a draft to nobody without page.manage, the vendor included',
    path: '/admin/pages/message-from-the-director',
    needle: 'Draft, not yet published',
    withheldFrom: STAFF_WITHOUT_COMMUNITY,
    entitled: 'admin',
  },

  // ---- The help desk ---------------------------------------------
  {
    what: 'a member’s ticket is theirs: staff read it in the console, not through the member door',
    path: '/help/tickets/HD-1041',
    needle: 'Bengaluru last month',
    withheldFrom: without(EVERYONE_SIGNED_IN, 'alumni', 'platform'),
    entitled: 'alumni',
  },
  {
    what: 'the ticket thread in the console reaches helpdesk.manage and nobody else',
    path: '/admin/helpdesk/tkt-1041',
    needle: 'Bengaluru last month',
    withheldFrom: STAFF_WITHOUT_COMMUNITY,
    entitled: 'operator',
  },
  {
    what: 'the help desk queue reaches helpdesk.manage and nobody else',
    path: '/admin/helpdesk',
    needle: 'Cannot change my city',
    withheldFrom: STAFF_WITHOUT_COMMUNITY,
    entitled: 'operator',
  },
  {
    what: 'the API lists a member’s own tickets and no one else’s',
    path: '/api/helpdesk',
    needle: 'Cannot change my city',
    withheldFrom: without(EVERYONE_SIGNED_IN, 'alumni', 'platform'),
    entitled: 'alumni',
  },

  // ---- The business directory ------------------------------------
  {
    what: 'a listing’s contact email needs both gates: a student never receives it',
    path: '/businesses/nimbus-cloud-labs',
    needle: 'hello@nimbus.example',
    withheldFrom: ['student'],
    entitled: 'faculty',
  },
  {
    what: 'a listing’s contact phone needs both gates: a student never receives it',
    path: '/businesses/nimbus-cloud-labs',
    needle: '90000 00001',
    withheldFrom: ['student'],
    entitled: 'faculty',
  },
  {
    what: 'the API holds contact back from a student too',
    path: '/api/businesses',
    needle: 'hello@nimbus.example',
    withheldFrom: ['student'],
    entitled: 'faculty',
  },
  {
    what: 'the owner’s edit form is the owner’s alone',
    path: '/businesses/nimbus-cloud-labs/edit',
    needle: 'A small cloud engineering studio',
    withheldFrom: without(EVERYONE_SIGNED_IN, 'alumni', 'platform'),
    entitled: 'alumni',
  },
  {
    what: 'a listing awaiting review is not public',
    path: '/businesses/rayudu-solar-works',
    needle: 'quotes@rayudusolar.example',
    withheldFrom: without(EVERYONE_SIGNED_IN, 'operator', 'admin'),
    entitled: 'operator',
  },
  {
    what: 'the review queue reaches business.moderate and nobody else',
    path: '/admin/businesses',
    needle: 'Rayudu Solar Works',
    withheldFrom: STAFF_WITHOUT_COMMUNITY,
    entitled: 'operator',
  },

  // ---- Forms that need a capability ------------------------------
  {
    what: 'the listing form is not rendered for someone who cannot list',
    path: '/businesses/new',
    needle: 'Industry',
    withheldFrom: ['student', 'faculty', 'hod', 'tpo', 'finance'],
    entitled: 'alumni',
  },
  {
    what: 'the showcase form is not rendered for someone who cannot submit',
    path: '/showcase/submit',
    needle: 'Headline',
    withheldFrom: ['student', 'faculty', 'hod', 'tpo', 'finance'],
    entitled: 'alumni',
  },
  {
    what: 'the proposal form is not rendered for a student',
    path: '/events/propose',
    needle: 'Venue',
    withheldFrom: ['student', 'finance'],
    entitled: 'alumni',
  },

  // ---- Groups ----------------------------------------------------
  {
    what: 'a chapter does not exist for a student',
    path: '/groups/hyderabad-chapter',
    needle: 'a shared list of who is hiring',
    withheldFrom: ['student'],
    entitled: 'alumni',
  },
  {
    what: 'a chapter is not on a student’s list of groups',
    path: '/groups',
    needle: 'a shared list of who is hiring',
    withheldFrom: ['student'],
    entitled: 'alumni',
  },

  // ---- The feed --------------------------------------------------
  {
    what: 'a post written inside a chapter is for that chapter',
    path: '/api/posts',
    needle: 'Moving to Pune next month',
    withheldFrom: without(EVERYONE_SIGNED_IN, 'operator', 'admin', 'platform'),
    entitled: 'operator',
  },
  {
    what: 'a hidden post reaches moderators and its author, not the feed',
    path: '/api/posts?page=2',
    needle: 'guaranteed income from home',
    withheldFrom: without(EVERYONE_SIGNED_IN, 'operator', 'admin', 'platform'),
    entitled: 'operator',
  },
  {
    what: 'the moderation queue shows reports to moderators only',
    path: '/admin/community',
    needle: 'sales pitch with no role',
    withheldFrom: STAFF_WITHOUT_COMMUNITY,
    entitled: 'operator',
  },

  // ---- The showcase ----------------------------------------------
  {
    what: 'a submission awaiting review is not published',
    path: '/showcase',
    needle: 'Ten years of weekend teaching',
    withheldFrom: EVERYONE_SIGNED_IN,
    entitled: 'operator',
    // The list shows published entries to every role, the curators included.
    controlPath: '/admin/showcase',
  },
  {
    what: 'the showcase console shows submissions to showcase.manage and nobody else',
    path: '/admin/showcase',
    needle: 'Ten years of weekend teaching',
    withheldFrom: STAFF_WITHOUT_COMMUNITY,
    entitled: 'operator',
  },

  // ---- Invitations -----------------------------------------------
  {
    what: 'an inviter’s list of addresses is theirs alone',
    path: '/invite',
    needle: 'ravi.kumar@example.com',
    withheldFrom: without(EVERYONE_SIGNED_IN, 'alumni', 'platform'),
    entitled: 'alumni',
  },
  {
    what: 'the API returns only the caller’s own invitations',
    path: '/api/invitations',
    needle: 'ravi.kumar@example.com',
    withheldFrom: without(EVERYONE_SIGNED_IN, 'alumni', 'platform'),
    entitled: 'alumni',
  },
];

test.describe('what the community modules withhold', () => {
  for (const c of CASES) {
    test(`${c.path} — ${c.what}`, async ({ request }) => {
      // Compiled before it is measured: on a cold dev server the first
      // response can be an error page, which would fail the control below
      // for a reason that has nothing to do with authorisation.
      const controlPath = c.controlPath ?? c.path;
      await warm(request, controlPath, cookieFor(c.entitled));

      // The entitled reader first, so a page that is simply broken cannot
      // masquerade as a page that is well guarded.
      const entitled = await stableGet(request, controlPath, cookieFor(c.entitled));
      expect(entitled.status(), `${controlPath} for ${CALLER_LABEL[c.entitled]}`).toBe(200);
      expect(
        await entitled.text(),
        [
          '',
          `The control failed: ${CALLER_LABEL[c.entitled]} did not receive the text this case looks for.`,
          `  path:   ${controlPath}`,
          `  needle: ${c.needle}`,
          '',
          '  Every absence below would then be meaningless. Either the seed was reworded (update the',
          '  needle) or the page is broken for the person it exists for.',
          '',
        ].join('\n'),
      ).toContain(c.needle);

      for (const caller of c.withheldFrom) {
        const res = await stableGet(request, c.path, cookieFor(caller));
        // A crash is not a guard. A 5xx has no needle in it either, and must not read as "safe".
        expect(res.status(), `${c.path} for ${CALLER_LABEL[caller]} must not be a server error`).toBeLessThan(500);

        const body = await res.text();
        expect(
          body.includes(c.needle),
          [
            '',
            'WITHHELD TEXT REACHED SOMEBODY WHO MUST NOT RECEIVE IT.',
            `  path:     ${c.path}`,
            `  case:     ${c.what}`,
            `  reader:   ${CALLER_LABEL[caller]}`,
            `  status:   ${res.status()}  ← a 200 here is normal; the body is what matters`,
            `  contains: ${c.needle}`,
            '',
          ].join('\n'),
        ).toBe(false);
      }
    });
  }
});
