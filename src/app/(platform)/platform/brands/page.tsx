import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, ArrowUpRight, Camera, Globe, Plus } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenants } from '@/lib/data/repo';
import { listPacks, getPack, HOUSE_PACK_ID, DEMO_PACK_IDS } from '@/lib/branding/registry';
import { OVERRIDABLE_TOKENS, type BrandPack } from '@/lib/branding/pack';
import { readableTextOn } from '@/lib/branding/color';
import type { TenantSummary } from '@/lib/data/types';
import { cn } from '@/lib/cn';
import {
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardFooter,
  Disclosure,
} from '@/components/ui';

import { brandVerdict } from '../_shared/brand-check';
import { CollegeMark } from '../_shared/CollegeMark';
import { MediaReadiness, mediaSummary } from '../_shared/MediaReadiness';
import { MiniPortal, SeedSwatches } from '../_shared/MiniPortal';
import { ConsoleBand, LABEL, Meter, SectionHeading, VerdictText } from '../_shared/parts';
import { portalAddress, type PortalAddress } from '../_shared/portal-address';
import { VendorTrustChip } from '../_shared/VendorTrustChip';

/**
 * The brand pack registry, as each pack renders.
 *
 * The claim this screen makes is the one the product is sold on: a new
 * college is a JSON file in `brands/` and one line in the registry, with
 * no component or stylesheet change. So each pack is shown as its own
 * sign-in screen, light and dark, and the file itself stays in a
 * disclosure for the vendor staff who write it.
 */

export const metadata = { title: 'Brand packs' };

/**
 * A pack file to copy. Placeholders, not an example college: a real
 * college's name here would read as a customer.
 */
const NEW_PACK_JSON = `{
  "id": "<subdomain>",
  "version": 1,

  "color": {
    "primary": "<hex from the college's style guide>",
    "accent": "<second hex, if it has one>",
    "surface": "#FCFBF9"
  },

  "copy": {
    "portalName": "<what alumni will call the portal>",
    "institutionName": "<registered name, as on a degree certificate>",
    "shortName": "<the letters on the crest>",
    "tagline": "<town, district>"
  },

  "assets": {
    "crest": "/brand/<subdomain>/crest.svg"
  },

  "features": {
    "donations": false
  }
}`;

const REGISTRY_LINE = `// src/lib/branding/registry.ts
+ import newJson from '../../../brands/<subdomain>.json';

  export const PACKS: Record<string, BrandPack> = {
    …
+   '<subdomain>': load(newJson, '<subdomain>'),
  };`;

const STEPS = [
  { title: 'Collect', body: 'The crest in vector, the official colour values and three to five campus photos.' },
  { title: 'Write the pack', body: 'One file, brands/{id}.json, and one line in the registry — no component or stylesheet change.' },
  { title: 'Preview, then set up', body: 'Open it on its own address to check it, then set the college up with it.' },
];

export default async function BrandPacksPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  requireCap(session, 'tenant.provision');

  const packs = listPacks();
  const tenants = getTenants();

  const isDemo = (id: string) => (DEMO_PACK_IDS as readonly string[]).includes(id);
  const all = packs.map((p) => getPack(p.id)).filter((p): p is BrandPack => p !== null);
  const colleges = all.filter((p) => p.id !== HOUSE_PACK_ID && !isDemo(p.id));
  const templates = [
    ...all.filter((p) => p.id === HOUSE_PACK_ID),
    ...all.filter((p) => isDemo(p.id)),
  ];

  const addresses = new Map<string, PortalAddress>(
    await Promise.all(all.map(async (p) => [p.id, await portalAddress(p.id)] as const)),
  );

  const verdicts = new Map(all.map((p) => [p.id, brandVerdict(p)] as const));
  const blocked = [...verdicts.values()].filter((v) => v.blocked).length;
  const withWarnings = [...verdicts.values()].filter((v) => !v.blocked && v.warnings > 0).length;

  // A lone card in a group takes the full row, laid out wide rather than leaving half the row empty.
  const card = (pack: BrandPack, _i: number, group: BrandPack[]) => (
    <li key={pack.id} id={pack.id} className={group.length === 1 ? 'min-w-0 scroll-mt-20 xl:col-span-2' : 'min-w-0 scroll-mt-20'}>
      <PackCard
        wide={group.length === 1}
        pack={pack}
        verdict={verdicts.get(pack.id)!}
        house={pack.id === HOUSE_PACK_ID}
        demo={isDemo(pack.id)}
        users={tenants.filter((t) => t.packId === pack.id)}
        address={addresses.get(pack.id)!}
      />
    </li>
  );

  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

  return (
    <div className="space-y-10">
      <ConsoleBand
        eyebrow="Platform / Brand packs"
        title="Brand packs"
        lead="Each college’s look — colours, crest, type, photos and wording — lives in one file. This is how each one renders."
        actions={
          <ButtonLink href="/platform/new" variant="band" className="min-h-11">
            <Plus className="size-4" aria-hidden="true" />
            Set up a college
          </ButtonLink>
        }
        figures={[
          { value: all.length, label: plural(all.length, 'Pack', 'Packs') },
          { value: colleges.length, label: plural(colleges.length, 'College', 'Colleges') },
          { value: blocked, label: 'Blocked' },
          { value: withWarnings, label: plural(withWarnings, 'Warning', 'Warnings') },
        ]}
      />

      <div className="-mt-4">
        <VendorTrustChip />
      </div>

      {/* The gallery's index: each pack as its own band colour, set from pack data like the college marks. */}
      <nav aria-label="Jump to a pack">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[...colleges, ...templates].map((p) => {
            const v = verdicts.get(p.id)!;
            return (
              <li key={p.id} className="min-w-0">
                <a
                  href={`#${p.id}`}
                  className="group relative flex h-24 min-h-11 flex-col justify-between overflow-hidden rounded border border-line p-3 transition-transform duration-fast ease-brand hover:-translate-y-0.5"
                  style={{ backgroundColor: p.color.primary, color: readableTextOn(p.color.primary) }}
                >
                  <span className="block truncate font-display text-sm font-bold leading-tight">{p.copy.portalName}</span>
                  <span className="flex items-end justify-between gap-2 font-mono text-xs uppercase tracking-[0.12em]">
                    <span className="truncate">{v.label}</span>
                    {p.color.accent ? (
                      <span
                        aria-hidden="true"
                        className="size-3 shrink-0 rounded-full border border-[color-mix(in_srgb,currentColor_40%,transparent)]"
                        style={{ backgroundColor: p.color.accent }}
                      />
                    ) : null}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {colleges.length ? (
        <section id="colleges" aria-labelledby="colleges-title" className="scroll-mt-20 space-y-5">
          <SectionHeading id="colleges-title" eyebrow="Colleges" title="Written for a college">
            Packs built from a college’s own crest, colours and wording.
          </SectionHeading>
          <ul className="grid grid-cols-1 gap-6 xl:grid-cols-2">{colleges.map(card)}</ul>
        </section>
      ) : null}

      <section id="templates" aria-labelledby="templates-title" className="scroll-mt-20 space-y-5">
        <SectionHeading id="templates-title" eyebrow="Templates" title="Starting templates">
          The platform’s own look and two illustrative packs, for a college whose own is not written yet.
        </SectionHeading>
        <ul className="grid grid-cols-1 gap-6 xl:grid-cols-2">{templates.map(card)}</ul>
      </section>

      <section aria-labelledby="adding-title" className="space-y-5">
        <SectionHeading id="adding-title" eyebrow="Add one" title="Adding a college’s brand">
          Three steps, and no component or stylesheet change.
        </SectionHeading>

        <ol className="grid border-t border-line md:grid-cols-3 md:gap-x-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 border-b border-line py-5 md:border-b-0">
              <span className="font-mono text-xs tabular text-accent-fg" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-primary">{s.title}</p>
                <p className="text-sm text-secondary">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink href="/platform/new">
            Set up a college
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
          <p className="text-sm text-secondary">Pick a starting template there if the college’s own pack is not ready.</p>
        </div>

        <Disclosure summary="How to add a college’s brand (vendor staff)" id="how-to">
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="font-medium text-primary">1. Write the pack file</p>
              <p>
                Only what differs from the defaults. The ten-stop colour ramps, hover states, tinted fills, dark mode
                and every text-on-colour pairing are derived from the seeds and contrast-checked; run{' '}
                <code className="font-mono text-xs text-primary">npm run brand:check</code> before publishing.
              </p>
              <pre className="overflow-x-auto rounded-lg border border-line bg-surface-sunken p-4">
                <code className="font-mono text-xs leading-relaxed text-primary">{NEW_PACK_JSON}</code>
              </pre>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-primary">2. Add one line to the registry</p>
              <p>Packs are imported statically, so a malformed one fails at boot for everyone rather than at first render for one college.</p>
              <pre className="overflow-x-auto rounded-lg border border-line bg-surface-sunken p-4">
                <code className="font-mono text-xs leading-relaxed text-primary">{REGISTRY_LINE}</code>
              </pre>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-primary">3. Preview on its address, then set up</p>
              <p>
                A pack answers on its own subdomain before any college row exists, so the college can see its portal
                before anything is signed. Setting the college up then stores the pack against it.
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-primary">What a pack cannot do</p>
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  No free-form CSS: <code className="font-mono text-xs">overrides</code> accepts {OVERRIDABLE_TOKENS.length}{' '}
                  named tokens and rejects anything else.
                </li>
                <li>
                  Light and dark are separate: <code className="font-mono text-xs">darkOverrides</code> is its own map.
                </li>
                <li>
                  Giving stays off (<code className="font-mono text-xs">features.donations</code>) until the college
                  confirms its FCRA registration.
                </li>
              </ul>
            </div>
          </div>
        </Disclosure>
      </section>
    </div>
  );
}

function PackCard({
  pack,
  verdict,
  house,
  demo,
  users,
  address,
  wide = false,
}: {
  pack: BrandPack;
  verdict: ReturnType<typeof brandVerdict>;
  house: boolean;
  demo: boolean;
  users: TenantSummary[];
  address: PortalAddress;
  /** At xl: the preview on the left, colours and media on the right. */
  wide?: boolean;
}) {
  const media = mediaSummary(pack);

  const details = (
    <div className={cn('grid gap-5', wide ? 'sm:grid-cols-2 xl:grid-cols-1' : 'sm:grid-cols-2')}>
      <div className="space-y-2">
        <p className={LABEL}>Colours</p>
        <SeedSwatches pack={pack} />
      </div>
      <div className="space-y-2">
        <p className={cn(LABEL, 'flex items-center gap-1.5')}>
          <Camera className="size-3.5" aria-hidden="true" />
          Media
        </p>
        <Meter value={media.present} total={media.total} label={`${media.present} of ${media.total} filled`} />
        <MediaReadiness pack={pack} variant="row" />
      </div>
    </div>
  );

  return (
    <Card className="ring-hairline flex h-full flex-col">
      <CardBody className="flex-1 space-y-5">
        <div className="flex items-start gap-3">
          <CollegeMark pack={pack} name={pack.copy.shortName} size={44} />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-bold leading-snug tracking-tight">{pack.copy.portalName}</h3>
            <p className="text-sm text-secondary">{pack.copy.institutionName}</p>
            {house || demo ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {house ? <Badge tone="outline">The platform’s own look</Badge> : null}
                {demo ? <Badge tone="outline">Illustrative — not a real college</Badge> : null}
              </div>
            ) : null}
          </div>
          <VerdictText verdict={verdict} className="shrink-0" />
        </div>

        <div className={cn(wide && 'grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]')}>
          <div className="min-w-0 space-y-3">
            <MiniPortal pack={pack} />
            <p className="text-xs text-secondary">{verdict.summary}</p>
          </div>
          {wide ? <div className="mt-5 min-w-0 xl:mt-0">{details}</div> : null}
        </div>

        {wide ? null : details}
      </CardBody>

      <CardFooter className="flex-wrap justify-between gap-x-4 gap-y-2">
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {users.length ? (
            users.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/platform/${t.id}`}
                  className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand-fg underline-offset-4 hover:underline"
                >
                  Used by {t.shortName}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </li>
            ))
          ) : (
            <li className="text-sm text-secondary">Not used by a college yet</li>
          )}
        </ul>
        <a
          href={address.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-secondary underline-offset-4 hover:text-brand-fg hover:underline"
        >
          <Globe className="size-3.5" aria-hidden="true" />
          Open live preview
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
          <span className="sr-only">(opens {address.host} in a new tab)</span>
        </a>
      </CardFooter>
    </Card>
  );
}
