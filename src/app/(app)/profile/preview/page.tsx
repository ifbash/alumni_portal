import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Eye, EyeOff, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import {
  Alert,
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  DetailRow,
  PageHeader,
  SegmentedNav,
  Section,
  Table,
  TableWrap,
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
import type { MemberDetail, MemberStatus, Role } from '@/lib/data/types';

/**
 * What others see.
 *
 * The most reassuring screen in the product for somebody who signed up
 * reluctantly — and the easiest one in the world to get quietly wrong.
 *
 * It would be trivial to hand-write "students do not see your email" into
 * this page. The moment the projection or the release rule changes, that
 * sentence becomes a lie printed in the one place a member went looking for
 * the truth. So nothing here is described; everything is *run*. The page
 * builds a session for each viewer role and calls `getMemberBySlug()` —
 * the same function the directory calls, applying the same tier projection
 * and the same two contact-release gates. If a field is missing from the
 * table below, it is missing because the projection did not carry it, not
 * because this file said so.
 *
 * The simulated viewer has no accepted connection with you, which is the
 * floor rather than the average: it is what a member who has never spoken
 * to you can reach.
 */

export const metadata: Metadata = {
  title: 'Profile preview',
};

type ViewerKind = 'student' | 'alumni' | 'admin';

const VIEWERS: Record<
  ViewerKind,
  { tab: string; who: string; role: Role; status: MemberStatus; standing: string }
> = {
  student: {
    tab: 'A student',
    who: 'a final-year student',
    role: 'student',
    status: 'active_student',
    standing: 'Browsing the alumni directory looking for someone to ask. Has never met you.',
  },
  alumni: {
    tab: 'A fellow alumnus',
    who: 'a fellow alumnus',
    role: 'alumni',
    status: 'active_alumni',
    standing: 'Another verified graduate of the college. No connection request between you.',
  },
  admin: {
    tab: 'The college admin',
    who: 'the college admin',
    role: 'college_admin',
    status: 'active_alumni',
    standing:
      'The alumni cell head, holding the one role that can read contact details outright and export them in bulk. Every one of those reads is attributable.',
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
  // The real read path. Tier projection and both contact gates run inside.
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

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'My profile', href: '/profile' },
          { label: 'What others see' },
        ]}
      />

      <PageHeader
        eyebrow="Profile preview"
        title="What others see"
        description="Your own record, read back through the same code the directory uses for each kind of viewer. Nothing on this page is a description of the rules — it is the rules, run against your profile, a moment ago."
        actions={
          <ButtonLink href="/settings/privacy" variant="secondary">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Privacy settings
          </ButtonLink>
        }
      />

      <div className="space-y-3">
        <SegmentedNav items={tabs} />
        <p className="text-sm text-secondary">
          <span className="font-medium text-primary">Viewing as {viewerSpec.who}.</span>{' '}
          {viewerSpec.standing}
        </p>
      </div>

      {seen ? (
        <>
          <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0 space-y-6">
              <Section
                title="In the directory list"
                description="The card itself, rendered by the same component the search results use."
              >
                <div className="sm:max-w-sm">
                  <MemberCard member={seen} />
                </div>
                <p className="text-xs text-muted">
                  Opening the card takes you to your own profile page as you normally see it — not
                  as {viewerSpec.who} sees it. Use the switcher above for that.
                </p>
              </Section>

              <Section
                title="Field by field"
                description={`Anything marked withheld was never selected into the response. It is not hidden by the page — it never left the server.`}
              >
                <TableWrap caption={`What ${viewerSpec.who} receives for each field of your profile`}>
                  <Table>
                    <THead>
                      <TR>
                        <TH className="min-w-40">Field</TH>
                        <TH>What {viewerSpec.who} gets</TH>
                      </TR>
                    </THead>
                    <TBody>
                      <FieldRow label="Name" value={seen.fullName} />
                      <FieldRow
                        label="Photo"
                        value={seen.photoUrl ? 'Shown' : null}
                        absent={profile.photoUrl ? 'Withheld at this tier' : 'You have not uploaded one'}
                      />
                      <FieldRow
                        label="Branch and batch"
                        value={
                          memberLine([
                            seen.departmentCode,
                            seen.batchYear ? `batch of ${seen.batchYear}` : null,
                          ]) || null
                        }
                        absent="Not on your record"
                      />
                      <FieldRow
                        label="Employer and designation"
                        value={memberLine([seen.designation, seen.currentCompany]) || null}
                        absent={
                          profile.currentCompany || profile.designation
                            ? 'Withheld at this tier'
                            : 'You have not added one'
                        }
                      />
                      <FieldRow
                        label="Short introduction"
                        value={seen.bio ? truncate(seen.bio) : null}
                        absent={profile.bio ? 'Withheld at this tier' : 'You have not written one'}
                      />
                      <FieldRow
                        label="Skills"
                        value={seen.skills.length ? seen.skills.join(', ') : null}
                        absent={profile.skills.length ? 'Withheld at this tier' : 'None added'}
                      />
                      <FieldRow
                        label="City, state, country"
                        value={memberLine([seen.city, seen.state, seen.country]) || null}
                        absent={
                          profile.city
                            ? 'Withheld — location is not in the field list for this viewer'
                            : 'You have not added a city'
                        }
                      />
                      <FieldRow
                        label="Industry"
                        value={seen.industry ?? null}
                        absent={
                          profile.industry
                            ? 'Withheld — not in the field list for this viewer'
                            : 'You have not added one'
                        }
                      />
                      <FieldRow
                        label="Open to mentoring, referrals, speaking"
                        value={
                          availabilityLine(seen) ||
                          'All three off — the profile says you are not taking requests'
                        }
                      />

                      <ContactFieldRow
                        label="Email"
                        ownValue={ownContact.email ?? null}
                        released={seen.contact?.email ?? null}
                        seen={seen}
                        viewer={viewerSpec.who}
                      />
                      <ContactFieldRow
                        label="Mobile"
                        ownValue={ownContact.mobile ?? null}
                        released={seen.contact?.mobile ?? null}
                        seen={seen}
                        viewer={viewerSpec.who}
                        neverBulk
                      />
                      <ContactFieldRow
                        label="LinkedIn"
                        ownValue={ownContact.linkedin ?? null}
                        released={seen.contact?.linkedin ?? null}
                        seen={seen}
                        viewer={viewerSpec.who}
                      />
                      <ContactFieldRow
                        label="GitHub or portfolio"
                        ownValue={ownContact.github ?? ownContact.portfolio ?? null}
                        released={seen.contact?.github ?? seen.contact?.portfolio ?? null}
                        seen={seen}
                        viewer={viewerSpec.who}
                      />

                      <FieldRow
                        label="Roll number"
                        value={seen.rollNumber ?? null}
                        absent="Withheld — released only to a role that can read the college record"
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
                          absent="Withheld — placement-side data, never shown to alumni"
                        />
                      ) : null}
                    </TBody>
                  </Table>
                </TableWrap>
              </Section>
            </div>

            <aside className="min-w-0 space-y-6">
              <ContactBlock
                contact={seen.contact}
                ownerName={profile.fullName}
                // The owner's setting travels with the refusal, so the block
                // can name which gate is closed instead of showing a dead
                // end. `seen.contact?.visibility` would be null exactly when
                // the reason matters most.
                visibility={seen.contactVisibility}
                hasAcceptedConnection={seen.hasAcceptedConnection}
              />

              <Card>
                <CardHeader>
                  <div className="space-y-1">
                    <CardTitle as="h2" className="text-md">
                      Why that block says what it says
                    </CardTitle>
                    <CardDescription>
                      Contact release needs both gates to pass, every time.
                    </CardDescription>
                  </div>
                  {seen.contact ? (
                    <Badge tone="warning" dot>
                      Released
                    </Badge>
                  ) : (
                    <Badge tone="success" dot>
                      Withheld
                    </Badge>
                  )}
                </CardHeader>

                <CardBody className="space-y-3">
                  <dl className="divide-y divide-line">
                    <DetailRow label="Gate 1 — entitled">
                      {kind === 'admin'
                        ? 'Yes. The college admin holds an explicit capability to read contact details.'
                        : tier === 'member'
                          ? 'Depends on your setting below — alumni and faculty are the tier your setting can open to.'
                          : 'Students are never entitled outright. Only an accepted request reaches them.'}
                    </DetailRow>
                    <DetailRow label="Gate 2 — you consented">
                      {VISIBILITY_PLAIN[seen.contactVisibility ?? 'on_accept']}
                    </DetailRow>
                    <DetailRow label="Connection between you">
                      {seen.hasAcceptedConnection
                        ? 'Accepted'
                        : 'None — this preview assumes a viewer you have never accepted'}
                    </DetailRow>
                    <DetailRow label="Field tier applied">
                      <span className="font-mono">{tier}</span>
                    </DetailRow>
                  </dl>

                  <ButtonLink href="/settings/privacy" variant="secondary" size="sm" className="w-full">
                    <ShieldCheck className="size-4" aria-hidden="true" />
                    Change who can reach you
                  </ButtonLink>
                </CardBody>
              </Card>

              {kind === 'admin' ? (
                <Alert tone="neutral" title="What the admin cannot do" icon={<Lock className="size-4" />}>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    <li>
                      Read a private message. There is no capability for it, for any role, and the
                      absence is deliberate.
                    </li>
                    <li>
                      Export in bulk without leaving a trace. Every export writes the actor, the
                      scope and a stated reason to the audit log, and you can ask for the entries
                      about you.
                    </li>
                  </ul>
                </Alert>
              ) : null}

              {kind === 'student' ? (
                <Alert tone="neutral" title="What a student can still do" icon={<UserCheck className="size-4" />}>
                  Send you one connection request with a message — five open at a time, ten a month
                  across the whole portal. You see their name, branch and batch before you decide,
                  and declining is silent.
                </Alert>
              ) : null}

              <ButtonLink href="/profile/edit" variant="secondary" size="sm" className="w-full">
                Edit what is on the profile
              </ButtonLink>
            </aside>
          </div>
        </>
      ) : (
        <Section title={`${capitalise(viewerSpec.who)} cannot see your profile at all`}>
          <Card>
            <CardBody className="space-y-4">
              <p className="max-w-prose text-sm text-secondary">
                {invisibleReason(kind, profile, allowedStatuses, viewerSeesStudents)}
              </p>

              <dl className="divide-y divide-line">
                <DetailRow label="Your membership status">
                  <span className="font-mono">{profile.status}</span>
                </DetailRow>
                <DetailRow label="Statuses this viewer may list">
                  <span className="font-mono">{allowedStatuses.join(', ')}</span>
                </DetailRow>
              </dl>

              <p className="text-xs text-muted">
                This is the directory read path refusing, not a page hiding something. The refusal
                happens before any field of your record is selected, so there is nothing for a
                careless query to leak.
              </p>
            </CardBody>
          </Card>
        </Section>
      )}

      <Card>
        <CardBody className="space-y-2">
          <CardTitle as="h2" className="text-md">
            One thing this preview does not show you
          </CardTitle>
          <p className="max-w-prose text-sm text-secondary">
            The simulated viewer has never had a connection request accepted by you. If your setting
            is &ldquo;only people whose request I accept&rdquo;, that is why the contact block is
            closed here — accepting one person&rsquo;s request opens it for that person and nobody
            else. Changing the setting afterwards narrows what is released next; it does not take
            back an address already given.{' '}
            <Link href="/settings/privacy" className="link">
              Read the full rule and your consent history
            </Link>
            .
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------
// Rows
// ---------------------------------------------------------------

function FieldRow({
  label,
  value,
  absent = 'Withheld at this tier',
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
            <span className={mono ? 'font-mono' : undefined}>{value}</span>
          </span>
        ) : (
          <Withheld>{absent}</Withheld>
        )}
      </TD>
    </TR>
  );
}

function ContactFieldRow({
  label,
  ownValue,
  released,
  seen,
  viewer,
  neverBulk,
}: {
  label: string;
  ownValue: string | null;
  released: string | null;
  seen: MemberDetail;
  viewer: string;
  neverBulk?: boolean;
}) {
  if (!ownValue) {
    return (
      <TR>
        <TH scope="row" className="text-left font-semibold normal-case tracking-normal text-primary">
          {label}
        </TH>
        <TD>
          <span className="text-sm text-muted">Not on your record — nothing to release.</span>
        </TD>
      </TR>
    );
  }

  return (
    <TR>
      <TH scope="row" className="text-left font-semibold normal-case tracking-normal text-primary">
        {label}
      </TH>
      <TD>
        {released ? (
          <span className="inline-flex items-start gap-2">
            <Eye className="mt-0.5 size-3.5 shrink-0 text-warning-fg" aria-hidden="true" />
            <span className="min-w-0 break-words font-mono">{released}</span>
          </span>
        ) : (
          <Withheld>
            {!seen.contact
              ? releaseReason(seen, viewer)
              : neverBulk
                ? 'Withheld. A mobile number is never released in bulk, at any setting — only on a request you have accepted, or to the college admin.'
                : 'Withheld by the release rule for this viewer.'}
          </Withheld>
        )}
      </TD>
    </TR>
  );
}

function Withheld({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-start gap-2 text-secondary">
      <EyeOff className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </span>
  );
}

// ---------------------------------------------------------------
// Copy
// ---------------------------------------------------------------

function releaseReason(seen: MemberDetail, viewer: string): string {
  switch (seen.contactVisibility) {
    case 'private':
      return `Withheld. You have chosen that nobody sees your contact details, so ${viewer} gets nothing — not even after an accepted request.`;
    case 'on_accept':
      return `Withheld. Your setting releases contact details only to somebody whose request you have accepted, and ${viewer} is not that person here.`;
    case 'alumni_only':
      return `Withheld. Your setting releases contact details to alumni and faculty, and ${viewer} is outside that group.`;
    case 'all_members':
      return `Withheld. "Every verified member" means every alumnus and faculty member — students reach you through a request you accept, never through the directory.`;
    default:
      return 'Withheld. Release needs you to have consented and the viewer to be entitled. Both must be true.';
  }
}

const VISIBILITY_PLAIN: Record<string, string> = {
  private: 'No. You have chosen that nobody sees your email or mobile through the portal.',
  on_accept: 'Only for someone whose connection request you have accepted.',
  alumni_only: 'Yes, for alumni and faculty. No, for students.',
  all_members: 'Yes, for every verified alumnus and faculty member. Students still have to ask.',
};

function invisibleReason(
  kind: ViewerKind,
  profile: MemberDetail,
  allowedStatuses: string[],
  viewerSeesStudents: boolean,
): string {
  if (!allowedStatuses.includes(profile.status)) {
    if (profile.status === 'active_student' && !viewerSeesStudents) {
      return kind === 'student'
        ? 'Students are not listed to other students. A final-year cannot browse their own cohort here — the directory exists to reach alumni, and a searchable list of classmates is not something anybody consented to.'
        : 'Alumni do not browse the student list. Your record is not in the results an alumnus can page through; they see you when you write to them, with your name, branch and batch attached to the message. That is the only route, and it is on purpose.';
    }
    return 'Your membership is not active in the directory yet. Until your claim is matched against the degree register, your record is reachable by the alumni cell through the admin console for exactly that purpose — and by nobody else.';
  }
  return 'The directory read path refused this viewer. Nothing about your record was selected.';
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

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
