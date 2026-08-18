import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  BadgeCheck,
  Building2,
  Check,
  GraduationCap,
  MapPin,
  Pencil,
  Plus,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import {
  Alert,
  Avatar,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  DetailRow,
  PageHeader,
  Progress,
  Separator,
} from '@/components/ui';
import { MarginNote } from '@/components/brand/Marks';
import { ContactBlock } from '@/components/members/ContactBlock';
import { getSession } from '@/lib/auth/session';
import { requireSession, can } from '@/lib/auth/guard';
import { getOwnProfile } from '@/lib/data/repo';
import { ROLE_LABELS } from '@/lib/navigation';
import { formatDate, memberLine, yearsOut } from '@/lib/format';
import { profileChecks, completenessScore } from './completeness';

/**
 * Your own profile, as you hold it.
 *
 * Two things separate this from the public card in the directory. It shows
 * the fields nobody else can see — roll number, contact record, the
 * verification decision the college made — labelled as such. And it opens
 * with a completeness meter that names the missing field and links to the
 * input that fills it, because a percentage on its own has never caused
 * anybody to complete anything.
 */

export const metadata: Metadata = {
  title: 'My profile',
};

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  requireSession(session);

  const profile = getOwnProfile(session);
  if (!profile) notFound();

  const checks = profileChecks(profile);
  const score = completenessScore(checks);
  const missing = checks.filter((c) => !c.done);
  const filled = checks.filter((c) => c.done);

  const editable = can(session, 'profile.write.own');
  const listed = can(session, 'directory.search.alumni');

  const currentRole = profile.employment.find((e) => e.isCurrent) ?? null;
  const roleLabels = profile.roles.map((r) =>
    memberLine([ROLE_LABELS[r.role] ?? r.role, r.departmentCode]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your profile"
        title={profile.fullName}
        description={
          profile.isStudent
            ? 'This is what alumni see when a request from you lands in their inbox. Everything except your contact record is visible to other verified members.'
            : 'This is the record students and other alumni see. Your contact details are held separately and released only under the rules on your privacy page.'
        }
        actions={
          <>
            {listed ? (
              <ButtonLink href={`/directory/${profile.slug}`} variant="secondary">
                <Eye className="size-4" aria-hidden="true" />
                View as others see it
              </ButtonLink>
            ) : null}
            {editable ? (
              <ButtonLink href="/profile/edit">
                <Pencil className="size-4" aria-hidden="true" />
                Edit profile
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {!editable ? (
        <Alert tone="neutral" title="This profile is read-only for your role">
          Your account holds a staff role without profile editing. The alumni cell can make changes
          on your behalf, and every change they make is written to the audit log with a before and
          after.
        </Alert>
      ) : null}

      {/* ---- Completeness ---------------------------------------------- */}

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle as="h2">Profile completeness</CardTitle>
            <CardDescription>
              Weighted by what the directory can actually be searched on — not by how many boxes
              are ticked.
            </CardDescription>
          </div>
          <span className="font-display text-display-xs font-bold tabular">{score}%</span>
        </CardHeader>

        <CardBody className="space-y-5">
          <Progress
            value={score}
            label={`Profile ${score} per cent complete`}
            tone={score >= 80 ? 'success' : score >= 50 ? 'brand' : 'warning'}
          />

          {missing.length ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">
                {missing.length} {missing.length === 1 ? 'thing is' : 'things are'} missing
              </h3>
              <ul className="space-y-2.5">
                {missing.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-start gap-x-3 gap-y-1.5 rounded-lg border border-line bg-surface px-3.5 py-3"
                  >
                    <span
                      className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-dashed border-line-strong text-muted"
                      aria-hidden="true"
                    >
                      <Plus className="size-3" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-medium">{c.label}</p>
                      <p className="text-xs text-secondary">{c.why}</p>
                    </div>
                    {editable ? (
                      <ButtonLink href={c.href} variant="secondary" size="sm">
                        Add it
                      </ButtonLink>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Alert tone="success" title="Nothing left to fill in" icon={<Check className="size-4" />}>
              Your record has everything the directory searches on. Keep the employer current —
              that is the field that goes stale first.
            </Alert>
          )}

          {filled.length ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-secondary">Already done</h3>
              <ul className="flex flex-wrap gap-1.5">
                {filled.map((c) => (
                  <li key={c.id}>
                    <Badge tone="success">
                      <Check className="size-3" aria-hidden="true" />
                      {c.label}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <MarginNote>
            Nobody is scored on this and no staff member sees your percentage. It exists because a
            profile with a company and a city gets answered, and one with neither does not.
          </MarginNote>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* ---- Identity ---------------------------------------------- */}

          <Card>
            <CardHeader>
              <CardTitle as="h2">Identity</CardTitle>
            </CardHeader>
            <CardBody className="space-y-5">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar name={profile.fullName} src={profile.photoUrl} size="xl" />
                <div className="min-w-0 space-y-1">
                  <p className="font-display text-lg font-semibold">{profile.fullName}</p>
                  {profile.preferredName ? (
                    <p className="text-sm text-secondary">Goes by {profile.preferredName}</p>
                  ) : null}
                  <p className="text-sm text-secondary">
                    {memberLine([
                      currentRole?.designation ?? profile.designation,
                      profile.currentCompany,
                    ]) || (profile.isStudent ? 'Final-year student' : 'No employer on file')}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {profile.verifiedAt ? (
                      <Badge tone="success">
                        <BadgeCheck className="size-3.5" aria-hidden="true" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge tone="warning" dot>
                        Awaiting verification
                      </Badge>
                    )}
                    {roleLabels.map((label) => (
                      <Badge key={label} tone="neutral">
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <dl className="divide-y divide-line">
                <DetailRow label="Roll number">
                  <span className="font-mono">{profile.rollNumber ?? '—'}</span>
                  <span className="ml-2 text-xs font-normal text-muted">
                    From the college register. Cannot be edited.
                  </span>
                </DetailRow>
                <DetailRow label="Programme">
                  {memberLine([profile.programme, profile.departmentName]) || '—'}
                </DetailRow>
                <DetailRow label="Batch">
                  {profile.batchYear ? (
                    <>
                      {profile.batchYear}
                      <span className="ml-2 text-xs font-normal text-muted">
                        {profile.admissionYear ? `admitted ${profile.admissionYear} · ` : ''}
                        {yearsOut(profile.batchYear)}
                      </span>
                    </>
                  ) : (
                    '—'
                  )}
                </DetailRow>
                <DetailRow label="Verification">
                  {profile.verifiedAt ? (
                    <>
                      {VERIFICATION_METHOD[profile.verificationMethod ?? ''] ??
                        profile.verificationMethod ??
                        'Verified'}
                      <span className="ml-2 text-xs font-normal text-muted">
                        {formatDate(profile.verifiedAt)}
                      </span>
                    </>
                  ) : (
                    'Not verified yet'
                  )}
                </DetailRow>
                {profile.isStudent && profile.placementStatus ? (
                  <DetailRow label="Placement">
                    {profile.placementStatus}
                    <span className="ml-2 text-xs font-normal text-muted">
                      Visible to the placement cell only. Never to alumni.
                    </span>
                  </DetailRow>
                ) : null}
              </dl>
            </CardBody>
          </Card>

          {/* ---- About ------------------------------------------------- */}

          <Card>
            <CardHeader>
              <CardTitle as="h2">About</CardTitle>
              {editable ? (
                <ButtonLink href="/profile/edit#bio" variant="ghost" size="sm">
                  Edit
                </ButtonLink>
              ) : null}
            </CardHeader>
            <CardBody className="space-y-4">
              {profile.bio ? (
                <p className="max-w-prose text-sm leading-relaxed text-secondary">{profile.bio}</p>
              ) : (
                <p className="text-sm text-muted">
                  Nothing written yet. Two sentences is enough — what you work on, and what you are
                  willing to be asked about.
                </p>
              )}

              <Separator />

              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-2.5">
                  <Building2 className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                  <div>
                    <dt className="text-xs text-muted">Current work</dt>
                    <dd className="text-sm font-medium">
                      {memberLine([profile.designation, profile.currentCompany]) || 'Not stated'}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                  <div>
                    <dt className="text-xs text-muted">Location</dt>
                    <dd className="text-sm font-medium">
                      {memberLine([
                        profile.city,
                        profile.country === 'IN' ? profile.state : profile.country,
                      ]) || 'Not stated'}
                    </dd>
                  </div>
                </div>
              </dl>

              <div className="space-y-2">
                <p className="text-xs text-muted">Skills</p>
                {profile.skills.length ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {profile.skills.map((s) => (
                      <li key={s}>
                        <Badge tone="outline">{s}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">
                    None added. Skills are the filter students use most after branch and batch.
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          {/* ---- History ----------------------------------------------- */}

          <Card>
            <CardHeader>
              <CardTitle as="h2">Work history</CardTitle>
              {editable ? (
                <ButtonLink href="/profile/edit#employment" variant="ghost" size="sm">
                  Edit
                </ButtonLink>
              ) : null}
            </CardHeader>
            <CardBody>
              {profile.employment.length ? (
                <ol className="space-y-4">
                  {profile.employment.map((e) => (
                    <li key={e.id} className="flex gap-3">
                      <span
                        className="mt-1 grid size-8 shrink-0 place-items-center rounded bg-surface-sunken text-muted"
                        aria-hidden="true"
                      >
                        <Building2 className="size-4" />
                      </span>
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-medium">
                          {memberLine([e.designation, e.company])}
                        </p>
                        <p className="text-xs text-secondary">
                          {formatDate(e.startedOn)} –{' '}
                          {e.isCurrent ? 'present' : formatDate(e.endedOn)}
                          {e.location ? ` · ${e.location}` : ''}
                        </p>
                        {e.isCurrent ? <Badge tone="brand">Current</Badge> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">
                  {profile.isStudent
                    ? 'Internships count. Add one and it shows up here.'
                    : 'No roles listed. Even one line — company and years — makes the profile searchable by company.'}
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Education</CardTitle>
              {editable ? (
                <ButtonLink href="/profile/edit#education" variant="ghost" size="sm">
                  Edit
                </ButtonLink>
              ) : null}
            </CardHeader>
            <CardBody>
              <ol className="space-y-4">
                {profile.education.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span
                      className="mt-1 grid size-8 shrink-0 place-items-center rounded bg-surface-sunken text-muted"
                      aria-hidden="true"
                    >
                      <GraduationCap className="size-4" />
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium">{e.institution}</p>
                      <p className="text-xs text-secondary">
                        {memberLine([e.qualification, e.field])}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDate(e.startedOn)} – {e.endedOn ? formatDate(e.endedOn) : 'present'}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>

        {/* ---- Right rail ---------------------------------------------- */}

        <div className="space-y-6">
          <ContactBlock
            contact={profile.contact}
            ownerName={profile.fullName}
            visibility={profile.contact?.visibility ?? null}
            hasAcceptedConnection={false}
            viewerIsOwner
          />

          <Card>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle as="h2" className="text-md">
                  Who can see your contact details
                </CardTitle>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-sm text-secondary">
                {VISIBILITY_SUMMARY[profile.contact?.visibility ?? 'on_accept']}
              </p>
              <ButtonLink href="/settings/privacy" variant="secondary" size="sm">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Change this
              </ButtonLink>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-md">
                What you are open to
              </CardTitle>
            </CardHeader>
            <CardBody>
              <ul className="space-y-2.5">
                {AVAILABILITY.map((a) => {
                  const on = profile[a.key];
                  return (
                    <li key={a.key} className="flex items-start gap-2.5">
                      <Badge tone={on ? 'success' : 'neutral'} dot>
                        {on ? 'On' : 'Off'}
                      </Badge>
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-medium">{a.label}</p>
                        <p className="text-xs text-secondary">{on ? a.onCopy : a.offCopy}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {editable ? (
                <div className="pt-4">
                  <ButtonLink href="/profile/edit#availability" variant="secondary" size="sm">
                    Change what you are open to
                  </ButtonLink>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-2.5">
              <CardTitle as="h2" className="text-md">
                Your data
              </CardTitle>
              <p className="text-sm text-secondary">
                Download everything the college holds about you, ask for a correction, or ask for
                the account to be deleted. The college has 30 days to answer.
              </p>
              <Link href="/settings/data" className="link text-sm">
                Open your data requests
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

const VERIFICATION_METHOD: Record<string, string> = {
  auto_roll_match: 'Roll number matched the degree register automatically',
  admin_manual: 'Approved by hand at the alumni cell',
  bulk_import: 'Loaded in a bulk import from college records',
  placement_cell_import: 'Loaded from the placement cell roll list',
};

const VISIBILITY_SUMMARY: Record<string, string> = {
  private: 'Nobody can see your email or mobile through the portal. Members can still send you a request, and you can reply.',
  on_accept: 'Your email is released to a member only after you accept their connection request. Until then they see a masked address.',
  alumni_only: 'Alumni and faculty can see your email. Students cannot, whatever they ask for.',
  all_members: 'Every verified member can see your email. Your mobile number is still never shown in the directory.',
};

const AVAILABILITY = [
  {
    key: 'openToMentoring' as const,
    label: 'Mentoring',
    onCopy: 'Students can send you a mentorship request. You can decline any of them silently.',
    offCopy: 'You are not listed as a mentor and students are told not to ask.',
  },
  {
    key: 'openToReferrals' as const,
    label: 'Referrals',
    onCopy: 'Students can ask you to refer them at your current employer.',
    offCopy: 'Referral requests cannot be sent to you.',
  },
  {
    key: 'openToSpeaking' as const,
    label: 'Speaking',
    onCopy: 'The alumni cell may invite you to speak at a campus session.',
    offCopy: 'You will not be invited to speak.',
  },
];
