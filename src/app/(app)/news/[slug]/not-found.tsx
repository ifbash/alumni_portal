import type { Metadata } from 'next';
import { Newspaper } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { NotFoundPanel } from '../../_components/NotFoundPanel';

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
    <NotFoundPanel
      eyebrow="Story not found"
      icon={<Newspaper />}
      title="That story is not here"
      description="The link may be old or cut short."
      action={
        <ButtonLink href="/news" className="min-h-11">
          Read the latest news
        </ButtonLink>
      }
    />
  );
}
