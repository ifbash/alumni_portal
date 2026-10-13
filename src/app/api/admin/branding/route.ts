import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenant } from '@/lib/tenant';
import { validateBranding, BrandingInput } from '@/lib/branding/config';
import { invalidateBranding } from '@/lib/branding/resolve';
import { buildTokens, tokensToCss, contrastReport } from '@/lib/branding/tokens';
import { resolvePack, listPacks } from '@/lib/branding/registry';
import { BrandPack } from '@/lib/branding/pack';
import { logAudit } from '@/lib/audit/log';
import { IS_FIXTURE } from '@/lib/config';
import { clientIp, fail, HttpError, json, limit, readJson } from '../../_lib/http';
import { z } from 'zod';

/**
 * Branding admin API.
 *
 * Three operations, all going through the same resolver the renderer
 * uses, so what an administrator previews is byte-for-byte what ships:
 *
 *   GET            — current pack, available base packs, contrast report
 *   POST ?preview=1 — validate and return CSS without persisting
 *   POST            — validate, persist, invalidate the cache, audit
 *
 * Contrast *errors* block publication; warnings do not. A college that
 * picks a marginal accent should be told, not stopped. Body text nobody
 * can read is a different category and is refused.
 */

export async function GET() {
  try {
    const session = await getSession();
    requireCap(session, 'tenant.configure');

    const tenant = await getTenant();
    if (!tenant) throw new HttpError(404, 'unknown_tenant', 'Unknown tenant');

    const pack = resolvePack({ packId: tenant.packId });
    const tokens = buildTokens(pack);

    return json({
      pack,
      basePacks: listPacks(),
      report: contrastReport(pack),
      tokens: { light: tokens.light, dark: tokens.dark, base: tokens.base },
    });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireCap(session, 'tenant.configure');

    const tenant = await getTenant();
    if (!tenant) throw new HttpError(404, 'unknown_tenant', 'Unknown tenant');

    const url = new URL(request.url);
    const isPreview = url.searchParams.get('preview') === '1';

    const payload = await readJson(request, z.unknown());
    const result = validateBranding(payload);

    if (result.report === null) {
      throw new HttpError(422, 'invalid_input', 'Invalid branding', { fieldErrors: result.fieldErrors });
    }

    // Preview never persists and never blocks — an admin has to be able
    // to *see* the failing combination in order to understand the report.
    if (isPreview) {
      return json({
        css: result.css,
        fontHref: result.fontHref,
        report: result.report,
        publishable: result.ok,
      });
    }

    // Publishing is rate limited; previewing is not, because the Branding Studio
    // previews as the administrator moves a colour.
    limit(
      `branding:${session.memberId}`,
      60,
      60 * 60,
      'Sixty published branding changes an hour is the limit. Previewing is not counted - keep adjusting, and publish when it looks right.',
    );

    if (!result.ok) {
      throw new HttpError(422, 'contrast_failure', 'These colours fail accessibility checks and cannot be published.', {
        report: result.report,
      });
    }

    // `validateBranding` has already accepted this payload, so this parse
    // cannot fail on shape - it narrows the type.
    const parsed = BrandingInput.parse(payload);

    if (!IS_FIXTURE) {
      // Through withTenant: tenant_branding is under row-level security, and
      // a read or write with no tenant context sees and changes nothing.
      const { withTenant } = await import('@/lib/db/client');
      const before = await withTenant(tenant.id, (tx) =>
        tx.tenantBranding.findUnique({ where: { tenantId: tenant.id } }),
      );

      await withTenant(tenant.id, (tx) => tx.tenantBranding.upsert({
        where: { tenantId: tenant.id },
        create: {
          tenantId: tenant.id,
          portalName: parsed.portalName,
          tagline: parsed.tagline ?? null,
          primaryHex: parsed.primary,
          accentHex: parsed.accent ?? null,
          surfaceHex: parsed.surface,
          surfaceDarkHex: parsed.surfaceDark,
          logoPrimary: parsed.logoPrimary ?? null,
          logoInverse: parsed.logoInverse ?? null,
          logoMark: parsed.logoMark ?? null,
          crest: parsed.crest ?? null,
          ogImage: parsed.ogImage ?? null,
          heroImage: parsed.heroImage ?? null,
          fontDisplay: parsed.fontDisplay,
          fontBody: parsed.fontBody,
          radius: parsed.radius,
          supportEmail: parsed.supportEmail ?? null,
          published: true,
        },
        update: {
          portalName: parsed.portalName,
          tagline: parsed.tagline ?? null,
          primaryHex: parsed.primary,
          accentHex: parsed.accent ?? null,
          surfaceHex: parsed.surface,
          surfaceDarkHex: parsed.surfaceDark,
          logoPrimary: parsed.logoPrimary ?? null,
          logoInverse: parsed.logoInverse ?? null,
          logoMark: parsed.logoMark ?? null,
          crest: parsed.crest ?? null,
          ogImage: parsed.ogImage ?? null,
          heroImage: parsed.heroImage ?? null,
          fontDisplay: parsed.fontDisplay,
          fontBody: parsed.fontBody,
          radius: parsed.radius,
          supportEmail: parsed.supportEmail ?? null,
          published: true,
          updatedAt: new Date(),
        },
      }));

      await logAudit({
        tenantId: tenant.id,
        session,
        action: 'branding.publish',
        resource: 'tenant_branding',
        resourceId: tenant.id,
        before,
        after: parsed,
        ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
      });
    } else {
      await logAudit({
        tenantId: tenant.id,
        session,
        action: 'branding.publish',
        resource: 'tenant_branding',
        resourceId: tenant.id,
        after: parsed,
        ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
      });
    }

    invalidateBranding(tenant.id);

    return json({
      ok: true,
      report: result.report,
      css: result.css,
    });
  } catch (err) {
    return fail(err);
  }
}

/**
 * Export the tenant's full pack as JSON.
 *
 * This is the white-label seam made concrete: an administrator can
 * download exactly the file that goes into `brands/`, hand it to a
 * designer, and paste the result back. It is also how a demo tenant
 * becomes a real one without anyone retyping eleven colour values.
 */
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    requireCap(session, 'tenant.configure');

    const tenant = await getTenant();
    if (!tenant) throw new HttpError(404, 'unknown_tenant', 'Unknown tenant');

    const body = await readJson(request, z.unknown());
    const parsed = BrandPack.safeParse(body);

    if (!parsed.success) {
      throw new HttpError(422, 'invalid_pack', 'That is not a valid brand pack.', {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const tokens = buildTokens(parsed.data);

    return json({
      ok: !tokens.blocking,
      pack: parsed.data,
      css: tokensToCss(tokens),
      report: contrastReport(parsed.data),
    });
  } catch (err) {
    return fail(err);
  }
}
