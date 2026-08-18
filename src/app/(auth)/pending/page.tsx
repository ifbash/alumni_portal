import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check, Clock, Hourglass, Mail } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getTenantBrand } from '@/lib/tenant';
import { Alert, Badge, ButtonLink, Card, CardBody } from '@/components/ui';
import { cn } from '@/lib/cn';

export const metadata: Metadata = {
  title: 'Your claim is being reviewed',
  description: 'What happens next after submitting an alumni verification claim.',
};

/**
 * The waiting room.
 *
 * This page exists because the alternative — a toast that says
 * "submitted" and a redirect to the sign-in screen — makes people submit
 * the same claim four times and then email the college asking whether the
 * portal is broken. It says who has it, how long they take, and what to
 * do if the answer never comes.
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

  const { brand } = (await getTenantBrand())!;
  const copy = brand.pack.copy;

  const steps: Array<{ state: 'done' | 'current' | 'waiting'; title: string; body: string }> = [
    {
      state: 'done',
      title: 'Claim received',
      body: 'Your roll number, name, branch and year of passing are in the verification queue, with the consent you gave recorded against the notice version you were shown.',
    },
    {
      state: 'current',
      title: 'Matched against the degree register',
      body: 'The matcher scores your details against the records from the examinations branch and attaches the candidate rows it found. Nobody is asked to approve a claim with no evidence in front of them.',
    },
    {
      state: 'waiting',
      title: 'Reviewed by the alumni cell',
      body: 'A person confirms the match — usually within three working days, longer around examinations and admissions. You are emailed either way, including if the answer is no.',
    },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Badge tone="warning" dot>
          Awaiting verification
        </Badge>
        <h1 className="font-display text-display-sm font-bold">Your claim is with the alumni cell</h1>
        <p className="text-secondary">
          {email ? (
            <>
              We will write to{' '}
              <span className="font-medium text-primary break-all">{email}</span> as soon as it has
              been looked at. There is nothing else for you to do.
            </>
          ) : (
            <>
              We will write to the address you gave as soon as it has been looked at. There is
              nothing else for you to do.
            </>
          )}
        </p>
      </header>

      <Card>
        <CardBody>
          <h2 className="mb-5 font-display text-base font-semibold">Where your claim is</h2>

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
                        step.state === 'current' && 'bg-brand-soft text-brand-soft-fg',
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

      <Alert tone="info" title="Do not submit the form again">
        <p>
          A second claim on the same roll number does not move you up the queue — it creates a
          duplicate the alumni cell has to close before they can look at the first one.
        </p>
      </Alert>

      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-display text-base font-semibold">If you have not heard in a week</h2>
          <p className="text-sm text-secondary">
            Check the spam folder first — the approval email carries a sign-in code and mail
            providers are suspicious of those. After that, write to the alumni cell with your roll
            number, year of passing and a scan of your degree certificate. The most common reason a
            claim stalls is a name that reads differently on the certificate than in the register,
            and a scan settles it in one exchange.
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

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
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
    </div>
  );
}
