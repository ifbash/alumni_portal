import { redirect } from 'next/navigation';
import { ArrowRight, Building2, FileJson, Layers, Lock, Palette, Type } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenants } from '@/lib/data/repo';
import {
  listPacks,
  getPack,
  HOUSE_PACK_ID,
  DEMO_PACK_IDS,
} from '@/lib/branding/registry';
import { OVERRIDABLE_TOKENS } from '@/lib/branding/pack';
import { contrastRatio, readableTextOn } from '@/lib/branding/color';
import { MarginNote, Scribble } from '@/components/brand/Marks';
import {
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  DetailRow,
  PageHeader,
  Section,
  Separator,
  Stat,
} from '@/components/ui';

/**
 * The brand pack registry.
 *
 * This screen is documentation as much as UI. The claim it has to make
 * credible is the one the whole product is sold on: a new customer is a
 * JSON file in `brands/` plus one line in the registry — no component, no
 * stylesheet, no branch. So it shows the actual file and the actual line,
 * not a description of them.
 */

export const metadata = { title: 'Brand packs' };

const RADIUS_LABEL = {
  none: 'square',
  subtle: 'subtle',
  rounded: 'rounded',
  pill: 'pill',
} as const;

const NEW_PACK_JSON = `{
  "id": "kakinada",
  "version": 1,

  "color": {
    "primary": "#0F4C81",
    "accent": "#C9772B",
    "surface": "#FCFBF9",
    "marker": "#C9772B"
  },

  "copy": {
    "portalName": "KIET Connect",
    "institutionName": "Kakinada Institute of Engineering & Technology",
    "shortName": "KIET",
    "tagline": "Korangi, Kakinada · Since 1998",
    "supportEmail": "alumni@kiet.example.ac.in"
  },

  "features": {
    "whatsapp": true,
    "donations": false
  }
}`;

const REGISTRY_DIFF = `// src/lib/branding/registry.ts

  import dietJson from '../../../brands/diet.json';
+ import kakinadaJson from '../../../brands/kakinada.json';

  export const PACKS: Record<string, BrandPack> = {
    ifbash: load(ifbashJson, 'ifbash'),
    diet:   load(dietJson, 'diet'),
+   kakinada: load(kakinadaJson, 'kakinada'),
  };`;

export default async function BrandPacksPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  requireCap(session, 'tenant.provision');

  const packs = listPacks();
  const tenants = getTenants();

  const assigned = new Set(tenants.map((t) => t.packId).filter(Boolean) as string[]);
  const customerPacks = packs.filter(
    (p) => p.id !== HOUSE_PACK_ID && !(DEMO_PACK_IDS as readonly string[]).includes(p.id),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ifBash platform"
        title="Brand packs"
        description="One object per customer, holding the whole visual identity: colour seeds, typography, shape, assets, copy, feature flags and locale. Everything the UI renders that could differ between colleges is named here and nowhere else."
        actions={
          <ButtonLink variant="secondary" href="/platform">
            <Building2 className="size-4" aria-hidden="true" />
            Colleges
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Packs in the registry"
          value={packs.length}
          icon={<Layers className="size-4" />}
          hint={`${customerPacks.length} customer, ${DEMO_PACK_IDS.length} demonstration, 1 house`}
        />
        <Stat
          label="Assigned to a tenant"
          value={assigned.size}
          icon={<Building2 className="size-4" />}
          hint="a pack with no tenant still previews on its own subdomain"
        />
        <Stat
          label="Overridable tokens"
          value={OVERRIDABLE_TOKENS.length}
          icon={<Lock className="size-4" />}
          hint="named tokens only — there is no free-form CSS seam"
        />
      </div>

      <Section
        title="Every pack in the registry"
        description="Swatches are the pack’s own seed colours, rendered from the file. The ramps, hover states, tinted fills and text-on-brand pairings under them are derived, not supplied."
      >
        <ul className="grid gap-6 lg:grid-cols-2">
          {packs.map((summary) => {
            const pack = getPack(summary.id);
            if (!pack) return null;

            const isHouse = pack.id === HOUSE_PACK_ID;
            const isDemo = (DEMO_PACK_IDS as readonly string[]).includes(pack.id);
            const users = tenants.filter((t) => t.packId === pack.id);

            const onPrimary = readableTextOn(pack.color.primary);
            const ratio = contrastRatio(pack.color.primary, onPrimary);
            const featuresOn = Object.entries(pack.features).filter(([, v]) => v === true);

            return (
              <li key={pack.id}>
                <Card className="h-full overflow-hidden">
                  {/* The band is the pack's own primary; its text colour is chosen
                      by the same contrast rule the button tokens use. */}
                  <div
                    className="flex flex-wrap items-end justify-between gap-3 p-card"
                    style={{ backgroundColor: pack.color.primary, color: onPrimary }}
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="font-display text-xl font-bold">{pack.copy.portalName}</p>
                      <p className="text-sm">{pack.copy.institutionName}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
                      <span
                        className="size-8 rounded-full border border-[color-mix(in_srgb,currentColor_40%,transparent)]"
                        style={{ backgroundColor: pack.color.primary }}
                      />
                      <span
                        className="size-8 rounded-full border border-[color-mix(in_srgb,currentColor_40%,transparent)]"
                        style={{ backgroundColor: pack.color.accent ?? pack.color.primary }}
                      />
                      <span
                        className="size-8 rounded-full border border-[color-mix(in_srgb,currentColor_40%,transparent)]"
                        style={{ backgroundColor: pack.color.surface }}
                      />
                    </div>
                  </div>

                  <CardBody className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="brand">
                        <FileJson className="size-3" aria-hidden="true" />
                        <span className="font-mono">brands/{pack.id}.json</span>
                      </Badge>
                      {isHouse ? <Badge tone="accent">House pack</Badge> : null}
                      {isDemo ? <Badge tone="warning">Demonstration only</Badge> : null}
                      {users.length ? (
                        <Badge tone="success">
                          In use by {users.length} {users.length === 1 ? 'tenant' : 'tenants'}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">Not assigned</Badge>
                      )}
                    </div>

                    <dl className="divide-y divide-line">
                      <DetailRow label="Primary">
                        <span className="font-mono text-xs">
                          {pack.color.primary.toUpperCase()}
                        </span>{' '}
                        <span className="text-xs font-normal text-muted">
                          text on it resolves to{' '}
                          <span className="font-mono">{onPrimary}</span> at {ratio.toFixed(1)}:1
                        </span>{' '}
                        {ratio >= 4.5 ? (
                          <Badge tone="success">WCAG AA</Badge>
                        ) : (
                          <Badge tone="warning">Below 4.5:1</Badge>
                        )}
                      </DetailRow>
                      <DetailRow label="Accent">
                        {pack.color.accent ? (
                          <span className="font-mono text-xs">
                            {pack.color.accent.toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-muted">
                            None — falls back to the primary, which reads as deliberate
                          </span>
                        )}
                      </DetailRow>
                      <DetailRow label="Type">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Type className="size-3.5 text-muted" aria-hidden="true" />
                          {pack.type.display} · {pack.type.body} · {pack.type.mono}
                        </span>
                      </DetailRow>
                      <DetailRow label="Shape">
                        {RADIUS_LABEL[pack.shape.radius]} corners · {pack.shape.density} density ·{' '}
                        {pack.shape.elevation} elevation
                      </DetailRow>
                      <DetailRow label="Features on">
                        <span className="tabular">{featuresOn.length}</span> of{' '}
                        <span className="tabular">{Object.keys(pack.features).length}</span>
                        <span className="block text-xs font-normal text-muted">
                          {featuresOn.map(([k]) => k).join(', ')}
                        </span>
                      </DetailRow>
                      <DetailRow label="Locale">
                        <span className="font-mono text-xs">{pack.locale.locale}</span> ·{' '}
                        {pack.locale.currency} · {pack.locale.timeZone}
                      </DetailRow>
                    </dl>
                  </CardBody>

                  <CardFooter>
                    {users.length ? (
                      <ul className="flex flex-wrap items-center gap-2">
                        {users.map((t) => (
                          <li key={t.id}>
                            <ButtonLink variant="ghost" size="sm" href={`/platform/${t.id}`}>
                              {t.shortName}
                              <ArrowRight className="size-3.5" aria-hidden="true" />
                            </ButtonLink>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted">
                        No tenant row points at this pack yet.{' '}
                        <span className="font-mono">{pack.id}.alumni.ifbash.com</span> still resolves
                        it, so a prospect&rsquo;s portal can be previewed before anything is signed.
                      </p>
                    )}
                  </CardFooter>
                </Card>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section
        title="Adding a customer"
        description="Three steps, none of which is a code change to the product."
      >
        <Card>
          <CardHeader>
            <div className="min-w-0 space-y-1">
              <CardTitle as="h3">
                A new college is{' '}
                <span className="relative inline-block">
                  one JSON file and one line
                  <Scribble className="absolute -bottom-1 left-0" />
                </span>
              </CardTitle>
              <CardDescription>
                The person doing this at 11pm before a demo should not need to be able to write any
                code. So there is none to write.
              </CardDescription>
            </div>
          </CardHeader>

          <CardBody className="space-y-6">
            <ol className="space-y-6">
              <li className="space-y-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-xs text-brand-soft-fg">
                    1
                  </span>
                  Drop a file in <span className="font-mono">brands/</span>
                </p>
                <p className="max-w-prose text-sm text-secondary">
                  Only what differs from the defaults. A college that wants nothing but its own
                  colour and name supplies exactly that and inherits a complete, accessible design
                  system for everything else — the ten-stop ramps, the hover states, the tinted
                  fills, the dark mode.
                </p>
                {/* Code scrolls inside its own region rather than widening the page. */}
                <pre className="overflow-x-auto rounded-lg border border-line bg-surface-sunken p-4">
                  <code className="font-mono text-xs leading-relaxed text-primary">
                    {NEW_PACK_JSON}
                  </code>
                </pre>
              </li>

              <li className="space-y-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-xs text-brand-soft-fg">
                    2
                  </span>
                  Add one line to the registry
                </p>
                <p className="max-w-prose text-sm text-secondary">
                  Packs are imported statically rather than read from disk, so the bundler includes
                  them and a malformed pack fails at boot — loudly, for everyone — instead of at
                  first render for one unlucky customer.
                </p>
                <pre className="overflow-x-auto rounded-lg border border-line bg-surface-sunken p-4">
                  <code className="font-mono text-xs leading-relaxed text-primary">
                    {REGISTRY_DIFF}
                  </code>
                </pre>
              </li>

              <li className="space-y-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-xs text-brand-soft-fg">
                    3
                  </span>
                  Point a subdomain at it
                </p>
                <p className="max-w-prose text-sm text-secondary">
                  <span className="font-mono">kakinada.alumni.ifbash.com</span> resolves the pack by
                  its slug. That is enough to demo a prospect&rsquo;s own portal before a tenant row
                  exists. Provisioning then creates the tenant and stores{' '}
                  <span className="font-mono">packId</span> against it.
                </p>
                <p>
                  <ButtonLink href="/platform/new" size="sm">
                    Provision a college
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </ButtonLink>
                </p>
              </li>
            </ol>

            <Separator label="What a pack may not do" />

            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-1.5">
                <p className="text-sm font-semibold">No free-form CSS</p>
                <p className="text-sm text-secondary">
                  <span className="font-mono text-xs">overrides</span> accepts values for{' '}
                  {OVERRIDABLE_TOKENS.length} named tokens and rejects anything else at parse time.
                  Unbounded theming turns every support ticket into CSS archaeology.
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-semibold">Light and dark are separate</p>
                <p className="text-sm text-secondary">
                  <span className="font-mono text-xs">darkOverrides</span> is its own map. An ink a
                  brand guideline fixes for headings on paper is, applied unchanged to a dark
                  ground, ink on ink.
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-semibold">Features are gates, not styling</p>
                <p className="text-sm text-secondary">
                  <span className="font-mono text-xs">features.donations</span> stays false until a
                  college confirms FCRA registration. The navigation and every route guard read it;
                  no CSS class is involved.
                </p>
              </div>
            </div>

            <MarginNote className="max-w-prose">
              The packs marked “demonstration only” are not customers. They exist so the branding
              studio has something to switch between on a sales call, and so the contrast checker
              exercises hues, shapes and densities the two real packs never touch.
            </MarginNote>
          </CardBody>

          <CardFooter>
            <p className="flex items-center gap-2 text-xs text-muted">
              <Palette className="size-3.5 shrink-0" aria-hidden="true" />
              Colleges edit their own pack from the college console under Branding. Platform admins
              hold <span className="font-mono">tenant.configure</span>; they do not hold anything
              that reads what the branding is applied to.
            </p>
          </CardFooter>
        </Card>
      </Section>
    </div>
  );
}
