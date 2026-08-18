import Link from 'next/link';
import { Building2, MapPin, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Avatar, Badge, Card } from '@/components/ui';
import { memberLine } from '@/lib/format';
import type { MemberSummary } from '@/lib/data/types';

/**
 * Directory card.
 *
 * Built to survive a mostly-empty record, because most records are mostly
 * empty. A 2014 graduate who signed up once has a name, a branch and a
 * year — and the card has to look designed with only those, not like a
 * template with holes in it.
 *
 * The availability chips (`mentoring`, `referrals`, `speaking`) are the
 * most valuable thing on the card. They are the difference between a
 * directory and a phone book: they say who has already agreed to be
 * contacted, which is the only question a student browsing this actually
 * has.
 */
export function MemberCard({
  member,
  className,
  showAvailability = true,
}: {
  member: MemberSummary;
  className?: string;
  showAvailability?: boolean;
}) {
  const secondary = memberLine([
    member.departmentCode,
    member.batchYear ? `Batch of ${member.batchYear}` : null,
  ]);

  const chips = [
    showAvailability && member.openToMentoring ? { label: 'Mentors', tone: 'success' as const } : null,
    showAvailability && member.openToReferrals ? { label: 'Refers', tone: 'brand' as const } : null,
    showAvailability && member.openToSpeaking ? { label: 'Speaks', tone: 'accent' as const } : null,
  ].filter(Boolean);

  return (
    <Card interactive as="article" className={cn('flex flex-col p-card', className)}>
      <div className="flex items-start gap-3">
        <Avatar name={member.fullName} src={member.photoUrl} size="lg" />

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-md font-semibold leading-snug">
            <Link href={`/directory/${member.slug}`} className="link-quiet after:absolute after:inset-0">
              {member.fullName}
            </Link>
          </h3>

          {secondary ? <p className="mt-0.5 truncate text-xs text-secondary">{secondary}</p> : null}

          {member.isStudent ? (
            <Badge tone="info" className="mt-1.5">
              Final year
            </Badge>
          ) : null}
        </div>
      </div>

      <dl className="mt-3 space-y-1.5 text-sm">
        {member.designation || member.currentCompany ? (
          <div className="flex items-start gap-2">
            <dt className="sr-only">Work</dt>
            <Building2 className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
            <dd className="min-w-0 truncate text-secondary">
              {memberLine([member.designation, member.currentCompany])}
            </dd>
          </div>
        ) : null}

        {member.city ? (
          <div className="flex items-start gap-2">
            <dt className="sr-only">Location</dt>
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
            <dd className="min-w-0 truncate text-secondary">
              {memberLine([member.city, member.country !== 'IN' ? member.country : member.state])}
            </dd>
          </div>
        ) : null}

        {/* A record with nothing but a name still gets a line, so the card
            reads as complete rather than half-rendered. */}
        {!member.currentCompany && !member.city ? (
          <div className="flex items-start gap-2">
            <GraduationCap className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
            <dd className="text-muted">No details shared yet</dd>
          </div>
        ) : null}
      </dl>

      {member.skills.length ? (
        <ul className="mt-3 flex flex-wrap gap-1">
          {member.skills.slice(0, 3).map((s) => (
            <li key={s}>
              <Badge tone="outline">{s}</Badge>
            </li>
          ))}
          {member.skills.length > 3 ? (
            <li>
              <Badge tone="outline">+{member.skills.length - 3}</Badge>
            </li>
          ) : null}
        </ul>
      ) : null}

      {chips.length ? (
        <ul className="mt-auto flex flex-wrap gap-1 pt-3">
          {chips.map((c) => (
            <li key={c!.label}>
              <Badge tone={c!.tone} dot>
                {c!.label}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
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
 */
export function MemberRow({
  member,
  action,
  className,
  linkProfile = true,
}: {
  member: MemberSummary;
  action?: React.ReactNode;
  className?: string;
  linkProfile?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-3 py-2.5', className)}>
      <Avatar name={member.fullName} src={member.photoUrl} size="sm" />
      <div className="min-w-0 flex-1">
        {linkProfile ? (
          <Link href={`/directory/${member.slug}`} className="block truncate text-sm font-medium link-quiet">
            {member.fullName}
          </Link>
        ) : (
          <span className="block truncate text-sm font-medium">{member.fullName}</span>
        )}
        <p className="truncate text-xs text-muted">
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
