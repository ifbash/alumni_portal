import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { LifeBuoy } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { requireSession } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getMyTickets } from '@/lib/data/helpdesk';
import { getMemberPages } from '@/lib/data/pages';
import { OTP_TTL_SECONDS } from '@/lib/config';
import { TICKET_KIND_LABELS, TICKET_STATE_LABELS, ticketCategoryLabel } from '@/lib/community';
import { formatRelative } from '@/lib/format';
import { Badge, Card, CardBody, CardHeader, CardTitle, Disclosure, EmptyState, PageHeader } from '@/components/ui';
import { TicketForm } from '@/components/community/TicketForm';

/**
 * Help.
 *
 * Open to any signed-in member, **a pending one included**: the most common
 * question there will ever be is "my registration is pending", and the people
 * asking it are not yet active. So the answers come first (most people
 * have one of five questions), then the form, then the questions the member
 * has already asked and where each stands.
 *
 * Nothing here describes what the product cannot do. Each answer points at a
 * screen that exists.
 */

export const metadata: Metadata = { title: 'Help and feedback' };

const STATE_TONE = { open: 'warning', answered: 'success', closed: 'neutral' } as const;

export default async function HelpPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  requireSession(session);

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.helpdesk) notFound();

  const office = pack.copy.officeName;
  const minutes = Math.max(1, Math.round(OTP_TTL_SECONDS / 60));
  const tickets = getMyTickets(session);
  const pages = pack.features.pages ? getMemberPages() : [];
  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };

  const faq: Array<{ q: string; a: React.ReactNode }> = [
    {
      q: 'I did not get my sign-in code',
      a: (
        <p>
          Codes arrive within a minute and work for {minutes} minutes. Look in your spam folder, check you used the email address you registered with,
          and ask for a new code if the old one has expired. If it still does not come, ask below and choose “Signing in or my account”.
        </p>
      ),
    },
    {
      q: 'My registration is still pending',
      a: (
        <p>
          The {office} checks every registration against the college’s records of graduates. A spelling that differs between the two is the
          usual reason it takes longer. Ask below and choose “Registration or verification”, and give your name as it appears on your degree.
        </p>
      ),
    },
    {
      q: 'Who can see my phone number and email?',
      a: (
        <p>
          Only the people you allow. You choose in <Link href="/settings/privacy" className="link">privacy settings</Link>, and final-year
          students never see alumni contact details, whatever you choose.
        </p>
      ),
    },
    {
      q: 'How do I correct something on my profile?',
      a: (
        <p>
          Edit it yourself from <Link href="/profile/edit" className="link">your profile</Link>. Details the college holds from its own records, such
          as your roll number and year of passing, are changed by the {office}: ask below and choose “My profile”.
        </p>
      ),
    },
    {
      q: 'How do I get a copy of my data, or have it erased?',
      a: (
        <p>
          Both are in <Link href="/settings/data" className="link">your data settings</Link>. The {office} answers every request within the time the
          law allows, and you can see where each one stands.
        </p>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Your account"
        title="Help and feedback"
        description={`Answers to the common questions, and a way to ask the ${office}.`}
      />

      <section aria-labelledby="faq-heading" className="max-w-3xl space-y-3">
        <h2 id="faq-heading" className="font-display text-xl font-semibold">
          Common questions
        </h2>
        <div className="divide-y divide-line rounded-lg border border-line bg-surface-raised">
          {faq.map((item, i) => (
            <Disclosure key={item.q} id={`faq-${i}`} summary={item.q}>
              <div className="space-y-2 px-4 pb-4 text-md text-secondary">{item.a}</div>
            </Disclosure>
          ))}
        </div>
        {pages.length > 0 ? (
          <p className="text-sm text-secondary">
            Also worth reading:{' '}
            {pages.map((p, i) => (
              <span key={p.slug}>
                {i > 0 ? ', ' : ''}
                <Link href={`/p/${p.slug}`} className="link">
                  {p.title.toLowerCase()}
                </Link>
              </span>
            ))}
            .
          </p>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle as="h2">Ask the {office}</CardTitle>
          </CardHeader>
          <CardBody>
            <TicketForm officeName={office} />
          </CardBody>
        </Card>

        <section aria-labelledby="mine-heading" className="space-y-3">
          <h2 id="mine-heading" className="font-display text-xl font-semibold">
            Your questions
          </h2>
          {tickets.length === 0 ? (
            <EmptyState
              variant="inline"
              icon={<LifeBuoy className="size-5" />}
              title="You have not asked anything yet"
              description="A question you send appears here with its answer. Feedback from the sidebar button appears here too."
            />
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface-raised">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link href={`/help/tickets/${t.reference}`} className="block px-4 py-3 transition-colors duration-fast ease-brand hover:bg-surface-sunken">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-secondary">{t.reference}</span>
                      <Badge tone={STATE_TONE[t.state]}>{TICKET_STATE_LABELS[t.state]}</Badge>
                      <Badge tone="outline">{TICKET_KIND_LABELS[t.kind]}</Badge>
                    </span>
                    <span className="mt-1 block font-medium">{t.subject}</span>
                    <span className="block text-xs text-secondary">
                      {ticketCategoryLabel(t.category)} · {formatRelative(t.updatedAt, timing)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
