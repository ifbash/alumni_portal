import Link from 'next/link';
import { ArrowRight, Briefcase, HandHeart, Handshake, Mic, Users, type LucideIcon } from 'lucide-react';
import { can, type Session } from '@/lib/auth/guard';
import type { Capability } from '@/lib/auth/permissions';
import { cn } from '@/lib/cn';
import type { FeatureSpec } from '@/lib/branding/pack';
import { SectionHead } from './SectionHead';

/**
 * "Get involved" — three or four ways back in, under the hero (Brown's
 * action blocks, with SMU's habit of saying what each one costs you in
 * time).
 *
 * Every tile is a real link to the real module. Signed out, a tile needs
 * only its feature: middleware sends the visitor to `/login?next=…`, and
 * the closing line says why. Signed in, a tile also needs the capability,
 * so nobody is shown a door they will be refused at — which is also how
 * the Give row stays away from students, who never hold `donation.give`.
 *
 * Laid out as a bento: the first pathway is the lead tile (large, in the
 * brand tint), the rest are smaller tiles beside it. Give is its own
 * full-width row under the bento, never one of the pathways: asking for
 * money sits apart from asking for time.
 */

interface Row {
  Icon: LucideIcon;
  title: string;
  line: string;
  href: string;
}

/** Placement of each tile at lg, by how many tiles there are. The lead is always first. */
function placement(count: number, index: number): string {
  if (index === 0) return count === 1 ? 'lg:col-span-12' : count === 2 ? 'lg:col-span-7' : 'lg:col-span-6 lg:row-span-2';
  if (count === 2) return 'lg:col-span-5';
  if (count === 3) return 'lg:col-span-6';
  // Four: the second runs the full width of the right column, the last two share the row below it.
  return index === 1 ? 'lg:col-span-6' : 'lg:col-span-3';
}

export function GetInvolved({
  features,
  session,
  shortName,
  office,
  firstBatch,
  rollMid,
}: {
  features: FeatureSpec;
  session: Session | null;
  shortName: string;
  office: string;
  /** The register's oldest batch, or null when the register is empty. */
  firstBatch: number | null;
  rollMid: string;
}) {
  const allowed = (feature: boolean, cap?: Capability) => feature && (!session || !cap || can(session, cap));

  const rows: Row[] = [
    ...(allowed(features.directory, 'directory.search.alumni')
      ? [{ Icon: Users, title: 'Find your batchmates', line: 'Search by batch, branch, company or city.', href: '/directory' }]
      : []),
    ...(allowed(features.mentorship && features.connections, 'connection.receive')
      ? [{ Icon: Handshake, title: 'Mentor a final-year student', line: 'At your own pace. You can decline any request.', href: '/mentorship' }]
      : []),
    ...(allowed(features.jobs, 'job.post')
      ? [{ Icon: Briefcase, title: `Hire from ${shortName}`, line: 'Post a role. The placement cell checks it before students see it.', href: '/jobs/new' }]
      : []),
    ...(allowed(features.events)
      ? [{ Icon: Mic, title: 'Speak at a session', line: `About an hour, on campus or online. Tell the ${office} what you could talk about.`, href: '/contact#help' }]
      : []),
  ];

  const give: Row | null = allowed(features.donations, 'donation.give')
    ? { Icon: HandHeart, title: `Give to ${shortName}`, line: 'Campaigns the college has opened to alumni.', href: '/giving' }
    : null;

  if (!rows.length && !give) return null;

  return (
    <section id="get-involved" aria-labelledby="involved-title" className="scroll-mt-20 bg-surface-sunken py-10 md:py-section">
      <div className="page-shell">
        <SectionHead
          id="involved-title"
          eyebrow="Ways in"
          title="Get involved"
          description={`Whether you passed out last year or ${firstBatch !== null ? `in ${firstBatch}` : 'long ago'}, there is a place for you at ${shortName}.`}
        />

        {rows.length ? (
          <ul className="reveal mt-6 grid gap-3 md:mt-10 lg:grid-cols-12 lg:gap-4">
            {rows.map((r, i) => (
              <li key={r.href} className={cn('min-w-0', placement(rows.length, i))}>
                {i === 0 ? <LeadTile row={r} /> : <PathwayTile row={r} />}
              </li>
            ))}
          </ul>
        ) : null}

        {give ? (
          <Link
            href={give.href}
            className={cn(
              'group lift flex min-h-11 items-center gap-4 rounded-xl bg-accent-soft p-5 text-accent-soft-fg md:gap-6 md:p-6',
              rows.length ? 'mt-3 lg:mt-4' : 'mt-8 md:mt-10',
            )}
          >
            <give.Icon className="size-8 shrink-0" aria-hidden="true" strokeWidth={1.5} />
            <span className="min-w-0">
              <span className="block font-display text-lg font-bold md:text-xl">{give.title}</span>
              <span className="mt-0.5 block text-sm">{give.line}</span>
            </span>
            <ArrowRight
              className="ml-auto size-5 shrink-0 transition-transform duration-fast ease-brand group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
        ) : null}

        {!session ? (
          <p className="mt-6 text-sm text-secondary">
            These open once the college has confirmed your registration.{' '}
            <Link className="link" href="/claim">
              Register with your {rollMid}
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** The lead pathway: big, tinted, with its icon drawn oversize behind the words. */
function LeadTile({ row }: { row: Row }) {
  return (
    <Link
      href={row.href}
      className="group lift ring-hairline relative flex h-full min-h-0 flex-col md:min-h-56 overflow-hidden rounded-xl bg-brand-800 p-6 text-brand-50 md:p-8"
    >
      <row.Icon
        aria-hidden="true"
        strokeWidth={1}
        className="pointer-events-none absolute -bottom-8 -right-6 size-40 md:size-56 text-[color-mix(in_srgb,currentColor_14%,transparent)]"
      />
      <span className="relative flex items-start justify-between">
        <span className="grid size-11 place-items-center rounded-full border border-current md:size-12">
          <row.Icon className="size-6" aria-hidden="true" />
        </span>
        {/* Phones: the arrow sits by the icon; the whole tile is the link, so no "Open" row. */}
        <ArrowRight className="size-5 md:hidden" aria-hidden="true" />
      </span>
      <span className="relative mt-auto block pt-4 md:pt-10">
        <span className="block font-display text-display-xs font-bold">{row.title}</span>
        <span className="mt-2 block max-w-sm text-brand-100">{row.line}</span>
        <span className="mt-4 hidden min-h-11 items-center gap-2 text-sm font-semibold md:inline-flex">
          Open
          <ArrowRight
            className="size-4 transition-transform duration-fast ease-brand group-hover:translate-x-1"
            aria-hidden="true"
          />
        </span>
      </span>
    </Link>
  );
}

function PathwayTile({ row }: { row: Row }) {
  return (
    <Link
      href={row.href}
      className="group lift flex h-full min-h-11 items-start gap-4 rounded-xl border border-line bg-surface-raised p-4 md:p-6"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-soft-fg">
        <row.Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-lg font-bold leading-snug">{row.title}</span>
        <span className="mt-1 block text-sm text-secondary">{row.line}</span>
      </span>
      <ArrowRight
        className="ml-auto size-4 shrink-0 self-center text-brand-fg transition-transform duration-fast ease-brand group-hover:translate-x-1"
        aria-hidden="true"
      />
    </Link>
  );
}
