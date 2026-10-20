import { Github, Globe, Linkedin, Lock, LockOpen, Mail, Phone } from 'lucide-react';
import { Badge, Card, CardBody, CardTitle } from '@/components/ui';
import { firstNameOf } from '@/lib/identity';
import type { ContactDetails } from '@/lib/data/types';

/**
 * Contact block.
 *
 * Renders one of three states:
 *
 *  - **Released** — both gates passed, real values shown, with one line
 *    saying why this viewer can see them.
 *  - **Withheld** — one lock row, "Email and mobile are private", and the
 *    reason in the owner's terms, then the page's action. No masked
 *    placeholders: a fake `v•••@gmail.com` is a claim about data the
 *    viewer was not given.
 *  - **Absent** — the member never supplied one.
 *
 * Every sentence here must stay true of `releaseContact()` in
 * `src/lib/members/projection.ts`. In particular, nothing promises that a
 * request releases contact under `alumni_only` or `all_members`: it does
 * not, for a student, ever.
 *
 * The component is incapable of leaking: it renders what it is handed. If
 * `releaseContact()` returned null, there is nothing here to show.
 */
export function ContactBlock({
  contact,
  ownerName,
  visibility,
  hasAcceptedConnection,
  viewerIsOwner = false,
  action,
  ownerFirstName,
  releasedBecause,
  // Reserved: accepted so pages can pass it today and the block can tighten
  // student copy later without a signature change. See the prop's doc below.
  viewerIsStudent: _viewerIsStudent = false,
  shortName,
}: {
  contact: Partial<ContactDetails> | null;
  ownerName: string;
  visibility: ContactDetails['visibility'] | null;
  hasAcceptedConnection: boolean;
  viewerIsOwner?: boolean;
  /** "Request an introduction" button, supplied by the page. */
  action?: React.ReactNode;
  /** Defaults to `firstNameOf(ownerName)`. */
  ownerFirstName?: string;
  /**
   * Why the viewer can see a released contact, for the footnote. The page
   * knows which gate opened; the block does not guess. Omitted means an
   * accepted connection when there is one, else no footnote.
   */
  releasedBecause?: 'connection' | 'visibility' | 'role' | 'owner';
  /**
   * Whether the viewer is a final-year student. The withheld reasons are
   * written to be true for a student already (none promises that a
   * request releases `alumni_only` or `all_members` contact), so today
   * this changes no wording; pages pass it so the block can tighten
   * student copy without a signature change.
   */
  viewerIsStudent?: boolean;
  /** The college's short name, for "shares this with DIET alumni and faculty". */
  shortName?: string;
}) {
  const first = ownerFirstName?.trim() || firstNameOf(ownerName);

  if (contact) {
    const rows = [
      contact.email ? { icon: <Mail className="size-4" />, label: 'Email', value: contact.email, href: `mailto:${contact.email}` } : null,
      contact.mobile ? { icon: <Phone className="size-4" />, label: 'Mobile', value: contact.mobile, href: `tel:${contact.mobile.replace(/\s/g, '')}` } : null,
      contact.linkedin ? { icon: <Linkedin className="size-4" />, label: 'LinkedIn', value: 'View profile', href: contact.linkedin } : null,
      contact.github ? { icon: <Github className="size-4" />, label: 'GitHub', value: 'View profile', href: contact.github } : null,
      contact.portfolio ? { icon: <Globe className="size-4" />, label: 'Website', value: 'Visit', href: contact.portfolio } : null,
    ].filter(Boolean);

    if (rows.length === 0) {
      return (
        <Card>
          <CardBody className="space-y-3">
            <CardTitle as="h2">Contact</CardTitle>
            <p className="text-sm text-secondary">{first} has not added any contact details.</p>
          </CardBody>
        </Card>
      );
    }

    // Styling only: the rows and sentences are exactly what the projection released.

    const because = viewerIsOwner ? 'owner' : (releasedBecause ?? (hasAcceptedConnection ? 'connection' : undefined));
    const footnote =
      because === 'connection'
        ? `Shared because ${first} accepted your request.`
        : because === 'visibility'
          ? `${first} shares this with ${shortName ? `${shortName} ` : ''}alumni and faculty.`
          : because === 'role'
            ? 'Shown to you because of your staff role.'
            : null;

    return (
      <Card className="overflow-hidden">
        {/* The unlocked state: a success-tinted header, so "released" is a different object from "withheld" at a glance. */}
        <div className="flex items-center justify-between gap-3 border-b border-line bg-success-soft px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-raised text-success-fg shadow-sm"
            >
              <LockOpen className="size-4" />
            </span>
            <CardTitle as="h2">Contact</CardTitle>
          </div>
          {because === 'owner' ? <Badge tone="neutral">Only you see this</Badge> : null}
        </div>
        <CardBody className="space-y-3">
          <dl className="space-y-2">
            {rows.map((r) => (
              <div
                key={r!.label}
                className="group relative flex min-h-11 items-center gap-3 rounded-lg border border-line bg-surface-sunken px-3 text-sm transition-colors duration-fast ease-brand hover:border-line-strong hover:bg-surface-raised sm:min-h-10"
              >
                <dt className="flex items-center gap-2.5 text-brand-fg">
                  <span aria-hidden="true">{r!.icon}</span>
                  <span className="sr-only">{r!.label}</span>
                </dt>
                <dd className="min-w-0 truncate">
                  <a
                    href={r!.href}
                    className="link font-medium after:absolute after:inset-0 after:rounded-lg"
                    {...(r!.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                  >
                    {r!.value}
                  </a>
                </dd>
              </div>
            ))}
          </dl>

          {footnote ? <p className="text-xs text-secondary">{footnote}</p> : null}
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardBody className="space-y-4">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-sunken text-secondary ring-1 ring-inset ring-line"
          >
            <Lock className="size-4" />
          </span>
          <CardTitle as="h2">Contact</CardTitle>
        </div>

        <div className="rounded-lg bg-surface-sunken p-3.5 text-sm">
          <p className="font-medium text-primary">Email and mobile are private</p>
          <p className="mt-1 text-secondary">{withheldReason(visibility, first)}</p>
        </div>

        {action ? <div>{action}</div> : null}
      </CardBody>
    </Card>
  );
}

/**
 * The reason, in the owner's terms. Each line is true of the projection:
 *
 *  - private: nothing releases it (an admin with the contact capability
 *    aside), but a request is still delivered.
 *  - on_accept: an accepted request releases it, to anyone.
 *  - alumni_only / all_members: alumni and faculty only. A request does
 *    not change that, so none is promised — this is what a student sees.
 */
function withheldReason(visibility: ContactDetails['visibility'] | null, first: string): string {
  switch (visibility) {
    case 'private':
      return `${first} keeps contact details private. A request still reaches them.`;
    case 'on_accept':
      return `Released when ${first} accepts your request.`;
    case 'alumni_only':
    case 'all_members':
      // True for everyone refused here: a student, or a staff role with
      // neither the alumni nor the faculty role.
      return `${first} shares contact details with alumni and faculty only.`;
    default:
      return `${first} has not chosen who can see their contact details.`;
  }
}
