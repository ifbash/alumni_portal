import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Check, Clock, Eye, Lock, X } from 'lucide-react';
import {
  Badge,
  DefinitionCard,
  Disclosure,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { getSession } from '@/lib/auth/session';
import { requireSession, can, type Session } from '@/lib/auth/guard';
import { getNotifications, getOwnProfile } from '@/lib/data/repo';
import { roleHas, type Role } from '@/lib/auth/permissions';
import { releaseContact } from '@/lib/members/projection';
import { getTenantBrand } from '@/lib/tenant';
import { isVendorOnlySession } from '@/lib/navigation';
import { NOTICE_VERSION } from '@/lib/config';
import { formatDate } from '@/lib/format';
import { capitalise, vendorLabel } from '@/lib/branding/copy';
import { visibilityOption } from '@/lib/visibility-copy';
import type { ContactVisibility } from '@/lib/data/types';
import { VisibilityForm, type Matrices, type MatrixCell, type MatrixRow } from './VisibilityForm';

/**
 * Privacy — the member's half of contact release.
 *
 * The setting is four options in plain words, with what each one does
 * written next to it. Under it, "Who can see what" is not written by hand:
 * the page runs `releaseContact()` from `src/lib/members/projection.ts`
 * against a viewer of each kind, for each of the four options, so the
 * matrix follows the option being chosen and cannot drift from what the
 * directory actually releases. The per-role table in the disclosure is
 * read from the same capability grants `can()` reads.
 */

export const metadata: Metadata = {
  title: 'Privacy settings',
};

type Access = 'yes' | 'no' | 'on_accept' | 'never';

const OPTIONS: ContactVisibility[] = ['private', 'on_accept', 'alumni_only', 'all_members'];

/** A stand-in contact, so the matrix measures the rule rather than which fields happen to be filled. */
const PROBE = { email: 'probe', mobile: 'probe', linkedin: 'probe', github: 'probe', portfolio: 'probe' };

export default async function PrivacySettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  requireSession(session);

  const profile = getOwnProfile(session);
  if (!profile) notFound();

  const visibility: ContactVisibility = profile.contact?.visibility ?? 'on_accept';
  const isStudent = profile.isStudent;

  // ---- Derived from the same grants the guards read -------------------

  const seesProfile = (role: Role): boolean => {
    if (roleHas(role, 'profile.read.any')) return true;
    return isStudent
      ? roleHas(role, 'directory.search.students')
      : roleHas(role, 'directory.search.alumni');
  };

  const seesRawContact = (role: Role) => roleHas(role, 'directory.view.contact');
  const memberTier = (role: Role) => role === 'alumni' || role === 'faculty';

  const seesEmail = (role: Role): Access => {
    if (seesRawContact(role)) return 'yes';
    if (!seesProfile(role)) return 'no';
    switch (visibility) {
      case 'private':
        return 'no';
      case 'on_accept':
        return 'on_accept';
      case 'alumni_only':
        return memberTier(role) ? 'yes' : 'no';
      case 'all_members':
        return 'yes';
    }
  };

  const seesMobile = (role: Role): Access => {
    if (seesRawContact(role)) return 'yes';
    if (!seesProfile(role)) return 'no';
    switch (visibility) {
      case 'private':
        return 'no';
      case 'on_accept':
        return 'on_accept';
      case 'alumni_only':
        return memberTier(role) ? 'yes' : 'no';
      // A phone number is never bulk-visible, whatever the member picks.
      case 'all_members':
        return 'no';
    }
  };

  const rows = ROLE_ROWS.map((r) => ({
    ...r,
    identity: seesProfile(r.role) ? ('yes' as Access) : ('no' as Access),
    detail: seesProfile(r.role) ? ('yes' as Access) : ('no' as Access),
    email: seesEmail(r.role),
    mobile: seesMobile(r.role),
    academic:
      isStudent && roleHas(r.role, 'directory.view.cgpa') ? ('yes' as Access) : ('no' as Access),
    messages: 'never' as Access,
  }));

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const pack = resolved.brand.pack;
  const office = pack.copy.officeName;
  const editable = can(session, 'profile.write.own');
  const vendorOnly = isVendorOnlySession(session);

  // ---- Contact release, run rather than described ---------------------

  const ownerCanReceive = can(session, 'connection.receive');
  const ownerCanSend = can(session, 'connection.send');

  const viewerFor = (role: Role): Session => ({
    memberId: `privacy:${role}`,
    tenantId: session.tenantId,
    status: role === 'student' ? 'active_student' : 'active_alumni',
    roles: [{ role, departmentId: null }],
    departmentId: null,
    batchYear: null,
  });

  /** Could these two ever hold an accepted request between them? */
  const connectable = (viewer: Session): boolean =>
    pack.features.connections &&
    ((can(viewer, 'connection.send') && ownerCanReceive) ||
      (ownerCanSend && can(viewer, 'connection.receive')));

  const release = (role: Role, option: ContactVisibility): { email: MatrixCell; mobile: MatrixCell } => {
    const viewer = viewerFor(role);
    const owner = { memberId: session.memberId, contact: { ...PROBE, visibility: option } };
    const now = releaseContact(viewer, owner, { hasAcceptedConnection: false });
    const onAccept = connectable(viewer)
      ? releaseContact(viewer, owner, { hasAcceptedConnection: true })
      : null;
    const cell = (field: 'email' | 'mobile'): MatrixCell =>
      now?.[field] ? 'yes' : onAccept?.[field] ? 'on_accept' : 'no';
    return { email: cell('email'), mobile: cell('mobile') };
  };

  const reach = (role: Role, option: ContactVisibility): Omit<MatrixRow, 'key' | 'label'> => {
    const profileCell: MatrixCell = seesProfile(role) ? 'yes' : 'no';
    if (profileCell === 'no') return { profile: 'no', email: 'no', mobile: 'no' };
    return { profile: profileCell, ...release(role, option) };
  };

  const same = (a: Omit<MatrixRow, 'key' | 'label'>, b: Omit<MatrixRow, 'key' | 'label'>) =>
    a.profile === b.profile && a.email === b.email && a.mobile === b.mobile;

  const matrices = Object.fromEntries(
    OPTIONS.map((option) => {
      const alumni = reach('alumni', option);
      const faculty = reach('faculty', option);
      const matrix: MatrixRow[] = [
        { key: 'student', label: 'Final-year students', ...reach('student', option) },
        ...(same(alumni, faculty)
          ? [{ key: 'members', label: 'Alumni and faculty', ...alumni }]
          : [
              { key: 'alumni', label: 'Alumni', ...alumni },
              { key: 'faculty', label: 'Faculty', ...faculty },
            ]),
        { key: 'office', label: capitalise(office), ...reach('alumni_cell_operator', option) },
        { key: 'admin', label: 'College admin', ...reach('college_admin', option) },
      ];
      return [option, matrix];
    }),
  ) as Matrices;

  // The per-role table below reads its email and mobile columns from the
  // same run, so the two views on this page can never disagree.
  const saved = Object.fromEntries(
    ROLE_ROWS.map((r) => [r.role, seesProfile(r.role) ? release(r.role, visibility) : null]),
  ) as Record<Role, { email: MatrixCell; mobile: MatrixCell } | null>;
  const releasedAccess = (role: Role, field: 'email' | 'mobile'): Access => saved[role]?.[field] ?? 'no';

  const roleLabel = (role: Role, label: string) =>
    role === 'platform_admin'
      ? `Platform admin (${vendorLabel(pack.copy)})`
      : role === 'alumni_cell_operator'
        ? `${capitalise(office)} staff`
        : label;

  // ---- Consent records ------------------------------------------------

  const noticeUpdate = getNotifications(session).find(
    (n) => n.kind === 'system' && n.title.toLowerCase().includes('privacy notice'),
  );

  const current = visibilityOption(visibility);

  return (
    <>
      <VisibilityForm
        initial={visibility}
        matrices={matrices}
        readOnly={!editable}
        officeName={office}
        ownerIsStudent={isStudent}
      />

      <div className="space-y-3">
        <Disclosure id="every-role" summary="Every role at the college, in detail">
          <div className="space-y-3">
            <p>
              What each role can see about you with your saved setting,
              {current ? ` “${current.label}”` : ''}. Someone who holds two roles gets both.
            </p>

            <TableWrap caption="What each role at the college can see about your record" className="hidden sm:block">
              <Table>
                <THead>
                  <TR>
                    <TH className="min-w-44">Role</TH>
                    <TH>Name, branch, batch</TH>
                    <TH>Bio, skills, employer</TH>
                    <TH>Email</TH>
                    <TH>Mobile</TH>
                    {isStudent ? <TH>CGPA, placement</TH> : null}
                    <TH>Your messages</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((r) => (
                    <TR key={r.role}>
                      <TH scope="row" className="text-left font-semibold normal-case tracking-normal text-primary">
                        {roleLabel(r.role, r.label)}
                        {r.note ? (
                          <span className="block text-xs font-normal normal-case text-secondary">{r.note}</span>
                        ) : null}
                      </TH>
                      <TD>
                        <AccessCell value={r.identity} />
                      </TD>
                      <TD>
                        <AccessCell value={r.detail} />
                      </TD>
                      <TD>
                        <AccessCell value={releasedAccess(r.role, 'email')} />
                      </TD>
                      <TD>
                        <AccessCell value={releasedAccess(r.role, 'mobile')} />
                      </TD>
                      {isStudent ? (
                        <TD>
                          <AccessCell value={r.academic} />
                        </TD>
                      ) : null}
                      <TD>
                        <AccessCell value={r.messages} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>

            {/* Below sm a seven-column table is unreadable however it scrolls. */}
            <div className="space-y-3 sm:hidden">
              {rows.map((r) => (
                <DefinitionCard
                  key={r.role}
                  title={roleLabel(r.role, r.label)}
                  subtitle={r.note}
                  rows={[
                    { label: 'Name, branch, batch', value: <AccessCell value={r.identity} /> },
                    { label: 'Bio, skills, employer', value: <AccessCell value={r.detail} /> },
                    { label: 'Email', value: <AccessCell value={releasedAccess(r.role, 'email')} /> },
                    { label: 'Mobile', value: <AccessCell value={releasedAccess(r.role, 'mobile')} /> },
                    ...(isStudent
                      ? [{ label: 'CGPA, placement', value: <AccessCell value={r.academic} /> }]
                      : []),
                    { label: 'Your messages', value: <AccessCell value={r.messages} /> },
                  ]}
                />
              ))}
            </div>
          </div>
        </Disclosure>

        {pack.features.directory && !vendorOnly ? (
          <p>
            <Link href="/profile/preview" className="link inline-flex min-h-11 items-center gap-2 text-sm">
              <Eye className="size-4" aria-hidden="true" />
              {isStudent ? 'See what others see' : 'See it as a student sees it'}
            </Link>
          </p>
        ) : null}

        <Disclosure id="consent-history" summary="Your consent history">
          <ol className="space-y-4">
            {noticeUpdate ? (
              <ConsentRow
                title={`Privacy notice ${NOTICE_VERSION}`}
                when={noticeUpdate.createdAt}
                version={NOTICE_VERSION}
                state={
                  noticeUpdate.readAt
                    ? { tone: 'success', label: `Read ${formatDate(noticeUpdate.readAt)}` }
                    : { tone: 'warning', label: 'Not read yet' }
                }
                detail="The notice now in force."
              />
            ) : null}

            <ConsentRow
              title="Contact sharing"
              when={null}
              version={NOTICE_VERSION}
              state={{ tone: 'brand', label: current?.label ?? 'Not chosen' }}
              detail="Your current setting. Changing it adds a new entry and keeps this one."
            />

            <ConsentRow
              title="Directory listing"
              when={profile.verifiedAt}
              version={NOTICE_VERSION}
              state={{ tone: 'success', label: 'Given' }}
              detail={
                isStudent
                  ? 'Recorded when the placement cell added you. Alumni see your name, branch and batch when you write to them.'
                  : 'Recorded when your registration was verified. Other members see your name, branch and batch.'
              }
            />
          </ol>
        </Disclosure>
      </div>
    </>
  );
}

// ---------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------

function AccessCell({ value }: { value: Access }) {
  if (value === 'yes') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-primary">
        <Eye className="size-3.5 shrink-0 text-brand-fg" aria-hidden="true" />
        Yes
      </span>
    );
  }
  if (value === 'on_accept') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-primary">
        <Clock className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
        If you accept
      </span>
    );
  }
  if (value === 'never') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        <Lock className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
        Never
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-secondary">
      <X className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
      No
    </span>
  );
}

function ConsentRow({
  title,
  when,
  version,
  state,
  detail,
}: {
  title: string;
  when: string | null;
  version: string;
  state: { tone: 'success' | 'warning' | 'brand'; label: string };
  detail: string;
}) {
  return (
    <li className="flex gap-3 border-b border-line pb-4 last:border-0 last:pb-0">
      <span
        className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-surface-sunken text-secondary"
        aria-hidden="true"
      >
        <Check className="size-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-primary">{title}</p>
          <Badge tone={state.tone}>{state.label}</Badge>
        </div>
        <p className="text-sm text-secondary">{detail}</p>
        <p className="text-xs text-secondary">
          {when ? formatDate(when) : 'Current'} · notice {version}
        </p>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------
// Copy
// ---------------------------------------------------------------

const ROLE_ROWS: Array<{ role: Role; label: string; note?: string }> = [
  { role: 'student', label: 'Final-year students' },
  { role: 'alumni', label: 'Other alumni' },
  { role: 'faculty', label: 'Faculty' },
  {
    role: 'hod',
    label: 'Head of department',
    note: 'Reviews registrations and messages for their own branch.',
  },
  {
    role: 'placement_officer',
    label: 'Placement officer',
    note: 'Works with current students.',
  },
  { role: 'alumni_cell_operator', label: 'Office staff', note: 'Cannot export contact details.' },
  { role: 'finance', label: 'Finance', note: 'Donations only. No directory access.' },
  {
    role: 'college_admin',
    label: 'College admin',
    note: 'The only role that can export contact details, with a written reason that is logged.',
  },
  {
    role: 'platform_admin',
    label: 'Platform admin',
    note: 'Sets up the portal for the college. Cannot see member data.',
  },
];
