import type { Metadata } from 'next';
import { Briefcase, LinkIcon, Timer, UserX } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { NotFoundPanel } from '../../NotFoundPanel';

/**
 * The applicant list did not resolve.
 *
 * Three rules land here and the page deliberately does not say which:
 * the posting was never there, it is a submission only its author and a
 * moderator can address, or the viewer is neither the poster nor the
 * placement cell. Naming the one that caught you would let anybody walk
 * the job ids and learn which postings exist and who is hiring quietly.
 */

export const metadata: Metadata = { title: 'Applicant list not available' };

export default function JobApplicantsNotFound() {
  const reasons = [
    {
      icon: <LinkIcon className="size-4" />,
      title: 'The posting is not there',
      body: 'Job links get forwarded long after a role is filled.',
    },
    {
      icon: <UserX className="size-4" />,
      title: 'This is not your posting',
      body: 'An applicant list is open to the person who posted the role and to the placement cell.',
    },
    {
      icon: <Timer className="size-4" />,
      title: 'The posting has not been published',
      body: 'Students never saw it, so nobody could have applied.',
    },
  ];

  return (
    <NotFoundPanel
      documentTitle="Applicant list not available"
      icon={<Briefcase className="size-6" />}
      title="We cannot show you this applicant list"
      description="It is one of the three below. The jobs board and your own postings are one click away."
      actions={
        <>
          <ButtonLink href="/jobs" className="min-h-11">
            Back to the jobs board
          </ButtonLink>
          <ButtonLink href="/jobs?tab=mine" variant="secondary" className="min-h-11">
            My postings
          </ButtonLink>
        </>
      }
      reasons={reasons}
    />
  );
}
