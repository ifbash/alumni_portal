import Link from 'next/link';
import { Building2, MapPin } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Avatar, Badge, Card } from '@/components/ui';
import { memberLine } from '@/lib/format';
import { availabilityCopy } from '@/lib/availability-copy';
import type { MemberSummary } from '@/lib/data/types';

/**
 * Directory card.
 *
 * Built to survive a mostly-empty record, because most records are mostly
 * empty. A 2014 graduate who signed up once has a name, a branch and a
 * year — and the card has to look designed with only those, not like a
 * template with holes in it. So the branch and batch lead as an eyebrow,
 * and a record with nothing else simply ends after the name.
 *
 * The availability chips sit directly under the name, in verbs
 * ("Mentors", "Refers at Amazon", "Speaks"). They are the most valuable
 * thing on the card: they say who has already agreed to be asked, which is
 * the only question a student browsing this actually has.
 */

type Chip = { label: string; tone: 'success' | 'brand' | 'accent' };

function openToChips(member: MemberSummary): Chip[] {
  // The same words the profile form uses when the member switched these on.
  const ctx = { audience: 'alumni' as const, company: member.currentCompany, officeName: '', openLimit: 0 };
  return [
    member.openToMentoring ? { label: availabilityCopy('mentoring', ctx)!.chip, tone: 'success' as const } : null,
    member.openToReferrals ? { label: availabilityCopy('referrals', ctx)!.chip, tone: 'brand' as const } : null,
    member.openToSpeaking ? { label: availabilityCopy('speaking', ctx)!.chip, tone: 'accent' as const } : null,
  ].filter((c): c is Chip => c !== null);
}

function ChipList({ chips, className }: { chips: Chip[]; className?: string }) {
  if (!chips.length) return null;
  return (
    <ul className={cn('flex flex-wrap gap-1', className)} aria-label="Open to">
      {chips.map((c) => (
        <li key={c.label}>
          <Badge tone={c.tone} dot>
            {c.label}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

/**
 * The portrait: a photograph or initials inside a two-tone rim drawn from
 * the college's own brand and accent ramps, so a wall of people reads as
 * one family rather than a column of grey discs. The rim is the only
 * decoration; the initials still come from the kit's `Avatar`.
 */
function Portrait({ member, large }: { member: MemberSummary; large?: boolean }) {
  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full p-[3px]',
        'bg-[linear-gradient(140deg,color-mix(in_srgb,var(--brand-500)_60%,transparent),color-mix(in_srgb,var(--accent-500)_50%,transparent))]',
      )}
    >
      <Avatar
        name={member.fullName}
        src={member.photoUrl}
        size="lg"
        className={cn('ring-2 ring-surface-raised', large ? 'size-16 text-lg' : 'size-11 text-sm')}
      />
    </span>
  );
}

export function MemberCard({
  member,
  variant = 'card',
  note,
  action,
  isViewer = false,
  showAvailability = true,
  className,
}: {
  member: MemberSummary;
  /** `row` is a compact, roughly 88px line for lists and rails. */
  variant?: 'card' | 'row';
  /** One line of context from the page: "Asked you 2 days ago". */
  note?: React.ReactNode;
  /** A control in the card's footer, above the card-wide link. Not shown on the viewer's own card. */
  action?: React.ReactNode;
  /** The viewer's own card: a "You" badge, and no action. */
  isViewer?: boolean;
  showAvailability?: boolean;
  className?: string;
}) {
  const eyebrow = memberLine([member.departmentCode, member.batchYear ? `Batch of ${member.batchYear}` : null]);
  const chips = showAvailability ? openToChips(member) : [];
  const work = memberLine([member.designation, member.currentCompany]);
  const place = member.city ? memberLine([member.city, member.country !== 'IN' ? member.country : member.state]) : '';
  const footer = !isViewer && action ? action : null;
  const href = `/directory/${member.slug}`;

  const name = (
    <Link href={href} className="link-quiet after:absolute after:inset-0 after:rounded-lg">
      {member.fullName}
    </Link>
  );

  const badges = (
    <>
      {isViewer ? <Badge tone="brand">You</Badge> : null}
      {member.isStudent ? <Badge tone="outline">Final year</Badge> : null}
    </>
  );

  if (variant === 'row') {
    return (
      <Card
        interactive
        as="article"
        className={cn('relative flex min-h-[88px] items-center gap-3.5 px-4 py-3', className)}
      >
        <Portrait member={member} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="min-w-0 truncate font-display text-md font-semibold leading-snug">{name}</h3>
            {badges}
          </div>
          {work ? <p className="truncate text-sm text-secondary">{work}</p> : null}
          {eyebrow && !work ? <p className="truncate text-xs text-secondary">{eyebrow}</p> : null}
          <ChipList chips={chips.slice(0, 2)} className="pt-0.5" />
        </div>
        {footer ? <div className="relative z-10 shrink-0">{footer}</div> : null}
      </Card>
    );
  }

  return (
    <Card
      as="article"
      className={cn(
        'lift group relative flex flex-col overflow-hidden',
        // The whole tile is the link; its focus ring has to be the tile's.
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-[var(--surface)]',
        className,
      )}
    >
      {/* A wash of the college's tint behind the portrait: the one place the card carries colour. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--brand-soft)_85%,transparent),transparent)]"
      />

      <div className="relative flex items-start gap-4 px-5 pt-5">
        <Portrait member={member} large />
        <div className="min-w-0 flex-1 pt-0.5">
          {eyebrow ? (
            <p className="truncate text-xs font-semibold uppercase tracking-wider text-brand-fg">{eyebrow}</p>
          ) : null}
          <h3 className="mt-0.5 line-clamp-2 font-display text-lg font-semibold leading-snug">{name}</h3>
          {isViewer || member.isStudent ? <div className="mt-1.5 flex flex-wrap gap-1">{badges}</div> : null}
        </div>
      </div>

      {work || place ? (
        <dl className="relative mt-4 space-y-1 px-5 text-sm">
          {work ? (
            <div className="flex items-start gap-2">
              <dt className="mt-0.5 shrink-0 text-muted">
                <Building2 className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Work</span>
              </dt>
              <dd className="min-w-0 line-clamp-1 font-medium text-primary">{work}</dd>
            </div>
          ) : null}
          {place ? (
            <div className="flex items-start gap-2">
              <dt className="mt-0.5 shrink-0 text-muted">
                <MapPin className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Location</span>
              </dt>
              <dd className="min-w-0 truncate text-secondary">{place}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {chips.length || member.skills.length ? (
        <div className="relative mt-4 space-y-2.5 border-t border-line px-5 py-3.5">
          <ChipList chips={chips} />
          {member.skills.length ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Skills">
              {member.skills.slice(0, 3).map((s) => (
                <li
                  key={s}
                  className="rounded-sm bg-surface-sunken px-2 py-0.5 text-xs font-medium text-secondary"
                >
                  {s}
                </li>
              ))}
              {member.skills.length > 3 ? (
                <li className="rounded-sm px-1.5 py-0.5 text-xs font-medium text-secondary">
                  <span aria-hidden="true">+{member.skills.length - 3}</span>
                  <span className="sr-only">and {member.skills.length - 3} more</span>
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="pb-5" />
      )}

      {note ? <p className="relative -mt-1 truncate px-5 pb-3 text-sm text-secondary">{note}</p> : null}

      {footer ? <div className="relative z-10 mt-auto px-5 pb-5 pt-1">{footer}</div> : null}
    </Card>
  );
}

/**
 * Compact one-line variant for lists inside panels and tables.
 *
 * `linkProfile` defaults to true but must be turned off wherever the
 * person shown may not be reachable in the directory *by this viewer*.
 * The case that forced the option: an alumnus looking at applicants to
 * their own job posting. Applicants are students, and an alumnus's
 * `visibleStatusesFor` is `['active_alumni']` — so every name linked
 * straight to a not-found page. The row is still correct to render; only
 * the link was wrong.
 *
 * `href` overrides the directory link — the staff console points rows at
 * `/admin/members/{id}` instead.
 */
export function MemberRow({
  member,
  action,
  href,
  className,
  linkProfile = true,
}: {
  member: MemberSummary;
  action?: React.ReactNode;
  href?: string;
  className?: string;
  linkProfile?: boolean;
}) {
  const target = href ?? `/directory/${member.slug}`;
  return (
    <div className={cn('flex items-center gap-3 py-2.5', className)}>
      <Avatar name={member.fullName} src={member.photoUrl} size="sm" />
      <div className="min-w-0 flex-1">
        {linkProfile || href ? (
          <Link href={target} className="block truncate text-sm font-medium link-quiet">
            {member.fullName}
          </Link>
        ) : (
          <span className="block truncate text-sm font-medium">{member.fullName}</span>
        )}
        <p className="truncate text-xs text-secondary">
          {memberLine([
            member.departmentCode,
            member.batchYear,
            member.currentCompany ?? (member.isStudent ? 'Final year' : null),
          ])}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
