import { headers } from 'next/headers';
import type { BrandPack } from '@/lib/branding/pack';

/**
 * Links the product site builds from the request, never from a constant.
 *
 * The showcase runs on the house tenant (ifbash.localhost, demo.example.com)
 * and points at colleges served by the same deployment. Their addresses
 * differ from this one only in the first host label, so they are built by
 * swapping it: nothing here knows or hardcodes a domain.
 */

/** The fictional college the "See a demo college" button opens. */
export const DEMO_COLLEGE_ID = 'srivarsity';

/**
 * `host` (a Host header, port included) with its tenant label replaced by
 * `sub`, or null when the host carries no tenant label to replace.
 *
 *   ifbash.localhost:3000 → srivarsity.localhost:3000
 *   localhost:3000        → srivarsity.localhost:3000
 *   demo.example.com      → srivarsity.example.com
 *
 * Mirrors `subdomainFrom()` in `lib/tenant.ts`: an IP address, a
 * `*.vercel.app` preview and a two-label apex all resolve to the default
 * tenant rather than to a subdomain, so there is nothing to swap and
 * guessing would send a buyer to somebody else's site.
 */
export function tenantHost(host: string, sub: string): string | null {
  const raw = host.trim().toLowerCase();
  if (!raw || raw.startsWith('[')) return null;

  const colon = raw.lastIndexOf(':');
  const name = colon >= 0 ? raw.slice(0, colon) : raw;
  const port = colon >= 0 ? raw.slice(colon) : '';

  if (!name || /^\d{1,3}(\.\d{1,3}){3}$/.test(name) || name.endsWith('.vercel.app')) return null;
  if (name === 'localhost') return `${sub}.localhost${port}`;

  const labels = name.split('.');
  const local = name.endsWith('.localhost');
  if (!local && labels.length < 3) return null;

  return [sub, ...labels.slice(1)].join('.') + port;
}

function protocol(): string {
  // The same rule as `siteOrigin()` in lib/share.ts.
  return process.env.NODE_ENV === 'production' ? 'https' : 'http';
}

export interface ShowcaseLinks {
  /** The demo college's landing page, or null when this host cannot name it. */
  demoCollege: string | null;
  /** A prefilled demo request to the pack's support address. */
  requestDemo: string | null;
  /** The address each college's portal answers on, for the preview frames. */
  hostFor: (packId: string) => string;
}

/** A mailto that arrives with a subject and the three facts a first call needs. */
export function demoMailto(email: string, subject = 'Alumni portal demo for our college'): string {
  const body = ['College name:', 'Your role:', 'Roughly how many alumni:', '', ''].join('\n');
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function showcaseLinks(pack: BrandPack): Promise<ShowcaseLinks> {
  const host = (await headers()).get('host') ?? '';
  const demoHost = tenantHost(host, DEMO_COLLEGE_ID);

  return {
    demoCollege: demoHost ? `${protocol()}://${demoHost}/` : null,
    requestDemo: pack.copy.supportEmail ? demoMailto(pack.copy.supportEmail) : null,
    hostFor: (packId) => tenantHost(host, packId) ?? packId,
  };
}
