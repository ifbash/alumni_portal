import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { BadgeCheck, Eye, Pencil, Plus } from 'lucide-react';
import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardTitle,
  CopyButton,
  DetailRow,
} from '@/components/ui';
import { ContactBlock } from '@/components/members/ContactBlock';
import { getSession } from '@/lib/auth/session';
import { requireSession, can } from '@/lib/auth/guard';
import { getOwnProfile } from '@/lib/data/repo';
import { getTenantBrand } from '@/lib/tenant';
import { isVendorOnlySession } from '@/lib/navigation';
import { formatDate, memberLine, yearsOut } from '@/lib/format';
import { rollNumber } from '@/lib/branding/copy';
import { pickBandPhoto } from '@/lib/branding/media';
import { availabilityCopy, type AvailabilityKey } from '@/lib/availability-copy';
import { visibilityOption } from '@/lib/visibility-copy';
import { viewerBranch } from '@/lib/identity';
import { siteOrigin } from '@/lib/share';
import { CONNECTION_LIMITS } from '@/lib/config';
import type { EducationEntry, EmploymentEntry } from '@/lib/data/types';
import { profileChecks, completenessScore } from './completeness';
import { CompletenessRing } from './CompletenessRing';

/**
 * Your own profile, as you hold it.
 *
 * It opens on the person, not on a score: the cover strip, the photo or
 * initials, the name once, one line of work and place. The completeness
 * bar only appears while something is missing, and each missing item is a
 * link to the field that fills it. The rail holds what only the owner
 * sees (their contact record, who it is released to, what they have said
 * yes to), and the college's record of them closes the page.
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

  const editable = can(session, 'profile.write.own');
  const listed = can(session, 'directory.search.alumni');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const pack = resolved.brand.pack;
  const copy = pack.copy;
  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };
  const office = copy.officeName;

  const vendorOnly = isVendorOnlySession(session);
  const holdsAlumni = profile.roles.some((r) => r.role === 'alumni');
  const holdsFaculty = profile.roles.some((r) => r.role === 'faculty' || r.role === 'hod');
  const directoryOn = pack.features.directory;

  // Member-level links (the preview, the batch and branch pages, the
  // shareable directory link) are for members only. The vendor may open
  // its own profile, and nothing it links to may bounce.
  const memberLinks = directoryOn && listed && !vendorOnly;

  // Listed in the directory means other members can open this record at
  // /directory/{slug}. Final-year students are not listed to other members.
  const shareable = memberLinks && profile.status === 'active_alumni';
  const profileUrl = shareable ? `${await siteOrigin()}/directory/${profile.slug}` : null;

  // One source for the line under the name: the headline fields the form
  // edits, then the city.
  const place = memberLine([
    profile.city,
    profile.country && profile.country !== 'IN' ? profile.country : null,
  ]);
  const headline =
    memberLine([profile.designation, profile.currentCompany, place]) ||
    (profile.isStudent ? 'Final-year student' : null);

  // The batch belongs to holders of the alumni role only; staff seeded
  // from alumni rows are introduced by their department.
  const branch = profile.isStudent || holdsAlumni ? profile.departmentCode : viewerBranch(session);

  const photo = pickBandPhoto(pack, 'profile');

  // What the owner has said yes to. Students are never asked, and the
  // vendor holds no member features, so neither has anything to show.
  const receivesRequests = !profile.isStudent && can(session, 'connection.receive');
  const availabilityCtx = {
    audience: holdsFaculty && !holdsAlumni ? ('faculty' as const) : ('alumni' as const),
    company: profile.currentCompany,
    officeName: office,
    openLimit: CONNECTION_LIMITS.studentOpenRequests,
  };
  const openTo = (['mentoring', 'referrals', 'speaking'] as const)
    .map((key) => ({ key, on: availabilityOn(profile, key), copy: availabilityCopy(key, availabilityCtx) }))
    .filter((a): a is { key: AvailabilityKey; on: boolean; copy: NonNullable<typeof a.copy> } => a.copy !== null);
  const openOn = openTo.filter((a) => a.on);
  const openOff = openTo.filter((a) => !a.on);

  const visibility = visibilityOption(profile.contact?.visibility ?? 'on_accept');
  const roll = rollNumber(copy);

  return (
    <div className="space-y-6">
      {/* ---- Header ---------------------------------------------------- */}

      <Card className="ring-hairline overflow-hidden shadow-md">
        <div className="band-surface grain relative isolate h-28 overflow-hidden sm:h-36" aria-hidden="true">
          {photo ? (
            // Decorative: the name below says whose page this is. No text
            // sits on the photo. Tenant-supplied URL; see next.config.ts.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.src}
              alt=""
              decoding="async"
              className="absolute inset-0 size-full object-cover"
              style={{ objectPosition: photo.focus }}
            />
          ) : (
            <div className="aurora" />
          )}
        </div>

        <CardBody className="pt-0">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <CompletenessRing
              score={editable ? score : null}
              className="-mt-14 w-fit sm:col-start-1 sm:row-start-1"
            >
              <Avatar name={profile.fullName} src={profile.photoUrl} size="xl" />
            </CompletenessRing>

            {editable || memberLinks ? (
              <div className="order-last flex flex-wrap items-center gap-2 sm:order-none sm:col-start-2 sm:row-start-1 sm:self-end sm:justify-end">
                {memberLinks ? (
                  <ButtonLink href="/profile/preview" variant="secondary" className="min-h-11">
                    <Eye className="size-4" aria-hidden="true" />
                    What others see
                  </ButtonLink>
                ) : null}
                {profileUrl ? (
                  <CopyButton text={profileUrl} label="Copy profile link" copiedLabel="Link copied" />
                ) : null}
                {editable ? (
                  <ButtonLink href="/profile/edit" className="order-first min-h-11 sm:order-none">
                    <Pencil className="size-4" aria-hidden="true" />
                    Edit profile
                  </ButtonLink>
                ) : null}
              </div>
            ) : null}

            <div className="min-w-0 space-y-3 sm:col-span-2">
              <div className="space-y-1">
                <h1 className="font-display text-display-sm font-bold tracking-tight">{profile.fullName}</h1>
                {profile.preferredName ? (
                  <p className="text-sm text-secondary">Goes by {profile.preferredName}</p>
                ) : null}
                {headline ? <p className="text-md text-secondary">{headline}</p> : null}
              </div>

              <ul className="flex flex-wrap items-center gap-1.5" aria-label="About this record">
                {holdsAlumni && profile.batchYear ? (
                  <li>
                    <IdentityChip
                      parts={[
                        branch
                          ? { label: branch, href: memberLinks ? `/directory/branch/${branch}` : null }
                          : null,
                        {
                          label: `Batch of ${profile.batchYear}`,
                          href: memberLinks ? `/directory/batch/${profile.batchYear}` : null,
                        },
                      ]}
                    />
                  </li>
                ) : branch ? (
                  <li>
                    <Badge tone="neutral">{profile.isStudent ? `${branch} · Final year` : branch}</Badge>
                  </li>
                ) : null}
                <li>
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
                </li>
                {receivesRequests
                  ? openOn.map((a) => (
                      <li key={a.key}>
                        <Badge tone={a.key === 'mentoring' ? 'success' : a.key === 'referrals' ? 'brand' : 'accent'} dot>
                          {a.copy.chip}
                        </Badge>
                      </li>
                    ))
                  : null}
              </ul>

              {!editable ? (
                <p className="text-sm text-secondary">
                  Changes to this profile are made by the {office}
                  {copy.supportEmail ? (
                    <>
                      {' '}
                      at{' '}
                      <a href={`mailto:${copy.supportEmail}`} className="link">
                        {copy.supportEmail}
                      </a>
                    </>
                  ) : null}
                  .
                </p>
              ) : null}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ---- Completeness, only while something is missing ------------- */}

      {editable && score < 100 && missing.length ? (
        <section
          aria-label="Profile completeness"
          className="flex flex-col gap-2 rounded-lg border border-line bg-surface-raised px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
        >
          <p className="shrink-0 font-display text-md font-semibold">
            <span className="tabular">{score}%</span> complete
          </p>
          <p className="min-w-0 text-sm text-secondary">
            <span className="font-medium text-primary">To finish: </span>
            {missing.map((c, i) => (
              <span key={c.id}>
                {i > 0 ? <span className="text-muted" aria-hidden="true"> · </span> : null}
                <Link href={c.href} className="link">
                  {c.label}
                </Link>
              </span>
            ))}
          </p>
        </section>
      ) : null}

      {/* ---- Main column and rail ---------------------------------------
          Phones read header, completeness, About, then the rail. At lg the
          rail spans both rows and the second row absorbs its height, so no
          gap opens under About. */}

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr]">
        <Card className="min-w-0 lg:col-start-1 lg:row-start-1">
          <CardBody className="space-y-4">
            <SectionTitle title="About" edit={editable ? '/profile/edit#bio' : null} editLabel="Edit about" />
            {profile.bio ? (
              <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed text-secondary">
                {profile.bio}
              </p>
            ) : (
              <EmptyLine
                text="You have not written an introduction yet."
                href={editable ? '/profile/edit#bio' : null}
                action="Write one"
              />
            )}

            <div className="space-y-2 border-t border-line pt-4">
              <h3 className="text-sm font-semibold">Skills</h3>
              {profile.skills.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {profile.skills.map((s) => (
                    <li key={s}>
                      <Badge tone="outline">{s}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine
                  text="No skills listed yet."
                  href={editable ? '/profile/edit#skills' : null}
                  action="Add skills"
                />
              )}
            </div>
          </CardBody>
        </Card>

        <aside
          aria-label="Contact and availability"
          className="min-w-0 space-y-gutter lg:col-start-2 lg:row-span-2 lg:row-start-1"
        >
          <ContactBlock
            contact={profile.contact}
            ownerName={profile.fullName}
            visibility={profile.contact?.visibility ?? null}
            hasAcceptedConnection={false}
            viewerIsOwner
          />

          {visibility ? (
            <Card>
              <CardBody className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs text-secondary">Who can see them</p>
                  <p className="text-sm font-medium">{visibility.label}</p>
                </div>
                <Link
                  href="/settings/privacy"
                  className="link -my-1 inline-flex min-h-11 shrink-0 items-center text-sm"
                >
                  Change
                </Link>
              </CardBody>
            </Card>
          ) : null}

          {receivesRequests && openTo.length ? (
            <Card>
              <CardBody className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle as="h2" className="text-md">
                    Open to
                  </CardTitle>
                  {editable ? (
                    <Link
                      href="/profile/edit#availability"
                      className="link -my-3 inline-flex min-h-11 shrink-0 items-center text-sm"
                    >
                      Change
                    </Link>
                  ) : null}
                </div>
                {openOn.length ? (
                  <ul className="space-y-2.5">
                    {openOn.map((a) => (
                      <li key={a.key} className="space-y-0.5">
                        <p className="text-sm font-medium">{a.copy.label}</p>
                        <p className="text-xs text-secondary">{a.copy.line}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-secondary">
                    You are not open to requests for mentoring, referrals or speaking.
                  </p>
                )}
                {openOn.length && openOff.length ? (
                  <p className="border-t border-line pt-3 text-xs text-secondary">
                    Not open to {openOff.map((a) => a.key).join(' or ')}.
                  </p>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </aside>

        <div className="min-w-0 space-y-gutter lg:col-start-1 lg:row-start-2">
          <Card>
            <CardBody className="space-y-4">
              <SectionTitle
                title="Experience"
                edit={editable ? '/profile/edit#employment' : null}
                editLabel="Edit experience"
              />
              {profile.employment.length ? (
                <ExperienceList entries={profile.employment} timing={timing} />
              ) : (
                <EmptyLine
                  text={
                    profile.isStudent
                      ? 'No internships listed yet.'
                      : 'No roles listed yet. One line with a company and the years is enough.'
                  }
                  href={editable ? '/profile/edit#employment' : null}
                  action="Add a role"
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-4">
              <SectionTitle
                title="Education"
                edit={editable ? '/profile/edit#education' : null}
                editLabel="Edit education"
              />
              {profile.education.length ? (
                <EducationList entries={profile.education} timing={timing} />
              ) : (
                <EmptyLine
                  text="Nothing listed beyond your degree."
                  href={editable ? '/profile/edit#education' : null}
                  action="Add a qualification"
                />
              )}
            </CardBody>
          </Card>

          {/* ---- The college's record ---------------------------------- */}

          <Card>
            <CardBody className="space-y-3">
              <div className="space-y-0.5">
                <CardTitle as="h2" className="text-md">
                  Your college record
                </CardTitle>
                <p className="text-sm text-secondary">
                  From the college register. The {office} can correct it.
                </p>
              </div>

              <dl className="divide-y divide-line">
                {profile.isStudent || holdsAlumni ? (
                  <>
                    <DetailRow className={RECORD_ROW} label={roll.label}>
                      <span className="font-mono">{profile.rollNumber ?? '—'}</span>
                    </DetailRow>
                    <DetailRow className={RECORD_ROW} label="Programme">
                      {memberLine([profile.programme, profile.departmentName]) || '—'}
                    </DetailRow>
                    <DetailRow className={RECORD_ROW} label="Batch">
                      {profile.batchYear ? (
                        <>
                          {profile.batchYear}
                          <span className="ml-2 text-xs font-normal text-secondary">
                            {memberLine([
                              profile.admissionYear ? `admitted ${profile.admissionYear}` : null,
                              profile.isStudent ? 'final year' : yearsOut(profile.batchYear),
                            ])}
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </DetailRow>
                  </>
                ) : null}
                <DetailRow className={RECORD_ROW} label="Verification">
                  {profile.verifiedAt ? (
                    <>
                      {verificationMethod(profile.verificationMethod, office)}
                      <span className="ml-2 text-xs font-normal text-secondary">
                        {formatDate(profile.verifiedAt, timing)}
                      </span>
                    </>
                  ) : (
                    'Not verified yet'
                  )}
                </DetailRow>
                {profile.isStudent && profile.placementStatus ? (
                  <DetailRow label="Placement">
                    {profile.placementStatus}
                    <span className="ml-2 text-xs font-normal text-secondary">
                      Visible to the placement cell only. Never to alumni.
                    </span>
                  </DetailRow>
                ) : null}
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function availabilityOn(
  p: { openToMentoring: boolean; openToReferrals: boolean; openToSpeaking: boolean },
  key: AvailabilityKey,
): boolean {
  return key === 'mentoring' ? p.openToMentoring : key === 'referrals' ? p.openToReferrals : p.openToSpeaking;
}

// ---------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------

/** "CSE · Batch of 2017": each half links to its page when the viewer can open it. */
function IdentityChip({ parts }: { parts: Array<{ label: string; href: string | null } | null> }) {
  const shown = parts.filter((p): p is { label: string; href: string | null } => p !== null);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-soft-fg">
      {shown.map((p, i) => (
        <span key={p.label} className="inline-flex items-center gap-1">
          {i > 0 ? <span aria-hidden="true">·</span> : null}
          {p.href ? (
            <Link href={p.href} className="underline-offset-2 hover:underline">
              {p.label}
            </Link>
          ) : (
            p.label
          )}
        </span>
      ))}
    </span>
  );
}

function SectionTitle({ title, edit, editLabel }: { title: string; edit: string | null; editLabel: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <CardTitle as="h2">{title}</CardTitle>
      {edit ? (
        <ButtonLink href={edit} variant="ghost" size="sm" className="-my-2 min-h-11" aria-label={editLabel}>
          <Pencil className="size-3.5" aria-hidden="true" />
          Edit
        </ButtonLink>
      ) : null}
    </div>
  );
}

function EmptyLine({ text, href, action }: { text: string; href: string | null; action: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-sm text-secondary">
      <span>{text}</span>
      {href ? (
        <Link href={href} className="link inline-flex min-h-11 items-center gap-1">
          <Plus className="size-3.5" aria-hidden="true" />
          {action}
        </Link>
      ) : null}
    </p>
  );
}

interface Timing {
  locale: string;
  timeZone: string;
}

function ExperienceList({ entries, timing }: { entries: EmploymentEntry[]; timing: Timing }) {
  return (
    <ol>
      {entries.map((e, i) => (
        <li key={e.id} className="relative flex gap-4 pb-5 last:pb-0">
          {i < entries.length - 1 ? (
            <span aria-hidden="true" className="absolute bottom-0 left-[0.4375rem] top-5 w-px bg-line" />
          ) : null}
          <span
            aria-hidden="true"
            className={
              e.isCurrent
                ? 'mt-1.5 size-3.5 shrink-0 rounded-full border-2 border-[var(--button-primary-bg)] bg-brand-soft'
                : 'mt-1.5 size-3.5 shrink-0 rounded-full border-2 border-line-strong bg-surface-raised'
            }
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="font-medium">{e.designation || e.company}</p>
              {e.isCurrent ? <Badge tone="brand">Current</Badge> : null}
            </div>
            {e.designation ? <p className="text-sm text-secondary">{e.company}</p> : null}
            <p className="mt-0.5 text-xs text-secondary">
              {memberLine([period(e.startedOn, e.endedOn, e.isCurrent, timing), e.location])}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function EducationList({ entries, timing }: { entries: EducationEntry[]; timing: Timing }) {
  return (
    <ul className="space-y-4">
      {entries.map((e) => (
        <li key={e.id} className="min-w-0">
          <p className="font-medium">{e.institution}</p>
          {e.qualification || e.field ? (
            <p className="text-sm text-secondary">{memberLine([e.qualification, e.field])}</p>
          ) : null}
          <p className="mt-0.5 text-xs text-secondary">{period(e.startedOn, e.endedOn, !e.endedOn, timing)}</p>
        </li>
      ))}
    </ul>
  );
}

/** "Apr 2021 – Present", month precision, in the college's locale and time zone. */
function period(start: string | null, end: string | null, current: boolean, timing: Timing): string | null {
  const from = monthYear(start, timing);
  const to = end ? monthYear(end, timing) : current ? 'Present' : null;
  if (from && to) return `${from} – ${to}`;
  return from ?? (to ? `Until ${to}` : null);
}

function monthYear(iso: string | null, timing: Timing): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(timing.locale, { month: 'short', year: 'numeric', timeZone: timing.timeZone }).format(d);
}

/** Label over value on phones, side by side from sm. */
const RECORD_ROW = 'grid-cols-1 gap-0.5 sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-4';

function verificationMethod(method: string | null, office: string): string {
  switch (method) {
    case 'auto_roll_match':
      return 'Matched against the register';
    case 'admin_manual':
      return `Checked by the ${office}`;
    case 'bulk_import':
      return 'Loaded from college records';
    case 'placement_cell_import':
      return 'Loaded by the placement cell';
    default:
      return 'Verified';
  }
}
