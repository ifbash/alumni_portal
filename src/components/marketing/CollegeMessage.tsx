import type { CopySpec } from '@/lib/branding/pack';

/**
 * A message from the college — usually the Principal's, as on Indian
 * college alumni pages.
 *
 * Text only, from `copy.collegeMessage`, and nothing at all when the
 * college has not written one: no invented name, no placeholder quote.
 * There is no portrait slot, because a portrait needs a fallback and
 * initials in a circle would be filler.
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
    <section id="message" aria-labelledby="message-title" className="scroll-mt-20 border-t border-line py-10 md:py-section">
      <div className="page-shell">
        <h2 id="message-title" className="font-display text-display-xs font-bold">
          {message.heading ?? 'A message from the college'}
        </h2>
        <figure className="mt-6 max-w-prose">
          <blockquote className="space-y-4 font-display text-xl leading-relaxed text-primary">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </blockquote>
          <figcaption className="mt-4 text-sm">
            <span className="font-semibold">{message.name}</span>,{' '}
            <span className="text-secondary">{message.role}</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
