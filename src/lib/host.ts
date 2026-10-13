import { DEFAULT_TENANT } from './config';

/**
 * Which college a request is for, from its Host header.
 *
 * One definition, imported by both `middleware.ts` and `tenant.ts`. They
 * used to carry a copy each, with a comment asking the next editor to keep
 * them in step - and when they disagree the header and the resolved tenant
 * differ and the bug looks like a caching problem.
 *
 * Pure on purpose: no `next/headers`, no React `cache()`, no dataset, so
 * middleware can import it without bundling any of that into a module that
 * runs on every request.
 *
 * Development hosts (`localhost`, `127.0.0.1`, `*.localhost`, and Vercel
 * `*.vercel.app` URLs) have no usable subdomain of their own and fall back
 * to `DEFAULT_TENANT`, except that `name.localhost` selects `name`. That
 * fallback applies in production builds too: the e2e suite runs the whole
 * sweep against `next start` on `*.localhost`, and a Vercel preview is a
 * production build. It is a consequence of treating those hosts as
 * development hosts, so a production deployment that is also reachable on
 * its `*.vercel.app` URL serves the default college there - put real
 * traffic on a custom domain.
 */
export function subdomainFrom(host: string): string | null {
  const clean = host.split(':')[0]?.toLowerCase() ?? '';
  if (!clean) return null;

  const isLocal =
    clean === 'localhost' ||
    clean.endsWith('.localhost') ||
    clean === '127.0.0.1' ||
    clean.endsWith('.vercel.app');

  if (isLocal) {
    const sub = clean.endsWith('.localhost') ? clean.replace('.localhost', '') : null;
    return sub ?? DEFAULT_TENANT;
  }

  const parts = clean.split('.');
  if (parts.length < 3) return null;
  return parts[0] ?? null;
}
