import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check, Clock, Hourglass, Info, Mail, MessageCircle } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getTenantBrand } from '@/lib/tenant';
import { inSentence } from '@/lib/branding/copy';
import { siteOrigin, whatsappShareUrl } from '@/lib/share';
import { Alert, Badge, ButtonLink, Card, CardBody } from '@/components/ui';
import { cn } from '@/lib/cn';
import { AuthHeader } from '../_components/AuthHeader';

/** Stagger index for the entrance; see `.stagger` in globals.css. */
const at = (n: number) => ({ '--i': n }) as React.CSSProperties;

export const metadata: Metadata = {
  title: 'Your registration is being checked',
  description: 'What happens after you register as an alumnus.',
};

/**
 * The waiting room.
 *
 * This page exists because the alternative — a toast that says
 * "submitted" and a redirect to the sign-in screen — makes people submit
 * the same registration four times and then email the college asking
 * whether the portal is broken. It says who has it, what they do with it,
 * and what to do if the answer never comes.
 *
 * It states a review time only when the pack sets `reviewTurnaround`. A
 * number typed into this component would be a promise the college never
 * made. It says what happens in the registrant's terms — checked against
 * the college's records, confirmed by a person — and never how: no
 * matcher, scores, queues or notice versions.
 *
 * `?match=1` (sent by the registration form when the register matched
 * exactly) marks the records check as done. It only changes which step is
 * current; an exact match still waits for the office to confirm it, which
 * is what the product does.
 */
export default async function PendingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  // An approved member who lands here has nothing to wait for.
  if (session && session.status !== 'pending') redirect('/dashboard');

  const sp = await searchParams;
  const email = typeof sp.email === 'string' ? sp.email.trim() : '';
  const matched = sp.match === '1';

  const { brand } = (await getTenantBrand())!;
  const copy = brand.pack.copy;
  const office = copy.officeName;
  const rollMid = inSentence(copy.rollNumberLabel);

  // The WhatsApp growth loop: somebody who has just registered is the
  // likeliest person to forward the link to their batch group. The link
  // is the portal's home page on this tenant's own host — never this
  // page, which carries the registrant's address in its query string.
  const shareHref = whatsappShareUrl(
    copy.shareText ??
      `${copy.portalName}, the alumni network of ${copy.institutionName}. Find your batch and register with your ${rollMid}:`,
    `${await siteOrigin()}/`,
  );

  const steps: Array<{ state: 'done' | 'current' | 'waiting'; title: string; body: string }> = [
    {
      state: 'done',
      title: 'Registration received',
      body: `We have your ${rollMid}, name, branch and year of passing, and your agreement to check them.`,
    },
    matched
      ? {
          state: 'done',
          title: "Found in the college's records",
          body: 'Your details matched the list of graduates the examinations branch keeps.',
        }
      : {
          state: 'current',
          title: "Checked against the college's records",
          body: 'Your details are compared with the list of graduates the examinations branch keeps.',
        },
    {
      state: matched ? 'current' : 'waiting',
      title: `Confirmed by the ${office}`,
      body: `A person confirms the match and opens your account${copy.reviewTurnaround ? `, usually within ${copy.reviewTurnaround}` : ''}. You are emailed either way.`,
    },
  ];

  return (
    <div className="stagger space-y-8">
      <AuthHeader
        icon={
          <>
            {/* A slow ripple behind the hourglass: it is being looked at. */}
            <span className="absolute inset-0 rounded-full bg-brand-soft opacity-70 motion-safe:animate-ping" />
            <Hourglass className="relative size-5" />
          </>
        }
        title={`Your registration is with the ${office}`}
      >
        <p>
          {email ? (
            <>
              We will write to <span className="break-all font-medium text-primary">{email}</span> as
              soon as it has been looked at. There is nothing else for you to do.
            </>
          ) : (
            <>
              We will write to the address you gave as soon as it has been looked at. There is
              nothing else for you to do.
            </>
          )}
        </p>
      </AuthHeader>

      <Card style={at(1)} className="overflow-hidden">
        <CardBody>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <h2 className="font-display text-lg font-semibold">Where your registration is</h2>
            <Badge tone="warning" dot>
              Awaiting verification
            </Badge>
          </div>

          {/* Progress at a glance: one segment per step, filled as it is done. */}
          <div aria-hidden="true" className="mb-6 flex gap-1.5">
            {steps.map((step) => (
              <span
                key={step.title}
                className={cn(
                  'h-1.5 flex-1 rounded-full',
                  step.state === 'done' && 'bg-success',
                  step.state === 'current' && 'bg-brand-500 motion-safe:animate-pulse',
                  step.state === 'waiting' && 'bg-line',
                )}
              />
            ))}
          </div>

          <ol>
            {steps.map((step, i) => {
              const last = i === steps.length - 1;
              return (
                <li key={step.title} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        'grid size-7 shrink-0 place-items-center rounded-full',
                        step.state === 'done' && 'bg-success-soft text-success-fg',
                        step.state === 'current' && 'bg-brand-soft text-brand-soft-fg ring-4 ring-[color-mix(in_srgb,var(--brand-500)_20%,transparent)]',
                        step.state === 'waiting' && 'border border-line bg-surface-sunken text-muted',
                      )}
                      aria-hidden="true"
                    >
                      {step.state === 'done' ? (
                        <Check className="size-3.5" />
                      ) : step.state === 'current' ? (
                        <Hourglass className="size-3.5" />
                      ) : (
                        <Clock className="size-3.5" />
                      )}
                    </span>
                    {!last ? <span className="w-px flex-1 bg-line" aria-hidden="true" /> : null}
                  </div>

                  <div className={cn('space-y-1', last ? 'pb-0' : 'pb-6')}>
                    <p className="font-semibold">
                      {step.title}
                      <span className="ml-2 text-xs font-medium text-secondary">
                        {step.state === 'done'
                          ? 'Done'
                          : step.state === 'current'
                            ? 'In progress'
                            : 'Next'}
                      </span>
                    </p>
                    <p className="text-sm text-secondary">{step.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </CardBody>
      </Card>

      <Alert
        style={at(2)}
        tone="neutral"
        title="Do not submit the form again"
        icon={<Info className="size-4 text-brand-fg" />}
      >
        <p>
          A second registration does not speed things up. It only gives the {office} a duplicate to
          close first.
        </p>
      </Alert>

      <Card style={at(3)}>
        <CardBody className="space-y-3">
          <h2 className="font-display text-base font-semibold">
            {copy.reviewTurnaround
              ? `If you have not heard within ${copy.reviewTurnaround}`
              : 'If you have not heard back'}
          </h2>
          <p className="text-sm text-secondary">
            Check your spam folder first. Then write to the {office} with your {rollMid}, year of
            passing and a scan of your degree certificate. A name that reads differently on the
            certificate is the most common hold-up, and a scan usually settles it in one exchange.
          </p>
          {copy.supportEmail ? (
            <p className="flex items-center gap-2 text-sm">
              <Mail className="size-4 shrink-0 text-muted" aria-hidden="true" />
              <a href={`mailto:${copy.supportEmail}`} className="link">
                {copy.supportEmail}
              </a>
            </p>
          ) : null}
        </CardBody>
      </Card>

      <div style={at(4)} className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <ButtonLink href="/" variant="secondary">
          Back to {copy.portalName}
        </ButtonLink>
        <p className="text-sm text-secondary">
          Already been approved?{' '}
          <Link
            href={email ? `/login?email=${encodeURIComponent(email)}` : '/login'}
            className="link"
          >
            Sign in
          </Link>
          .
        </p>
      </div>

      <section
        style={at(5)}
        aria-labelledby="share-title"
        className="space-y-2 rounded-lg bg-surface-sunken p-5"
      >
        <h2 id="share-title" className="font-display text-base font-semibold">
          Bring your batch along
        </h2>
        <p className="text-sm text-secondary">
          Forward the link to your batch group. Everyone registers with their own {rollMid}.
        </p>
        <ButtonLink
          href={shareHref}
          target="_blank"
          rel="noreferrer noopener"
          variant="secondary"
          size="md"
          className="min-h-11"
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          Share on WhatsApp
          <span className="sr-only"> (opens WhatsApp)</span>
        </ButtonLink>
      </section>
    </div>
  );
}
