import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
// The only import from the repository, and deliberately so. This handler
// creates a college; it must never be able to read one's people. Nothing
// that returns a member record is in scope here, and `getTenants` returns
// tenant summaries — names, subdomains, counts — and no member row.
import { getTenants } from '@/lib/data/repo';
import { PACKS } from '@/lib/branding/registry';
import { logAudit } from '@/lib/audit/log';
import { clientIp, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../_lib/http';

/**
 * Provisioning a college.
 *
 * Four properties carry the whole endpoint:
 *
 *  1. **`dryRun` is stated, never defaulted.** There is no body shape that
 *     creates a tenant by omission. The step-three summary is a dry run;
 *     the button is the same call with the flag flipped and the subdomain
 *     typed back. A preview built by a different code path from the write
 *     is a preview of something else.
 *  2. **The server names what it would create.** The console does not get
 *     to describe the rows — it renders the list this handler returns. A
 *     client-side guess drifts the moment the schema does, and the one
 *     screen where a drifting description is expensive is the one that
 *     creates a college with a permanent address.
 *  3. **The subdomain is checked against two namespaces.** Existing
 *     tenants, obviously — and the brand pack registry, because
 *     `getTenant()` resolves a bare pack id as a tenant when no row
 *     matches. A college that took `northgate` would be served the
 *     demonstration pack's identity on every request that missed the row.
 *  4. **It cannot read a member.** A platform admin holds
 *     `tenant.provision`, `tenant.configure` and `audit.read`, and no
 *     capability that reads a member row. Provisioning a college does not
 *     make anyone at ifBash a member of it, and this handler is where that
 *     claim is either true or marketing.
 *
 * Isolation itself is not created here. The row-level security policies
 * already exist on all nineteen tables; provisioning adds a tenant id for
 * them to key off, and every request for the college opens with
 * `SET LOCAL app.tenant_id`. Isolation is enforced in Postgres, not in
 * application code.
 */

// ---------------------------------------------------------------
// Input
// ---------------------------------------------------------------

/**
 * Two to thirty-two characters, no leading or trailing hyphen. Kept
 * identical to the console's own check so a name that reads as free on
 * screen is free here — the real guarantee is the unique index, and this
 * is the courtesy that stops someone typing a full form to find that out.
 */
const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,30})[a-z0-9]$/;

/**
 * Names the platform itself answers on. A tenant holding `api` or `www`
 * would shadow infrastructure on every request.
 *
 * This list is duplicated in the provisioning page, which uses it to
 * colour the availability note as you type. Both are courtesies; this one
 * is the check that counts.
 */
const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'app', 'admin', 'platform', 'portal', 'auth', 'login',
  'mail', 'smtp', 'static', 'assets', 'cdn', 'status', 'docs', 'help',
  'support', 'dashboard', 'ifbash', 'staging', 'preview', 'test',
]);

const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in',
  'outlook.com', 'hotmail.com', 'live.com', 'rediffmail.com',
]);

/**
 * Every module, stated. No defaults: a missing flag must not be able to
 * switch a module on for a college that never asked for it, and giving in
 * particular is a legal gate rather than a rollout preference.
 */
const Features = z.object({
  directory: z.boolean(),
  connections: z.boolean(),
  events: z.boolean(),
  jobs: z.boolean(),
  mentorship: z.boolean(),
  donations: z.boolean(),
  gallery: z.boolean(),
  news: z.boolean(),
  whatsapp: z.boolean(),
  publicLanding: z.boolean(),
});

const PLANS = ['trial', 'standard', 'institution'] as const;
const FCRA = ['unknown', 'registered', 'not_registered'] as const;

const Body = z
  .object({
    dryRun: z.boolean({
      required_error:
        'Say whether this is a dry run. There is no default — a missing flag on this endpoint must never mean "create the college".',
      invalid_type_error: 'dryRun is true or false.',
    }),

    institutionName: z
      .string()
      .trim()
      .min(4, 'The registered name of the institution, as it appears on a degree certificate.')
      .max(120),
    shortName: z
      .string()
      .trim()
      .min(1, 'The abbreviation staff actually say out loud — DIET, KIET, SVU.')
      .max(24, 'Twenty-four characters at most. This sits next to the crest in the sidebar.'),
    subdomain: z
      .string()
      .trim()
      .toLowerCase()
      .min(2, 'Two characters at least.')
      .max(32, 'Thirty-two characters at most.')
      .regex(
        SUBDOMAIN_RE,
        'Lowercase letters, digits and hyphens, not starting or ending with a hyphen.',
      ),
    packId: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]{2,32}$/, 'A brand pack id, as it appears in brands/.'),
    adminEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email('A working address for the person who will hold college_admin. The first invite goes here.')
      .max(160),
    plan: z.enum(PLANS),
    fcra: z.enum(FCRA),
    features: Features,
    requestDegreeRegister: z.boolean(),

    /**
     * Typed back on execute, exactly as the console asks for it on screen.
     * The subdomain is the one value that cannot be changed afterwards
     * without breaking every link the college has already shared, so it is
     * the value the confirmation asks for.
     */
    confirm: z.string().trim().max(64).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.dryRun && value.confirm?.toLowerCase() !== value.subdomain) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirm'],
        message: `Type ${value.subdomain} to confirm the subdomain. It becomes the college's permanent address and cannot be changed afterwards.`,
      });
    }

    // Giving is a legal gate, not a default that can be flipped later in
    // the database. Donations carry source_country and
    // is_foreign_contribution from the first rupee; segregation cannot be
    // applied retrospectively at audit time.
    if (value.features.donations && value.fcra !== 'registered') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['features', 'donations'],
        message:
          'Giving stays off until the college trust’s FCRA registration is confirmed in writing. Foreign contributions have to be segregated at the point of collection or not collected at all.',
      });
    }
  });

type ProvisionBody = z.infer<typeof Body>;

// ---------------------------------------------------------------
// What provisioning creates, described by the thing that would create it
// ---------------------------------------------------------------

interface PlanField {
  label: string;
  value: string;
}

interface PlanItem {
  /** Stable key; the console maps it to an icon. Wording comes from here. */
  key: 'tenant' | 'rls' | 'branding' | 'invite' | 'audit';
  title: string;
  detail: string;
  fields: PlanField[];
}

interface PlanOmission {
  title: string;
  detail: string;
}

function buildPlan(
  body: ProvisionBody,
  ids: { tenantId: string; host: string; actorMemberId: string; auditScope: string },
) {
  const modulesOn = (Object.entries(body.features) as Array<[string, boolean]>)
    .filter(([, on]) => on)
    .map(([key]) => key);

  const creates: PlanItem[] = [
    {
      key: 'tenant',
      title: 'A row in tenants',
      detail:
        'The college itself. Every other table in the schema carries this id and a policy that compares it against the session variable set at the start of the request.',
      fields: [
        { label: 'id', value: ids.tenantId },
        { label: 'name', value: body.institutionName },
        { label: 'short_name', value: body.shortName },
        { label: 'subdomain', value: body.subdomain },
        { label: 'plan', value: body.plan },
        { label: 'status', value: 'provisioning' },
        { label: 'fcra_registered', value: String(body.fcra === 'registered') },
        { label: 'region', value: 'ap-south-1' },
      ],
    },
    {
      key: 'rls',
      title: 'An RLS-scoped request context',
      detail:
        'Nothing is created here — the policies already exist on all nineteen tables. Every request for this college opens by setting the tenant id, and every policy keys off it. A query that forgets its tenant clause returns nothing, not another college’s rows.',
      fields: [
        { label: 'statement', value: `SET LOCAL app.tenant_id = '${ids.tenantId}'` },
        { label: 'enforced_in', value: 'PostgreSQL row-level security, not application code' },
      ],
    },
    {
      key: 'branding',
      title: 'A row in tenant_branding',
      detail:
        'The starting identity. The pack file is the base; the college edits its own record from its branding console and the design system derives ramps, dark mode and every text-on-fill pairing from the seeds.',
      fields: [
        { label: 'pack_id', value: body.packId },
        { label: 'version', value: '1' },
        { label: 'token_overrides', value: 'none' },
        { label: 'published', value: 'false' },
      ],
    },
    {
      key: 'invite',
      title: 'One college_admin invite',
      detail:
        'A members row at status invited, with a single role grant and no department scope. They sign in with an email OTP and grant every other role themselves. Nobody at ifBash holds a role inside this tenant.',
      fields: [
        { label: 'members.status', value: 'invited' },
        { label: 'email', value: body.adminEmail },
        { label: 'roles', value: 'college_admin' },
        { label: 'department_scope', value: 'none' },
        { label: 'credential', value: 'email OTP' },
      ],
    },
    {
      key: 'audit',
      title: 'An entry in audit_log',
      detail:
        'Append-only: no capability in the matrix edits or deletes this table. It is written in the audit scope of the account doing the provisioning rather than the new college’s, because that account is not — and never becomes — a member of the college it created, so an entry filed inside the new tenant would be readable by nobody.',
      fields: [
        { label: 'action', value: 'tenant.provision' },
        { label: 'resource', value: `tenants/${ids.tenantId}` },
        { label: 'actor_member_id', value: ids.actorMemberId },
        { label: 'audit_scope', value: ids.auditScope },
        { label: 'snapshot', value: 'after: the whole tenant row, including subdomain and pack' },
      ],
    },
  ];

  const notCreated: PlanOmission[] = [
    {
      title: 'No member data',
      detail:
        'Not one row in members beyond the single admin invite. The college loads its own people, and no capability held here can read them afterwards.',
    },
    {
      title: 'No degree register',
      detail: body.requestDegreeRegister
        ? 'A request goes to the examinations branch for roll number, name, branch and year of passing for every batch. Until that file arrives, verification is a manual decision made against no evidence.'
        : 'Nothing is requested. Alumni verification will have no source of truth to match a self-registration against.',
    },
    {
      title: body.features.donations ? 'No campaigns or payment keys' : 'No giving module',
      detail: body.features.donations
        ? 'Giving is enabled, but campaigns, Razorpay keys and 80G receipt numbering are configured by the college, not here.'
        : 'Locked until the FCRA registration status of the college trust is confirmed. Not a default that can be flipped later in the database.',
    },
  ];

  const warnings: string[] = [];

  const emailDomain = body.adminEmail.split('@')[1] ?? '';
  if (FREE_MAIL.has(emailDomain)) {
    warnings.push(
      `The only administrator account would be a personal mailbox (${emailDomain}). A college-domain address survives the person who set the portal up; a personal one makes the next registrar’s account recovery a support ticket to us.`,
    );
  }

  if (modulesOn.length === 0) {
    warnings.push(
      'Every module is switched off. The college_admin would sign in to an empty portal with nothing but the member list they have not loaded yet.',
    );
  }

  if (!body.features.directory && modulesOn.length > 0) {
    warnings.push(
      'The directory is off and other modules are on. Connections, mentorship and jobs all assume members can find each other first.',
    );
  }

  if (!body.requestDegreeRegister) {
    warnings.push(
      'No degree register has been requested. It has the longest lead time of anything in onboarding and every part of alumni verification is blocked on it — chase it on day one, not in week six.',
    );
  }

  return {
    tenantId: ids.tenantId,
    subdomain: body.subdomain,
    host: ids.host,
    packId: body.packId,
    plan: body.plan,
    modulesOn,
    creates,
    notCreated,
    warnings,
    isolation:
      'Tenant isolation is enforced in Postgres by row-level security on app.tenant_id, not in application code. Postgres and object storage stay in ap-south-1, so no tenant data crosses a border and DPDP cross-border transfer rules stay out of scope.',
  };
}

/**
 * The college's address, as this deployment would actually resolve it.
 *
 * Tenants are resolved from the Host header, so the honest answer is the
 * platform's own host with the subdomain in front of it. In development
 * that is `kiet.localhost:3000`, which is exactly right — `getTenant()`
 * reads `.localhost` subdomains.
 */
function hostFor(request: Request, subdomain: string): string {
  const root = request.headers.get('host')?.trim().toLowerCase();
  if (!root) return `${subdomain}.alumni.ifbash.com`;
  return `${subdomain}.${root}`;
}

// ---------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireCap(session, 'tenant.provision');

    const body = await readJson(request, Body);

    limit(
      body.dryRun ? `tenant-plan:${session.memberId}` : `tenant-provision:${session.memberId}`,
      body.dryRun ? 60 : 5,
      60 * 60,
      body.dryRun
        ? 'Sixty provisioning previews in an hour is the limit. The plan does not move between one and the next.'
        : 'Five provisioning attempts in an hour is the limit. A college has a permanent address; if two attempts have already failed, read the error rather than trying a third.',
    );

    // The pack has to exist before anything else is worth checking: a
    // tenant pointed at a pack that is not in `brands/` renders the neutral
    // fallback on every page and looks like an outage.
    if (!PACKS[body.packId]) {
      throw new HttpError(
        422,
        'unknown_pack',
        `There is no brand pack called “${body.packId}”. Packs are the JSON files in brands/, and a tenant pointed at a missing one falls back to a neutral identity on every page.`,
        {
          fieldErrors: {
            packId: 'Pick one of the packs in the registry.',
          },
          available: Object.keys(PACKS),
        },
      );
    }

    if (RESERVED_SUBDOMAINS.has(body.subdomain)) {
      throw new HttpError(
        409,
        'subdomain_reserved',
        `“${body.subdomain}” is reserved for platform infrastructure — the platform itself answers on that name, and a college holding it would shadow infrastructure on every request. Pick another.`,
        { subdomain: body.subdomain, fieldErrors: { subdomain: 'Reserved for platform infrastructure.' } },
      );
    }

    // A subdomain that matches a brand pack id resolves to that pack's
    // identity whenever the tenant row is missed — during provisioning,
    // during a failover, during a migration. Two namespaces, one host
    // header, so both have to be clear.
    if (PACKS[body.subdomain]) {
      throw new HttpError(
        409,
        'subdomain_shadows_pack',
        `The brand pack “${body.subdomain}” already answers on that subdomain. A tenant sharing the name would be served the pack's identity on any request that missed the tenant row, so the two namespaces are kept apart.`,
        { subdomain: body.subdomain, fieldErrors: { subdomain: 'A brand pack already uses that name.' } },
      );
    }

    const clash = getTenants().find((t) => t.subdomain === body.subdomain);
    if (clash) {
      throw new HttpError(
        409,
        'subdomain_taken',
        `${clash.name} already serves from ${body.subdomain}. A subdomain is a college's permanent address and cannot be shared or handed on.`,
        { subdomain: body.subdomain, fieldErrors: { subdomain: `${clash.name} already serves from that subdomain.` } },
      );
    }

    const tenantId = `ten-${body.subdomain}`;

    const plan = buildPlan(body, {
      tenantId,
      host: hostFor(request, body.subdomain),
      actorMemberId: session.memberId,
      auditScope: session.tenantId,
    });

    if (body.dryRun) {
      return json({
        ok: true,
        dryRun: true,
        ...plan,
        note: 'Nothing has been written and no name has been held. Confirming runs the same checks again, writes the audit entry, and creates the five rows above in one transaction — if any of them fails, none of them lands.',
      });
    }

    const after = {
      id: tenantId,
      name: body.institutionName,
      shortName: body.shortName,
      subdomain: body.subdomain,
      host: plan.host,
      packId: body.packId,
      plan: body.plan,
      status: 'provisioning',
      fcra: body.fcra,
      fcraRegistered: body.fcra === 'registered',
      features: body.features,
      degreeRegisterRequested: body.requestDegreeRegister,
      adminInvite: { email: body.adminEmail, role: 'college_admin', status: 'invited' },
      region: 'ap-south-1',
    };

    await logAudit({
      // The actor's own scope, not the new college's. The account that
      // provisions a tenant holds no role inside it, so an entry filed
      // there would be readable by nobody — least of all by the people who
      // have to answer "who created this college, and when".
      tenantId: session.tenantId,
      session,
      action: 'tenant.provision',
      resource: 'tenants',
      resourceId: tenantId,
      reason: null,
      // A create has no before. Recorded as null rather than omitted, so
      // the entry reads the same shape as an edit does.
      before: null,
      after,
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();
    const provisionedAt = new Date().toISOString();

    return json(
      {
        ok: true,
        dryRun: false,
        ...write,
        ...plan,
        provisionedAt,
        auditedAs: 'tenant.provision',
        note: `The capability guard, the subdomain checks against both namespaces and the audit entry all ran. ${body.subdomain} is described above exactly as it would be written; this build has no writable store behind it, so no row was stored.`,
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(err);
  }
}
