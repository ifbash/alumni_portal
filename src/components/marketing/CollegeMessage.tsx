import type { CopySpec } from '@/lib/branding/pack';
import { SectionHead } from './SectionHead';

/**
 * A message from the college — usually the Principal's, as on Indian
 * college alumni pages.
 *
 * Text only, from `copy.collegeMessage`, and nothing at all when the
 * college has not written one: no invented name, no placeholder quote.
 * There is no portrait slot, because a portrait needs a fallback and
 * initials in a circle would be filler.
 *
 * Set as an editorial spread: the heading on the left, the words large on
 * the right, with an oversized quotation mark as the only ornament.
 *
 * No italics: not every pack ships an italic face (ifBash does not), and
 * a synthesised oblique of a display serif looks broken.
 */
export function CollegeMessage({ message }: { message: CopySpec['collegeMessage'] }) {
  if (!message) return null;

  const paragraphs = message.body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <section id="message" aria-labelledby="message-title" className="scroll-mt-20 py-10 md:py-section">
      <div className="page-shell grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <SectionHead
          id="message-title"
          eyebrow="From the college"
          title={message.heading ?? 'A message from the college'}
        />

        <figure className="reveal relative min-w-0 max-w-prose lg:pt-2">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-1 -top-10 select-none font-display text-[7rem] font-bold leading-none text-brand-fg lg:-left-10"
          >
            &ldquo;
          </span>
          <blockquote className="relative space-y-4 font-display text-xl leading-relaxed text-primary md:text-2xl md:leading-relaxed">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </blockquote>
          <figcaption className="mt-6 flex items-center gap-4 text-sm">
            <span aria-hidden="true" className="h-px w-10 bg-line-strong" />
            <span>
              <span className="font-semibold">{message.name}</span>,{' '}
              <span className="text-secondary">{message.role}</span>
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
