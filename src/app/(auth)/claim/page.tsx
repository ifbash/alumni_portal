import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GraduationCap } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getTenantBrand } from '@/lib/tenant';
import { getDegreeRegisterStats, getDepartments } from '@/lib/data/repo';
import { NOTICE_VERSION } from '@/lib/config';
import { rollNumber } from '@/lib/branding/copy';
import { yearIn } from '@/lib/format';
import { Alert } from '@/components/ui';
import { AuthHeader } from '../_components/AuthHeader';
import { ClaimForm } from './ClaimForm';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * The years the form offers, newest first.
 *
 * Exactly the years the degree register covers: offering a year the
 * college holds no records for only produces a registration nobody can
 * approve. Only `.year` is read — never a count. Until the register
 * arrives from the examinations branch the list would be empty and the
 * form unusable, so it falls back to the last forty years; "My year is
 * not listed" catches anything older.
 */
function registerYears(timeZone: string): number[] {
  const years = getDegreeRegisterStats()
    .byYear.map((r) => r.year)
    .filter((y) => y > 0)
    .sort((a, b) => b - a);
  if (years.length > 0) return years;

  const now = yearIn(timeZone);
  return Array.from({ length: 41 }, (_, i) => now - i);
}

/**
 * `?year=2016`, from a batch chip on the landing page or a link forwarded
 * round a batch group. Anything that is not a register year is ignored
 * silently: a stale or mistyped link still opens a working form.
 */
function pickYear(raw: string | string[] | undefined, years: number[]): number | undefined {
  if (typeof raw !== 'string' || !/^\d{4}$/.test(raw)) return undefined;
  const year = Number(raw);
  return years.includes(year) ? year : undefined;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const sp = await searchParams;
  const resolved = await getTenantBrand();
  if (!resolved) return { title: 'Alumni registration' };

  const { copy, locale } = resolved.brand.pack;
  const year = pickYear(sp.year, registerYears(locale.timeZone));

  return {
    title: year ? `Batch of ${year} — Alumni registration` : 'Alumni registration',
    description: `Register as a graduate of ${copy.institutionName} with your ${rollNumber(copy).mid} and year of passing.`,
  };
}

/**
 * Alumni registration.
 *
 * Four details the matcher can score against the degree register, asked
 * for in the words printed on the certificate, plus somewhere to send the
 * outcome. Final-year students are told first that this page is not for
 * them: the placement cell invites them, and a student who registers here
 * only produces a record the college cannot match.
 */
export default async function RegistrationPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (session) redirect('/dashboard');

  const sp = await searchParams;
  const { brand } = (await getTenantBrand())!;
  const { copy, features, locale } = brand.pack;
  const roll = rollNumber(copy);
  const office = copy.officeName;

  const years = registerYears(locale.timeZone);
  const initialYear = pickYear(sp.year, years);
  const initialEmail = typeof sp.email === 'string' ? sp.email.trim().slice(0, 254) : '';
  const departments = getDepartments().map((d) => ({ code: d.code, name: d.name }));

  return (
    <div className="stagger space-y-8">
      <div className="relative">
        {/* The batch from a forwarded link, as a large outline: the product's idea, decoration only. */}
        {initialYear ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-3 right-0 hidden select-none font-display text-[4rem] font-bold leading-none tabular text-transparent [-webkit-text-stroke:1.5px_color-mix(in_srgb,var(--brand-500)_38%,transparent)] sm:block"
          >
            {initialYear}
          </span>
        ) : null}
        <AuthHeader
          className="relative"
          eyebrow={initialYear ? `Batch of ${initialYear}` : `${copy.shortName} alumni`}
          title="Alumni registration"
        >
          <p>
            For graduates of {copy.institutionName}. Keep your {roll.mid} handy — it is on your{' '}
            {roll.sourcesMid[0]} and {roll.sourcesMid[1]}. It takes about two minutes.
          </p>
          <p className="text-sm">
            Already registered?{' '}
            <Link className="link" href="/login">
              Sign in
            </Link>
          </p>
        </AuthHeader>
      </div>

      <Alert
        style={{ '--i': 1 } as React.CSSProperties}
        tone="neutral"
        icon={<GraduationCap className="size-4" />}
        title="Final-year student?"
      >
        <p>
          You do not need to register. The placement cell adds your batch and emails you an
          invitation — then you simply <Link href="/login">sign in</Link>. Not received yours?{' '}
          <Link href="/contact">Contact the {office}</Link>.
        </p>
      </Alert>

      <ClaimForm
        departments={departments}
        years={years}
        initialYear={initialYear}
        initialEmail={initialEmail}
        noticeVersion={NOTICE_VERSION}
        supportEmail={copy.supportEmail}
        shortName={copy.shortName}
        office={office}
        roll={roll}
        whatsappEnabled={features.whatsapp}
        reviewTurnaround={copy.reviewTurnaround}
      />
    </div>
  );
}
