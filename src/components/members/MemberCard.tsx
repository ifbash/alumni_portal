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
        className={cn('relative flex min-h-[88px] items-center gap-3 px-4 py-3', className)}
      >
        <Avatar name={member.fullName} src={member.photoUrl} size="md" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="min-w-0 truncate font-display text-md font-semibold leading-snug">{name}</h3>
            {badges}
          </div>
          {work ? <p className="truncate text-sm text-secondary">{work}</p> : null}
          <ChipList chips={chips.slice(0, 2)} />
        </div>
        {footer ? <div className="relative z-10 shrink-0">{footer}</div> : null}
      </Card>
    );
  }

  return (
    <Card interactive as="article" className={cn('relative flex flex-col p-card', className)}>
      <div className="flex items-start gap-3">
        <Avatar name={member.fullName} src={member.photoUrl} size="lg" />

        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="truncate text-xs font-medium text-secondary">{eyebrow}</p> : null}
          <h3 className="line-clamp-2 font-display text-md font-semibold leading-snug">{name}</h3>
          {isViewer || member.isStudent ? <div className="mt-1.5 flex flex-wrap gap-1">{badges}</div> : null}
          <ChipList chips={chips} className="mt-2" />
        </div>
      </div>

      {work || place ? (
        <dl className="mt-3 space-y-1.5 text-sm">
          {work ? (
            <div className="flex items-start gap-2">
              <dt className="mt-0.5 shrink-0 text-muted">
                <Building2 className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Work</span>
              </dt>
              <dd className="min-w-0 line-clamp-1 text-secondary">{work}</dd>
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

      {member.skills.length ? (
        <ul className="mt-3 flex flex-wrap gap-1" aria-label="Skills">
          {member.skills.slice(0, 2).map((s) => (
            <li key={s}>
              <Badge tone="outline">{s}</Badge>
            </li>
          ))}
          {member.skills.length > 2 ? (
            <li>
              <Badge tone="outline">
                <span aria-hidden="true">+{member.skills.length - 2}</span>
                <span className="sr-only">and {member.skills.length - 2} more</span>
              </Badge>
            </li>
          ) : null}
        </ul>
      ) : null}

      {note ? <p className="mt-3 truncate text-sm text-secondary">{note}</p> : null}

      {footer ? <div className="relative z-10 mt-auto pt-3">{footer}</div> : null}
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
