import { getTenantBrand } from '@/lib/tenant';
import type { Feature } from '@/lib/branding/pack';
import { HttpError } from './http';

/**
 * The tenant, and the proof that it has a module switched on.
 *
 * Every community route starts with this. A module is something a college
 * has taken, so a route for one it has not is a 404 and not a 403: nothing
 * is being withheld from the caller, it simply is not there. The message
 * names the module so a developer reading a 404 knows which switch.
 */
export async function requireFeature(feature: Feature, label: string) {
  const resolved = await getTenantBrand();
  if (!resolved) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');
  if (!resolved.brand.pack.features[feature]) {
    throw new HttpError(404, 'feature_off', `${label} is not enabled for this college.`);
  }
  return resolved;
}
