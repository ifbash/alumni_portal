import type { Metadata } from 'next';
import { Briefcase } from 'lucide-react';
import { ButtonLink, EmptyState } from '@/components/ui';

/**
 * A posting that did not resolve in the console. It must not imply the
 * posting was deleted: nothing on this board is.
 */

export const metadata: Metadata = { title: 'Posting not found · Staff console' };

export default function AdminJobNotFound() {
  return (
    <div className="space-y-6">
      {/* The empty state's title is a paragraph; the document still needs its h1. */}
      <h1 className="sr-only">Posting not found</h1>

      <EmptyState
        icon={<Briefcase className="size-5" />}
        title="No posting at this address"
        description="The link may be mistyped. Postings are never deleted, so find it in the list by its title."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/admin/jobs">Back to jobs</ButtonLink>
            <ButtonLink href="/admin" variant="secondary">
              Staff console
            </ButtonLink>
          </div>
        }
      />
    </div>
  );
}
