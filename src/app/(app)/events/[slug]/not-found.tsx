import type { Metadata } from 'next';
import { CalendarOff } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { NotFoundPanel } from '../../_components/NotFoundPanel';

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
    <NotFoundPanel
      eyebrow="Event not found"
      icon={<CalendarOff />}
      title="That event is not here"
      description="The link may be old, or the event is not open to your account."
      action={
        <ButtonLink href="/events" className="min-h-11">
          See upcoming events
        </ButtonLink>
      }
    />
  );
}
