import type { Metadata } from 'next';
import { Store } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { NotFoundPanel } from '../../_components/NotFoundPanel';

/**
 * Listing not found.
 *
 * A listing that does not exist, one still awaiting review and one that was
 * declined all land here, and the page does not say which: telling a visitor
 * "that exists but is not approved" confirms the review queue to anyone who
 * can guess an address.
 */

export const metadata: Metadata = { title: 'Business not found' };

export default function BusinessNotFound() {
  return (
    <NotFoundPanel
      eyebrow="Business not found"
      icon={<Store />}
      title="That business is not here"
      description="The link may be old, or the listing is not open to your account."
      action={
        <ButtonLink href="/businesses" className="min-h-11">
          See the directory
        </ButtonLink>
      }
    />
  );
}
