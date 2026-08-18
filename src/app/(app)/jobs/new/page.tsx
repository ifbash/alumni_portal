import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Ban, Clock, Eye, ShieldCheck } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getOwnProfile } from '@/lib/data/repo';
import {
  Alert,
  Breadcrumbs,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageHeader,
} from '@/components/ui';
import { JobForm } from './JobForm';

export const metadata: Metadata = {
  title: 'Post a role',
  description: 'Share an opening with final-year students and alumni. Reviewed by the placement cell.',
};

export default async function NewJobPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const { brand } = (await getTenantBrand())!;
  if (!brand.pack.features.jobs) notFound();

  // Alumni, faculty and the placement officer hold `job.post`. Students
  // hold `job.apply` and nothing else — the guard, not the hidden link, is
  // what stops them here.
  requireCap(session, 'job.post');

  const me = getOwnProfile(session);
  const shortName = brand.pack.copy.shortName;
  const supportEmail = brand.pack.copy.supportEmail ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Jobs', href: '/jobs' },
              { label: 'Post a role' },
            ]}
          />
        }
        eyebrow="Placement & careers"
        title="Post a role"
        description={`Openings you post reach final-year students and alumni of ${brand.pack.copy.institutionName}.`}
      />

      {/* Stated before the first field, not in a footnote after the submit
          button. Someone who fills in nine fields and only then learns their
          posting will not appear for two days has been misled by the form. */}
      <Alert
        tone="info"
        title="Every posting is read by the placement cell before it goes live"
        icon={<ShieldCheck className="size-4" />}
      >
        <p>
          Nothing you submit appears on the board straight away. A member of the placement cell
          reads it first — usually within two working days — and either publishes it or sends it
          back with a reason.
        </p>
        <p className="mt-2">
          That review is not bureaucracy. The college is accountable for what it points its
          students at, and a portal that publishes anything is how students end up paying a
          &ldquo;registration fee&rdquo; to a fake recruiter. Your posting carries {shortName}&rsquo;s
          name once it is listed.
        </p>
      </Alert>

      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_18rem]">
        <JobForm
          defaultCompany={me?.currentCompany ?? ''}
          posterName={me?.fullName ?? 'You'}
          shortName={shortName}
          supportEmail={supportEmail}
        />

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-md">
                What the cell checks
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-1">
              <ul className="space-y-2.5 text-sm text-secondary">
                <li className="flex gap-2.5">
                  <Eye className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                  <span>
                    That the opening is real and current, and that you are either hiring for it or
                    can refer inside the company.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <Ban className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                  <span>
                    That it is not a staffing-agency listing, an unpaid &ldquo;training
                    programme&rdquo;, or anything that asks a candidate for money.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <Clock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                  <span>
                    That the closing date has not already passed, and the pay band is stated in a
                    form a student can read.
                  </span>
                </li>
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-md">
                After you submit
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-1">
              <ol className="space-y-2.5 text-sm text-secondary">
                <li>
                  <span className="font-medium text-primary">1. With the placement cell.</span> The
                  posting sits in your{' '}
                  <span className="font-medium text-primary">My postings</span> tab marked
                  &ldquo;with the placement cell&rdquo;. It is not lost and it is not public.
                </li>
                <li>
                  <span className="font-medium text-primary">2. Published or sent back.</span> If it
                  is sent back you get the reason in writing, and can correct and resubmit.
                </li>
                <li>
                  <span className="font-medium text-primary">3. Applications come to you.</span>{' '}
                  Name, branch, batch and a note — never a student&rsquo;s CGPA or contact details.
                </li>
              </ol>
            </CardBody>
          </Card>

          {supportEmail ? (
            <p className="text-xs text-muted">
              Urgent hiring deadline? Write to{' '}
              <a href={`mailto:${supportEmail}`} className="link">
                {supportEmail}
              </a>{' '}
              and the cell will look at it the same day.
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
