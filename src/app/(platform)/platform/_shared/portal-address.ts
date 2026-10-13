import { siteOrigin } from '@/lib/share';
import { getTenants } from '@/lib/data/repo';
import { PACKS } from '@/lib/branding/registry';

/**
 * Where a college's portal answers, as this deployment serves it.
 *
 * Colleges are resolved from the first label of the Host header, so the
 * honest address is the platform's own host with the college's subdomain
 * in front. The console itself is reached through some college's host
 * (`diet.localhost:3000` in development), so a leading label that is
 * already a college or a brand pack is taken off first: the address of
 * `kiet` is `kiet.localhost:3000`, never `kiet.diet.localhost:3000`.
 *
 * Server only: it reads the request headers through `siteOrigin()`.
 */

export interface PortalAddress {
  /** `http://kiet.localhost:3000`, for an href. */
  href: string;
  /** `kiet.localhost:3000`, for reading. */
  host: string;
}

/** The protocol and the apex every college's subdomain sits under. */
export async function portalRoot(): Promise<{ protocol: string; root: string }> {
  const origin = await siteOrigin();
  const at = origin.indexOf('://');
  const protocol = at > 0 ? origin.slice(0, at) : 'https';
  const host = (at > 0 ? origin.slice(at + 3) : origin).toLowerCase();

  const dot = host.indexOf('.');
  const first = dot > 0 ? host.slice(0, dot) : null;
  const known = new Set<string>([...getTenants().map((t) => t.subdomain), ...Object.keys(PACKS)]);

  return { protocol, root: first && known.has(first) ? host.slice(dot + 1) : host };
}

export async function portalAddress(subdomain: string): Promise<PortalAddress> {
  const { protocol, root } = await portalRoot();
  const host = `${subdomain}.${root}`;
  return { href: `${protocol}://${host}`, host };
}
