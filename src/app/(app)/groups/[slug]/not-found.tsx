import type { Metadata } from 'next';
import { UsersRound } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { NotFoundPanel } from '../../_components/NotFoundPanel';

/**
 * Group not found.
 *
 * A group that does not exist, one that is archived, and a chapter a student
 * may not open all land here, and the page does not say which. A student
 * told "that chapter exists but is for alumni" has learned something the
 * chapter list was written not to tell them.
 */

export const metadata: Metadata = { title: 'Group not found' };

export default function GroupNotFound() {
  return (
    <NotFoundPanel
      eyebrow="Group not found"
      icon={<UsersRound />}
      title="That group is not here"
      description="The link may be old, or the group is not open to your account."
      action={
        <ButtonLink href="/groups" className="min-h-11">
          See all groups
        </ButtonLink>
      }
    />
  );
}
