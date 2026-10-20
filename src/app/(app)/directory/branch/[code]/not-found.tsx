import type { Metadata } from 'next';
import { Compass, PencilLine, ShieldCheck, SignpostBig } from 'lucide-react';
import { ButtonLink, Card, CardBody } from '@/components/ui';
import { NotFoundPanel } from '../../../_components/NotFoundPanel';

/**
 * The address is not a branch code.
 *
 * Deliberately does not list the codes that do exist. The valid set comes
 * from the college's own department table, and enumerating it here would
 * put one tenant's department list on a page that any signed-in account
 * can reach by guessing — including accounts that cannot open the
 * directory at all. The directory itself lists every branch, with counts,
 * for whoever is entitled to see them.
 */

export const metadata: Metadata = { title: 'Branch not found' };

export default function BranchNotFound() {
  const reasons = [
    {
      icon: <PencilLine className="size-4" />,
      title: 'The code is not one this college uses',
      body: 'Branch codes vary between colleges under the same university — CSM, CSD, AIML and AI&ML are all real codes somewhere. This page only answers to the codes on this college’s own department list.',
    },
    {
      icon: <SignpostBig className="size-4" />,
      title: 'The department was renamed or merged',
      body: 'A branch that has been folded into another keeps its graduates, but not its address. The directory’s branch filter shows the current list with a count beside each one.',
    },
    {
      icon: <ShieldCheck className="size-4" />,
      title: 'Your account cannot open the directory',
      body: 'Every list of members needs a verified, signed-in account behind it. An account still waiting on verification can sign in and finish its profile, but cannot browse departments yet.',
    },
  ];

  return (
    <div className="space-y-6">
      <NotFoundPanel
        eyebrow="Branch not found"
        icon={<Compass />}
        title="There is no branch at this address"
        description="A branch page answers to a department code from the college’s own register, like CSE or ECE. Whatever came after /directory/branch was not one of them."
        action={
          <>
            <ButtonLink href="/directory" className="min-h-11">
              Browse by branch
            </ButtonLink>
            <ButtonLink href="/directory?mentoring=1" variant="secondary" className="min-h-11">
              Everyone open to mentoring
            </ButtonLink>
          </>
        }
      />

      <Card className="max-w-prose">
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
            The directory&apos;s filter panel lists every branch this college runs with the number of
            members behind each. Picking one there produces an address you can copy and send on.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
