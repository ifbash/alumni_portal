import type { Metadata } from 'next';
import Link from 'next/link';
import { FileUp, ScrollText } from 'lucide-react';

import { ButtonLink, Card, CardBody, CardDescription, CardTitle, EmptyState } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Register row not found',
  robots: { index: false, follow: false },
};

/**
 * No register row at that address.
 *
 * The important thing this page has to say is that a missing row is
 * usually a missing *file*. An operator who reads this as "that graduate
 * does not exist" will reject a legitimate claim; an operator who reads it
 * as "the 2019 ECE batch has not been supplied yet" will chase the
 * examinations branch, which is the action that actually fixes it.
 */
export default function RegisterRowNotFound() {
  return (
    <div className="space-y-6">
      {/* The visual heading is the empty state's title; this is the one the
          document outline needs, so the h2s below descend from something. */}
      <h1 className="sr-only">Register row not found</h1>

      <EmptyState
        icon={<ScrollText className="size-5" />}
        title="No register row at that address"
        description="Nothing in the degree register carries that row id or that roll number. That is a statement about what the college has loaded, not about who has graduated."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/admin/degree-register">Search the register</ButtonLink>
            <ButtonLink href="/admin/degree-register/upload" variant="secondary">
              Load a register file
            </ButtonLink>
          </div>
        }
      />

      <Card>
        <CardBody className="space-y-3">
          <div className="space-y-1">
            <CardTitle as="h2">What a missing row usually means</CardTitle>
            <CardDescription>In the order it happens, and none of them is the graduate&rsquo;s fault.</CardDescription>
          </div>

          <ul className="space-y-2 text-sm text-secondary">
            <li>
              <span className="font-medium text-primary">The batch file has not been loaded.</span> The register is
              built from files the examinations branch sends, one per year and branch. Results reach them months after
              the ceremony, so a recent gap is ordinary and anything older is a file nobody chased. A graduate from a
              missing year cannot be verified at all.
            </li>
            <li>
              <span className="font-medium text-primary">The roll number is off by a digit.</span> Eight years after
              graduating, the last two digits are the part people get wrong. Search the name instead — the register
              spelling follows the marks memorandum, so try one distinctive part of it rather than the whole thing.
            </li>
            <li>
              <span className="font-medium text-primary">The row id came from a replaced import.</span> A corrected
              file loads new rows; a link into the superseded set stops resolving. The roll number still finds the
              current row.
            </li>
            <li>
              <span className="font-medium text-primary">Reading the register is a wider grant than deciding a
              claim.</span> An HOD reviews their own branch&rsquo;s claims and does not open the register itself; this
              page answers the same way for a row that does not exist and one that is not theirs to know about.
            </li>
          </ul>

          <p className="flex items-start gap-2 border-t border-line pt-3 text-sm text-secondary">
            <FileUp className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Check{' '}
              <Link href="/admin/imports" className="link">
                the import history
              </Link>{' '}
              before deciding anything against this. If the file for that year and branch is not in it, leave the claim
              queued and chase the file — rejecting a graduate because the college has not supplied its own record is
              the one outcome the queue exists to prevent.
            </span>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
