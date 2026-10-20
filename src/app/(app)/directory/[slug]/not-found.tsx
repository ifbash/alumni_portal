import type { Metadata } from 'next';
import { UserX } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { NotFoundPanel } from '../../_components/NotFoundPanel';

export const metadata: Metadata = {
  title: 'Profile not found',
};

/**
 * A profile that did not resolve.
 *
 * Deliberately says the same thing whether the slug never existed, the
 * member left, or the viewer is not entitled to see them. A page that
 * distinguished "no such person" from "not allowed" would let anyone
 * enumerate the student roll by trying URLs, which is the whole reason
 * students cannot list students in the first place.
 */
export default function MemberNotFound() {
  return (
    <NotFoundPanel
      eyebrow="Profile not found"
      icon={<UserX />}
      title="That profile is not available"
      description="The link may be old, or the member may have left the network. Some profiles are visible only to certain members of the college."
      action={
        <ButtonLink href="/directory" className="min-h-11 sm:min-h-0">
          Back to the directory
        </ButtonLink>
      }
    />
  );
}
