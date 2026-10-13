import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Eye, EyeOff, Pencil } from 'lucide-react';
import {
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardTitle,
  Disclosure,
  PageHeader,
  Table,
  TableWrap,
  Tabs,
  TBody,
  TD,
  TH,
  THead,
  TR,
  type TabItem,
} from '@/components/ui';
import { MemberCard } from '@/components/members/MemberCard';
import { ContactBlock } from '@/components/members/ContactBlock';
import { getSession } from '@/lib/auth/session';
import { requireSession, can, type Session } from '@/lib/auth/guard';
import { tierFor, visibleStatusesFor } from '@/lib/members/projection';
import { getTenantBrand } from '@/lib/tenant';
import { getMemberBySlug, getOwnProfile } from '@/lib/data/repo';
import { memberLine } from '@/lib/format';
import { capitalise, inSentence, joinList } from '@/lib/branding/copy';
import { visibilityOption } from '@/lib/visibility-copy';
import type { ContactVisibility, MemberDetail, MemberStatus, Role } from '@/lib/data/types';

/**
 * What others see.
 *
 * Nothing on this page is written from the rules; it is the rules, run.
 * For each kind of viewer the page builds a session and calls
 * `getMemberBySlug()`, the same function the directory calls, so the card,
 * the contact block, the "Sees" and "Does not see" lines and the
 * field-by-field table are all read off what that call returned. Only the
 * "Can" line is written, and it follows `VISIBILITY_OPTIONS`.
 *
 * The simulated viewer has no accepted request with you: the floor, not
 * the average, and what a member who has never spoken to you can reach.
 */

export const metadata: Metadata = {
  title: 'What others see',
};

type ViewerKind = 'student' | 'alumni' | 'admin';

const VIEWERS: Record<
  ViewerKind,
  { tab: string; who: string; role: Role; status: MemberStatus; standing: string }
> = {
  student: {
    tab: 'Final-year student',
    who: 'a final-year student',
    role: 'student',
    status: 'active_student',
    standing: 'Has never been in touch with you.',
  },
  alumni: {
    tab: 'Fellow alumnus',
    who: 'a fellow alumnus',
    role: 'alumni',
    status: 'active_alumni',
    standing: 'Another verified graduate you have not accepted a request from.',
  },
  admin: {
    tab: 'College admin',
    who: 'the college admin',
    role: 'college_admin',
    status: 'active_alumni',
    standing: 'Runs the portal for the college.',
  },
};

const ORDER: ViewerKind[] = ['student', 'alumni', 'admin'];

function isViewerKind(v: string | undefined): v is ViewerKind {
  return v === 'student' || v === 'alumni' || v === 'admin';
}

/**
 * A viewer session, built for the preview and nothing else.
 *
 * The member id is deliberately not a real one. If it were the owner's,
 * `releaseContact()` would take its "this is your own record" shortcut and
 * the preview would show everything to everybody — the exact failure this
 * page exists to rule out.
 */
function previewSession(kind: ViewerKind, tenantId: string, departmentCode: string | null): Session {
  const v = VIEWERS[kind];
  return {
    memberId: `preview:${kind}`,
    tenantId,
    status: v.status,
    roles: [{ role: v.role, departmentId: kind === 'admin' ? null : departmentCode }],
    departmentId: departmentCode,
    batchYear: null,
  };
}

export default async function ProfilePreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  requireSession(session);

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  // Nothing to preview when there is no directory to be seen in.
  if (!pack.features.directory) notFound();

  const profile = getOwnProfile(session);
  if (!profile) notFound();

  const params = await searchParams;
  const kind: ViewerKind = isViewerKind(params.as) ? params.as : 'student';
  const viewerSpec = VIEWERS[kind];

  const viewer = previewSession(kind, session.tenantId, profile.departmentCode);
  // The real read path. The field projection and contact release run inside.
  const seen = getMemberBySlug(viewer, profile.slug);

  const tier = tierFor(viewer);
  const allowedStatuses = visibleStatusesFor(viewer);
  const viewerSeesStudents = can(viewer, 'directory.search.students');

  const tabs: TabItem[] = ORDER.map((k) => ({
    label: VIEWERS[k].tab,
    href: `/profile/preview?as=${k}`,
    active: k === kind,
  }));

  const ownContact = profile.contact ?? {};
  const visibility: ContactVisibility = profile.contact?.visibility ?? 'on_accept';
  const option = visibilityOption(visibility);
  const rollMid = inSentence(pack.copy.rollNumberLabel);
  const editable = can(session, 'profile.write.own');

  // A request needs the viewer to be able to send one and the owner to be
  // able to receive it, on a college with requests switched on.
  const mayRequest =
    pack.features.connections && can(viewer, 'connection.send') && can(session, 'connection.receive');

  const summary = seen
    ? summarise({ kind, seen, profile, ownContact, rollMid, visibility, mayRequest, staffView: tier === 'privileged' })
    : null;

  const releasedBecause =
    seen?.contact == null
      ? undefined
      : kind === 'admin'
        ? ('role' as const)
        : seen.hasAcceptedConnection
          ? ('connection' as const)
          : ('visibility' as const);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'My profile', href: '/profile' },
              { label: 'What others see' },
            ]}
          />
        }
        title="What others see"
        description="Your profile as each kind of member sees it, before any request is accepted."
      />

      <Tabs items={tabs} ariaLabel="Viewer" />

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-6">
          {seen && summary ? (
            <>
              <section aria-labelledby="seen-as" className="space-y-3">
                <h2 id="seen-as" className="text-sm font-semibold text-secondary">
                  As {viewerSpec.who} sees you
                </h2>
                <div className="grid grid-cols-1 items-start gap-gutter md:grid-cols-2">
                  <MemberCard member={seen} />
                  <ContactBlock
                    contact={seen.contact}
                    ownerName={profile.fullName}
                    // The owner's setting travels with the refusal, so the
                    // block can say why instead of showing a dead end.
                    visibility={seen.contactVisibility}
                    hasAcceptedConnection={seen.hasAcceptedConnection}
                    releasedBecause={releasedBecause}
                    viewerIsStudent={kind === 'student'}
                    shortName={pack.copy.shortName}
                  />
                </div>
              </section>

              <Card>
                <CardBody>
                  <dl className="divide-y divide-line">
                    <SummaryRow label="Sees" tone="seen">
                      {summary.sees}
                    </SummaryRow>
                    <SummaryRow label="Does not see" tone="hidden">
                      {summary.hidden}
                    </SummaryRow>
                    <SummaryRow label="Can">{summary.can}</SummaryRow>
                  </dl>
                </CardBody>
              </Card>

              <Disclosure id="field-by-field" summary="Field by field">
                <TableWrap caption={`What ${viewerSpec.who} is shown from each part of your profile`}>
                  <Table>
                    <THead>
                      <TR>
                        <TH className="min-w-36">Field</TH>
                        <TH>What {viewerSpec.who} sees</TH>
                      </TR>
                    </THead>
                    <TBody>
                      <FieldRow label="Name" value={seen.fullName} />
                      <FieldRow
                        label="Photo"
                        value={seen.photoUrl ? 'Shown' : null}
                        absent={profile.photoUrl ? 'Not shown' : 'You have not added one'}
                      />
                      <FieldRow
                        label="Branch and batch"
                        value={
                          memberLine([
                            seen.departmentCode,
                            seen.batchYear ? `Batch of ${seen.batchYear}` : null,
                          ]) || null
                        }
                        absent="Not on your record"
                      />
                      <FieldRow
                        label="Work"
                        value={memberLine([seen.designation, seen.currentCompany]) || null}
                        absent={profile.currentCompany || profile.designation ? 'Not shown' : 'You have not added any'}
                      />
                      <FieldRow
                        label="Introduction"
                        value={seen.bio ? truncate(seen.bio) : null}
                        absent={profile.bio ? 'Not shown' : 'You have not written one'}
                      />
                      <FieldRow
                        label="Skills"
                        value={seen.skills.length ? seen.skills.join(', ') : null}
                        absent={profile.skills.length ? 'Not shown' : 'None added'}
                      />
                      <FieldRow
                        label="City"
                        value={memberLine([seen.city, seen.state, seen.country]) || null}
                        absent={profile.city ? 'Not shown' : 'You have not added one'}
                      />
                      <FieldRow
                        label="Industry"
                        value={seen.industry ?? null}
                        absent={profile.industry ? 'Not shown' : 'You have not added one'}
                      />
                      <FieldRow label="Open to" value={availabilityLine(seen) || 'Nothing switched on'} />
                      <FieldRow
                        label="Email and mobile"
                        value={contactLine(seen)}
                        absent={ownContact.email || ownContact.mobile ? 'Not shown' : 'Not on your record'}
                        mono
                      />
                      <FieldRow
                        label="LinkedIn, GitHub, website"
                        value={seen.contact?.linkedin || seen.contact?.github || seen.contact?.portfolio ? 'Shown' : null}
                        absent={
                          ownContact.linkedin || ownContact.github || ownContact.portfolio
                            ? 'Not shown'
                            : 'You have not added any'
                        }
                      />
                      <FieldRow
                        label={pack.copy.rollNumberLabel}
                        value={seen.rollNumber ?? null}
                        absent="Not shown"
                        mono
                      />
                      {profile.isStudent ? (
                        <FieldRow
                          label="CGPA and placement status"
                          value={
                            seen.cgpa != null || seen.placementStatus
                              ? memberLine([
                                  seen.cgpa != null ? seen.cgpa.toFixed(2) : null,
                                  seen.placementStatus,
                                ])
                              : null
                          }
                          absent="Not shown. Only the placement cell and the college admin see these."
                        />
                      ) : null}
                    </TBody>
                  </Table>
                </TableWrap>
              </Disclosure>
            </>
          ) : (
            <Card>
              <CardBody className="space-y-2">
                <CardTitle as="h2" className="text-md">
                  {capitalise(viewerSpec.who)} cannot find your profile
                </CardTitle>
                <p className="max-w-prose text-sm text-secondary">
                  {invisibleReason(kind, profile, allowedStatuses, viewerSeesStudents)}
                </p>
              </CardBody>
            </Card>
          )}
        </div>

        <aside aria-label="About this preview" className="min-w-0 space-y-gutter">
          <Card>
            <CardBody>
              <dl className="space-y-4 text-sm">
                <div className="space-y-0.5">
                  <dt className="text-xs text-secondary">Viewer</dt>
                  <dd>
                    <span className="font-medium">{capitalise(viewerSpec.who)}.</span>{' '}
                    <span className="text-secondary">{viewerSpec.standing}</span>
                  </dd>
                </div>
                <div className="space-y-0.5">
                  <dt className="text-xs text-secondary">Your contact setting</dt>
                  <dd className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-medium">{option?.label ?? 'Not chosen'}</span>
                    <Link href="/settings/privacy" className="link inline-flex min-h-11 items-center">
                      Change
                    </Link>
                  </dd>
                </div>
                <div className="space-y-0.5">
                  <dt className="text-xs text-secondary">Request between you</dt>
                  <dd className="font-medium">None accepted</dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          {editable ? (
            <ButtonLink href="/profile/edit" variant="secondary" className="min-h-11 w-full">
              <Pencil className="size-4" aria-hidden="true" />
              Edit profile
            </ButtonLink>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// The three lines
// ---------------------------------------------------------------

function summarise({
  kind,
  seen,
  profile,
  ownContact,
  rollMid,
  visibility,
  mayRequest,
  staffView,
}: {
  kind: ViewerKind;
  seen: MemberDetail;
  profile: MemberDetail;
  ownContact: Partial<NonNullable<MemberDetail['contact']>>;
  rollMid: string;
  visibility: ContactVisibility;
  mayRequest: boolean;
  staffView: boolean;
}): { sees: string; hidden: string; can: string } {
  const c = seen.contact;
  const parts: Array<{ label: string; own: boolean; seen: boolean }> = [
    { label: 'photo', own: Boolean(profile.photoUrl), seen: Boolean(seen.photoUrl) },
    {
      label: 'branch and batch',
      own: Boolean(profile.departmentCode || profile.batchYear),
      seen: Boolean(seen.departmentCode || seen.batchYear),
    },
    {
      label: 'work',
      own: Boolean(profile.designation || profile.currentCompany),
      seen: Boolean(seen.designation || seen.currentCompany),
    },
    { label: 'introduction', own: Boolean(profile.bio), seen: Boolean(seen.bio) },
    { label: 'skills', own: profile.skills.length > 0, seen: seen.skills.length > 0 },
    { label: 'city', own: Boolean(profile.city), seen: Boolean(seen.city) },
    { label: 'industry', own: Boolean(profile.industry), seen: Boolean(seen.industry) },
    { label: 'email', own: Boolean(ownContact.email), seen: Boolean(c?.email) },
    { label: 'mobile', own: Boolean(ownContact.mobile), seen: Boolean(c?.mobile) },
    {
      label: 'profile links',
      own: Boolean(ownContact.linkedin || ownContact.github || ownContact.portfolio),
      seen: Boolean(c?.linkedin || c?.github || c?.portfolio),
    },
    { label: rollMid, own: Boolean(profile.rollNumber), seen: Boolean(seen.rollNumber) },
    ...(profile.isStudent
      ? [
          {
            label: 'CGPA and placement status',
            own: profile.cgpa != null || Boolean(profile.placementStatus),
            seen: seen.cgpa != null || Boolean(seen.placementStatus),
          },
        ]
      : []),
  ];

  const seesList = ['name', ...parts.filter((p) => p.own && p.seen).map((p) => p.label)];
  const hiddenList = parts.filter((p) => p.own && !p.seen).map((p) => p.label);
  // No role can read the text of a request or reply, the admin included.
  if (staffView) hiddenList.push('messages');

  const sees = `Your ${joinList(seesList)}.`;
  const hidden = hiddenList.length ? `Your ${joinList(hiddenList)}.` : 'Nothing else on your profile.';

  let canLine: string;
  if (kind === 'admin') {
    canLine = 'Correct your record, and export contact details with a written reason that is logged.';
  } else {
    const released = Boolean(c?.email || c?.mobile);
    const direct = c?.mobile ? 'Email or call you directly' : 'Email you directly';
    if (released && mayRequest) canLine = `${direct}, or send you a request.`;
    else if (released) canLine = `${direct}.`;
    else if (mayRequest) {
      const after: Record<ContactVisibility, string> = {
        private: 'Your email and mobile stay private even if you accept.',
        on_accept: 'If you accept it, they see your email and mobile.',
        alumni_only: 'Accepting it does not show them your email or mobile.',
        all_members: 'Accepting it does not show them your email or mobile.',
      };
      canLine = `Send you a request. ${after[visibility]}`;
    } else canLine = 'Read your profile. Nothing more.';
  }

  return { sees, hidden, can: canLine };
}

// ---------------------------------------------------------------
// Rows
// ---------------------------------------------------------------

function SummaryRow({
  label,
  tone,
  children,
}: {
  label: string;
  tone?: 'seen' | 'hidden';
  children: React.ReactNode;
}) {
  const Icon = tone === 'seen' ? Eye : tone === 'hidden' ? EyeOff : null;
  return (
    <div className="grid grid-cols-1 gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
      <dt className="flex items-center gap-2 text-sm font-semibold">
        {Icon ? (
          <Icon
            className={tone === 'seen' ? 'size-4 shrink-0 text-brand-fg' : 'size-4 shrink-0 text-muted'}
            aria-hidden="true"
          />
        ) : null}
        {label}
      </dt>
      <dd className="text-sm text-secondary">{children}</dd>
    </div>
  );
}

function FieldRow({
  label,
  value,
  absent = 'Not shown',
  mono,
}: {
  label: string;
  value: string | null;
  absent?: string;
  mono?: boolean;
}) {
  return (
    <TR>
      <TH scope="row" className="text-left font-semibold normal-case tracking-normal text-primary">
        {label}
      </TH>
      <TD>
        {value ? (
          <span className="inline-flex items-start gap-2">
            <Eye className="mt-0.5 size-3.5 shrink-0 text-brand-fg" aria-hidden="true" />
            <span className={mono ? 'min-w-0 break-words font-mono' : 'min-w-0'}>{value}</span>
          </span>
        ) : (
          <span className="inline-flex items-start gap-2 text-secondary">
            <EyeOff className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
            <span className="min-w-0">{absent}</span>
          </span>
        )}
      </TD>
    </TR>
  );
}

// ---------------------------------------------------------------
// Copy
// ---------------------------------------------------------------

/** "alumni@example.com · +91 …", or the email alone with a note, or null. */
function contactLine(seen: MemberDetail): string | null {
  const email = seen.contact?.email ?? null;
  const mobile = seen.contact?.mobile ?? null;
  if (email && mobile) return `${email} · ${mobile}`;
  if (email) return `${email} (mobile not shown)`;
  if (mobile) return `${mobile} (email not shown)`;
  return null;
}

function invisibleReason(
  kind: ViewerKind,
  profile: MemberDetail,
  allowedStatuses: string[],
  viewerSeesStudents: boolean,
): string {
  if (!allowedStatuses.includes(profile.status)) {
    if (profile.status === 'active_student' && !viewerSeesStudents) {
      return kind === 'student'
        ? 'Final-year students are not listed to each other. The directory is for reaching alumni.'
        : 'Alumni cannot browse final-year students. They see your name, branch and batch when you send them a request.';
    }
    return 'Your profile is not in the directory yet. It appears once your registration is verified.';
  }
  return 'Your profile is not shown to this viewer.';
}

function availabilityLine(m: MemberDetail): string {
  return [
    m.openToMentoring ? 'mentoring' : null,
    m.openToReferrals ? 'referrals' : null,
    m.openToSpeaking ? 'speaking' : null,
  ]
    .filter(Boolean)
    .join(', ');
}

function truncate(s: string): string {
  return s.length > 140 ? `${s.slice(0, 137)}…` : s;
}
