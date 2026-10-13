import type { Metadata } from 'next';
import { Compass } from 'lucide-react';
import { ButtonLink, EmptyState } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Not found',
  robots: { index: false, follow: false },
};

/**
 * Not found, inside the platform console: a college or brand pack that
 * does not exist, or an old link to one.
 */
export default function PlatformNotFound() {
  return (
    <div className="space-y-6">
      {/* The visual heading is the empty state's title; this is the one the
          document outline needs. */}
      <h1 className="sr-only">Page not found</h1>

      <EmptyState
        icon={<Compass className="size-5" />}
        title="That page is not here"
        description="The link may be old, or the college or brand pack it pointed at is not on the platform."
        action={<ButtonLink href="/platform">Back to Colleges</ButtonLink>}
      />
    </div>
  );
}
