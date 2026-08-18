import type { Metadata } from 'next';
import Link from 'next/link';
import { Megaphone, ScrollText } from 'lucide-react';

import { ButtonLink, Card, CardBody, CardDescription, CardTitle, EmptyState } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Campaign not found',
  robots: { index: false, follow: false },
};

/**
 * No campaign at that address.
 *
 * Two different causes land here and the page does not distinguish them,
 * because distinguishing them is how somebody works out which ids exist:
 * an id that never existed, and an id that exists but belongs to a record
 * this account cannot read. Reading a send record needs `audit.read`, and
 * the people who send campaigns are not always the people who audit them.
 */
export default function CampaignNotFound() {
  return (
    <div className="space-y-6">
      {/* The visual heading is the empty state's title; this is the one the
          document outline needs, so the h2s below descend from something. */}
      <h1 className="sr-only">Campaign not found</h1>

      <EmptyState
        icon={<Megaphone className="size-5" />}
        title="No campaign at that address"
        description="Either nothing was ever sent under that reference, or the record exists and reading it needs a capability this account does not hold. Both answer the same way, so that nobody can map what a college has sent by trying addresses."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/admin/comms">Back to communications</ButtonLink>
            <ButtonLink href="/admin/comms/new" variant="secondary">
              Write a new message
            </ButtonLink>
          </div>
        }
      />

      <Card>
        <CardBody className="space-y-3">
          <div className="space-y-1">
            <CardTitle as="h2">Where a campaign reference comes from</CardTitle>
            <CardDescription>
              There is no campaigns table. A send leaves one durable trace and this is how to find it.
            </CardDescription>
          </div>

          <ul className="space-y-2 text-sm text-secondary">
            <li>
              <span className="font-medium text-primary">The reference is an audit entry id.</span> Every broadcast
              writes one <span className="font-mono text-xs">comms.send</span> row carrying the actor, the subject and
              the recipient count. That row is the campaign; its id is what this page opens.
            </li>
            <li>
              <span className="font-medium text-primary">Reading it needs audit.read.</span> An HOD can send to their
              own branch and still not open the history — sending and auditing are separate grants, on purpose, so the
              two jobs can sit with two people.
            </li>
            <li>
              <span className="font-medium text-primary">Nothing here is ever deleted.</span> Audit rows are
              append-only, so a reference that worked yesterday has not been removed. A miss is a mistyped id or a
              record outside this account&rsquo;s reach.
            </li>
            <li>
              <span className="font-medium text-primary">Drafts have no reference.</span> The composer writes the
              audit entry at the moment of sending. A message that was never sent leaves nothing to open.
            </li>
          </ul>

          <p className="flex items-start gap-2 border-t border-line pt-3 text-sm text-secondary">
            <ScrollText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              The full send history is on the{' '}
              <Link href="/admin/comms" className="link">
                communications console
              </Link>
              , and every entry behind it is in{' '}
              <Link href="/admin/audit?action=comms.send" className="link">
                the audit log
              </Link>{' '}
              filtered to <span className="font-mono text-xs">comms.send</span>.
            </span>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
