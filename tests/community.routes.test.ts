import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../src/lib/auth/guard';

/**
 * The community modules, at their route handlers.
 *
 * `community.test.ts` proves what the read layer will and will not return.
 * This proves the doors: that each mutation checks the capability before it
 * reads the body, that the rules a form cannot be trusted to keep are kept
 * by the handler, and that nothing a request can say turns a proposal into
 * a published event, a pending listing into a live one, or a stranger into a
 * member of somebody's group.
 *
 * The handlers are the real ones. Only the signed-in session (which needs a
 * cookie jar), the resolved tenant (which needs a Host header) and the rate
 * limiter are stubbed, so every guard, schema, refusal and audit write below
 * is the production code path.
 */

const ctx = vi.hoisted(() => ({
  session: null as Session | null,
  limited: false,
  features: {
    events: true,
    groups: true,
    feed: true,
    businesses: true,
    showcase: true,
    helpdesk: true,
    pages: true,
    invites: true,
  } as Record<string, boolean>,
  tenant: { id: 'ten-diet', name: 'DIET', shortName: 'DIET', subdomain: 'diet', packId: 'diet', fcraRegistered: false },
}));

vi.mock('@/lib/auth/session', () => ({
  getSession: async () => ctx.session,
  rateLimit: () => (ctx.limited ? { ok: false, retryAfter: 120 } : { ok: true, retryAfter: 0 }),
}));

vi.mock('@/lib/tenant', () => ({
  getTenant: async () => ctx.tenant,
  getTenantBrand: async () => ({ tenant: ctx.tenant, brand: { pack: { features: ctx.features } } }),
}));

const { POST: proposePOST } = await import('../src/app/api/events/propose/route');
const { PATCH: proposalDecidePATCH } = await import('../src/app/api/admin/events/[id]/route');
const { POST: invitePOST } = await import('../src/app/api/invitations/route');
const { POST: postPOST } = await import('../src/app/api/posts/route');
const { PATCH: postModeratePATCH, DELETE: postDELETE } = await import('../src/app/api/posts/[id]/route');
const { PATCH: showcaseDecidePATCH } = await import('../src/app/api/admin/showcase/[slug]/route');
const { POST: showcaseCuratePOST } = await import('../src/app/api/admin/showcase/route');
const { POST: showcaseSubmitPOST } = await import('../src/app/api/showcase/route');
const { POST: ticketReplyPOST } = await import('../src/app/api/helpdesk/[id]/route');
const { POST: staffReplyPOST } = await import('../src/app/api/admin/helpdesk/[id]/route');
const { POST: businessPOST } = await import('../src/app/api/businesses/route');
const { PATCH: businessDecidePATCH } = await import('../src/app/api/admin/businesses/[slug]/route');
const { POST: membershipPOST } = await import('../src/app/api/groups/[slug]/membership/route');
const { PATCH: joinDecidePATCH } = await import('../src/app/api/groups/[slug]/requests/route');
const { POST: groupCreatePOST } = await import('../src/app/api/admin/groups/route');
const { POST: pageCreatePOST } = await import('../src/app/api/admin/pages/route');

const { recentAuditWrites } = await import('../src/lib/audit/log');
const { displayNow } = await import('../src/lib/format');
const { findMemberById, getDemoAccounts, getPendingEventProposals } = await import('../src/lib/data/repo');
const { GROUPS, GROUP_MEMBERSHIPS, INVITATIONS, SHOWCASE, TICKETS } = await import('../src/lib/data/seed-community');
const { INVITE_WEEKLY_LIMIT } = await import('../src/lib/data/invites');

// ---------------------------------------------------------------
// Fixtures and helpers
// ---------------------------------------------------------------

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

function alumnusSession(memberId: string): Session {
  const member = findMemberById(memberId)!;
  return {
    memberId: member.id,
    tenantId: 'ten-diet',
    status: member.status,
    roles: [{ role: 'alumni', departmentId: null }],
    departmentId: member.departmentCode,
    batchYear: member.batchYear,
  };
}

const STUDENT = sessionFor('student@diet.ac.in');
const ALUMNUS = sessionFor('alumni@example.com');
const FACULTY = sessionFor('faculty.ece@diet.ac.in');
const HOD = sessionFor('hod.cse@diet.ac.in');
const FINANCE = sessionFor('finance@diet.ac.in');
const OPERATOR = sessionFor('alumnicell@diet.ac.in');
const ADMIN = sessionFor('admin@diet.ac.in');
const VENDOR = sessionFor('platform@ifbash.com');

const HOST = 'diet.localhost:3000';

function req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`http://${HOST}${path}`, {
    method,
    headers: { host: HOST, 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const read = async (res: Response): Promise<Record<string, any>> => res.json();

const inDays = (n: number) => new Date(displayNow().getTime() + n * 86_400_000).toISOString();

const inGroup = (s: Session, slug: string) => {
  const g = GROUPS.find((x) => x.slug === slug)!;
  return GROUP_MEMBERSHIPS.some((r) => r.groupId === g.id && r.memberId === s.memberId && r.state === 'active');
};

const lastAudit = () => recentAuditWrites()[0]!;

const PROPOSAL = {
  title: 'Hyderabad founders breakfast',
  description: 'A relaxed breakfast for alumni building companies in Hyderabad, to swap notes on hiring and fundraising.',
  venue: 'A cafe in Jubilee Hills',
  startsAt: inDays(30),
  kind: 'meetup',
  mode: 'in_person',
};

const POST = {
  kind: 'update',
  body: 'Two openings on my team this quarter, both for people who have shipped something real.',
  tags: ['hiring'],
};

beforeEach(() => {
  ctx.session = null;
  ctx.limited = false;
  for (const k of Object.keys(ctx.features)) ctx.features[k] = true;
});

// ---------------------------------------------------------------
// The doors, in bulk
// ---------------------------------------------------------------

/**
 * Every community mutation that is gated on a capability, called with a body
 * the handler would accept if it got that far. The check has to come before
 * the body is read: a refusal that depended on the body being valid would
 * tell an outsider which fields exist.
 */
const GATED: Array<[string, () => Promise<Response>]> = [
  ['POST /api/events/propose', () => proposePOST(req('POST', '/api/events/propose', PROPOSAL))],
  ['PATCH /api/admin/events/[id]', () => proposalDecidePATCH(req('PATCH', '/api/admin/events/x', { action: 'approve' }), params({ id: 'x' }))],
  ['POST /api/posts', () => postPOST(req('POST', '/api/posts', POST))],
  ['PATCH /api/posts/[id]', () => postModeratePATCH(req('PATCH', '/api/posts/post-14', { action: 'restore' }), params({ id: 'post-14' }))],
  ['POST /api/showcase', () => showcaseSubmitPOST(req('POST', '/api/showcase', {}))],
  ['POST /api/admin/showcase', () => showcaseCuratePOST(req('POST', '/api/admin/showcase', {}))],
  ['PATCH /api/admin/showcase/[slug]', () => showcaseDecidePATCH(req('PATCH', '/api/admin/showcase/x', { action: 'approve' }), params({ slug: 'x' }))],
  ['POST /api/admin/helpdesk/[id]', () => staffReplyPOST(req('POST', '/api/admin/helpdesk/x', { body: 'Hello', state: 'answered' }), params({ id: 'x' }))],
  ['POST /api/businesses', () => businessPOST(req('POST', '/api/businesses', {}))],
  ['PATCH /api/admin/businesses/[slug]', () => businessDecidePATCH(req('PATCH', '/api/admin/businesses/x', { action: 'approve' }), params({ slug: 'x' }))],
  ['POST /api/admin/groups', () => groupCreatePOST(req('POST', '/api/admin/groups', {}))],
  ['POST /api/admin/pages', () => pageCreatePOST(req('POST', '/api/admin/pages', {}))],
];

describe('every gated community mutation refuses before it reads the body', () => {
  it.each(GATED)('%s: 401 with no session', async (_name, call) => {
    ctx.session = null;
    expect((await call()).status).toBe(401);
  });

  it.each(GATED)('%s: 403 for the vendor', async (_name, call) => {
    ctx.session = VENDOR;
    const res = await call();
    expect(res.status).toBe(403);
  });

  it.each(GATED)('%s: 403 for a final-year student', async (_name, call) => {
    ctx.session = STUDENT;
    expect((await call()).status).toBe(403);
  });

  it.each(GATED)('%s: 403 for finance, who holds no community capability', async (_name, call) => {
    ctx.session = FINANCE;
    expect((await call()).status).toBe(403);
  });

  it('refuses a body that is not JSON only after the guard: an outsider learns nothing from the shape', async () => {
    ctx.session = STUDENT;
    const res = await proposePOST(new Request(`http://${HOST}/api/events/propose`, { method: 'POST', body: '{not json', headers: { host: HOST } }));
    expect(res.status).toBe(403);
  });
});

describe('a module a college has not taken is not there', () => {
  it('answers 404, not 403, naming nothing it withholds', async () => {
    ctx.session = ALUMNUS;
    ctx.features.feed = false;
    const res = await postPOST(req('POST', '/api/posts', POST));
    expect(res.status).toBe(404);
    expect((await read(res)).code).toBe('feature_off');
  });

  it('applies to each module independently', async () => {
    ctx.session = ADMIN;
    ctx.features.showcase = false;
    expect((await showcaseCuratePOST(req('POST', '/api/admin/showcase', {}))).status).toBe(404);
    ctx.features.pages = false;
    expect((await pageCreatePOST(req('POST', '/api/admin/pages', {}))).status).toBe(404);
    ctx.features.groups = false;
    expect((await groupCreatePOST(req('POST', '/api/admin/groups', {}))).status).toBe(404);
  });
});

// ---------------------------------------------------------------
// Event proposals
// ---------------------------------------------------------------

describe('POST /api/events/propose', () => {
  it('accepts a proposal from an alumnus and says it is waiting, not published', async () => {
    ctx.session = ALUMNUS;
    const res = await proposePOST(req('POST', '/api/events/propose', PROPOSAL));
    expect(res.status).toBe(201);
    const out = await read(res);
    expect(out.event.published).toBe(false);
    expect(out.event.reviewState).toBe('pending');
    expect(out.persisted).toBe(false);
  });

  it('lets faculty propose as well', async () => {
    ctx.session = FACULTY;
    expect((await proposePOST(req('POST', '/api/events/propose', PROPOSAL))).status).toBe(201);
  });

  it('cannot be told to publish: no request field changes the outcome', async () => {
    ctx.session = ALUMNUS;
    const res = await proposePOST(
      req('POST', '/api/events/propose', { ...PROPOSAL, published: true, reviewState: 'approved', review_state: 'approved', status: 'published', proposedBy: ADMIN.memberId }),
    );
    const out = await read(res);
    expect(out.event.published).toBe(false);
    expect(out.event.reviewState).toBe('pending');
    expect(lastAudit().after).toMatchObject({ proposedBy: ALUMNUS.memberId });
  });

  it('wants a week\'s notice, and says which field', async () => {
    ctx.session = ALUMNUS;
    const res = await proposePOST(req('POST', '/api/events/propose', { ...PROPOSAL, startsAt: inDays(2) }));
    expect(res.status).toBe(422);
    expect((await read(res)).fieldErrors.startsAt).toMatch(/days from now/);
  });

  it('accepts exactly the minimum notice', async () => {
    ctx.session = ALUMNUS;
    const res = await proposePOST(req('POST', '/api/events/propose', { ...PROPOSAL, startsAt: inDays(7) }));
    expect(res.status).toBe(201);
  });

  it('wants a join link for an online event, and an https one with no password in it', async () => {
    ctx.session = ALUMNUS;
    const online = { ...PROPOSAL, kind: 'webinar', mode: 'online' };
    expect((await proposePOST(req('POST', '/api/events/propose', online))).status).toBe(422);
    expect((await proposePOST(req('POST', '/api/events/propose', { ...online, meetingUrl: 'http://meet.example.com/x' }))).status).toBe(422);
    expect((await proposePOST(req('POST', '/api/events/propose', { ...online, meetingUrl: 'https://user:pw@meet.example.com/x' }))).status).toBe(422);
    expect((await proposePOST(req('POST', '/api/events/propose', { ...online, meetingUrl: 'https://meet.example.com/x' }))).status).toBe(201);
  });

  it('refuses a join link on an event held in person', async () => {
    ctx.session = ALUMNUS;
    const res = await proposePOST(req('POST', '/api/events/propose', { ...PROPOSAL, meetingUrl: 'https://meet.example.com/x' }));
    expect(res.status).toBe(422);
    expect((await read(res)).fieldErrors.meetingUrl).toMatch(/in person/);
  });

  it('refuses a batch on anything but a reunion', async () => {
    ctx.session = ALUMNUS;
    expect((await proposePOST(req('POST', '/api/events/propose', { ...PROPOSAL, batchYear: 2016 }))).status).toBe(422);
    expect((await proposePOST(req('POST', '/api/events/propose', { ...PROPOSAL, kind: 'reunion', batchYear: 2016 }))).status).toBe(201);
  });

  it('refuses an end before the start', async () => {
    ctx.session = ALUMNUS;
    const res = await proposePOST(req('POST', '/api/events/propose', { ...PROPOSAL, endsAt: inDays(29) }));
    expect(res.status).toBe(422);
    expect((await read(res)).fieldErrors.endsAt).toBeDefined();
  });

  it('refuses to attach an event to a group the proposer is not in, and accepts one they are in', async () => {
    ctx.session = ALUMNUS;
    const stranger = GROUPS.find((g) => g.kind === 'chapter' && !inGroup(ALUMNUS, g.slug))!;
    const refused = await proposePOST(req('POST', '/api/events/propose', { ...PROPOSAL, groupSlug: stranger.slug }));
    expect(refused.status).toBe(422);
    expect((await read(refused)).fieldErrors.groupSlug).toBeDefined();

    const accepted = await proposePOST(req('POST', '/api/events/propose', { ...PROPOSAL, groupSlug: 'hyderabad-chapter' }));
    expect(accepted.status).toBe(201);
    expect((await read(accepted)).event.groupSlug).toBe('hyderabad-chapter');
  });

  it('refuses an unknown branch', async () => {
    ctx.session = ALUMNUS;
    expect((await proposePOST(req('POST', '/api/events/propose', { ...PROPOSAL, departmentCode: 'NOPE' }))).status).toBe(422);
  });

  it('refuses a title whose address an event already holds', async () => {
    ctx.session = ALUMNUS;
    const res = await proposePOST(req('POST', '/api/events/propose', { ...PROPOSAL, title: 'Hyderabad chapter meetup' }));
    expect([201, 409]).toContain(res.status);
    if (res.status === 409) expect((await read(res)).code).toBe('slug_taken');
  });

  it('stops at the daily limit with a retry-after', async () => {
    ctx.session = ALUMNUS;
    ctx.limited = true;
    const res = await proposePOST(req('POST', '/api/events/propose', PROPOSAL));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('120');
  });

  it('writes an audit entry naming the proposer and the group', async () => {
    ctx.session = ALUMNUS;
    await proposePOST(req('POST', '/api/events/propose', { ...PROPOSAL, groupSlug: 'hyderabad-chapter' }));
    expect(lastAudit()).toMatchObject({ action: 'event.propose', resource: 'events', tenantId: 'ten-diet' });
    expect(lastAudit().after).toMatchObject({ groupSlug: 'hyderabad-chapter', published: false, reviewState: 'pending' });
  });
});

describe('PATCH /api/admin/events/[id]', () => {
  const pending = () => getPendingEventProposals(ADMIN)[0]!;

  it('has a proposal waiting to decide', () => {
    expect(pending()).toBeDefined();
  });

  it('turns away everyone without event.create.any, including a head of department', async () => {
    for (const s of [ALUMNUS, HOD, FACULTY, STUDENT, VENDOR]) {
      ctx.session = s;
      const res = await proposalDecidePATCH(req('PATCH', `/api/admin/events/${pending().id}`, { action: 'approve' }), params({ id: pending().id }));
      expect(res.status, String(s.memberId)).toBe(403);
    }
  });

  it('lets the alumni cell and the college admin approve, which publishes', async () => {
    for (const s of [OPERATOR, ADMIN]) {
      ctx.session = s;
      const res = await proposalDecidePATCH(req('PATCH', `/api/admin/events/${pending().id}`, { action: 'approve' }), params({ id: pending().id }));
      expect(res.status).toBe(200);
      const out = await read(res);
      expect(out.event).toMatchObject({ published: true, reviewState: 'approved', moderationNote: null });
      expect(lastAudit()).toMatchObject({ action: 'event.proposal.approve' });
    }
  });

  it('will not decline without a reason the proposer can act on', async () => {
    ctx.session = ADMIN;
    for (const bad of [{ action: 'decline' }, { action: 'decline', message: '' }, { action: 'decline', message: 'No.' }]) {
      const res = await proposalDecidePATCH(req('PATCH', `/api/admin/events/${pending().id}`, bad), params({ id: pending().id }));
      expect(res.status, JSON.stringify(bad)).toBe(422);
    }
  });

  it('declines with the reason, which is recorded and stays unpublished', async () => {
    ctx.session = ADMIN;
    const message = 'The venue is not confirmed yet; send it again once the hall is booked.';
    const res = await proposalDecidePATCH(req('PATCH', `/api/admin/events/${pending().id}`, { action: 'decline', message }), params({ id: pending().id }));
    expect(res.status).toBe(200);
    expect((await read(res)).event).toMatchObject({ published: false, reviewState: 'rejected', moderationNote: message });
    expect(lastAudit()).toMatchObject({ action: 'event.proposal.decline', reason: message });
  });

  it('knows nothing of an event that is not a waiting proposal', async () => {
    ctx.session = ADMIN;
    for (const id of ['evt-1', 'no-such-event']) {
      const res = await proposalDecidePATCH(req('PATCH', `/api/admin/events/${id}`, { action: 'approve' }), params({ id }));
      expect(res.status, id).toBe(404);
    }
  });
});

// ---------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------

describe('POST /api/invitations', () => {
  const one = (email: string, extra: object = {}) => ({ invitations: [{ email, ...extra }] });
  const normalised = (b: Record<string, unknown>) =>
    JSON.parse(JSON.stringify(b, (k, v) => (k === 'id' || k === 'createdAt' || k === 'email' || k === 'name' ? '*' : v)));

  it('wants an active member', async () => {
    ctx.session = null;
    expect((await invitePOST(req('POST', '/api/invitations', one('a@example.com')))).status).toBe(401);
    ctx.session = { ...ALUMNUS, status: 'pending' };
    expect((await invitePOST(req('POST', '/api/invitations', one('a@example.com')))).status).toBe(403);
  });

  it('answers the same for an address that belongs to a member and one that does not', async () => {
    ctx.session = ALUMNUS;
    const member = await invitePOST(req('POST', '/api/invitations', one('admin@diet.ac.in')));
    const stranger = await invitePOST(req('POST', '/api/invitations', one('nobody.at.all@example.com')));
    expect(member.status).toBe(stranger.status);
    expect(normalised(await read(member))).toEqual(normalised(await read(stranger)));
  });

  it('answers the same for an address already invited, which is a no-op', async () => {
    ctx.session = ALUMNUS;
    const again = await invitePOST(req('POST', '/api/invitations', one('Ravi.Kumar@Example.com')));
    const fresh = await invitePOST(req('POST', '/api/invitations', one('brand.new@example.com')));
    expect(again.status).toBe(fresh.status);
    const a = await read(again);
    const f = await read(fresh);
    expect(a.accepted).toBe(f.accepted);
    expect(a.note).toBe(f.note);
    // The only difference is that nothing new was stored for the one already invited.
    expect(a.invitations).toEqual([]);
    expect(f.invitations).toHaveLength(1);
  });

  it('lowercases an address, so case is not a way round the cap', async () => {
    ctx.session = ALUMNUS;
    const out = await read(await invitePOST(req('POST', '/api/invitations', one('MixedCase@Example.COM'))));
    expect(out.invitations[0].email).toBe('mixedcase@example.com');
  });

  it('refuses a malformed address and more than five at a time', async () => {
    ctx.session = ALUMNUS;
    expect((await invitePOST(req('POST', '/api/invitations', one('not-an-email')))).status).toBe(422);
    const six = { invitations: Array.from({ length: 6 }, (_, i) => ({ email: `p${i}@example.com` })) };
    expect((await invitePOST(req('POST', '/api/invitations', six))).status).toBe(422);
    expect((await invitePOST(req('POST', '/api/invitations', { invitations: [] }))).status).toBe(422);
  });

  it('does not copy the addresses into the audit log', async () => {
    ctx.session = ALUMNUS;
    await invitePOST(req('POST', '/api/invitations', one('private.friend@example.com', { name: 'Private Friend' })));
    const entry = lastAudit();
    expect(entry.action).toBe('invitation.create');
    expect(JSON.stringify(entry)).not.toContain('private.friend');
    expect(JSON.stringify(entry)).not.toContain('Private Friend');
    expect(entry.after).toEqual({ count: 1 });
  });

  it('stops at the weekly limit, with a retry-after, and does not stop anyone else', async () => {
    const filler = Array.from({ length: INVITE_WEEKLY_LIMIT - 1 }, (_, i) => ({
      id: `inv-route-${i}`,
      inviterId: ALUMNUS.memberId,
      email: `route.${i}@example.com`,
      name: null,
      batchYear: null,
      message: null,
      state: 'sent' as const,
      createdAt: new Date(displayNow().getTime() - 86_400_000).toISOString(),
    }));
    INVITATIONS.push(...filler);
    try {
      ctx.session = ALUMNUS;
      const over = await invitePOST(req('POST', '/api/invitations', one('one.too.many@example.com')));
      expect(over.status).toBe(429);
      expect((await read(over)).code).toBe('invite_quota');
      expect(over.headers.get('retry-after')).toBe('86400');

      ctx.session = HOD;
      expect((await invitePOST(req('POST', '/api/invitations', one('hod.friend@example.com')))).status).toBe(201);
    } finally {
      INVITATIONS.splice(INVITATIONS.length - filler.length, filler.length);
    }
  });

  it('refuses a batch bigger than what is left rather than sending part of it', async () => {
    const filler = Array.from({ length: INVITE_WEEKLY_LIMIT - 3 }, (_, i) => ({
      id: `inv-part-${i}`,
      inviterId: ALUMNUS.memberId,
      email: `part.${i}@example.com`,
      name: null,
      batchYear: null,
      message: null,
      state: 'sent' as const,
      createdAt: new Date(displayNow().getTime() - 86_400_000).toISOString(),
    }));
    INVITATIONS.push(...filler);
    try {
      ctx.session = ALUMNUS;
      // Two remain (the seed holds one this week as well); three are too many.
      const three = { invitations: ['x1', 'x2', 'x3'].map((n) => ({ email: `${n}@example.com` })) };
      const res = await invitePOST(req('POST', '/api/invitations', three));
      expect(res.status).toBe(429);
      expect((await read(res)).error).toMatch(/more this week/);
    } finally {
      INVITATIONS.splice(INVITATIONS.length - filler.length, filler.length);
    }
  });

  it('is a 404 for a college without the module', async () => {
    ctx.session = ALUMNUS;
    ctx.features.invites = false;
    expect((await invitePOST(req('POST', '/api/invitations', one('a@example.com')))).status).toBe(404);
  });
});

// ---------------------------------------------------------------
// Posts
// ---------------------------------------------------------------

describe('POST /api/posts', () => {
  it('publishes an alumnus\'s post on arrival', async () => {
    ctx.session = ALUMNUS;
    const res = await postPOST(req('POST', '/api/posts', POST));
    expect(res.status).toBe(201);
    expect((await read(res)).post).toMatchObject({ state: 'published', groupSlug: null });
  });

  it('normalises tags on the way in', async () => {
    ctx.session = ALUMNUS;
    const out = await read(await postPOST(req('POST', '/api/posts', { ...POST, tags: ['#Hiring', 'Open Source', 'hiring'] })));
    expect(out.post.tags).toEqual(['hiring', 'open-source']);
  });

  it('refuses a post that is too short, too long, or all links', async () => {
    ctx.session = ALUMNUS;
    expect((await postPOST(req('POST', '/api/posts', { ...POST, body: 'Nice.' }))).status).toBe(422);
    expect((await postPOST(req('POST', '/api/posts', { ...POST, body: 'x'.repeat(1201) }))).status).toBe(422);
    const links = 'Look at https://a.example.com and https://b.example.com and https://c.example.com now please.';
    expect((await postPOST(req('POST', '/api/posts', { ...POST, body: links }))).status).toBe(422);
  });

  it('lets an alumnus write in a group they are in and refuses one they are not', async () => {
    ctx.session = ALUMNUS;
    expect((await postPOST(req('POST', '/api/posts', { ...POST, groupSlug: 'hyderabad-chapter' }))).status).toBe(201);
    const stranger = GROUPS.find((g) => g.kind === 'chapter' && !inGroup(ALUMNUS, g.slug))!;
    const res = await postPOST(req('POST', '/api/posts', { ...POST, groupSlug: stranger.slug }));
    expect(res.status).toBe(403);
    expect((await read(res)).code).toBe('not_in_group');
  });

  it('cannot be told its state or its author', async () => {
    ctx.session = ALUMNUS;
    const out = await read(await postPOST(req('POST', '/api/posts', { ...POST, state: 'hidden', authorId: ADMIN.memberId, likeCount: 99 })));
    expect(out.post.state).toBe('published');
    expect(out.post).not.toHaveProperty('authorId');
    expect(out.post).not.toHaveProperty('likeCount');
  });

  it('stores the length of a post in the audit log, not the post', async () => {
    ctx.session = ALUMNUS;
    await postPOST(req('POST', '/api/posts', POST));
    const entry = lastAudit();
    expect(entry.action).toBe('post.create');
    expect(JSON.stringify(entry)).not.toContain('Two openings');
    expect(entry.after).toMatchObject({ bodyLength: POST.body.length });
  });
});

describe('moderating and removing a post', () => {
  const REASON = 'A sales pitch with no role, employer or detail attached to it.';

  it('lets a moderator hide with a reason, and refuses a hide without one', async () => {
    ctx.session = OPERATOR;
    const ok = await postModeratePATCH(req('PATCH', '/api/posts/post-14', { action: 'hide', reason: REASON }), params({ id: 'post-14' }));
    expect(ok.status).toBe(200);
    for (const bad of [{ action: 'hide' }, { action: 'hide', reason: 'no' }]) {
      const res = await postModeratePATCH(req('PATCH', '/api/posts/post-14', bad), params({ id: 'post-14' }));
      expect(res.status, JSON.stringify(bad)).toBe(422);
    }
  });

  it('turns away a member from moderating', async () => {
    ctx.session = ALUMNUS;
    const res = await postModeratePATCH(req('PATCH', '/api/posts/post-14', { action: 'hide', reason: REASON }), params({ id: 'post-14' }));
    expect(res.status).toBe(403);
  });

  it('lets an author remove their own post and nobody else\'s', async () => {
    const post1 = 'post-1'; // by the demo alumnus
    ctx.session = ALUMNUS;
    expect((await postDELETE(req('DELETE', `/api/posts/${post1}`), params({ id: post1 }))).status).toBe(200);

    ctx.session = HOD;
    expect((await postDELETE(req('DELETE', `/api/posts/${post1}`), params({ id: post1 }))).status).toBe(403);

    ctx.session = OPERATOR; // a moderator may remove any
    expect((await postDELETE(req('DELETE', `/api/posts/${post1}`), params({ id: post1 }))).status).toBe(200);
  });

  it('does not confirm that a post exists in a group the caller cannot read', async () => {
    ctx.session = STUDENT;
    const stranger = 'post-3'; // pune-chapter
    const real = await postDELETE(req('DELETE', `/api/posts/${stranger}`), params({ id: stranger }));
    const fake = await postDELETE(req('DELETE', '/api/posts/post-9999'), params({ id: 'post-9999' }));
    expect(real.status).toBe(404);
    expect(fake.status).toBe(404);
  });
});

// ---------------------------------------------------------------
// The showcase
// ---------------------------------------------------------------

describe('PATCH /api/admin/showcase/[slug]', () => {
  const pending = () => SHOWCASE.find((e) => e.state === 'pending_moderation')!;
  const published = () => SHOWCASE.find((e) => e.state === 'published')!;
  const call = (slug: string, body: unknown) =>
    showcaseDecidePATCH(req('PATCH', `/api/admin/showcase/${slug}`, body), params({ slug }));

  it('lets the people who curate approve a pending entry', async () => {
    for (const s of [OPERATOR, ADMIN]) {
      ctx.session = s;
      const res = await call(pending().slug, { action: 'approve' });
      expect(res.status).toBe(200);
      expect((await read(res)).entry.state).toBe('published');
    }
  });

  it('declines only with a reason the member can act on', async () => {
    ctx.session = ADMIN;
    expect((await call(pending().slug, { action: 'decline' })).status).toBe(422);
    expect((await call(pending().slug, { action: 'decline', message: 'No.' })).status).toBe(422);
    const ok = await call(pending().slug, { action: 'decline', message: 'Add the name of the award and a link to where it was announced.' });
    expect(ok.status).toBe(200);
    expect(lastAudit()).toMatchObject({ action: 'showcase.decline' });
  });

  it('refuses to decide the same entry twice, and to take down what is not up', async () => {
    ctx.session = ADMIN;
    expect((await call(published().slug, { action: 'approve' })).status).toBe(409);
    expect((await call(pending().slug, { action: 'unpublish', message: 'Asked to be removed.' })).status).toBe(409);
  });

  it('takes a published entry down at once, with the reason recorded', async () => {
    ctx.session = ADMIN;
    const res = await call(published().slug, { action: 'unpublish', message: 'The person asked to be taken out.' });
    expect(res.status).toBe(200);
    expect(lastAudit()).toMatchObject({ action: 'showcase.unpublish', reason: 'The person asked to be taken out.' });
  });

  it('answers 404 for an address that is not an entry', async () => {
    ctx.session = ADMIN;
    expect((await call('no-such-entry', { action: 'approve' })).status).toBe(404);
  });

  it('will not publish an entry about a member whose agreement is not on record', async () => {
    const record = { ...pending(), id: 'show-route-1', slug: 'route-no-consent', memberId: ALUMNUS.memberId, consentRecordedAt: null, sourceUrl: null };
    SHOWCASE.push(record);
    try {
      ctx.session = ADMIN;
      const res = await call(record.slug, { action: 'approve' });
      expect(res.status).toBe(409);
      const out = await read(res);
      expect(out.code).toBe('cannot_publish');
      expect(out.error).toMatch(/agreement/i);
    } finally {
      SHOWCASE.pop();
    }
  });

  it('will not publish an entry about somebody who is not a member without a public source', async () => {
    const record = { ...pending(), id: 'show-route-2', slug: 'route-no-source', memberId: null, consentRecordedAt: null, sourceUrl: null };
    SHOWCASE.push(record);
    try {
      ctx.session = ADMIN;
      const res = await call(record.slug, { action: 'approve' });
      expect(res.status).toBe(409);
      expect((await read(res)).error).toMatch(/already published/i);
    } finally {
      SHOWCASE.pop();
    }
  });

  it('can still decline an entry it cannot publish', async () => {
    const record = { ...pending(), id: 'show-route-3', slug: 'route-decline-me', memberId: ALUMNUS.memberId, consentRecordedAt: null, sourceUrl: null };
    SHOWCASE.push(record);
    try {
      ctx.session = ADMIN;
      const res = await call(record.slug, { action: 'decline', message: 'Their agreement is not recorded; ask them first.' });
      expect(res.status).toBe(200);
    } finally {
      SHOWCASE.pop();
    }
  });
});

describe('POST /api/admin/showcase', () => {
  const entry = {
    kind: 'prominent',
    category: 'leadership',
    headline: 'Managing Director of a design company',
    summary: 'Runs a three-hundred-person design centre and returns every year to judge final-year projects.',
    displayName: 'Someone Notable',
    publish: false,
  };

  it('refuses an entry about a member without confirmation that they agreed', async () => {
    ctx.session = ADMIN;
    const res = await showcaseCuratePOST(req('POST', '/api/admin/showcase', { ...entry, memberId: ALUMNUS.memberId }));
    expect(res.status).toBe(422);
    expect((await read(res)).fieldErrors.consentConfirmed).toBeDefined();
  });

  it('refuses an entry about a non-member without a source', async () => {
    ctx.session = ADMIN;
    const res = await showcaseCuratePOST(req('POST', '/api/admin/showcase', entry));
    expect(res.status).toBe(422);
    expect((await read(res)).fieldErrors.sourceUrl).toBeDefined();
  });

  it('refuses a source that is not https', async () => {
    ctx.session = ADMIN;
    const res = await showcaseCuratePOST(req('POST', '/api/admin/showcase', { ...entry, sourceUrl: 'http://example.com/press' }));
    expect(res.status).toBe(422);
  });

  it('has no default for publish', async () => {
    ctx.session = ADMIN;
    const { publish: _omitted, ...rest } = entry;
    const res = await showcaseCuratePOST(req('POST', '/api/admin/showcase', { ...rest, sourceUrl: 'https://example.com/press' }));
    expect(res.status).toBe(422);
    expect((await read(res)).fieldErrors.publish).toBeDefined();
  });

  it('records who confirmed a member\'s agreement', async () => {
    ctx.session = ADMIN;
    const res = await showcaseCuratePOST(
      req('POST', '/api/admin/showcase', { ...entry, memberId: ALUMNUS.memberId, consentConfirmed: true, headline: 'Patent granted for a firmware method', publish: true }),
    );
    expect(res.status).toBe(201);
    expect(lastAudit().after).toMatchObject({ basis: { consent: 'confirmed_by_staff', confirmedBy: ADMIN.memberId } });
  });
});

describe('POST /api/showcase (a member putting themselves forward)', () => {
  it('lets an alumnus submit, and always lands in review', async () => {
    ctx.session = ALUMNUS;
    const res = await showcaseSubmitPOST(
      req('POST', '/api/showcase', {
        category: 'research',
        headline: 'Best paper award at a national conference',
        summary: 'For work on fault detection in microgrids, written with two final-year students.',
        state: 'published',
      }),
    );
    expect(res.status).toBe(201);
    expect((await read(res)).entry.state).toBe('pending_moderation');
  });
});

// ---------------------------------------------------------------
// The help desk
// ---------------------------------------------------------------

describe('the help desk: whose ticket is it', () => {
  const mine = TICKETS.find((t) => t.memberId === ALUMNUS.memberId && t.state === 'open')!;
  const closed = TICKETS.find((t) => t.state === 'closed')!;
  const member = (id: string, body: unknown) => ticketReplyPOST(req('POST', `/api/helpdesk/${id}`, body), params({ id }));
  const staff = (id: string, body: unknown) => staffReplyPOST(req('POST', `/api/admin/helpdesk/${id}`, body), params({ id }));

  it('lets the author add to their own ticket', async () => {
    ctx.session = ALUMNUS;
    const res = await member(mine.reference, { body: 'It still does not work this morning.' });
    expect(res.status).toBe(200);
    expect((await read(res)).ticket).toMatchObject({ reference: mine.reference, state: 'open' });
  });

  it('reads another member\'s ticket as not found, the same as one that does not exist', async () => {
    ctx.session = STUDENT;
    const other = await member(mine.reference, { body: 'Let me chip in.' });
    const none = await member('HD-9999', { body: 'Let me chip in.' });
    expect(other.status).toBe(404);
    expect(none.status).toBe(404);
    expect((await read(other)).error).toBe((await read(none)).error);
  });

  it('does not let staff answer through the member door: they have their own, which records who', async () => {
    ctx.session = OPERATOR;
    expect((await member(mine.reference, { body: 'Hello from staff.' })).status).toBe(404);
  });

  it('will not add to a closed question', async () => {
    ctx.session = alumnusSession(closed.memberId);
    const res = await member(closed.reference, { body: 'One more thing.' });
    expect(res.status).toBe(409);
    expect((await read(res)).code).toBe('closed');
  });

  it('lets the people who answer tickets reply, choosing where it goes next', async () => {
    for (const s of [OPERATOR, ADMIN]) {
      ctx.session = s;
      const res = await staff(mine.reference, { body: 'We have fixed this; try again.', state: 'answered' });
      expect(res.status).toBe(200);
      expect((await read(res)).ticket.state).toBe('answered');
    }
  });

  it('will not let a staff reply leave a ticket in an undefined state', async () => {
    ctx.session = OPERATOR;
    expect((await staff(mine.reference, { body: 'Fixed.' })).status).toBe(422);
    expect((await staff(mine.reference, { body: 'Fixed.', state: 'open' })).status).toBe(422);
  });

  it('keeps what staff said to a member out of the audit log', async () => {
    ctx.session = OPERATOR;
    await staff(mine.reference, { body: 'A private note about your account that stays between us.', state: 'closed' });
    const entry = lastAudit();
    expect(entry.action).toBe('helpdesk.reply');
    expect(JSON.stringify(entry)).not.toContain('private note');
    expect(entry.after).toMatchObject({ state: 'closed' });
  });

  it('turns away a member from the staff door and the vendor too', async () => {
    for (const s of [ALUMNUS, STUDENT, VENDOR]) {
      ctx.session = s;
      expect((await staff(mine.reference, { body: 'Hello.', state: 'answered' })).status, String(s.memberId)).toBe(403);
    }
  });
});

// ---------------------------------------------------------------
// Businesses
// ---------------------------------------------------------------

describe('POST /api/businesses', () => {
  const listing = {
    name: 'Tallapragada Brewing',
    industry: 'Agriculture and food',
    description: 'A small craft brewery supplying restaurants across Vijayawada and Guntur, with a taproom open at weekends.',
    city: 'Vijayawada',
    country: 'IN',
  };

  it('has an industry the app accepts', async () => {
    const { BUSINESS_INDUSTRIES } = await import('../src/lib/community');
    expect(BUSINESS_INDUSTRIES).toContain(listing.industry);
  });

  it('always lands in review, whatever the request says', async () => {
    ctx.session = ALUMNUS;
    const res = await businessPOST(req('POST', '/api/businesses', { ...listing, status: 'live', moderationNote: 'ok' }));
    expect(res.status).toBe(201);
    expect((await read(res)).business.status).toBe('pending_moderation');
  });

  it('refuses a promise of returns', async () => {
    ctx.session = ALUMNUS;
    const res = await businessPOST(
      req('POST', '/api/businesses', { ...listing, description: 'Plots and apartments with guaranteed returns of thirty percent a year, no questions asked.' }),
    );
    expect(res.status).toBe(422);
    expect((await read(res)).fieldErrors.description).toMatch(/guaranteed returns/i);
  });

  it('keeps contact details and the choice to share them in step', async () => {
    ctx.session = ALUMNUS;
    const hidden = await businessPOST(req('POST', '/api/businesses', { ...listing, contactEmail: 'hello@example.com' }));
    expect(hidden.status).toBe(422);
    const empty = await businessPOST(req('POST', '/api/businesses', { ...listing, showContact: true }));
    expect(empty.status).toBe(422);
    const ok = await businessPOST(req('POST', '/api/businesses', { ...listing, showContact: true, contactEmail: 'hello@example.com' }));
    expect(ok.status).toBe(201);
  });

  it('refuses a website that is not https', async () => {
    ctx.session = ALUMNUS;
    expect((await businessPOST(req('POST', '/api/businesses', { ...listing, website: 'http://example.com' }))).status).toBe(422);
    expect((await businessPOST(req('POST', '/api/businesses', { ...listing, website: 'javascript:alert(1)' }))).status).toBe(422);
  });

  it('keeps contact details out of the audit log', async () => {
    ctx.session = ALUMNUS;
    await businessPOST(req('POST', '/api/businesses', { ...listing, showContact: true, contactEmail: 'secret.owner@example.com', contactPhone: '+91 90000 00099' }));
    const entry = lastAudit();
    expect(entry.action).toBe('business.submit');
    expect(JSON.stringify(entry)).not.toContain('secret.owner');
    expect(JSON.stringify(entry)).not.toContain('90000 00099');
  });

  it('refuses a listing whose address is taken, in any state', async () => {
    ctx.session = ALUMNUS;
    const res = await businessPOST(req('POST', '/api/businesses', { ...listing, name: 'Nimbus Cloud Labs' }));
    expect(res.status).toBe(409);
    expect((await read(res)).code).toBe('slug_taken');
  });
});

// ---------------------------------------------------------------
// Groups
// ---------------------------------------------------------------

describe('joining and leaving groups', () => {
  const join = (slug: string, action: 'join' | 'leave' = 'join') =>
    membershipPOST(req('POST', `/api/groups/${slug}/membership`, { action }), params({ slug }));

  it('hides every chapter from a student, so joining one is a 404 and not a refusal', async () => {
    ctx.session = STUDENT;
    const res = await join('hyderabad-chapter');
    expect(res.status).toBe(404);
  });

  it('lets a student join an interest group they are not in', async () => {
    ctx.session = STUDENT;
    const res = await join('embedded-and-iot');
    expect(res.status).toBe(200);
    expect((await read(res)).membership).toEqual({ groupSlug: 'embedded-and-iot', state: 'active' });
  });

  it('refuses a second join, naming why', async () => {
    ctx.session = STUDENT;
    const res = await join('ai-and-ml');
    expect(res.status).toBe(409);
    expect((await read(res)).code).toBe('cannot_join');
  });

  it('answers a join to an approval group with a request, never with membership', async () => {
    const joiner = [HOD, FACULTY, FINANCE].find((s) => !inGroup(s, 'startups-and-founders'))!;
    ctx.session = joiner;
    const res = await join('startups-and-founders');
    expect(res.status).toBe(200);
    expect((await read(res)).membership.state).toBe('requested');
  });

  it('refuses to let the only lead walk away', async () => {
    const group = GROUPS.find((g) => g.slug === 'hyderabad-chapter')!;
    const others = GROUP_MEMBERSHIPS.filter((r) => r.groupId === group.id && r.role === 'lead' && r.memberId !== ALUMNUS.memberId);
    expect(others.length).toBeGreaterThan(0);
    others.forEach((r) => (r.role = 'member'));
    try {
      ctx.session = ALUMNUS;
      const res = await join('hyderabad-chapter', 'leave');
      expect(res.status).toBe(409);
      expect((await read(res)).code).toBe('last_lead');
    } finally {
      others.forEach((r) => (r.role = 'lead'));
    }
  });

  it('lets a lead leave when another lead remains', async () => {
    ctx.session = ALUMNUS;
    expect((await join('hyderabad-chapter', 'leave')).status).toBe(200);
  });

  it('says nothing of a group that does not exist differently from one the caller may not see', async () => {
    ctx.session = STUDENT;
    const chapter = await join('hyderabad-chapter');
    const nothing = await join('no-such-group');
    expect(chapter.status).toBe(nothing.status);
  });
});

describe('PATCH /api/groups/[slug]/requests', () => {
  const waiting = () => GROUP_MEMBERSHIPS.find((r) => r.groupId === 'grp-startups-and-founders' && r.state === 'requested')!;
  const decide = (slug: string, body: unknown) => joinDecidePATCH(req('PATCH', `/api/groups/${slug}/requests`, body), params({ slug }));

  it('lets a lead decide', async () => {
    ctx.session = ALUMNUS;
    const res = await decide('startups-and-founders', { memberId: waiting().memberId, action: 'approve' });
    expect(res.status).toBe(200);
  });

  it('lets the alumni cell decide', async () => {
    ctx.session = OPERATOR;
    expect((await decide('startups-and-founders', { memberId: waiting().memberId, action: 'decline' })).status).toBe(200);
  });

  it('refuses an ordinary member of the group, a student and the vendor', async () => {
    const ordinary = alumnusSession(
      GROUP_MEMBERSHIPS.find((r) => r.groupId === 'grp-startups-and-founders' && r.role === 'member' && r.state === 'active')!.memberId,
    );
    for (const s of [ordinary, STUDENT, VENDOR]) {
      ctx.session = s;
      const res = await decide('startups-and-founders', { memberId: waiting().memberId, action: 'approve' });
      expect(res.status, String(s.memberId)).toBe(403);
    }
  });

  it('refuses a lead of a different group', async () => {
    ctx.session = ALUMNUS;
    const other = GROUPS.find((g) => g.slug !== 'startups-and-founders' && g.slug !== 'hyderabad-chapter')!;
    const res = await decide(other.slug, { memberId: waiting().memberId, action: 'approve' });
    expect(res.status).toBe(403);
  });

  it('knows nothing of a person who has no request waiting', async () => {
    ctx.session = ALUMNUS;
    const res = await decide('startups-and-founders', { memberId: STUDENT.memberId, action: 'approve' });
    expect(res.status).toBe(404);
  });
});
