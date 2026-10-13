import type { Metadata } from 'next';
import { CalendarOff } from 'lucide-react';
import { ButtonLink, EmptyState } from '@/components/ui';

/**
 * Event not found.
 *
 * Several different rules land here — a deleted event, an unpublished
 * draft, an alumni-only event opened by a student — and the page
 * deliberately does not say which. Telling a student "this exists but is
 * alumni-only" leaks the existence of the event and, with a guessable
 * slug, the whole calendar. One plain sentence covers all of them.
 */

export const metadata: Metadata = { title: 'Event not found' };

export default function EventNotFound() {
  return (
    <div className="space-y-6">
      {/* EmptyState's title is a paragraph by design — the page still owes
          the document exactly one h1. */}
      <h1 className="sr-only">Event not found</h1>

      <EmptyState
        icon={<CalendarOff className="size-5" />}
        title="That event is not here"
        description="The link may be old, or the event is not open to your account."
        action={
          <ButtonLink href="/events" className="min-h-11">
            See upcoming events
          </ButtonLink>
        }
      />
    </div>
  );
}
