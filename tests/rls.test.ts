import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Row-level security, proven against a real Postgres.
 *
 * CLAUDE.md's first load-bearing decision is that tenant isolation is
 * enforced by the database, so that one forgotten WHERE clause cannot leak
 * across colleges. A policy that exists is not that: it has to be applied by
 * a role the policy applies to, fail closed with no tenant context, and
 * survive a pooled connection. These tests apply every migration to an
 * in-memory Postgres (PGlite - WASM, no container) and then act as the
 * non-owner application role `alumni_app`, trying to break out.
 *
 * Statements that are *expected* to be refused run inside a savepoint,
 * because Postgres aborts the whole transaction on the first error.
 */

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const A_STUDENT_1 = '10000000-0000-0000-0000-000000000001';
const A_STUDENT_2 = '10000000-0000-0000-0000-000000000002';
const A_ALUMNUS = '10000000-0000-0000-0000-000000000003';
const B_STUDENT = '20000000-0000-0000-0000-000000000001';
const REGISTER_ROW = '30000000-0000-0000-0000-000000000001';
const CAMPAIGN = '40000000-0000-0000-0000-000000000001';

let db: PGlite;

/** Apply every migration, in order. */
function migrationSql(): string {
  const dir = path.resolve(__dirname, '../prisma/migrations');
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((name) => readFileSync(path.join(dir, name, 'migration.sql'), 'utf8').replace(/\r\n/g, '\n'))
    .join('\n')
    // PGlite does not ship pgcrypto. Nothing needs it: gen_random_uuid() is
    // part of core Postgres since 13.
    .replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";\n/g, '');
}

async function count(sql: string): Promise<number> {
  const result = await db.query<{ n: number }>(sql);
  return result.rows[0]!.n;
}

/**
 * Runs `sql` expecting Postgres to refuse it. Returns the violated
 * constraint's name when the error names one (check, unique, trigger-raised),
 * otherwise the SQLSTATE - 42501 is "insufficient privilege", which is what a
 * row-level-security refusal looks like.
 */
async function refused(sql: string): Promise<string> {
  // Postgres aborts a transaction on its first error, so the statement runs
  // inside a savepoint. Outside a transaction a savepoint is itself an error;
  // then the helper opens a transaction of its own and rolls it back.
  let ownTransaction = false;
  try {
    await db.exec('savepoint expect_refusal');
  } catch {
    await db.exec('begin; savepoint expect_refusal;');
    ownTransaction = true;
  }

  const finish = async (): Promise<void> => {
    await db.exec(ownTransaction ? 'rollback' : 'rollback to savepoint expect_refusal');
  };

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

  // Seeded as the owner: the application role could not do this across tenants.
  await db.exec(`
    insert into tenants (id, name, short_name, subdomain) values
      ('${A}', 'Alpha College', 'A', 'alpha'), ('${B}', 'Beta College', 'B', 'beta');
    insert into members (id, tenant_id, full_name, status, batch_year, admission_year, roll_number) values
      ('${A_STUDENT_1}', '${A}', 'A One', 'active_student', 2026, 2022, '22A1'),
      ('${A_STUDENT_2}', '${A}', 'A Two', 'active_student', 2026, 2022, '22A2'),
      ('${A_ALUMNUS}',   '${A}', 'A Old', 'active_alumni',  2020, 2016, '16A3'),
      ('${B_STUDENT}',   '${B}', 'B One', 'active_student', 2026, 2022, '22B1');
    insert into member_roles (tenant_id, member_id, role) values
      ('${A}', '${A_STUDENT_1}', 'student'),
      ('${A}', '${A_STUDENT_1}', 'faculty'),
      ('${A}', '${A_STUDENT_2}', 'student');
  `);

  await db.exec('set role alumni_app');
});

afterAll(async () => {
  await db.close();
});

describe('the migrations apply', () => {
  it('creates every table', async () => {
    expect(await count(`select count(*)::int n from information_schema.tables where table_schema = 'public'`)).toBe(30);
  });

  it('forces row-level security on every tenant table, owners included', async () => {
    // RLS is enabled but not forced on a table whose owner connects: the owner
    // is exempt, and every policy is then inert.
    const rows = await db.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `select relname, relrowsecurity, relforcerowsecurity from pg_class
        where relnamespace = 'public'::regnamespace and relkind = 'r' and relname <> 'tenants'`,
    );
    expect(rows.rows.length).toBe(29);
    for (const r of rows.rows) {
      expect(r.relrowsecurity, `${r.relname}: RLS not enabled`).toBe(true);
      expect(r.relforcerowsecurity, `${r.relname}: RLS not forced`).toBe(true);
    }
  });

  it('gives the application role no way around the policies', async () => {
    const role = await db.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      `select rolsuper, rolbypassrls from pg_roles where rolname = 'alumni_app'`,
    );
    expect(role.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });
});

describe('tenant isolation', () => {
  it('fails closed: with no tenant context a query returns nothing, and does not error', async () => {
    expect(await count('select count(*)::int n from members')).toBe(0);
  });

  it('refuses a write with no tenant context', async () => {
    await db.exec('begin');
    expect(await refused(`insert into departments (tenant_id, code, name) values ('${A}', 'CSE', 'x')`)).toBe('42501');
    await db.exec('rollback');
  });

  it('shows a tenant its own rows and no one else’s', async () => {
    await asTenant(A);
    expect(await count('select count(*)::int n from members')).toBe(3);
    expect(await count(`select count(*)::int n from members where id = '${B_STUDENT}'`)).toBe(0);
    await db.exec('rollback');
  });

  it('refuses a row written into another tenant, by INSERT or by UPDATE', async () => {
    await asTenant(A);
    expect(await refused(`insert into departments (tenant_id, code, name) values ('${B}', 'ECE', 'x')`)).toBe('42501');
    expect(await refused(`update members set tenant_id = '${B}' where roll_number = '22A1'`)).toBe('42501');
    await db.exec('rollback');
  });

  it('does not let one tenant read or change another’s rows by id', async () => {
    await asTenant(A);
    await db.exec(`update members set full_name = 'hijacked' where id = '${B_STUDENT}'`);
    await db.exec('rollback');
    await asTenant(B);
    expect(await count(`select count(*)::int n from members where full_name = 'hijacked'`)).toBe(0);
    await db.exec('rollback');
  });

  it('survives a pooled connection: after a tenant transaction the setting is empty, not the last tenant', async () => {
    // SET LOCAL ends with the transaction, but the custom setting lingers on
    // the connection as '' rather than reverting to unset. '' cast to uuid is
    // an error, which the first version of the policy hit.
    await db.exec(`begin; set local app.tenant_id = '${A}'; commit;`);
    expect(await count('select count(*)::int n from members')).toBe(0);
  });
});

describe('the audit trail and consent history are append-only', () => {
  it('lets the application append to both', async () => {
    await asTenant(A);
    await db.exec(`insert into audit_log (tenant_id, action, resource) values ('${A}', 'member.status', 'members')`);
    await db.exec(
      `insert into consent_records (tenant_id, member_id, purpose, notice_version, granted)
       values ('${A}', '${A_STUDENT_1}', 'email_comms', '2026-08-01', true)`,
    );
    expect(await count('select count(*)::int n from audit_log')).toBe(1);
    await db.exec('commit');
  });

  it('refuses to rewrite or delete either', async () => {
    await asTenant(A);
    expect(await refused(`update audit_log set action = 'forged'`)).toBe('42501');
    expect(await refused('delete from audit_log')).toBe('42501');
    expect(await refused('delete from consent_records')).toBe('42501');
    expect(await refused(`update consent_records set granted = false`)).toBe('42501');
    await db.exec('rollback');
  });
});

describe('rollover_batch', () => {
  it('previews a batch without changing it', async () => {
    await asTenant(A);
    const dry = await db.query(`select * from rollover_batch('${A}', 2026, true)`);
    expect(dry.rows).toHaveLength(2);
    expect(await count(`select count(*)::int n from members where status = 'active_student'`)).toBe(2);
    await db.exec('rollback');
  });

  it('refuses to run for a tenant other than the session’s', async () => {
    await asTenant(A);
    expect(await refused(`select * from rollover_batch('${B}', 2026, false)`)).toBe('42501');
    await db.exec('rollback');
  });

  it('flips status and swaps student for alumni, leaving every other role alone', async () => {
    await asTenant(A);
    const moved = await db.query(`select * from rollover_batch('${A}', 2026, false)`);
    expect(moved.rows).toHaveLength(2);

    expect(await count(`select count(*)::int n from members where status = 'active_alumni' and batch_year = 2026`)).toBe(2);
    expect(await count(`select count(*)::int n from member_roles where role = 'student' and revoked_at is not null`)).toBe(2);
    expect(await count(`select count(*)::int n from member_roles where role = 'alumni' and revoked_at is null`)).toBe(2);
    // Roles are a set, separate from status.
    expect(await count(`select count(*)::int n from member_roles where role = 'faculty' and revoked_at is null`)).toBe(1);

    // Idempotent: nobody is left to move, and nobody is granted twice.
    expect((await db.query(`select * from rollover_batch('${A}', 2026, false)`)).rows).toHaveLength(0);
    expect(await count(`select count(*)::int n from member_roles where role = 'alumni'`)).toBe(2);
    await db.exec('commit');
  });

  it('never touches another tenant’s students', async () => {
    await asTenant(B);
    expect(await count(`select count(*)::int n from members where status = 'active_student'`)).toBe(1);
    await db.exec('rollback');
  });
});

describe('integrity constraints', () => {
  it('refuses a second college-wide grant of the same role', async () => {
    // Two NULL departments compare as different in a plain UNIQUE.
    await asTenant(A);
    expect(
      await refused(`insert into member_roles (tenant_id, member_id, role) values ('${A}', '${A_STUDENT_1}', 'faculty')`),
    ).toBe('idx_member_roles_one_college_wide');
    await db.exec('rollback');
  });

  it('refuses two members sharing one degree-register row', async () => {
    await db.exec('reset role');
    await db.exec(`
      insert into degree_register (id, tenant_id, roll_number, name) values ('${REGISTER_ROW}', '${A}', '22A1', 'A One');
      update members set degree_register_id = '${REGISTER_ROW}' where roll_number = '22A1';
    `);
    expect(await refused(`update members set degree_register_id = '${REGISTER_ROW}' where roll_number = '22A2'`)).toBe('idx_members_register_row');
    await db.exec('set role alumni_app');
  });

  it('accepts a valid donation and refuses the nonsensical ones', async () => {
    await db.exec('reset role');
    await db.exec(
      `insert into donation_campaigns (id, tenant_id, title, slug, created_by) values ('${CAMPAIGN}', '${A}', 'C', 'c', '${A_STUDENT_1}')`,
    );
    await db.exec(`insert into donations (tenant_id, campaign_id, donor_name, amount, reconciled_by)
                   values ('${A}', '${CAMPAIGN}', 'D', 100, '${A_STUDENT_2}')`);

    expect(await refused(`insert into donations (tenant_id, donor_name, amount) values ('${A}', 'D', 0)`)).toBe('chk_donation_amount_positive');
    expect(
      await refused(`insert into donations (tenant_id, donor_name, amount, source_country, is_foreign_contribution)
                     values ('${A}', 'D', 10, 'US', false)`),
    ).toBe('chk_donation_foreign_flag');
    // Separation of duties: the campaign's creator cannot reconcile its money.
    expect(
      await refused(`insert into donations (tenant_id, campaign_id, donor_name, amount, reconciled_by)
                     values ('${A}', '${CAMPAIGN}', 'D', 100, '${A_STUDENT_1}')`),
    ).toBe('chk_reconciler_not_creator');
    await db.exec('set role alumni_app');
  });

  it('refuses a CGPA outside 0 to 10 and a brand colour that is not a hex colour', async () => {
    await db.exec('reset role');
    expect(await refused(`update members set cgpa = 11.5 where roll_number = '22A1'`)).toBe('members_cgpa_check');
    expect(
      await refused(`insert into tenant_branding (tenant_id, portal_name, primary_hex) values ('${A}', 'P', '#zzzzzz')`),
    ).toMatch(/^tenant_branding/);
    await db.exec('set role alumni_app');
  });
});
