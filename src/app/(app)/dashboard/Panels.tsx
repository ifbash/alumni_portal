import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { Avatar, Card, ShareActions } from '@/components/ui';
import { cn } from '@/lib/cn';
import { memberLine } from '@/lib/format';

/**
 * Pieces of the signed-in homes that are not content cards: the people
 * panel, the WhatsApp invite, the activity timeline and the small link
 * that closes a block. They hold no data of their own; the pages read it
 * (behind their own capability checks) and hand it down.
 */

/** A person as these panels draw them. Always a projected directory row. */
export interface PersonLine {
  id: string;
  slug: string;
  fullName: string;
  photoUrl: string | null;
  designation?: string | null;
  currentCompany?: string | null;
}

/** The small link that closes a block. */
export function RailLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-fg hover:underline"
    >
      {children}
      <ArrowRight
        className="size-4 transition-transform duration-fast ease-brand group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

/**
 * Your people: the viewer's batch as an avatar stack and a count, and the
 * few people most recently active in their branch as plain lines. The
 * lines are not cards; the directory is one tap away for more.
 */
export function PeoplePanel({
  batchYear,
  batchTotal,
  batchmates,
  activeTitle,
  activeHref,
  active,
}: {
  batchYear: number | null;
  batchTotal: number | null;
  batchmates: PersonLine[];
  activeTitle: string;
  activeHref: string;
  active: PersonLine[];
}) {
  return (
    <Card as="section" aria-labelledby="people-title" className="min-w-0 overflow-hidden">
      <div className="p-card pb-3">
        <h2 id="people-title" className="font-display text-lg font-semibold tracking-tight">
          Your people
        </h2>

        {batchYear && batchTotal !== null ? (
          <Link
            href={`/directory/batch/${batchYear}`}
            className="group mt-3 flex items-center gap-3 rounded-lg bg-surface-sunken p-3 transition-colors duration-fast ease-brand hover:bg-brand-soft"
          >
            {batchmates.length ? (
              <ul className="flex shrink-0 -space-x-2" aria-label={`Some of the ${batchYear} batch`}>
                {batchmates.slice(0, 4).map((m) => (
                  <li key={m.id}>
                    <Avatar name={m.fullName} src={m.photoUrl} size="sm" className="ring-2 ring-[var(--surface-sunken)]" />
                  </li>
                ))}
              </ul>
            ) : null}
            <span className="min-w-0 flex-1 text-sm text-secondary">
              <span className="font-display text-lg font-bold tabular text-primary">
                {batchTotal.toLocaleString('en-IN')}
              </span>{' '}
              of the {batchYear} batch {batchTotal === 1 ? 'is' : 'are'} here
              <span className="sr-only">. See your batch.</span>
            </span>
            <ArrowRight
              className="size-4 shrink-0 text-brand-fg transition-transform duration-fast ease-brand group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        ) : null}
      </div>

      {active.length ? (
        <div className="border-t border-line px-card pb-2 pt-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="eyebrow min-w-0 truncate text-secondary">{activeTitle}</h3>
          </div>
          <ul className="mt-1 divide-y divide-line">
            {active.map((m) => (
              <li key={m.id} className="relative flex min-h-11 items-center gap-3 py-2">
                <Avatar name={m.fullName} src={m.photoUrl} size="sm" />
                <span className="min-w-0 flex-1 leading-tight">
                  <Link href={`/directory/${m.slug}`} className="link-quiet block truncate text-sm font-semibold after:absolute after:inset-0">
                    {m.fullName}
                  </Link>
                  <span className="block truncate text-xs text-secondary">
                    {memberLine([m.designation, m.currentCompany])}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <RailLink href={activeHref}>Search the directory</RailLink>
        </div>
      ) : null}
    </Card>
  );
}

/**
 * The invitation, as the one standout card on the page: a tinted brand
 * panel with soft discs of light behind it. WhatsApp first, as everywhere.
 * All text sits on the brand-soft fill in its own foreground token.
 */
export function InviteCard({
  title,
  shareTitle,
  url,
  whatsappHref,
}: {
  title: string;
  shareTitle: string;
  url: string;
  whatsappHref: string;
}) {
  return (
    <section
      aria-labelledby="invite-title"
      className="ring-hairline relative isolate overflow-hidden rounded-xl bg-brand-soft p-card text-brand-soft-fg shadow-md"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 -z-10 size-44 rounded-full bg-[color-mix(in_srgb,var(--brand-soft-fg)_9%,transparent)]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -left-10 -z-10 size-40 rounded-full bg-[color-mix(in_srgb,var(--brand-soft-fg)_6%,transparent)]"
      />
      <span
        className="grid size-10 place-items-center rounded-full bg-surface-raised text-brand-fg shadow-sm"
        aria-hidden="true"
      >
        <MessageCircle className="size-5" />
      </span>
      <h2 id="invite-title" className="mt-3 font-display text-lg font-bold leading-snug tracking-tight">
        {title}
      </h2>
      <ShareActions url={url} whatsappHref={whatsappHref} title={shareTitle} size="sm" className="mt-4" />
    </section>
  );
}

export interface TimelineEntry {
  id: string;
  title: string;
  unread: boolean;
  /** "5 hours ago". */
  ago: string;
  /** A verb for where it leads, with the destination. */
  action?: { href: string; label: string } | null;
}

/**
 * Recent activity as a timeline: a hairline runs down the left and each
 * entry is a dot on it, filled for unread. The dot is never the only
 * signal: unread entries also say "new" to a screen reader.
 */
export function ActivityTimeline({
  entries,
  className,
}: {
  entries: TimelineEntry[];
  className?: string;
}) {
  return (
    <ol
      className={cn(
        'relative space-y-1 before:absolute before:bottom-4 before:left-[7px] before:top-4 before:w-px before:bg-line',
        "before:content-['']",
        className,
      )}
    >
      {entries.map((n) => (
        <li key={n.id} className="relative pl-7">
          <span
            aria-hidden="true"
            className={cn(
              'absolute left-0 top-[1.15rem] size-[15px] rounded-full border-[3px] border-[var(--surface-raised)]',
              n.unread
                ? 'bg-[var(--button-primary-bg)] shadow-[0_0_0_1px_var(--button-primary-bg)]'
                : 'bg-line-strong',
            )}
          />
          <div className="py-2.5">
            <p className="text-sm font-medium leading-snug text-primary">
              {n.title}
              {n.unread ? <span className="sr-only"> (new)</span> : null}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-secondary">
              <span>{n.ago}</span>
              {n.action ? (
                <>
                  <span aria-hidden="true" className="text-muted">
                    ·
                  </span>
                  <Link
                    href={n.action.href}
                    className="-my-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-fg hover:underline"
                  >
                    {n.action.label}
                    <span className="sr-only">: {n.title}</span>
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
