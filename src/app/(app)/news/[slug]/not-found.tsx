import type { Metadata } from 'next';
import { Newspaper } from 'lucide-react';
import { ButtonLink, EmptyState } from '@/components/ui';

/**
 * Story not found.
 *
 * The common case is an old WhatsApp forward — news links outlive the
 * message they arrived in by months — and the next is a draft somebody
 * shared before it was published. The page says neither: one plain
 * sentence, and the way back to what is published.
 */

export const metadata: Metadata = { title: 'Story not found' };

export default function NewsNotFound() {
  return (
    <div className="space-y-6">
      {/* EmptyState's title is a paragraph by design; the document still
          owes itself exactly one h1. */}
      <h1 className="sr-only">Story not found</h1>

      <EmptyState
        icon={<Newspaper className="size-5" />}
        title="That story is not here"
        description="The link may be old or cut short."
        action={
          <ButtonLink href="/news" className="min-h-11">
            Read the latest news
          </ButtonLink>
        }
      />
    </div>
  );
}
