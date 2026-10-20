import type { Metadata } from 'next';
import { Briefcase, CalendarX, LinkIcon, ShieldCheck } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { NotFoundPanel } from '../NotFoundPanel';

/**
 * A posting that did not resolve.
 *
 * The same page answers a mistyped id, a posting the placement cell has
 * not yet approved (which only its author and a moderator may open) and a
 * college that has not taken the jobs board. It says none of them, so a
 * walk through job ids teaches nothing about what exists.
 */

export const metadata: Metadata = { title: 'Posting not found' };

export default function JobNotFound() {
  const reasons = [
    {
      icon: <LinkIcon className="size-4" />,
      title: 'The link is not complete',
      body: 'Links forwarded on WhatsApp lose their last few characters more often than you would think.',
    },
    {
      icon: <CalendarX className="size-4" />,
      title: 'The role has been taken down',
      body: 'Postings are removed once they are filled or when the company stops hiring.',
    },
    {
      icon: <ShieldCheck className="size-4" />,
      title: 'It has not been published yet',
      body: 'Students see a posting only after the placement cell has checked it.',
    },
  ];

  return (
    <NotFoundPanel
      documentTitle="Posting not found"
      icon={<Briefcase className="size-6" />}
      title="There is no open posting at this address"
      description="The board lists every role students can apply to today."
      actions={
        <>
          <ButtonLink href="/jobs" className="min-h-11">
            See open roles
          </ButtonLink>
        </>
      }
      reasons={reasons}
    />
  );
}
