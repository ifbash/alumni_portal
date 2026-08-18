import type { Metadata } from 'next';
import { Briefcase, FileQuestion, Lock, Trash2 } from 'lucide-react';
import { ButtonLink, Card, CardBody, CardTitle, EmptyState } from '@/components/ui';

/**
 * A posting that did not resolve in the console.
 *
 * Unlike the member-facing pages, this one can afford to be specific:
 * everybody who reaches it already holds `job.moderate`, so naming the
 * ordinary causes tells them nothing they were not entitled to know. What
 * it must not do is imply the posting was deleted — nothing on this board
 * is, and a moderator who believes otherwise will go looking for a
 * recovery process that does not exist.
 */

export const metadata: Metadata = { title: 'Posting not found' };

export default function AdminJobNotFound() {
  return (
    <div className="space-y-6">
      {/* EmptyState's title is a paragraph by design — the page still owes
          the document exactly one h1. */}
      <h1 className="sr-only">Posting not found</h1>

      <EmptyState
        icon={<Briefcase className="size-5" />}
        title="No posting with that id"
        description="The queue could not find a submission at this address. Nothing has been lost — postings are never deleted from this board."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/admin/jobs">Back to the queue</ButtonLink>
            <ButtonLink href="/admin" variant="secondary">
              Console home
            </ButtonLink>
          </div>
        }
      />

      <Card className="mx-auto max-w-prose">
        <CardBody className="space-y-4">
          <CardTitle as="h2">What usually explains it</CardTitle>

          <ul className="space-y-4 text-sm">
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-muted" aria-hidden="true">
                <FileQuestion className="size-4" />
              </span>
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium">The id in the address is not a posting</p>
                <p className="text-secondary">
                  Console links are pasted between staff over WhatsApp and lose a character on the
                  way more often than anyone admits. Open the queue and find the role by its title.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-muted" aria-hidden="true">
                <Trash2 className="size-4" />
              </span>
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium">It is a draft that was never submitted</p>
                <p className="text-secondary">
                  A posting an alumnus started and did not send stays with them. It is not in the
                  moderation queue, because there is nothing yet to decide about.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-muted" aria-hidden="true">
                <Lock className="size-4" />
              </span>
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium">Your session no longer holds job.moderate</p>
                <p className="text-secondary">
                  Roles are a set and they change. If yours was edited while this tab was open, sign
                  out and back in — the console reads capabilities from the session cookie, not from
                  the page you were last on.
                </p>
              </div>
            </li>
          </ul>

          <p className="border-t border-line pt-4 text-xs text-muted">
            Every decision ever made on a posting is in the audit log under{' '}
            <span className="font-mono">job.moderate</span>, including the ones on postings you
            cannot open from here.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
