import { cache } from 'react';
import { IS_FIXTURE } from '../config';
import { BrandPack, type BrandPackInput, type DeepPartial } from './pack';
import { resolvePack, PACKS, housePack } from './registry';
import {
  buildTokens,
  tokensToCss,
  fontFaceCss,
  googleFontsHref,
  type TokenSet,
} from './tokens';

/**
 * Branding resolution, cached.
 *
 * Runs on every server render, so it must not hit the database each time.
 * Two layers:
 *
 *  - `cache()` dedupes within a single request — the layout, the metadata
 *    function and any component all ask for the same tenant.
 *  - A process-level map with a short TTL survives across requests.
 *
 * Branding changes rarely and a stale minute is harmless, so this is a
 * deliberately simple cache rather than Redis. `invalidateBranding()` is
 * called on save, so an admin never sees their own change lag.
 */

export interface ResolvedBrand {
  tenantId: string;
  pack: BrandPack;
  tokens: TokenSet;
  /** Ready to drop into a <style> tag in the document head. */
  css: string;
  fontHref: string | null;
}

const TTL_MS = 60_000;
const store = new Map<string, { at: number; value: ResolvedBrand }>();

export function invalidateBranding(tenantId?: string): void {
  if (tenantId) store.delete(tenantId);
  else store.clear();
}

function assemble(tenantId: string, pack: BrandPack): ResolvedBrand {
  const tokens = buildTokens(pack);
  return {
    tenantId,
    pack,
    tokens,
    css: fontFaceCss(pack) + tokensToCss(tokens),
    fontHref: googleFontsHref(pack),
  };
}

/**
 * Read the saved overrides for a tenant.
 *
 * Branding is tenant *configuration*, not member data, so it is read
 * outside RLS: the tenant is already resolved from the request host by
 * this point, and the layout needs colours before any session exists.
 */
async function savedOverrides(
  tenantId: string,
): Promise<{ packId: string | null; patch: DeepPartial<BrandPackInput> | null }> {
  if (IS_FIXTURE) return { packId: null, patch: null };

  const { prisma } = await import('../db/client');
  const row = await prisma.tenantBranding.findUnique({ where: { tenantId } });
  if (!row) return { packId: null, patch: null };

  return {
    packId: null,
    patch: {
      color: {
        primary: row.primaryHex,
        accent: row.accentHex ?? undefined,
        surface: row.surfaceHex,
        surfaceDark: row.surfaceDarkHex,
      },
      type: { display: row.fontDisplay, body: row.fontBody },
      shape: { radius: row.radius as BrandPack['shape']['radius'] },
      assets: {
        logoPrimary: row.logoPrimary ?? undefined,
        logoInverse: row.logoInverse ?? undefined,
        logoMark: row.logoMark ?? undefined,
        crest: row.crest ?? undefined,
        ogImage: row.ogImage ?? undefined,
        heroImage: row.heroImage ?? undefined,
      },
      copy: {
        portalName: row.portalName,
        tagline: row.tagline ?? undefined,
        supportEmail: row.supportEmail ?? undefined,
      },
    },
  };
}

export const getBrand = cache(async (tenantId: string, packId?: string | null): Promise<ResolvedBrand> => {
  const hit = store.get(tenantId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const saved = await savedOverrides(tenantId);
  const pack = resolvePack({
    packId: saved.packId ?? packId ?? (tenantId in PACKS ? tenantId : null),
    saved: saved.patch,
  });

  const value = assemble(tenantId, pack);
  store.set(tenantId, { at: Date.now(), value });
  return value;
});

/** The product's own identity — marketing pages and the platform console. */
export const getHouseBrand = cache(async (): Promise<ResolvedBrand> => assemble('house', housePack()));

/** Resolve without persisting. Powers the live preview in the branding admin. */
export function previewBrand(
  basePackId: string | null,
  patch: DeepPartial<BrandPackInput>,
): ResolvedBrand {
  return assemble('preview', resolvePack({ packId: basePackId, preview: patch }));
}
