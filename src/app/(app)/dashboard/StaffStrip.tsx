import Link from 'next/link';
import { FileCheck2, Briefcase, ArrowRight } from 'lucide-react';
import { can, type Session } from '@/lib/auth/guard';
import { getVerificationClaims, getJobs } from '@/lib/data/repo';
import { primaryRole } from '@/lib/navigation';
import type { Capability } from '@/lib/auth/permissions';
import type { BrandPack } from '@/lib/branding/pack';

/**
 * Capabilities that mean "this person has staff work to do".
 *
 * Checked explicitly rather than by asking whether the admin navigation
 * is non-empty: that tree contains one item with no capability attached,
 * so it is non-empty for every signed-in member, students included.
 */
const STAFF_CAPABILITIES: Capability[] = [
  'profile.read.any',
  'verification.review.department',
  'verification.review.any',
  'job.moderate',
  'event.create.department',
  'event.create.any',
  'comms.send.department',
  'comms.send.segment',
  'comms.send.all',
  'donation.report',
  'member.export',
  'role.manage',
  'tenant.configure',
  'audit.read',
  'rollover.execute',
];

/**
 * The staff bridge.
 *
 * Deliberately a strip and not a dashboard. Someone who runs the alumni
 * cell still uses the portal as a member; burying their member home under
 * an admin console is how staff stop seeing what members see. Two numbers
 * only, and both are queue depths — the things that rot if nobody looks
 * at them today.
 */
export function StaffStrip({ session, pack }: { session: Session; pack: BrandPack }) {
  void pack;
  if (!STAFF_CAPABILITIES.some((c) => can(session, c))) return null;

  const reviewer =
    can(session, 'verification.review.department') || can(session, 'verification.review.any');
  const moderator = can(session, 'job.moderate');

  // Never ask the repo for a queue the viewer cannot review — a count is
  // data too.
  const queueDepth = reviewer ? getVerificationClaims(session, { status: 'queued' }).length : null;
  const pendingJobs = moderator ? getJobs(session, { state: 'pending_moderation' }).length : null;

  return (
    <section
      aria-label="Staff console"
      className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-line bg-surface-sunken px-4 py-3"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-secondary">
        {primaryRole(session)}
      </p>

      {queueDepth !== null ? (
        <Link
          href="/admin/verification"
          className="group flex items-center gap-2 text-sm text-secondary hover:text-primary"
        >
          <FileCheck2 className="size-4 text-muted" aria-hidden="true" />
          <span className="font-semibold tabular text-primary">{queueDepth}</span>
          <span>
            {queueDepth === 1 ? 'claim' : 'claims'} waiting on a verification decision
          </span>
        </Link>
      ) : null}

      {pendingJobs !== null ? (
        <Link
          href="/admin/jobs"
          className="group flex items-center gap-2 text-sm text-secondary hover:text-primary"
        >
          <Briefcase className="size-4 text-muted" aria-hidden="true" />
          <span className="font-semibold tabular text-primary">{pendingJobs}</span>
          <span>{pendingJobs === 1 ? 'posting' : 'postings'} awaiting moderation</span>
        </Link>
      ) : null}

      {queueDepth === null && pendingJobs === null ? (
        <p className="text-sm text-secondary">
          Your staff tools live in the console — nothing here needs you today.
        </p>
      ) : null}

      <Link
        href="/admin"
        className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-brand-fg hover:underline"
      >
        Open the console
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
