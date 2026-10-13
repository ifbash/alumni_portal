import type { Metadata } from 'next';
import { Mail } from 'lucide-react';

import { ButtonLink, EmptyState } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Message not found · Staff console',
  robots: { index: false, follow: false },
};

/**
 * No sent message at that address.
 *
 * Two causes land here and the page does not tell them apart, because
 * telling them apart is how somebody works out which references exist: a
 * reference that never existed, and one this account cannot open.
 */
export default function SentMessageNotFound() {
  return (
    <div className="space-y-6">
      {/* The empty state's title is a paragraph; the document still needs its h1. */}
      <h1 className="sr-only">Message not found</h1>

      <EmptyState
        icon={<Mail className="size-5" />}
        title="No message at this address"
        description="Nothing was sent under this reference, or it is outside what your account can open."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/admin/comms">Back to messages</ButtonLink>
            <ButtonLink href="/admin/comms/new" variant="secondary">
              Write a new message
            </ButtonLink>
          </div>
        }
      />
    </div>
  );
}
