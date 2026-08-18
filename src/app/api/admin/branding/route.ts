import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { require as requireCap, toResponse } from '@/lib/auth/guard';
import { getTenant } from '@/lib/tenant';
import { validateBranding, BrandingInput } from '@/lib/branding/config';
import { invalidateBranding } from '@/lib/branding/resolve';
import { buildTokens, tokensToCss, contrastReport } from '@/lib/branding/tokens';
import { resolvePack, listPacks } from '@/lib/branding/registry';
import { BrandPack } from '@/lib/branding/pack';
import { logAudit } from '@/lib/audit/log';
import { IS_FIXTURE } from '@/lib/config';

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
    if (!tenant) return NextResponse.json({ error: 'Unknown tenant' }, { status: 404 });

    const pack = resolvePack({ packId: tenant.packId });
    const tokens = buildTokens(pack);

    return NextResponse.json({
      pack,
      basePacks: listPacks(),
      report: contrastReport(pack),
      tokens: { light: tokens.light, dark: tokens.dark, base: tokens.base },
    });
  } catch (err) {
    const { status, body } = toResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    requireCap(session, 'tenant.configure');

    const tenant = await getTenant();
    if (!tenant) return NextResponse.json({ error: 'Unknown tenant' }, { status: 404 });

    const url = new URL(request.url);
    const isPreview = url.searchParams.get('preview') === '1';

    const payload = await request.json();
    const result = validateBranding(payload);

    if (result.report === null) {
      return NextResponse.json({ error: 'Invalid branding', fieldErrors: result.fieldErrors }, { status: 422 });
    }

    // Preview never persists and never blocks — an admin has to be able
    // to *see* the failing combination in order to understand the report.
    if (isPreview) {
      return NextResponse.json({
        css: result.css,
        fontHref: result.fontHref,
        report: result.report,
        publishable: result.ok,
      });
    }

    if (!result.ok) {
      return NextResponse.json(
        { error: 'These colours fail accessibility checks and cannot be published.', report: result.report },
        { status: 422 },
      );
    }

    const parsed = BrandingInput.parse(payload);

    if (!IS_FIXTURE) {
      const { prisma } = await import('@/lib/db/client');
      const before = await prisma.tenantBranding.findUnique({ where: { tenantId: tenant.id } });

      await prisma.tenantBranding.upsert({
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
      });

      await logAudit({
        tenantId: tenant.id,
        session,
        action: 'branding.publish',
        resource: 'tenant_branding',
        resourceId: tenant.id,
        before,
        after: parsed,
        ip: request.headers.get('x-forwarded-for'),
      });
    } else {
      await logAudit({
        tenantId: tenant.id,
        session,
        action: 'branding.publish',
        resource: 'tenant_branding',
        resourceId: tenant.id,
        after: parsed,
      });
    }

    invalidateBranding(tenant.id);

    return NextResponse.json({
      ok: true,
      report: result.report,
      css: result.css,
    });
  } catch (err) {
    const { status, body } = toResponse(err);
    return NextResponse.json(body, { status });
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
    if (!tenant) return NextResponse.json({ error: 'Unknown tenant' }, { status: 404 });

    const body = await request.json();
    const parsed = BrandPack.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'That is not a valid brand pack.',
          issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
        { status: 422 },
      );
    }

    const tokens = buildTokens(parsed.data);

    return NextResponse.json({
      ok: !tokens.blocking,
      pack: parsed.data,
      css: tokensToCss(tokens),
      report: contrastReport(parsed.data),
    });
  } catch (err) {
    const { status, body } = toResponse(err);
    return NextResponse.json(body, { status });
  }
}
