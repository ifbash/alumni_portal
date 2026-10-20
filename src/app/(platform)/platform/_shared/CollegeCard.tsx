import Link from 'next/link';
import { ArrowRight, Landmark, Lock, Palette } from 'lucide-react';

import type { BrandPack } from '@/lib/branding/pack';
import type { TenantSummary } from '@/lib/data/types';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui';

import type { BrandVerdict } from './brand-check';
import { CollegeMark } from './CollegeMark';
import { MiniPortal, miniPortalCss } from './MiniPortal';
import type { PortalAddress } from './portal-address';
import { LABEL, Meter, VerdictText } from './parts';

/**
 * One college in the portfolio: its own sign-in screen beside the facts an
 * operator scans for. Status, brand check, media and set-up are all read
 * from the tenant row and the pack file. Nothing here comes from, or leads
 * to, a person: the vendor cannot see members, and the card does not pretend.
 *
 * The whole card opens the college through the name's stretched link;
 * the address and the set-up link sit above it.
 */

export const STATUS = {
  active: { label: 'Live', tone: 'success' },
  provisioning: { label: 'Onboarding', tone: 'brand' },
  suspended: { label: 'Suspended', tone: 'danger' },
} as const;

export const PLAN_LABEL = { trial: 'Trial', standard: 'Standard', institution: 'Institution' } as const;

export interface CollegeCardData {
  tenant: TenantSummary;
  pack: BrandPack | null;
  address: PortalAddress;
  setup: { done: number; total: number };
  verdict: BrandVerdict | null;
  media: { present: number; total: number };
  joined: string;
}

const STRETCH = 'after:absolute after:inset-0 after:content-[""]';
const ABOVE = 'relative z-10';

export function CollegeCard({ row }: { row: CollegeCardData }) {
  const { tenant, pack, address, setup, verdict, media } = row;
  const status = STATUS[tenant.status];

  return (
    <article className="ring-hairline lift relative grid h-full overflow-hidden rounded-lg border border-line bg-surface-raised sm:grid-cols-[14.5rem_minmax(0,1fr)]">
      {/* The college's own screen. A picture, not a control; the name is the one link. */}
      <div
        aria-hidden="true"
        className="relative border-b border-line bg-surface-sunken p-3 sm:border-b-0 sm:border-r sm:p-3.5"
      >
        {pack ? (
          <MiniPortal pack={pack} css={miniPortalCss(pack, ['light'])} modes={['light']} size="sm" className="pointer-events-none" />
        ) : (
          <div className="grid min-h-40 place-items-center gap-2 border border-dashed border-line-strong p-4 text-center">
            <Palette className="mx-auto size-5 text-muted" />
            <p className={LABEL}>No brand pack</p>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <CollegeMark pack={pack} name={tenant.shortName} size={36} />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-md font-bold leading-snug tracking-tight text-primary">
              <Link href={`/platform/${tenant.id}`} className={cn(STRETCH, 'hover:text-brand-fg')}>
                {tenant.name}
              </Link>
            </h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge tone={status.tone} dot>
                {status.label}
              </Badge>
              <span className="text-xs text-secondary">
                {PLAN_LABEL[tenant.plan]} plan · since {row.joined}
              </span>
            </p>
          </div>
        </div>

        <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
          <Row label="Brand check">
            {verdict ? <VerdictText verdict={verdict} /> : <span className="text-secondary">No pack to check</span>}
          </Row>
          <Row label="Media">
            <Meter value={media.present} total={media.total} label={`${media.present} of ${media.total} filled`} />
          </Row>
          <Row label="Set-up">
            {tenant.status === 'provisioning' ? (
              <Link
                href={`/platform/${tenant.id}#setup`}
                className={cn(ABOVE, 'inline-flex min-h-11 items-center gap-1.5 font-medium text-brand-fg underline-offset-4 hover:underline sm:min-h-8')}
              >
                {setup.done} of {setup.total} steps
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            ) : (
              <span className="tabular text-primary">
                {setup.done} of {setup.total} steps
              </span>
            )}
          </Row>
          <Row label="Giving">
            {tenant.fcraRegistered ? (
              <span className="inline-flex items-center gap-1.5 text-success-fg">
                <Landmark className="size-4 shrink-0" aria-hidden="true" />
                FCRA registered
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-secondary">
                <Lock className="size-4 shrink-0" aria-hidden="true" />
                FCRA not confirmed
              </span>
            )}
          </Row>
        </dl>

        <p className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-4">
          <a
            href={address.href}
            target="_blank"
            rel="noreferrer"
            className={cn(ABOVE, 'inline-flex min-h-11 items-center font-mono text-xs text-secondary underline-offset-4 hover:text-brand-fg hover:underline sm:min-h-8')}
          >
            {address.host}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <span aria-hidden="true" className="inline-flex items-center gap-1 text-sm font-medium text-brand-fg">
            Open
            <ArrowRight className="size-3.5" />
          </span>
        </p>
      </div>
    </article>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-9 grid-cols-[7.25rem_minmax(0,1fr)] items-center gap-3 py-1">
      <dt className={LABEL}>{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
