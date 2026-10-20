import type { Metadata } from 'next';
import { Images } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { NotFoundPanel } from '../../_components/NotFoundPanel';

/**
 * Album not found.
 *
 * A removed album, one still awaiting review, and one the viewer may not
 * open all land here, and the page does not say which. Telling a visitor
 * "this exists but is unpublished" confirms a contributed album its owner
 * has not agreed to show anybody, and with guessable slugs it confirms the
 * whole review queue. One plain sentence covers all of them.
 */

export const metadata: Metadata = { title: 'Album not found' };

export default function AlbumNotFound() {
  return (
    <NotFoundPanel
      eyebrow="Album not found"
      icon={<Images />}
      title="That album is not here"
      description="The link may be old, or the album is not open to your account yet."
      action={
        <ButtonLink href="/gallery" className="min-h-11">
          See all photos
        </ButtonLink>
      }
    />
  );
}
