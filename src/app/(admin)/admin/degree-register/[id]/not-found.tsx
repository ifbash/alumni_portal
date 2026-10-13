import type { Metadata } from 'next';
import { ScrollText } from 'lucide-react';

import { Breadcrumbs, ButtonLink, EmptyState } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Register row not found · Staff console',
  robots: { index: false, follow: false },
};

/**
 * No register row at that address.
 *
 * The one thing worth saying is that a missing row is usually a missing
 * file, or a roll number off by a digit, and never proof that somebody did
 * not graduate. Search by name, then check which files are loaded.
 */
export default function RegisterRowNotFound() {
  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Staff console', href: '/admin' },
          { label: 'Degree register', href: '/admin/degree-register' },
          { label: 'Not found' },
        ]}
      />
      {/* The visual heading is the empty state's title; this is the one the
          document outline needs. */}
      <h1 className="sr-only">Register row not found</h1>

      <EmptyState
        icon={<ScrollText className="size-5" />}
        title="No register row at that address"
        description="The file for that batch may not be loaded yet, or the roll number is off by a digit. Search by name before deciding anything."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/admin/degree-register">Search the register</ButtonLink>
            <ButtonLink href="/admin/imports" variant="secondary">
              See which files are loaded
            </ButtonLink>
          </div>
        }
      />
    </div>
  );
}
