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
    <section id="share" aria-labelledby="share-title" className="border-t border-line py-10">
      <div className="page-shell flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 id="share-title" className="font-display text-display-xs font-bold">
            Bring your batch along
          </h2>
          <p className="mt-2 max-w-prose text-secondary">
            Forward this page to your batch group. Everyone registers with their own {rollMid}, so nobody signs
            up on anyone else&apos;s behalf.
          </p>
        </div>
        <ButtonLink
          href={whatsappShareUrl(text, `${origin}/`)}
          target="_blank"
          rel="noreferrer noopener"
          variant="secondary"
          size="lg"
          className="min-h-11 w-full shrink-0 sm:w-auto"
        >
          <MessageCircle className="size-5" aria-hidden="true" />
          Share on WhatsApp
          <span className="sr-only"> (opens WhatsApp)</span>
        </ButtonLink>
      </div>
    </section>
  );
}
