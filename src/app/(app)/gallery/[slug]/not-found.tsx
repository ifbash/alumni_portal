import type { Metadata } from 'next';
import { Eye, ImageOff, LinkIcon, Lock, ShieldCheck } from 'lucide-react';
import { ButtonLink, Card, CardBody, EmptyState } from '@/components/ui';

/**
 * Album not found.
 *
 * Three different rules land here — a removed album, one still awaiting
 * review, and a link opened by an account that is not verified yet — and
 * the page does not say which. Telling a visitor "this exists but is
 * unpublished" confirms the existence of a contributed album its owner has
 * not agreed to show anybody, and with guessable slugs it confirms the
 * whole review queue. Listing what usually explains it is honest without
 * confirming any single one, and it gives someone who arrived from an old
 * WhatsApp forward something to do next.
 */

export const metadata: Metadata = { title: 'Album not found' };

export default function AlbumNotFound() {
  const reasons = [
    {
      icon: <Eye className="size-4" />,
      title: 'It is waiting on a review',
      body: 'Albums sent in by graduates are read before they go live — captions, tags and whether the photographs are the college’s to publish. Until that is done only the alumni cell can open them.',
    },
    {
      icon: <LinkIcon className="size-4" />,
      title: 'The link has moved on',
      body: 'Album links get forwarded for years. If the alumni cell renamed the album or took it down, an old address stops resolving.',
    },
    {
      icon: <ShieldCheck className="size-4" />,
      title: 'Somebody asked to be removed',
      body: 'A member can ask for a photograph they are in to be taken down, and the whole album comes down while that is sorted out. It is meant to be quick.',
    },
    {
      icon: <Lock className="size-4" />,
      title: 'Your account is not verified yet',
      body: 'The archive opens once your record is matched against the college degree register. A pending account can sign in, and nothing more.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* EmptyState's title is a paragraph by design — the page still owes
          the document exactly one h1. */}
      <h1 className="sr-only">Album not found</h1>

      <EmptyState
        icon={<ImageOff className="size-5" />}
        title="We cannot show you this album"
        description="Either it is not there any more, or it is not one you can see yet. Here is what usually explains it."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/gallery">Back to the photographs</ButtonLink>
            <ButtonLink href="/dashboard" variant="secondary">
              Go to the portal home
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
            If you sent these photographs in yourself and cannot find them, write to the alumni cell with the address
            you clicked — they can see which album it points at and what was decided about it.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
