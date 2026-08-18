import { Github, Globe, Linkedin, Lock, Mail, Phone } from 'lucide-react';
import { Alert, Badge, Card, CardBody, CardTitle } from '@/components/ui';
import { maskEmail, maskMobile } from '@/lib/format';
import type { ContactDetails } from '@/lib/data/types';

/**
 * Contact block.
 *
 * Renders one of three states, and the middle one is the important one:
 *
 *  - **Released** — both gates passed, real values shown.
 *  - **Withheld** — a contact exists but the viewer is not entitled to
 *    it, or the owner has not consented. Shown masked, with the reason.
 *  - **Absent** — the member never supplied one.
 *
 * Masking rather than hiding is deliberate. It tells the viewer that the
 * data exists and that access is a permissions question, not a
 * data-quality one, which is the difference between "request an
 * introduction" and a support ticket saying the directory is broken.
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
}: {
  contact: Partial<ContactDetails> | null;
  ownerName: string;
  visibility: ContactDetails['visibility'] | null;
  hasAcceptedConnection: boolean;
  viewerIsOwner?: boolean;
  /** "Request an introduction" button, supplied by the page. */
  action?: React.ReactNode;
}) {
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
            <p className="text-sm text-secondary">{ownerName} has not added any contact details.</p>
          </CardBody>
        </Card>
      );
    }

    return (
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle as="h2">Contact</CardTitle>
            {viewerIsOwner ? <Badge tone="neutral">Only you see this</Badge> : null}
          </div>

          <dl className="space-y-2">
            {rows.map((r) => (
              <div key={r!.label} className="flex items-center gap-2.5 text-sm">
                <dt className="flex items-center gap-2.5 text-muted">
                  <span aria-hidden="true">{r!.icon}</span>
                  <span className="sr-only">{r!.label}</span>
                </dt>
                <dd className="min-w-0 truncate">
                  <a
                    href={r!.href}
                    className="link"
                    {...(r!.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                  >
                    {r!.value}
                  </a>
                </dd>
              </div>
            ))}
          </dl>

          {!viewerIsOwner ? (
            <p className="border-t border-line pt-3 text-xs text-muted">
              Shared with you by {ownerName.split(' ')[0]}. Use it for the reason you asked — the college
              logs how contact details are released.
            </p>
          ) : null}
        </CardBody>
      </Card>
    );
  }

  const reason = withheldReason(visibility, hasAcceptedConnection);

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle as="h2">Contact</CardTitle>
          <Badge tone="neutral" dot>
            Not shared
          </Badge>
        </div>

        <dl className="space-y-2 text-sm" aria-label="Withheld contact details">
          <div className="flex items-center gap-2.5">
            <dt className="text-muted">
              <Mail className="size-4" aria-hidden="true" />
              <span className="sr-only">Email</span>
            </dt>
            <dd className="font-mono text-secondary">{maskEmail('hidden@example.com')}</dd>
          </div>
          <div className="flex items-center gap-2.5">
            <dt className="text-muted">
              <Phone className="size-4" aria-hidden="true" />
              <span className="sr-only">Mobile</span>
            </dt>
            <dd className="font-mono text-secondary">{maskMobile('+91 00000 00000')}</dd>
          </div>
        </dl>

        <Alert tone="neutral" icon={<Lock className="size-4" />}>
          {reason}
        </Alert>

        {action ? <div className="pt-1">{action}</div> : null}
      </CardBody>
    </Card>
  );
}

function withheldReason(
  visibility: ContactDetails['visibility'] | null,
  hasAcceptedConnection: boolean,
): string {
  switch (visibility) {
    case 'private':
      return 'This member has chosen not to share contact details with anyone. You can still send a connection request, and they will see your message.';
    case 'on_accept':
      return hasAcceptedConnection
        ? 'Details are being released — refresh in a moment.'
        : 'Details are released once this member accepts your connection request. That is their choice, not a restriction the college applies to you.';
    case 'alumni_only':
      return 'This member shares contact details with alumni and faculty only.';
    case 'all_members':
      return 'Sign in as a verified member to see shared contact details.';
    default:
      return 'Contact details are released when the member has consented and you are entitled to see them. Both have to be true.';
  }
}
