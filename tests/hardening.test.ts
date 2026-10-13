import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/lib/auth/guard';
import { isVendorOnlySession } from '@/lib/auth/guard';
import { CROSS_SITE_BODY, isCrossSiteMutation } from '@/lib/auth/origin';
import { decodeSessionToken, encodeSessionToken } from '@/lib/auth/session-token';
import { redactAuditEntry } from '@/lib/audit/redact';
import { safeForStyleElement } from '@/lib/branding/resolve';
import { BrandPack, DEFAULT_PACK, fontFamilyName, isSafeUrl } from '@/lib/branding/pack';
import { addressFromForwardedFor, auditIpFrom, clientIpFrom } from '@/lib/client-ip';
import {
  findMemberById,
  getConnections,
  getDemoAccounts,
  getEventBySlug,
  getMemberForAdminView,
  getMembersForAdmin,
  getMembersForAdminView,
  getVerificationClaims,
} from '@/lib/data/repo';
import { CONNECTIONS, EVENTS } from '@/lib/data/seed';
import type { AuditEntry } from '@/lib/data/types';
import { subdomainFrom } from '@/lib/host';

/**
 * Regression tests for the hardening pass.
 *
 * Each block names the way the thing used to fail, because a test that only
 * says "returns null" does not tell the next person what it is protecting.
 */

function sessionFor(email: string): Session {
  const account = getDemoAccounts().find((a) => a.email === email);
  if (!account) throw new Error(`No demo account for ${email}`);
  const member = findMemberById(account.memberId)!;
  return {
    memberId: member.id,
    tenantId: 'ten-diet',
    status: member.status,
    roles: account.roles.map((r) => ({ role: r.role, departmentId: r.departmentCode })),
    departmentId: member.departmentCode,
    batchYear: member.batchYear,
  };
}

// ---------------------------------------------------------------
// Session cookie
// ---------------------------------------------------------------

describe('session token', () => {
  const payload = () => ({ memberId: 'mem-a-1', tenantId: 'ten-diet', issuedAt: Date.now() });

  it('round-trips what it issued', () => {
    expect(decodeSessionToken(encodeSessionToken(payload()))).toMatchObject({ memberId: 'mem-a-1', tenantId: 'ten-diet' });
  });

  it('refuses a payload edited after signing', () => {
    const [, mac] = encodeSessionToken(payload()).split('.');
    const forged = Buffer.from(JSON.stringify({ ...payload(), memberId: 'mem-a-2' })).toString('base64url');
    expect(decodeSessionToken(`${forged}.${mac}`)).toBeNull();
  });

  it('refuses junk without throwing', () => {
    for (const junk of [undefined, null, '', '.', 'a.b.c', 'only-one-part', '....', 'é.é']) {
      expect(decodeSessionToken(junk as string | null | undefined)).toBeNull();
    }
  });

  it('refuses a validly signed token whose payload is not a session', () => {
    // A signature proves the payload is ours, not that it is well formed.
    // Without a shape check a token missing `issuedAt` compared as
    // `NaN > maxAge`, which is false, and never expired.
    for (const bad of [
      { memberId: 'mem-a-1', tenantId: 'ten-diet' },
      { memberId: '', tenantId: 'ten-diet', issuedAt: Date.now() },
      { memberId: 'mem-a-1', tenantId: 7, issuedAt: Date.now() },
      { memberId: 'mem-a-1', tenantId: 'ten-diet', issuedAt: 'now' },
      null,
    ]) {
      // The module's own encoder signs whatever it is handed, which is
      // exactly the case under test: a genuine signature on a bad payload.
      expect(decodeSessionToken(encodeSessionToken(bad as never))).toBeNull();
    }
  });

  it('refuses an expired token and one from the future', () => {
    const day = 24 * 60 * 60 * 1000;
    expect(decodeSessionToken(encodeSessionToken({ ...payload(), issuedAt: Date.now() - 15 * day }))).toBeNull();
    expect(decodeSessionToken(encodeSessionToken({ ...payload(), issuedAt: Date.now() + 5 * 60 * 1000 }))).toBeNull();
    expect(decodeSessionToken(encodeSessionToken({ ...payload(), issuedAt: Date.now() - 13 * day }))).not.toBeNull();
  });
});

describe('session secret', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('is refused in production when it is too short to be a secret', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_SECRET', 'changeme');
    vi.resetModules();
    const { sessionSecret } = await import('@/lib/auth/session-token');
    expect(() => sessionSecret()).toThrow(/at least 32/);
  });

  it('accepts a strong secret in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_SECRET', 'x'.repeat(40));
    vi.resetModules();
    const { sessionSecret } = await import('@/lib/auth/session-token');
    expect(sessionSecret()).toHaveLength(40);
  });

  it('does not make a short secret a problem on a laptop', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SESSION_SECRET', 'short');
    vi.resetModules();
    const { sessionSecret } = await import('@/lib/auth/session-token');
    expect(sessionSecret()).toBe('short');
  });
});

// ---------------------------------------------------------------
// Network address
// ---------------------------------------------------------------

describe('client address', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('takes the entry the proxy appended, not the one the client sent', () => {
    // The client sent "1.2.3.4"; the load balancer appended the real peer.
    expect(addressFromForwardedFor('1.2.3.4, 203.0.113.9')).toBe('203.0.113.9');
  });

  it('cannot be steered by a forged leftmost entry', () => {
    const real = '203.0.113.9';
    for (const forged of ['9.9.9.9', '8.8.8.8, 9.9.9.9', 'garbage']) {
      expect(addressFromForwardedFor(`${forged}, ${real}`)).toBe(real);
    }
  });

  it('counts back by the configured number of trusted proxies', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '2');
    expect(addressFromForwardedFor('1.1.1.1, 203.0.113.9, 10.0.0.1')).toBe('203.0.113.9');
  });

  it('uses the one entry a platform that overwrites the header sends', () => {
    expect(addressFromForwardedFor('203.0.113.9')).toBe('203.0.113.9');
  });

  it('shares one local bucket when there is no proxy header at all', () => {
    expect(clientIpFrom(new Headers())).toBe('local');
    expect(clientIpFrom(new Headers({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7');
  });

  it('only writes a real address into the audit row', () => {
    // `audit_log.ip` is inet: a sentinel or a forged string rejects the whole
    // row, and the audit entry with it.
    expect(auditIpFrom('1.2.3.4, 203.0.113.9')).toBe('203.0.113.9');
    expect(auditIpFrom('2001:db8::1')).toBe('2001:db8::1');
    expect(auditIpFrom('local')).toBeNull();
    expect(auditIpFrom('unknown')).toBeNull();
    expect(auditIpFrom("1.2.3.4'; drop table audit_log;--")).toBeNull();
    expect(auditIpFrom(null)).toBeNull();
  });
});

// ---------------------------------------------------------------
// Cross-site requests
// ---------------------------------------------------------------

describe('cross-site mutation check', () => {
  const h = (init: Record<string, string>) => new Headers({ host: 'diet.portal.example', ...init });

  it('lets reads through whatever they claim', () => {
    expect(isCrossSiteMutation('GET', h({ origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }))).toBe(false);
  });

  it('lets a same-origin write through', () => {
    expect(isCrossSiteMutation('POST', h({ origin: 'https://diet.portal.example', 'sec-fetch-site': 'same-origin' }))).toBe(false);
  });

  it('lets a non-browser caller through, because it has no ambient cookie to abuse', () => {
    expect(isCrossSiteMutation('POST', h({}))).toBe(false);
  });

  it('refuses another site', () => {
    expect(isCrossSiteMutation('POST', h({ origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }))).toBe(true);
    expect(isCrossSiteMutation('DELETE', h({ origin: 'https://evil.example' }))).toBe(true);
  });

  it('refuses a sibling college, which SameSite=Lax treats as same-site', () => {
    expect(isCrossSiteMutation('POST', h({ origin: 'https://northgate.portal.example', 'sec-fetch-site': 'same-site' }))).toBe(true);
    expect(isCrossSiteMutation('POST', h({ origin: 'https://northgate.portal.example' }))).toBe(true);
  });

  it('refuses an opaque or malformed origin', () => {
    expect(isCrossSiteMutation('POST', h({ origin: 'null' }))).toBe(true);
    expect(isCrossSiteMutation('PATCH', h({ origin: 'not a url' }))).toBe(true);
  });

  it('has a refusal body the client can read', () => {
    expect(CROSS_SITE_BODY.code).toBe('cross_site_request');
  });
});

// ---------------------------------------------------------------
// Host -> tenant
// ---------------------------------------------------------------

describe('host to tenant', () => {
  it('selects a college from its subdomain', () => {
    expect(subdomainFrom('diet.portal.example')).toBe('diet');
    expect(subdomainFrom('Northgate.Portal.Example:3000')).toBe('northgate');
  });

  it('selects a college on *.localhost and falls back on bare localhost', () => {
    expect(subdomainFrom('northgate.localhost:3300')).toBe('northgate');
    expect(subdomainFrom('localhost:3300')).toBeTruthy();
  });

  it('resolves no college for an apex or empty host', () => {
    expect(subdomainFrom('portal.example')).toBeNull();
    expect(subdomainFrom('')).toBeNull();
  });
});

// ---------------------------------------------------------------
// Brand input reaches a <style> element
// ---------------------------------------------------------------

describe('brand pack input that is written into CSS', () => {
  const withColor = (overrides: Record<string, string>) =>
    BrandPack.safeParse({ ...DEFAULT_PACK, color: { ...DEFAULT_PACK.color, overrides } });

  it('accepts the colour values real packs use', () => {
    for (const v of ['#9E2A4B', '#fff', 'oklch(0.55 0.12 20)', 'rgb(158, 42, 75)', 'var(--brand-600)']) {
      expect(withColor({ '--brand-fg': v }).success, v).toBe(true);
    }
  });

  it('refuses a value that can leave the declaration or the element', () => {
    for (const v of [
      'red}</style><meta http-equiv=refresh content="0;//evil.example">',
      '#fff;background:url(//evil.example/x)',
      'red;}body{display:none',
      '"><img src=x onerror=alert(1)>',
      'url(javascript:alert(1))\\',
      'a{b:c}',
    ]) {
      expect(withColor({ '--brand-fg': v }).success, v).toBe(false);
    }
  });

  it('refuses a font name that can close a string', () => {
    for (const v of ['x"}</style>', 'Inter"; src: url(//evil)', 'a\\b', '', ' '.repeat(3), 'a'.repeat(61)]) {
      expect(fontFamilyName.safeParse(v).success, v).toBe(false);
    }
    for (const v of ['Inter', 'IBM Plex Mono', 'Source Serif 4', 'Noto Sans-Telugu_UI']) {
      expect(fontFamilyName.safeParse(v).success, v).toBe(true);
    }
  });

  it('only lets an asset be a path on this site or an https address', () => {
    for (const v of ['/brand/crest.svg', 'https://cdn.example/crest.png']) expect(isSafeUrl(v), v).toBe(true);
    for (const v of ['//evil.example/x', 'javascript:alert(1)', 'data:text/html,<b>', 'http://plain.example/x', '/a b', '/a"b', '/a)b']) {
      expect(isSafeUrl(v), v).toBe(false);
    }
  });

  it('cannot be ended early at the sink even if something got past the schema', () => {
    expect(safeForStyleElement('a{}</style><script>x</script>')).not.toMatch(/<\/style/i);
    expect(safeForStyleElement('a{}</STYLE>')).not.toMatch(/<\/style/i);
    expect(safeForStyleElement('a{color:red}')).toBe('a{color:red}');
  });
});

// ---------------------------------------------------------------
// The vendor boundary, in the audit trail
// ---------------------------------------------------------------

describe('audit trail for the vendor', () => {
  const entry: AuditEntry = {
    id: 'aud-1',
    actorName: 'Asha Rao',
    actorRole: 'college_admin',
    action: 'member.status',
    resource: 'members',
    resourceId: 'mem-a-4',
    reason: 'Marked deceased at the family’s request',
    ip: '203.0.113.9',
    createdAt: '2026-08-01T00:00:00.000Z',
    before: { fullName: 'Ravi Kumar', rollNumber: '18JN1A0501', status: 'active_alumni' },
    after: { fullName: 'Ravi Kumar', rollNumber: '18JN1A0501', status: 'deceased' },
  };

  it('keeps the event and drops everything that describes a person', () => {
    const redacted = redactAuditEntry(entry);
    expect(redacted).toMatchObject({ action: 'member.status', resource: 'members', actorName: 'Asha Rao', createdAt: entry.createdAt });
    expect(redacted.before).toBeNull();
    expect(redacted.after).toBeNull();
    expect(redacted.reason).toBeNull();
    expect(JSON.stringify(redacted)).not.toMatch(/Ravi|18JN1A0501|deceased/);
  });

  it('recognises a vendor-only session and nobody else', () => {
    const vendor: Session = { ...sessionFor('admin@diet.ac.in'), roles: [{ role: 'platform_admin', departmentId: null }] };
    const alsoAlumnus: Session = { ...vendor, roles: [...vendor.roles, { role: 'alumni', departmentId: null }] };
    expect(isVendorOnlySession(vendor)).toBe(true);
    expect(isVendorOnlySession(alsoAlumnus)).toBe(false);
    expect(isVendorOnlySession(sessionFor('admin@diet.ac.in'))).toBe(false);
    expect(isVendorOnlySession({ ...vendor, roles: [] })).toBe(false);
  });
});

// ---------------------------------------------------------------
// Read layer fails closed
// ---------------------------------------------------------------

describe('verification queue visibility', () => {
  it('shows nothing to a member who holds neither review capability', () => {
    // Used to return every claim - names, rolls, emails - to anyone who was
    // not an HOD with a department, because the scope only applied when one
    // was found.
    expect(getVerificationClaims(sessionFor('student@diet.ac.in'))).toEqual([]);
    expect(getVerificationClaims(sessionFor('alumni@example.com'))).toEqual([]);
  });

  it('shows nothing to a member with a review role but no active status', () => {
    const lapsed: Session = { ...sessionFor('admin@diet.ac.in'), status: 'lapsed' };
    expect(getVerificationClaims(lapsed)).toEqual([]);
  });
});

describe('event addressed by slug', () => {
  it('is not served to a student when the event is not open to students', () => {
    // The list hid these; the by-slug lookup did not, so a student who knew
    // or guessed the slug could open and register for it. No seeded event is
    // closed to students without also being alumni-only, so flip one for the
    // length of the test.
    const event = EVENTS.find((e) => e.published && !e.alumniOnly && e.studentEligible)!;
    event.studentEligible = false;
    try {
      expect(getEventBySlug(sessionFor('student@diet.ac.in'), event.slug)).toBeNull();
      expect(getEventBySlug(sessionFor('alumni@example.com'), event.slug)).not.toBeNull();
    } finally {
      event.studentEligible = true;
    }
  });
});

describe('member records in the staff console', () => {
  const HOD = sessionFor('hod.cse@diet.ac.in');
  const OPERATOR = sessionFor('alumnicell@diet.ac.in');
  const ADMIN = sessionFor('admin@diet.ac.in');

  it('shows an HOD their own department and no other', () => {
    const seen = getMembersForAdminView(HOD, { perPage: 100000 }).items;
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen.map((m) => m.departmentCode))).toEqual(new Set(['CSE']));
    expect(getMembersForAdminView(ADMIN, { perPage: 100000 }).total).toBeGreaterThan(seen.length);
  });

  it('answers 404-alike for another branch’s member, by id and by slug', () => {
    const other = getMembersForAdminView(ADMIN, { perPage: 100000 }).items.find((m) => m.departmentCode !== 'CSE')!;
    expect(getMemberForAdminView(HOD, other.id)).toBeNull();
    expect(getMemberForAdminView(HOD, other.slug)).toBeNull();
    expect(getMemberForAdminView(ADMIN, other.id)?.id).toBe(other.id);
  });

  it('shows a member who cannot read records nothing at all', () => {
    expect(getMembersForAdminView(sessionFor('student@diet.ac.in'), {}).total).toBe(0);
    expect(getMemberForAdminView(sessionFor('alumni@example.com'), ADMIN.memberId)).toBeNull();
  });

  it('withholds contact details and academic fields the viewer has no capability for', () => {
    const asHod = getMembersForAdminView(HOD, { perPage: 5 }).items;
    for (const m of asHod) {
      expect(m.contact).toBeNull();
      expect(m.cgpa).toBeUndefined();
      expect(m.placementStatus).toBeUndefined();
    }
    const asAdmin = getMembersForAdminView(ADMIN, { perPage: 5 }).items;
    expect(asAdmin.some((m) => m.contact !== null)).toBe(true);
  });

  it('does not let a search reach an email the viewer cannot read', () => {
    // The alumni cell may read records but not contact details; matching on
    // the email would confirm who owns an address.
    const target = findMemberById(ADMIN.memberId)!;
    const email = target.privateContact.email!;
    expect(getMembersForAdminView(OPERATOR, { q: email }).total).toBe(0);
    expect(getMembersForAdminView(ADMIN, { q: email }).total).toBeGreaterThan(0);
  });

  it('keeps the bulk function available for internal, guarded callers', () => {
    expect(getMembersForAdmin({ perPage: 3 }).items[0]?.contact).not.toBeNull();
  });
});

describe('a block is never disclosed to the person who was blocked', () => {
  it('reads as an ordinary decline on the sender’s side only', () => {
    const connection = CONNECTIONS.find((c) => c.state === 'declined')!;
    const sender = { ...sessionFor('student@diet.ac.in'), memberId: connection.from.id };
    const blocker = { ...sessionFor('alumni@example.com'), memberId: connection.to.id };
    const original = connection.state;
    connection.state = 'blocked';
    try {
      const sent = getConnections(sender, 'sent').find((c) => c.id === connection.id);
      expect(sent?.state).toBe('declined');
      const received = getConnections(blocker, 'received').find((c) => c.id === connection.id);
      expect(received?.state).toBe('blocked');
    } finally {
      connection.state = original;
    }
  });
});
