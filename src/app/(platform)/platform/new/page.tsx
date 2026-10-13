import { redirect } from 'next/navigation';
import { Clock } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenants, findMemberById } from '@/lib/data/repo';
import { listPacks, getPack, HOUSE_PACK_ID, DEMO_PACK_IDS } from '@/lib/branding/registry';
import { readableTextOn } from '@/lib/branding/color';
import { googleFontsHref } from '@/lib/branding/tokens';
import { Badge, Breadcrumbs, PageHeader } from '@/components/ui';

import { ProvisionForm, type PackChoice } from './ProvisionForm';
import { COLLEGE_ASKS } from '../_shared/MediaReadiness';
import { miniPortalCss } from '../_shared/MiniPortal';
import { portalAddress, portalRoot } from '../_shared/portal-address';
import { VendorTrustChip } from '../_shared/VendorTrustChip';

/**
 * Setting up a new college.
 *
 * The form is a client component; everything it needs to decide with —
 * the packs and their preview CSS, the addresses already in use, the
 * reserved names — is resolved here and passed down. A `'use client'`
 * file cannot reach the repository, and that constraint is doing useful
 * work: the availability check is a courtesy, and the real guarantee is
 * the unique index the API writes against.
 */

export const metadata = { title: 'Set up a new college' };

/**
 * Names the platform itself answers on. A tenant that grabbed `api` or
 * `www` would shadow infrastructure on every request.
 */
const RESERVED_SUBDOMAINS = [
  'www', 'api', 'app', 'admin', 'platform', 'portal', 'auth', 'login',
  'mail', 'smtp', 'static', 'assets', 'cdn', 'status', 'docs', 'help',
  'support', 'dashboard', 'ifbash', 'staging', 'preview', 'test',
];

/** What to have in hand. FCRA status is left out: step two asks for it. */
const HAVE_IN_HAND = [COLLEGE_ASKS.adminEmail, COLLEGE_ASKS.register, COLLEGE_ASKS.headcounts, COLLEGE_ASKS.brand, COLLEGE_ASKS.photos].map(
  ({ title, when }) => ({ title, when }),
);

export default async function ProvisionPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  requireCap(session, 'tenant.provision');

  const tenants = getTenants();
  const isTemplate = (id: string) => id === HOUSE_PACK_ID || (DEMO_PACK_IDS as readonly string[]).includes(id);

  const packs: PackChoice[] = (
    await Promise.all(
      listPacks().map(async (p) => {
        const pack = getPack(p.id);
        if (!pack) return null;
        const choice: PackChoice = {
          ...p,
          // Derived here rather than in the browser: the same rule that picks
          // `--button-primary-fg` picks the text on the preview band.
          onPrimary: readableTextOn(p.primary),
          pack,
          // Each pack's preview CSS, so the browser never derives tokens.
          css: miniPortalCss(pack),
          fontHref: googleFontsHref(pack),
          template: isTemplate(p.id),
          inUseBy: tenants.filter((t) => t.packId === p.id).map((t) => t.name),
          previewHref: (await portalAddress(p.id)).href,
        };
        return choice;
      }),
    )
  ).filter((p): p is PackChoice => p !== null);

  // Templates first, the house last among them: a new college starts from a demo template.
  const defaultPackId =
    packs.find((p) => (DEMO_PACK_IDS as readonly string[]).includes(p.id))?.id ?? packs[0]?.id ?? '';

  const taken = getTenants().map((t) => ({ subdomain: t.subdomain, name: t.name }));
  const { root } = await portalRoot();

  // The actor's own record — `profile.read.own`, which every role holds.
  // It names them in the audit entry the provisioning write will make.
  const actorName = findMemberById(session.memberId)?.fullName ?? 'Platform admin';

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs items={[{ label: 'Colleges', href: '/platform' }, { label: 'Set up a new college' }]} />
        }
        title="Set up a new college"
        description="Name it, give it an address and a look. Its admin gets an invite; the college adds its own people."
        meta={<VendorTrustChip />}
        actions={
          <Badge tone="outline">
            <Clock className="size-3.5" aria-hidden="true" />
            About ten minutes
          </Badge>
        }
      />

      <ProvisionForm
        packs={packs}
        defaultPackId={defaultPackId}
        taken={taken}
        reserved={RESERVED_SUBDOMAINS}
        rootDomain={root}
        actorName={actorName}
        haveInHand={HAVE_IN_HAND}
      />
    </div>
  );
}
