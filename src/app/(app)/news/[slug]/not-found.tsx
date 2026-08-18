import type { Metadata } from 'next';
import { FileText, Link2, Newspaper, PenLine } from 'lucide-react';
import { ButtonLink, Card, CardBody, EmptyState } from '@/components/ui';

/**
 * Story not found.
 *
 * The common case here is not a broken portal, it is an old WhatsApp
 * forward — news links outlive the message they arrived in by months.
 * The second most common case is a draft: somebody on the alumni cell has
 * sent a colleague the address of a story they are still writing. Saying
 * so plainly is more useful than "404", and it does not disclose anything
 * about what is in the draft.
 */

export const metadata: Metadata = { title: 'Story not found' };

export default function NewsNotFound() {
  const reasons = [
    {
      icon: <Link2 className="size-4" />,
      title: 'The address has changed',
      body: 'A story is addressed by a slug taken from its headline. If the headline was corrected after publication, the old link stops resolving and the story is still on the news page under its new one.',
    },
    {
      icon: <PenLine className="size-4" />,
      title: 'It is still a draft',
      body: 'Nothing is readable here until the alumni cell publishes it. A draft has no page for members at all — not a locked one, not an empty one.',
    },
    {
      icon: <FileText className="size-4" />,
      title: 'It was taken down',
      body: 'Occasionally a story is withdrawn — a name spelled wrong, a figure that turned out to be provisional. The alumni cell republishes the corrected version rather than editing the record silently.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* EmptyState's title is a paragraph by design; the document still
          owes itself exactly one h1. */}
      <h1 className="sr-only">Story not found</h1>

      <EmptyState
        icon={<Newspaper className="size-5" />}
        title="That story is not on the news page"
        description="Either the link has aged out or the story was never published. The feed below has everything that is currently up."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/news">Go to the news page</ButtonLink>
            <ButtonLink href="/dashboard" variant="secondary">
              Back to the portal home
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
            If somebody forwarded you this link and you think it should work, send the alumni cell
            the address you clicked — they can see which story it was pointing at.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
