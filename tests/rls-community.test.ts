import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The community tables (migration 0002), proven against a real Postgres.
 *
 * `rls.test.ts` proves the isolation model on the original tables. This does
 * the same for the tables the community modules added, and then goes past it:
 * most of what makes these modules safe is a constraint in the database
 * rather than a check in the application, so each such rule is pinned here by
 * trying to break it as the non-owner application role.
 *
 *   - tenant isolation, and failing closed with no tenant context;
 *   - composite foreign keys, which stop a row in one college from pointing
 *     at a member or group of another (FK checks do not go through RLS);
 *   - the consent rule on the showcase, as a CHECK on `published`;
 *   - contact details on a business existing only when the owner shared them;
 *   - an event proposal never being published, an online event always having
 *     a link, a link always being https;
 *   - help-desk messages being append-only;
 *   - nothing community-shaped being deletable by the application role.
 *
 * Statements expected to be refused run inside a savepoint, because Postgres
 * aborts the whole transaction on the first error.
 */

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const A_ALUMNUS = '10000000-0000-0000-0000-000000000003';
const A_OTHER = '10000000-0000-0000-0000-000000000001';
const B_STUDENT = '20000000-0000-0000-0000-000000000001';
const GROUP_A = '50000000-0000-0000-0000-00000000000a';
const GROUP_B = '50000000-0000-0000-0000-00000000000b';
const POST_A = '60000000-0000-0000-0000-00000000000a';
const TICKET_A = '70000000-0000-0000-0000-00000000000a';
const BODY = 'A post of a sensible length.';

let db: PGlite;

function migrationSql(): string {
  const dir = path.resolve(__dirname, '../prisma/migrations');
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((name) => readFileSync(path.join(dir, name, 'migration.sql'), 'utf8').replace(/\r\n/g, '\n'))
    .join('\n')
    .replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";\n/g, '');
}

async function count(sql: string): Promise<number> {
  const result = await db.query<{ n: number }>(sql);
  return result.rows[0]!.n;
}

/** Runs `sql` expecting Postgres to refuse it; returns the constraint name, else the SQLSTATE. */
async function refused(sql: string): Promise<string> {
  let ownTransaction = false;
  try {
    await db.exec('savepoint expect_refusal');
  } catch {
    await db.exec('begin; savepoint expect_refusal;');
    ownTransaction = true;
  }
  const finish = async () => db.exec(ownTransaction ? 'rollback' : 'rollback to savepoint expect_refusal');

  try {
    await db.exec(sql);
  } catch (err) {
    await finish();
    const e = err as { code?: string; constraint?: string };
    return e.constraint || e.code || 'unknown';
  }
  await finish();
  throw new Error(`Postgres accepted a statement that should have been refused: ${sql}`);
}

const asTenant = (id: string) => db.exec(`begin; set local app.tenant_id = '${id}';`);

beforeAll(async () => {
  db = new PGlite({ extensions: { citext, pg_trgm } });
  await db.exec(migrationSql());

  // Seeded as the owner: the application role could not write across tenants.
  await db.exec(`
    insert into tenants (id, name, short_name, subdomain) values
      ('${A}', 'Alpha College', 'A', 'alpha'), ('${B}', 'Beta College', 'B', 'beta');
    insert into members (id, tenant_id, full_name, status, batch_year, admission_year, roll_number) values
      ('${A_OTHER}',   '${A}', 'A One', 'active_alumni', 2016, 2012, '12A1'),
      ('${A_ALUMNUS}', '${A}', 'A Old', 'active_alumni', 2020, 2016, '16A3'),
      ('${B_STUDENT}', '${B}', 'B One', 'active_student', 2026, 2022, '22B1');
    insert into groups (id, tenant_id, slug, name, kind, description, city) values
      ('${GROUP_A}', '${A}', 'hyderabad-chapter', 'Hyderabad chapter', 'chapter', 'Alumni in Hyderabad.', 'Hyderabad'),
      ('${GROUP_B}', '${B}', 'hyderabad-chapter', 'Hyderabad chapter', 'chapter', 'Alumni in Hyderabad.', 'Hyderabad');
    insert into posts (id, tenant_id, author_id, kind, body) values
      ('${POST_A}', '${A}', '${A_ALUMNUS}', 'update', '${BODY}');
    insert into support_tickets (id, tenant_id, reference, member_id, subject) values
      ('${TICKET_A}', '${A}', 'HD-1001', '${A_ALUMNUS}', 'Cannot sign in');
  `);
  await db.exec('set role alumni_app');
});

afterAll(async () => {
  await db.close();
});

describe('tenant isolation on the community tables', () => {
  it('shows each college its own rows and lets two colleges use the same address', async () => {
    await asTenant(A);
    expect(await count('select count(*)::int n from groups')).toBe(1);
    expect(await count('select count(*)::int n from posts')).toBe(1);
    expect(await count('select count(*)::int n from support_tickets')).toBe(1);
    await db.exec('rollback');

    await asTenant(B);
    expect(await count('select count(*)::int n from groups')).toBe(1);
    expect(await count('select count(*)::int n from posts')).toBe(0);
    expect(await count('select count(*)::int n from support_tickets')).toBe(0);
    await db.exec('rollback');
  });

  it('fails closed with no tenant context, on every table', async () => {
    for (const table of [
      'groups', 'group_members', 'posts', 'post_likes', 'post_reports', 'businesses',
      'showcase_entries', 'invitations', 'support_tickets', 'ticket_messages', 'cms_pages',
    ]) {
      expect(await count(`select count(*)::int n from ${table}`), table).toBe(0);
    }
  });

  it('refuses a write with no tenant context', async () => {
    await db.exec('begin');
    expect(
      await refused(`insert into cms_pages (tenant_id, slug, title, body) values ('${A}', 'about', 'About', 'About the network.')`),
    ).toBe('42501');
    await db.exec('rollback');
  });

  it('refuses a row written into another college', async () => {
    await asTenant(A);
    expect(
      await refused(`insert into cms_pages (tenant_id, slug, title, body) values ('${B}', 'about', 'About', 'About the network.')`),
    ).toBe('42501');
    await db.exec('rollback');
  });
});

describe('composite foreign keys', () => {
  it('refuse a membership that points at another college’s group or member, even from inside a tenant context', async () => {
    // FK checks do not go through row-level security, which is the whole reason these keys are composite.
    await asTenant(B);
    expect(
      await refused(`insert into group_members (tenant_id, group_id, member_id) values ('${B}', '${GROUP_A}', '${B_STUDENT}')`),
    ).toMatch(/^group_members_.*fkey$/);
    await db.exec('rollback');

    await asTenant(A);
    expect(
      await refused(`insert into group_members (tenant_id, group_id, member_id) values ('${A}', '${GROUP_A}', '${B_STUDENT}')`),
    ).toMatch(/^group_members_.*fkey$/);
    await db.exec('rollback');
  });

  it('refuse a post whose author belongs to another college', async () => {
    await asTenant(A);
    expect(
      await refused(`insert into posts (tenant_id, author_id, kind, body) values ('${A}', '${B_STUDENT}', 'update', '${BODY}')`),
    ).toMatch(/^posts_.*fkey$/);
    await db.exec('rollback');
  });

  it('refuse an event proposed by a member of another college', async () => {
    await asTenant(A);
    expect(
      await refused(
        `insert into events (tenant_id, title, slug, starts_at, review_state, published, proposed_by)
         values ('${A}', 'An event', 'cross', now() + interval '30 days', 'pending', false, '${B_STUDENT}')`,
      ),
    ).toBe('events_proposer_fk');
    await db.exec('rollback');
  });
});

describe('groups', () => {
  it('keeps a lead an active member: a request cannot be a leader', async () => {
    await asTenant(A);
    expect(
      await refused(
        `insert into group_members (tenant_id, group_id, member_id, role, state) values ('${A}', '${GROUP_A}', '${A_ALUMNUS}', 'lead', 'requested')`,
      ),
    ).toBe('chk_group_lead_is_active');
    await db.exec(`insert into group_members (tenant_id, group_id, member_id, role) values ('${A}', '${GROUP_A}', '${A_ALUMNUS}', 'lead')`);
    expect(await count('select count(*)::int n from group_members')).toBe(1);
    await db.exec('rollback');
  });

  it('keeps a chapter a place and an interest group not', async () => {
    await asTenant(A);
    expect(
      await refused(`insert into groups (tenant_id, slug, name, kind, description) values ('${A}', 'nowhere', 'N', 'chapter', 'No place given.')`),
    ).toBe('chk_group_chapter_has_place');
    expect(
      await refused(
        `insert into groups (tenant_id, slug, name, kind, description, city) values ('${A}', 'ai', 'AI', 'interest', 'Not tied to a place.', 'Pune')`,
      ),
    ).toBe('chk_group_place_is_chapter_only');
    await db.exec('rollback');
  });
});

describe('the feed', () => {
  it('will not hide a post without a reason, and refuses a post that is too short or over-tagged', async () => {
    await asTenant(A);
    expect(
      await refused(`insert into posts (tenant_id, author_id, kind, body, state) values ('${A}', '${A_ALUMNUS}', 'update', '${BODY}', 'hidden')`),
    ).toBe('chk_post_hidden_has_reason');
    expect(
      await refused(`insert into posts (tenant_id, author_id, kind, body) values ('${A}', '${A_ALUMNUS}', 'update', 'short')`),
    ).toBe('chk_post_body_length');
    expect(
      await refused(
        `insert into posts (tenant_id, author_id, kind, body, tags) values ('${A}', '${A_ALUMNUS}', 'update', '${BODY}', '{a,b,c,d,e,f}')`,
      ),
    ).toBe('chk_post_tag_count');
    await db.exec(
      `insert into posts (tenant_id, author_id, kind, body, state, hidden_reason)
       values ('${A}', '${A_ALUMNUS}', 'update', '${BODY}', 'hidden', 'A sales pitch with no role or employer.')`,
    );
    await db.exec('rollback');
  });

  it('counts a report as one person once', async () => {
    await asTenant(A);
    await db.exec(`insert into post_reports (tenant_id, post_id, reporter_id, reason) values ('${A}', '${POST_A}', '${A_OTHER}', 'Looks like spam.')`);
    expect(
      await refused(`insert into post_reports (tenant_id, post_id, reporter_id, reason) values ('${A}', '${POST_A}', '${A_OTHER}', 'Still spam.')`),
    ).toMatch(/^post_reports_.*key$/);
    await db.exec('rollback');
  });
});

describe('the showcase', () => {
  const base = 'tenant_id, slug, kind, category, headline, summary, display_name';
  const vals = (slug: string) =>
    `'${A}', '${slug}', 'prominent', 'leadership', 'A headline long enough', 'A summary long enough to be a summary.', 'Somebody'`;

  it('makes the consent rule structural: nothing about a member is published without their agreement, nothing about anybody else without a source', async () => {
    await asTenant(A);

    // A member, published, no consent on record: refused.
    expect(
      await refused(`insert into showcase_entries (${base}, member_id, state) values (${vals('m1')}, '${A_ALUMNUS}', 'published')`),
    ).toBe('chk_showcase_published_needs_consent_or_source');
    // Not a member, published, no source: refused.
    expect(await refused(`insert into showcase_entries (${base}, state) values (${vals('p1')}, 'published')`)).toBe('chk_showcase_published_needs_consent_or_source');

    // The same two, with what they need: accepted. Waiting for review needs neither.
    await db.exec(
      `insert into showcase_entries (${base}, member_id, consent_recorded_at, state) values (${vals('m2')}, '${A_ALUMNUS}', now(), 'published')`,
    );
    await db.exec(`insert into showcase_entries (${base}, source_url, state) values (${vals('p2')}, 'https://example.com/press', 'published')`);
    await db.exec(`insert into showcase_entries (${base}, member_id) values (${vals('m3')}, '${A_ALUMNUS}')`);
    expect(await count('select count(*)::int n from showcase_entries')).toBe(3);
    await db.exec('rollback');
  });

  it('refuses a source that is not an https link, and a refusal with no reason', async () => {
    await asTenant(A);
    expect(
      await refused(`insert into showcase_entries (${base}, source_url, state) values (${vals('x1')}, 'http://example.com/press', 'published')`),
    ).toBe('chk_showcase_source_https');
    expect(await refused(`insert into showcase_entries (${base}, state) values (${vals('x2')}, 'rejected')`)).toBe('chk_showcase_rejected_has_reason');
    await db.exec('rollback');
  });
});

describe('businesses', () => {
  const base = 'tenant_id, owner_id, slug, name, industry, description';
  const vals = (slug: string) => `'${A}', '${A_ALUMNUS}', '${slug}', 'Nimbus', 'Software and IT', 'A cloud studio for small companies.'`;

  it('holds contact details only when the owner chose to share them', async () => {
    await asTenant(A);
    expect(await refused(`insert into businesses (${base}, contact_email) values (${vals('b1')}, 'hello@example.com')`)).toBe('chk_business_contact_only_if_shared');
    await db.exec(`insert into businesses (${base}, show_contact, contact_email) values (${vals('b4')}, true, 'hello@example.com')`);
    await db.exec('rollback');
  });

  it('refuses a website that is not https, and a refusal with no reason', async () => {
    await asTenant(A);
    expect(await refused(`insert into businesses (${base}, website) values (${vals('b2')}, 'http://example.com')`)).toBe('chk_business_website_https');
    expect(await refused(`insert into businesses (${base}, status) values (${vals('b3')}, 'rejected')`)).toBe('chk_business_rejected_has_reason');
    await db.exec('rollback');
  });
});

describe('events', () => {
  const base = 'tenant_id, title, slug, starts_at';
  const vals = (slug: string) => `'${A}', 'An event', '${slug}', now() + interval '30 days'`;

  it('keeps a proposed event unpublished, an online event linked, a link https, and only a reunion for a batch', async () => {
    await asTenant(A);
    expect(await refused(`insert into events (${base}, review_state, published) values (${vals('e1')}, 'pending', true)`)).toBe('events_unreviewed_unpublished');
    expect(await refused(`insert into events (${base}, mode) values (${vals('e2')}, 'online')`)).toBe('events_online_needs_link');
    expect(await refused(`insert into events (${base}, meeting_url) values (${vals('e3')}, 'https://meet.example.com/x')`)).toBe('events_in_person_no_link');
    expect(await refused(`insert into events (${base}, mode, meeting_url) values (${vals('e4')}, 'online', 'http://meet.example.com/x')`)).toBe('events_meeting_url_https');
    expect(await refused(`insert into events (${base}, batch_year, kind) values (${vals('e5')}, 2016, 'workshop')`)).toBe('events_batch_is_reunion');
    expect(await refused(`insert into events (${base}, review_state) values (${vals('e6')}, 'rejected')`)).toBe('events_decline_has_reason');

    // And what each allows.
    await db.exec(`insert into events (${base}, kind, batch_year) values (${vals('e7')}, 'reunion', 2016)`);
    await db.exec(`insert into events (${base}, mode, meeting_url, kind) values (${vals('e8')}, 'online', 'https://meet.example.com/x', 'webinar')`);
    await db.exec(`insert into events (${base}, review_state, published, proposed_by) values (${vals('e9')}, 'pending', false, '${A_ALUMNUS}')`);
    await db.exec('rollback');
  });
});

describe('the help desk', () => {
  it('lets the application add to a ticket and never rewrite what was said', async () => {
    await asTenant(A);
    await db.exec(
      `insert into ticket_messages (tenant_id, ticket_id, author_id, body) values ('${A}', '${TICKET_A}', '${A_ALUMNUS}', 'The code never arrives.')`,
    );
    await db.exec(
      `insert into ticket_messages (tenant_id, ticket_id, author_id, from_staff, body) values ('${A}', '${TICKET_A}', '${A_OTHER}', true, 'We have fixed your address.')`,
    );
    expect(await count('select count(*)::int n from ticket_messages')).toBe(2);
    expect(await refused(`update ticket_messages set body = 'edited'`)).toBe('42501');
    expect(await refused('delete from ticket_messages')).toBe('42501');
    expect(await refused('delete from support_tickets')).toBe('42501');
    await db.exec('rollback');
  });

  it('refuses a ticket page path that carries a query string', async () => {
    await asTenant(A);
    expect(
      await refused(
        `insert into support_tickets (tenant_id, reference, member_id, subject, page_path) values ('${A}', 'HD-1002', '${A_ALUMNUS}', 'x', '/events?token=abc')`,
      ),
    ).toBe('chk_ticket_page_path_is_a_path');
    await db.exec(
      `insert into support_tickets (tenant_id, reference, member_id, subject, page_path) values ('${A}', 'HD-1003', '${A_ALUMNUS}', 'x', '/events/alumni-meet')`,
    );
    await db.exec('rollback');
  });

  it('numbers a reference once per college', async () => {
    await asTenant(A);
    expect(
      await refused(`insert into support_tickets (tenant_id, reference, member_id, subject) values ('${A}', 'HD-1001', '${A_ALUMNUS}', 'again')`),
    ).toMatch(/^support_tickets_.*key$/);
    await db.exec('rollback');
  });
});

describe('invitations', () => {
  it('allows an address to be invited once per inviter, whatever its case', async () => {
    await asTenant(A);
    await db.exec(`insert into invitations (tenant_id, inviter_id, email) values ('${A}', '${A_ALUMNUS}', 'Friend@Example.com')`);
    // citext: the same address in another case is the same address.
    expect(
      await refused(`insert into invitations (tenant_id, inviter_id, email) values ('${A}', '${A_ALUMNUS}', 'friend@example.com')`),
    ).toMatch(/^invitations_.*key$/);
    await db.exec('rollback');
  });
});

describe('the college’s pages', () => {
  it('keeps the public footer to public pages, and an address a valid one', async () => {
    await asTenant(A);
    const base = 'tenant_id, slug, title, body';
    expect(
      await refused(
        `insert into cms_pages (${base}, audience, show_in_footer) values ('${A}', 'guidelines', 'Guidelines', 'Be kind.', 'members', true)`,
      ),
    ).toBe('chk_cms_footer_is_public');
    expect(await refused(`insert into cms_pages (${base}) values ('${A}', 'Not A Slug', 'T', 'Body text here.')`)).toBe('chk_cms_slug_shape');
    await db.exec(`insert into cms_pages (${base}, show_in_footer) values ('${A}', 'about', 'About', 'About the alumni network.', true)`);
    await db.exec('rollback');
  });
});

describe('what the application role may not do', () => {
  it('gives it no way to delete a group, a post, a business or a showcase entry', async () => {
    await asTenant(A);
    expect(await refused('delete from groups')).toBe('42501');
    expect(await refused('delete from posts')).toBe('42501');
    expect(await refused('delete from businesses')).toBe('42501');
    expect(await refused('delete from showcase_entries')).toBe('42501');
    await db.exec('rollback');
  });

  it('is still not the owner and still cannot bypass row-level security', async () => {
    const role = await db.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      `select rolsuper, rolbypassrls from pg_roles where rolname = 'alumni_app'`,
    );
    expect(role.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });
});
