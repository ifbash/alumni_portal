import type { Metadata } from 'next';
import { CalendarOff, GraduationCap, Lock, LinkIcon } from 'lucide-react';
import { ButtonLink, Card, CardBody, EmptyState } from '@/components/ui';

/**
 * Event not found.
 *
 * Three different rules land here — a deleted event, an unpublished draft,
 * and an alumni-only event opened by a student — and the page deliberately
 * does not say which. Telling a student "this exists but is alumni-only"
 * leaks the existence of the event and, with a guessable slug, the whole
 * calendar. Listing the possibilities is honest without confirming any of
 * them, and it gives someone who arrived from a WhatsApp forward something
 * useful to do next.
 */

export const metadata: Metadata = { title: 'Event not found' };

export default function EventNotFound() {
  const reasons = [
    {
      icon: <LinkIcon className="size-4" />,
      title: 'The link has moved on',
      body: 'Event links get forwarded on WhatsApp for months. If the alumni cell took this one down or changed its address, an old link stops resolving.',
    },
    {
      icon: <CalendarOff className="size-4" />,
      title: 'It is still a draft',
      body: 'Events are only visible once the date and venue are fixed and the alumni cell publishes them. Until then only the organisers can open the page.',
    },
    {
      icon: <GraduationCap className="size-4" />,
      title: 'It is not addressed to your cohort',
      body: 'Batch reunions and some chapter dinners are for alumni only. They do not appear anywhere in the final-year student portal, including by direct link.',
    },
    {
      icon: <Lock className="size-4" />,
      title: 'Your account is not verified yet',
      body: 'Registration is tied to your record in the college degree register. A pending account can sign in but cannot open event pages.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* EmptyState's title is a paragraph by design — the page still owes
          the document exactly one h1. */}
      <h1 className="sr-only">Event not found</h1>

      <EmptyState
        icon={<CalendarOff className="size-5" />}
        title="We cannot show you this event"
        description="Either it is not there any more, or it is not one you can see. Here is what usually explains it."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/events">Back to events</ButtonLink>
            <ButtonLink href="/dashboard" variant="secondary">
              Go to the portal home
            </ButtonLink>
          </div>
        }
      />

      <Card className="mx-auto max-w-prose">
        <CardBody>
          <ul className="space-y-4 text-sm">
            {reasons.map((r) => (
              <li key={r.title} className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-muted" aria-hidden="true">
                  {r.icon}
                </span>
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-secondary">{r.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
            If a coordinator sent you this link and you think you should be able to open it, write
            to the alumni cell with the address you clicked — they can see which event it points at.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
