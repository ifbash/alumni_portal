import type { Metadata } from 'next';
import { CalendarX2, Link2, PencilLine, ShieldCheck } from 'lucide-react';
import { ButtonLink, Card, CardBody, EmptyState } from '@/components/ui';

/**
 * The address is not a graduating year.
 *
 * Reached only when the segment is not four digits, or falls outside the
 * window the directory's own batch filter accepts. A year that is a real
 * year but has nobody in it is *not* sent here — that case gets the batch
 * page with an honest empty state, because "2013 has nobody yet" and
 * "2O13 is not an address" are different facts and a reader who is told
 * the wrong one stops trusting the page.
 *
 * These links get retyped off a WhatsApp forward more often than they get
 * clicked, so the recovery path is the point of this screen.
 */

export const metadata: Metadata = { title: 'Batch not found' };

export default function BatchNotFound() {
  const reasons = [
    {
      icon: <PencilLine className="size-4" />,
      title: 'The year came through mangled',
      body: 'A forwarded link that got retyped, or one that a chat app wrapped and broke across two lines. The address needs exactly four digits — /directory/batch/2017, with nothing after it.',
    },
    {
      icon: <Link2 className="size-4" />,
      title: 'The link points at a range, not a year',
      body: 'A search across several batches lives in the directory with a batchFrom and a batchTo. This page is one year at a time; the directory takes the range.',
    },
    {
      icon: <ShieldCheck className="size-4" />,
      title: 'Your account cannot open the directory',
      body: 'Every list of members in the portal needs a verified, signed-in account behind it. An account still waiting on verification can sign in and finish its profile, but cannot browse batches yet.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* `EmptyState`'s title is a paragraph by design — the document still
          owes itself exactly one h1. */}
      <h1 className="sr-only">Batch not found</h1>

      <EmptyState
        icon={<CalendarX2 className="size-5" />}
        title="That is not a graduating year"
        description="A batch page is one four-digit year, like 2017. Whatever came after /directory/batch was not one, so there is nothing to show — not even an empty batch."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/directory">Search the directory</ButtonLink>
            <ButtonLink href="/directory/batch/2017" variant="secondary">
              Batch of 2017
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
            The directory holds the same search with a batch filter on it, and the address bar there
            carries the whole query — so a link copied out of it reproduces exactly what you were
            looking at for whoever you send it to.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
