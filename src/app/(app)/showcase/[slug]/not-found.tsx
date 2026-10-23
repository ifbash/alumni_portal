import type { Metadata } from 'next';
import { Award } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { NotFoundPanel } from '../../_components/NotFoundPanel';

/**
 * Entry not found.
 *
 * An entry that does not exist, one waiting for review, one declined and one
 * a curator took down all land here, and the page does not say which. Saying
 * "that exists but is not published" would confirm who has been put forward.
 */

export const metadata: Metadata = { title: 'Entry not found' };

export default function ShowcaseEntryNotFound() {
  return (
    <NotFoundPanel
      eyebrow="Entry not found"
      icon={<Award />}
      title="That entry is not here"
      description="The link may be old, or the entry is not open to your account."
      action={
        <ButtonLink href="/showcase" className="min-h-11">
          See the showcase
        </ButtonLink>
      }
    />
  );
}
