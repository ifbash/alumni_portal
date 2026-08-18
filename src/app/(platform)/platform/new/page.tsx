import { redirect } from 'next/navigation';
import { Clock, FileSpreadsheet, Landmark, Palette, Users } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenants, findMemberById } from '@/lib/data/repo';
import { listPacks } from '@/lib/branding/registry';
import { readableTextOn } from '@/lib/branding/color';
import {
  Badge,
  Breadcrumbs,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from '@/components/ui';

import { ProvisionForm, type PackChoice } from './ProvisionForm';

/**
 * Onboarding a new college.
 *
 * The form is a client component; everything it needs to decide with —
 * the packs in the registry, the subdomains already in use, the reserved
 * names — is resolved here and passed down. A `'use client'` file cannot
 * reach the repository, and that constraint is doing useful work: the
 * availability check is a courtesy, and the real guarantee is the unique
 * index the API writes against.
 */

export const metadata = { title: 'Provision a college' };

const PLATFORM_DOMAIN = 'alumni.ifbash.com';

/**
 * Names the platform itself answers on. A tenant that grabbed `api` or
 * `www` would shadow infrastructure on every request.
 */
const RESERVED_SUBDOMAINS = [
  'www', 'api', 'app', 'admin', 'platform', 'portal', 'auth', 'login',
  'mail', 'smtp', 'static', 'assets', 'cdn', 'status', 'docs', 'help',
  'support', 'dashboard', 'ifbash', 'staging', 'preview', 'test',
];

const BEFORE_YOU_START = [
  {
    icon: FileSpreadsheet,
    title: 'The degree register',
    body: 'Roll number, name, branch and year of passing for every graduate since the first batch, from the examinations branch. The longest lead time in onboarding, and every part of alumni verification is blocked on it.',
    tone: 'Chase first',
  },
  {
    icon: Users,
    title: 'Headcounts',
    body: 'Year of establishment, sanctioned intake by branch, current enrolment, staff count. Decides how much self-service verification is worth building for this college.',
    tone: 'Before the demo',
  },
  {
    icon: Landmark,
    title: 'FCRA registration status',
    body: 'Whether the college trust is registered to receive foreign contributions. Asked in step two, because it decides whether the giving module can exist at all.',
    tone: 'Blocks giving',
  },
  {
    icon: Palette,
    title: 'Brand assets',
    body: 'The crest in vector and the official colour hex values. Not blocking — pick the nearest pack now and swap the seeds later; the design system derives everything else from them.',
    tone: 'Can follow',
  },
];

export default async function ProvisionPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  requireCap(session, 'tenant.provision');

  const packs: PackChoice[] = listPacks().map((p) => ({
    ...p,
    // Derived here rather than in the browser: the same rule that picks
    // `--button-primary-fg` picks the text on the preview band.
    onPrimary: readableTextOn(p.primary),
  }));

  const taken = getTenants().map((t) => ({ subdomain: t.subdomain, name: t.name }));

  // The actor's own record — `profile.read.own`, which every role holds.
  // It names them in the audit entry the provisioning write will make.
  const actorName = findMemberById(session.memberId)?.fullName ?? 'Platform admin';

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[{ label: 'Colleges', href: '/platform' }, { label: 'New college' }]}
          />
        }
        eyebrow="Onboarding"
        title="Provision a college"
        description="Creates a tenant, its row-level security scope, a branding record and the first college_admin invite. It does not create a single member — the college loads its own people, and nobody at ifBash can read them afterwards."
        actions={
          <Badge tone="outline">
            <Clock className="size-3.5" aria-hidden="true" />
            About ten minutes
          </Badge>
        }
      />

      <Card>
        <CardHeader>
          <div className="min-w-0 space-y-1">
            <CardTitle as="h2">What to have in hand</CardTitle>
            <CardDescription>
              None of these blocks the form. Three of them block the college being useful, which is
              a different and more expensive kind of blocked.
            </CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {BEFORE_YOU_START.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Icon className="size-4 shrink-0 text-brand-fg" aria-hidden="true" />
                    {item.title}
                  </p>
                  <p className="text-sm text-secondary">{item.body}</p>
                  <Badge tone="neutral">{item.tone}</Badge>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>

      <ProvisionForm
        packs={packs}
        taken={taken}
        reserved={RESERVED_SUBDOMAINS}
        rootDomain={PLATFORM_DOMAIN}
        actorName={actorName}
      />
    </div>
  );
}
