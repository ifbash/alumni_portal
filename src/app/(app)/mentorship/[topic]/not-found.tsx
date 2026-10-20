import type { Metadata } from 'next';
import { Compass, Link2, ShieldCheck, SignpostBig } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { NotFoundPanel } from '../../jobs/NotFoundPanel';

/**
 * Topic not found.
 *
 * Three different rules land here — a mistyped or renamed topic slug, a
 * college whose plan does not include the mentorship module, and an
 * account that has not been verified far enough to use the request
 * channel. The page does not say which, and deliberately does not list the
 * topics that do exist: on a tenant where the module is switched off, an
 * enumerated list would advertise a feature the college has not bought.
 *
 * The hub is one link away and lists everything, with live counts, for
 * whoever is entitled to see it.
 */

export const metadata: Metadata = { title: 'Topic not found' };

export default function MentorTopicNotFound() {
  const reasons = [
    {
      icon: <Link2 className="size-4" />,
      title: 'The address is not one of the topics',
      body: 'Topic links are short and get retyped from a WhatsApp forward more often than they get clicked. The hub lists every question with the number of graduates behind it, so it is quicker to pick from there than to guess the spelling.',
    },
    {
      icon: <SignpostBig className="size-4" />,
      title: 'The question was renamed or folded into another',
      body: 'Topics are edited as the alumni cell sees what students actually ask. An older link can point at a question that has since been merged with a broader one.',
    },
    {
      icon: <ShieldCheck className="size-4" />,
      title: 'Your account cannot use the request channel yet',
      body: 'Mentorship is the directory’s request channel under a friendlier name, so it needs the same verified standing. A pending account can sign in and finish its profile, but cannot open these pages.',
    },
  ];

  return (
    <NotFoundPanel
      documentTitle="Mentorship topic not found"
      icon={<Compass className="size-6" />}
      title="There is no mentorship topic at this address"
      description="Either the link points at something that is not a question we group by, or it is not one your account can open. Here is what usually explains it."
      actions={
        <>
          <ButtonLink href="/mentorship" className="min-h-11">
            Back to the topics
          </ButtonLink>
          <ButtonLink href="/directory?mentoring=1" variant="secondary" className="min-h-11">
            Everyone open to mentoring
          </ButtonLink>
        </>
      }
      reasons={reasons}
      footnote="If a lecturer or the placement cell sent you this link and you think it should open, write to the alumni cell with the address you clicked. They can see which topic it was meant to point at."
    />
  );
}
