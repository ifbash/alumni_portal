import type { Metadata } from 'next';
import { UserX } from 'lucide-react';
import { ButtonLink, Card, CardBody, CardTitle, EmptyState } from '@/components/ui';

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
 *
 * It still has to be useful, so it explains the ordinary reasons and puts
 * the search back in reach.
 */
export default function MemberNotFound() {
  return (
    <div className="space-y-6">
      <EmptyState
        icon={<UserX className="size-5" />}
        title="That profile is not available"
        description="The link may be old, the member may have left the network, or this record may not be one you can open."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/directory">Back to the directory</ButtonLink>
            <ButtonLink href="/connections" variant="secondary">
              Your connections
            </ButtonLink>
          </div>
        }
      />

      <Card className="mx-auto max-w-prose">
        <CardBody className="space-y-3">
          <CardTitle as="h2">Why this happens</CardTitle>
          <ul className="space-y-2 text-sm text-secondary">
            <li>
              <span className="font-medium text-primary">The link is out of date.</span> Profile
              addresses change when a member corrects the spelling of their name against the degree
              register.
            </li>
            <li>
              <span className="font-medium text-primary">The member is no longer listed.</span>{' '}
              Anyone can ask for their record to be removed, and the directory honours it the same
              day.
            </li>
            <li>
              <span className="font-medium text-primary">It is outside what you can see.</span>{' '}
              Students see alumni who have opted in, not other students. Staff see their own
              department.
            </li>
          </ul>
          <p className="text-sm text-secondary">
            If you were sent this link by someone at the college and it still does not open, the
            alumni cell can check the record against the register.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
