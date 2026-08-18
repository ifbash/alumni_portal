import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ClipboardCheck, FileSearch, IdCard, UserRoundCheck } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getTenantBrand } from '@/lib/tenant';
import { getDegreeRegisterStats, getDepartments } from '@/lib/data/repo';
import { NOTICE_VERSION } from '@/lib/config';
import { Alert, Card, CardBody } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { ClaimForm } from './ClaimForm';

export const metadata: Metadata = {
  title: 'Claim your profile',
  description:
    'Register as an alumnus by matching your roll number and name against the college degree register.',
};

/**
 * Self-registration.
 *
 * The page has to do two jobs at once: collect four fields the matcher
 * can score, and be honest about what happens to them. People are being
 * asked to hand over identity data to a portal they have never used, and
 * "we will get back to you" is not an answer anyone accepts from a
 * college that lost touch with them nine years ago.
 */
export default async function ClaimPage() {
  const session = await getSession();
  if (session) redirect('/dashboard');

  const { brand } = (await getTenantBrand())!;
  const { copy, locale } = brand.pack;
  const fmt = { locale: locale.locale, currency: locale.currency, timeZone: locale.timeZone };

  const departments = getDepartments().map((d) => ({ code: d.code, name: d.name }));
  const register = getDegreeRegisterStats();

  // The dropdown offers exactly the years the register covers — offering a
  // year the college has no records for only produces a claim nobody can
  // approve.
  const years = register.byYear
    .map((r) => r.year)
    .filter((y) => y > 0)
    .sort((a, b) => b - a);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="font-display text-display-sm font-bold">Claim your alumni profile</h1>
        <p className="text-secondary">
          {copy.institutionName} keeps a register of every degree it has awarded — currently{' '}
          <span className="font-medium text-primary tabular">{formatNumber(register.total, fmt)}</span>{' '}
          records from the examinations branch. Give us four details and we will find your row in it.
        </p>
      </header>

      <Alert tone="info" title="Why the college has to check">
        <p>
          A portal that lets anyone type in a name is a portal where anyone can read your batch&apos;s
          contact details. Matching against the register is what keeps that from being possible — and
          it is why nobody sees the directory until a claim is approved.
        </p>
      </Alert>

      <ClaimForm
        departments={departments}
        years={years}
        noticeVersion={NOTICE_VERSION}
        supportEmail={copy.supportEmail}
      />

      <Card>
        <CardBody className="space-y-4">
          <h2 className="font-display text-base font-semibold">What happens after you submit</h2>
          <ol className="space-y-4">
            <Next
              n={1}
              icon={<FileSearch className="size-4" aria-hidden="true" />}
              title="Your details are scored against the register"
            >
              Roll number, name, branch and year, all four. The matcher expects spelling to differ
              between a certificate and the way you write your own name, so an initial in the wrong
              place will not fail you.
            </Next>
            <Next
              n={2}
              icon={<UserRoundCheck className="size-4" aria-hidden="true" />}
              title="A clean match is approved on the spot"
            >
              You get an email with a sign-in code and the directory opens immediately.
            </Next>
            <Next
              n={3}
              icon={<ClipboardCheck className="size-4" aria-hidden="true" />}
              title="Anything ambiguous goes to a person"
            >
              Two graduates with the same name in the same branch and year is common enough that the
              alumni cell reviews those by hand, with both register rows in front of them. Expect an
              answer within three working days.
            </Next>
          </ol>

          <div className="flex gap-3 rounded-lg border border-line bg-surface-sunken p-4">
            <IdCard className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            <p className="text-sm text-secondary">
              Changed your surname since graduating, held a supplementary exam, or transferred in?
              Submit the form with the details as the certificate has them and add a note by email —
              {copy.supportEmail ? (
                <>
                  {' '}
                  <a href={`mailto:${copy.supportEmail}`} className="link">
                    {copy.supportEmail}
                  </a>{' '}
                </>
              ) : (
                ' to the alumni cell '
              )}
              with a scan of the certificate. The cell corrects the record rather than rejecting the
              claim.
            </p>
          </div>
        </CardBody>
      </Card>

      <p className="text-sm text-secondary">
        Final-year student? You do not claim a profile — the placement cell adds your batch and
        emails you an invitation. If your classmates have one and you do not,{' '}
        {copy.supportEmail ? (
          <a href={`mailto:${copy.supportEmail}`} className="link">
            write to the alumni cell
          </a>
        ) : (
          'ask the placement cell'
        )}
        . Already have an account?{' '}
        <Link href="/login" className="link">
          Sign in
        </Link>
        .
      </p>
    </div>
  );
}

function Next({
  n,
  icon,
  title,
  children,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-xs font-bold text-brand-soft-fg tabular"
        aria-hidden="true"
      >
        {n}
      </span>
      <div className="min-w-0 space-y-1">
        <p className="flex items-center gap-2 font-semibold">
          <span className="text-muted">{icon}</span>
          {title}
        </p>
        <p className="text-sm text-secondary">{children}</p>
      </div>
    </li>
  );
}
