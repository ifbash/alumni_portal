import type { Metadata } from 'next';
import { CalendarX2 } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { NotFoundPanel } from '../../../_components/NotFoundPanel';

/**
 * The address is not a graduating year.
 *
 * Reached only when the segment is not four digits, or falls outside the
 * window the directory's own batch filter accepts. A year that is a real
 * year but has nobody in it is *not* sent here — that case gets the batch
 * page with its own empty state, because "2013 has nobody yet" and "2O13
 * is not an address" are different facts.
 *
 * These links get retyped off a WhatsApp forward more often than they get
 * clicked, so the way back is the point of this screen.
 */

export const metadata: Metadata = { title: 'Batch not found' };

export default function BatchNotFound() {
  return (
    <NotFoundPanel
      eyebrow="Batch not found"
      icon={<CalendarX2 />}
      title="That is not a graduating year"
      description="A batch page takes one four-digit year of passing. The link may have been cut short when it was forwarded."
      action={
        <ButtonLink href="/directory" className="min-h-11 sm:min-h-0">
          Browse batches in the directory
        </ButtonLink>
      }
    />
  );
}
