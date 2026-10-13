import type { Metadata } from 'next';
import { Briefcase, LinkIcon, Timer, UserX } from 'lucide-react';
import { ButtonLink, Card, CardBody, EmptyState } from '@/components/ui';

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
    <div className="space-y-6">
      {/* EmptyState's title is a paragraph by design — the page still owes
          the document exactly one h1. */}
      <h1 className="sr-only">Applicant list not available</h1>

      <EmptyState
        icon={<Briefcase className="size-5" />}
        title="We cannot show you this applicant list"
        description="It is one of the three below. The jobs board and your own postings are one click away."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/jobs" className="min-h-11">
              Back to the jobs board
            </ButtonLink>
            <ButtonLink href="/jobs?tab=mine" variant="secondary" className="min-h-11">
              My postings
            </ButtonLink>
          </div>
        }
      />

      <Card className="mx-auto max-w-prose">
        <CardBody>
          <ul className="space-y-4 text-sm">
            {reasons.map((r) => (
              <li key={r.title} className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-muted" aria-hidden="true">
                  {r.icon}
                </span>
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-secondary">{r.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
