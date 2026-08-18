import { BrandPack, DEFAULT_PACK, mergePack, type DeepPartial, type BrandPackInput } from './pack';

import ifbashJson from '../../../brands/ifbash.json';
import dietJson from '../../../brands/diet.json';
import srivarsityJson from '../../../brands/srivarsity.json';
import northgateJson from '../../../brands/northgate.json';

/**
 * The brand registry.
 *
 * Adding a customer is: drop a JSON file in `brands/`, add one line here,
 * point a subdomain at it. That is the entire onboarding path for the
 * visual identity — there is deliberately no code to write, because the
 * person doing it at 11pm before a demo should not need to be able to
 * write any.
 *
 * Packs are imported statically rather than read from disk at runtime so
 * the bundler includes them and a malformed pack fails at boot, loudly,
 * instead of at first render for one unlucky customer.
 */

/** JSON has no comment syntax, so `$`-prefixed keys carry the notes. */
function stripNotes<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripNotes) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!k.startsWith('$')) out[k] = stripNotes(v);
    }
    return out as T;
  }
  return value;
}

function load(raw: unknown, name: string): BrandPack {
  const result = BrandPack.safeParse(stripNotes(raw));
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Brand pack "brands/${name}.json" is invalid:\n${detail}`);
  }
  return result.data;
}

export const PACKS: Record<string, BrandPack> = {
  ifbash: load(ifbashJson, 'ifbash'),
  diet: load(dietJson, 'diet'),
  // Demonstration packs. They are not customers — they exist so the
  // branding studio has something to switch between on a sales call, and
  // so `npm run brand:check` exercises hues, shapes and densities the two
  // real packs never touch.
  srivarsity: load(srivarsityJson, 'srivarsity'),
  northgate: load(northgateJson, 'northgate'),
};

/** Packs that are shipped for demonstration rather than sold to anyone. */
export const DEMO_PACK_IDS = ['srivarsity', 'northgate'] as const;

/** The pack the product itself wears. */
export const HOUSE_PACK_ID = 'ifbash';

export function housePack(): BrandPack {
  return PACKS[HOUSE_PACK_ID] ?? DEFAULT_PACK;
}

export function listPacks(): Array<{ id: string; portalName: string; institutionName: string; primary: string }> {
  return Object.values(PACKS).map((p) => ({
    id: p.id,
    portalName: p.copy.portalName,
    institutionName: p.copy.institutionName,
    primary: p.color.primary,
  }));
}

/**
 * Resolve a pack for a tenant.
 *
 * Precedence, lowest to highest:
 *   DEFAULT_PACK → the pack file → saved `tenant_branding` → live preview
 *
 * Each layer states only what it changes, so a college that wants nothing
 * but a different primary colour supplies exactly that and inherits a
 * complete, accessible design system for everything else.
 */
export function resolvePack(args: {
  packId?: string | null;
  saved?: DeepPartial<BrandPackInput> | null;
  preview?: DeepPartial<BrandPackInput> | null;
}): BrandPack {
  const file = args.packId ? PACKS[args.packId] : undefined;
  let pack = file ?? DEFAULT_PACK;
  if (args.saved) pack = mergePack(pack, args.saved);
  if (args.preview) pack = mergePack(pack, args.preview);
  return pack;
}

export function getPack(id: string | null | undefined): BrandPack | null {
  if (!id) return null;
  return PACKS[id] ?? null;
}
