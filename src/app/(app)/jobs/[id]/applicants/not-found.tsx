import type { Metadata } from 'next';
import { Briefcase, LinkIcon, Lock, Timer, UserX } from 'lucide-react';
import { ButtonLink, Card, CardBody, EmptyState } from '@/components/ui';

/**
 * The applicant list did not resolve.
 *
 * Three rules land here and the page deliberately does not say which:
 * the posting was never there, it is a draft or a rejected submission
 * that only its author and a moderator can address, or the viewer is
 * neither the poster nor a holder of `job.applicants.export`. Naming the
 * one that caught you would let anybody walk the job ids and learn which
 * postings exist and who is hiring quietly.
 *
 * Listing the ordinary explanations is honest without confirming any of
 * them, and it gives someone who arrived from a forwarded link something
 * to do next.
 */

export const metadata: Metadata = { title: 'Applicant list not available' };

export default function JobApplicantsNotFound() {
  const reasons = [
    {
      icon: <LinkIcon className="size-4" />,
      title: 'The posting is not there',
      body: 'Job links get forwarded for months after a role is filled. A poster who closes and removes a listing takes this page with it.',
    },
    {
      icon: <UserX className="size-4" />,
      title: 'It is not your posting',
      body: 'The applicant list belongs to the alumnus who put the role up. Another alumnus reading the same posting on the board cannot see who answered it — that is the whole reason people are willing to apply through the portal.',
    },
    {
      icon: <Lock className="size-4" />,
      title: 'Your account does not hold job.applicants.export',
      body: 'Beyond the poster, only the placement cell reads applicant lists across postings. Moderating the board is a separate capability and does not carry it.',
    },
    {
      icon: <Timer className="size-4" />,
      title: 'The posting has not been published',
      body: 'A submission waiting on the placement cell, or one that was sent back, was never visible to students. Nobody could have applied, so there is no list to open.',
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
        description="Either the posting is not there any more, or reading who applied to it is not something this account can do."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/jobs">Back to the jobs board</ButtonLink>
            <ButtonLink href="/jobs?tab=mine" variant="secondary">
              Postings you put up
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

          <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
            If this is your own posting and the list still will not open, send the alumni cell the
            address you clicked — they can see which posting it points at without opening the list
            themselves.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
