import Link from 'next/link';
import { ArrowRight, Building2, GraduationCap, MapPin, UserCheck } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * "Start here": the directory's first move, made for the viewer.
 *
 * Shown only when no filter is on. An alumnus gets their own batch, their
 * branch, people near them and people who mentor; a student gets mentors,
 * their branch and the employers alumni work at. Every tile is a link to a
 * view that already exists, so the tiles add no reach of their own: the
 * page computes the counts with the same `searchDirectory` the results use.
 *
 * Counts below 3 are left off. "Your batch · 1" reads as a failure, not a
 * starting point.
 */

export type StartTileIcon = 'batch' | 'branch' | 'near' | 'mentor';

export interface StartTile {
  key: string;
  label: string;
  /** "2017", "CSE", "Hyderabad": the viewer's own value, when there is one. */
  detail?: string | null;
  count?: number | null;
  href: string;
  icon: StartTileIcon;
}

const ICONS: Record<StartTileIcon, React.ReactNode> = {
  batch: <GraduationCap className="size-4" />,
  branch: <Building2 className="size-4" />,
  near: <MapPin className="size-4" />,
  mentor: <UserCheck className="size-4" />,
};

export function StartHere({
  tiles,
  employers,
  className,
}: {
  tiles: StartTile[];
  /** Students: the top employers, as chips that open the directory filtered by company. */
  employers?: Array<{ label: string; href: string }>;
  className?: string;
}) {
  if (tiles.length === 0 && !employers?.length) return null;

  return (
    <section aria-labelledby="start-here-heading" className={cn('space-y-3', className)}>
      <h2 id="start-here-heading" className="text-xs font-semibold uppercase tracking-wider text-secondary">
        Start here
      </h2>

      <ul className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {tiles.map((tile) => {
          const facts = [tile.detail, tile.count != null && tile.count >= 3 ? `${tile.count.toLocaleString('en-IN')} people` : null]
            .filter(Boolean)
            .join(' · ');
          return (
            <li key={tile.key} className="min-w-0">
              <Link
                href={tile.href}
                className={cn(
                  'group flex h-full min-h-14 items-center gap-2.5 rounded-lg border border-line bg-surface-raised px-3 py-2.5 sm:gap-3',
                  'transition-colors duration-fast ease-brand hover:border-line-strong hover:bg-surface-sunken',
                )}
              >
                <span
                  className="hidden size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-soft-fg min-[420px]:grid xl:hidden 2xl:grid"
                  aria-hidden="true"
                >
                  {ICONS[tile.icon]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-primary">{tile.label}</span>
                  {facts ? <span className="block truncate text-xs text-secondary">{facts}</span> : null}
                </span>
                <ArrowRight
                  className="hidden size-4 shrink-0 text-muted transition-transform duration-fast group-hover:translate-x-0.5 sm:block"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}

        {employers?.length ? (
          <li className="col-span-2 min-w-0 rounded-lg border border-line bg-surface-raised px-3 py-2.5">
            <p className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Building2 className="size-4 text-muted" aria-hidden="true" />
              Top employers
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Top employers">
              {employers.map((e) => (
                <li key={e.href}>
                  <Link
                    href={e.href}
                    className="inline-flex min-h-11 items-center rounded-full border border-line px-3 text-sm text-secondary transition-colors duration-fast ease-brand hover:border-line-strong hover:text-primary sm:min-h-8"
                  >
                    {e.label}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
