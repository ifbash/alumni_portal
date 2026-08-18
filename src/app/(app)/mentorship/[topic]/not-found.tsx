import type { Metadata } from 'next';
import { Compass, Link2, ShieldCheck, SignpostBig } from 'lucide-react';
import { ButtonLink, Card, CardBody, EmptyState } from '@/components/ui';

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
    <div className="space-y-6">
      {/* `EmptyState`'s title is a paragraph by design — the document still
          owes itself exactly one h1. */}
      <h1 className="sr-only">Mentorship topic not found</h1>

      <EmptyState
        icon={<Compass className="size-5" />}
        title="There is no mentorship topic at this address"
        description="Either the link points at something that is not a question we group by, or it is not one your account can open. Here is what usually explains it."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/mentorship">Back to the topics</ButtonLink>
            <ButtonLink href="/directory?mentoring=1" variant="secondary">
              Everyone open to mentoring
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
            If a lecturer or the placement cell sent you this link and you think it should open,
            write to the alumni cell with the address you clicked — they can see which topic it was
            meant to point at.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
