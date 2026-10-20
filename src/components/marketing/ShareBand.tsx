import { MessageCircle } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { whatsappShareUrl } from '@/lib/share';

/**
 * "Bring your batch along" — a WhatsApp share of this page.
 *
 * An Indian alumni network spreads through batch WhatsApp groups, not
 * through email, so the one growth mechanism on the landing page is a
 * plain `wa.me` link with the text prefilled: no script, no SDK, no
 * tracking parameters, and it works whatever `features.whatsapp` says
 * (that flag is about the Business API, not about a share link).
 *
 * It is the page's one full-bleed dark moment: a diagonal from the brand
 * ramp's darkest stops, the same in both themes, with the brand glow in the
 * corner away from the words. It is deliberately not the band, which stays
 * the hero's and the footer's.
 *
 * The copy is careful about one thing: everyone registers with their own
 * roll number. A batch representative signing up forty classmates is
 * exactly the unverifiable registration the degree register exists to
 * prevent.
 */
export function ShareBand({
  shareText,
  origin,
  portalName,
  institutionName,
  rollMid,
}: {
  shareText?: string;
  /** This tenant's origin, from `siteOrigin()`. */
  origin: string;
  portalName: string;
  institutionName: string;
  rollMid: string;
}) {
  const text =
    shareText ??
    `${portalName}, the alumni network of ${institutionName}. Find your batch and register with your ${rollMid}:`;

  return (
    <section
      id="share"
      aria-labelledby="share-title"
      className="relative isolate overflow-hidden bg-[linear-gradient(135deg,var(--brand-900),var(--brand-700))] text-brand-50 [--focus-ring:var(--brand-50)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(48rem_28rem_at_100%_0%,color-mix(in_srgb,var(--brand-400)_30%,transparent),transparent_70%)]"
      />
      <div className="page-shell grid gap-6 py-10 md:gap-8 md:py-24 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-16">
        <h2
          id="share-title"
          className="reveal max-w-[12ch] font-display text-display-xl font-bold tracking-tight text-brand-50"
        >
          Bring your batch along
        </h2>

        <div className="space-y-6">
          <p className="max-w-prose text-md">
            Forward this page to your batch group. Everyone registers with their own {rollMid}, so nobody signs up
            on anyone else&apos;s behalf.
          </p>
          <ButtonLink
            href={whatsappShareUrl(text, `${origin}/`)}
            target="_blank"
            rel="noreferrer noopener"
            variant="band"
            size="lg"
            className="min-h-12 w-full sm:w-auto"
          >
            <MessageCircle className="size-5" aria-hidden="true" />
            Share on WhatsApp
            <span className="sr-only"> (opens WhatsApp)</span>
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
