import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  CircleAlert,
  GraduationCap,
  Lock,
  ScrollText,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import {
  getDepartments,
  getEventRegistrations,
  getEvents,
  getMembersForAdmin,
  getVerificationClaims,
  searchDegreeRegister,
} from '@/lib/data/repo';
import {
  Alert,
  Avatar,
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
  Progress,
  Separator,
} from '@/components/ui';
import { ROLE_LABELS } from '@/lib/navigation';
import {
  formatDate,
  formatPercent,
  formatRelative,
  maskEmail,
  maskMobile,
  memberLine,
  yearsOut,
} from '@/lib/format';
import type { ContactVisibility } from '@/lib/data/types';
import { STATUS_META, STATUS_ORDER } from '../status';
import { MemberActions } from './MemberActions';

export const metadata = { title: 'Member record' };

const VISIBILITY_COPY: Record<ContactVisibility, string> = {
  private: 'Private — released to nobody, including on an accepted connection',
  on_accept: 'Released once this member accepts a connection request',
  alumni_only: 'Alumni and faculty only — never students',
  all_members: 'Any verified member of the portal',
};

const VERIFICATION_METHOD: Record<string, string> = {
  auto_roll_match: 'Automatic — roll number matched the degree register',
  admin_manual: 'Manual — approved by the alumni cell against evidence supplied',
  bulk_import: 'Bulk import — loaded from a batch file, not self-registered',
  placement_cell_import: 'Placement cell import — current student roll list',
};

/**
 * One member record, staff view.
 *
 * The verification evidence sits directly under identity rather than in a
 * tab, because "why do we believe this person is who they say they are"
 * is the question this screen exists to answer. Contact and academic data
 * are each behind their own capability — being able to open a record is
 * not the same as being entitled to everything inside it.
 */
export default async function AdminMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  requireCap(session, 'profile.read.any');

  const { id } = await params;

  const everyone = getMembersForAdmin({ perPage: 100000 });
  const member = everyone.items.find((m) => m.id === id || m.slug === id);
  if (!member) notFound();

  const departments = getDepartments();
  const status = STATUS_META[member.status];

  const canContact = can(session, 'directory.view.contact');
  const canAcademic = can(session, 'directory.view.cgpa');
  const canWrite = can(session, 'profile.write.any');
  const canMerge = can(session, 'profile.merge');
  const canReview = can(session, 'verification.review.any') || can(session, 'verification.review.department');
  const canVerify = can(session, 'verification.override') || can(session, 'verification.review.any');

  // The register row this account was matched against. Without it, the
  // verification decision was made against no evidence — which is the one
  // thing the queue exists to prevent.
  const registerRow = member.rollNumber
    ? searchDegreeRegister(member.rollNumber, { perPage: 5 }).items.find(
        (r) => r.rollNumber === member.rollNumber,
      ) ?? null
    : null;

  const claim = canReview
    ? getVerificationClaims(session, { status: 'all' }).find(
        (c) => c.claimedRoll === member.rollNumber,
      ) ?? null
    : null;
  const topCandidate = claim?.candidates[0] ?? null;

  // Same name, same branch, same year happens in a cohort of 240. It is
  // the merge case, and it is also the case where merging is wrong.
  const duplicates = everyone.items.filter(
    (m) =>
      m.id !== member.id &&
      (m.fullName.toLowerCase() === member.fullName.toLowerCase() ||
        (Boolean(m.rollNumber) && m.rollNumber === member.rollNumber)),
  );

  const registrations = getEvents(session, { when: 'all', includeDrafts: true }).flatMap((e) =>
    getEventRegistrations(e.id).filter((r) => r.memberId === member.id),
  );
  const attended = registrations.filter((r) => r.checkedInAt).length;

  const completeness = [
    { label: 'Photo', done: Boolean(member.photoUrl) },
    { label: 'Bio', done: Boolean(member.bio) },
    { label: 'Current employer', done: Boolean(member.currentCompany) },
    { label: 'Designation', done: Boolean(member.designation) },
    { label: 'City', done: Boolean(member.city) },
    { label: 'Skills', done: member.skills.length > 0 },
    { label: 'LinkedIn', done: Boolean(member.contact?.linkedin) },
    { label: 'Mobile', done: Boolean(member.contact?.mobile) },
  ];
  const filled = completeness.filter((c) => c.done).length;

  const availability = [
    member.openToMentoring ? 'Mentors students' : null,
    member.openToReferrals ? 'Gives referrals' : null,
    member.openToSpeaking ? 'Speaks at events' : null,
  ].filter(Boolean) as string[];

  const location = memberLine([member.city, member.state, member.country !== 'IN' ? member.country : null]);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Console', href: '/admin' },
              { label: 'Members', href: '/admin/members' },
              { label: member.fullName },
            ]}
          />
        }
        eyebrow={member.rollNumber ?? 'No roll number on record'}
        title={member.fullName}
        description={memberLine([
          member.departmentName,
          member.batchYear ? `Batch of ${member.batchYear}` : null,
          yearsOut(member.batchYear),
          location || null,
        ])}
        actions={
          <ButtonLink href={`/directory/${member.slug}`} variant="secondary">
            View as a member sees it
          </ButtonLink>
        }
      />

      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        {/* ---------------------------------------------------------------
            Main column
           --------------------------------------------------------------- */}
        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-5">
              <div className="flex flex-wrap items-start gap-4">
                <Avatar name={member.fullName} src={member.photoUrl} size="xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={status.tone} dot>
                      {status.label}
                    </Badge>
                    {member.verifiedAt ? (
                      <Badge tone="brand">
                        <BadgeCheck className="size-3.5" aria-hidden="true" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge tone="warning">Not verified</Badge>
                    )}
                    {availability.map((a) => (
                      <Badge key={a} tone="outline">
                        {a}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-secondary">{status.note}</p>
                  {member.bio ? (
                    <p className="max-w-prose text-sm text-secondary">{member.bio}</p>
                  ) : (
                    <p className="text-sm text-muted">
                      No bio. Common for anyone who signed up more than four years ago and has not
                      been back since.
                    </p>
                  )}
                </div>
              </div>

              <Separator label="Identity" />

              <dl className="divide-y divide-line">
                <DetailRow label="Full name">{member.fullName}</DetailRow>
                <DetailRow label="Preferred name">
                  {member.preferredName ?? <span className="font-normal text-muted">Not set</span>}
                </DetailRow>
                <DetailRow label="Roll number">
                  {member.rollNumber ? (
                    <span className="font-mono">{member.rollNumber}</span>
                  ) : (
                    <span className="font-normal text-muted">Not on record</span>
                  )}
                </DetailRow>
                <DetailRow label="Programme">
                  {memberLine([member.programme, member.departmentName]) || '—'}
                </DetailRow>
                <DetailRow label="Admission year">{member.admissionYear ?? '—'}</DetailRow>
                <DetailRow label="Year of passing">{member.batchYear ?? '—'}</DetailRow>
                <DetailRow label="Member ID">
                  <span className="font-mono text-xs text-secondary">{member.id}</span>
                </DetailRow>
                <DetailRow label="Directory URL">
                  <Link href={`/directory/${member.slug}`} className="link font-mono text-xs">
                    /directory/{member.slug}
                  </Link>
                </DetailRow>
              </dl>
            </CardBody>
          </Card>

          {/* Verification evidence */}
          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h2">Verification evidence</CardTitle>
              <CardDescription>
                The degree register is the source of truth. Verification is a match between this
                account and a row in it — not a judgement call.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-4 pt-4">
              <dl className="divide-y divide-line">
                <DetailRow label="Verified on">
                  {member.verifiedAt ? (
                    <span>
                      {formatDate(member.verifiedAt)}{' '}
                      <span className="font-normal text-muted">({formatRelative(member.verifiedAt)})</span>
                    </span>
                  ) : (
                    <span className="font-normal text-muted">Not verified</span>
                  )}
                </DetailRow>
                <DetailRow label="Method">
                  {member.verificationMethod ? (
                    <span>
                      <span className="font-mono text-xs">{member.verificationMethod}</span>
                      <span className="mt-0.5 block text-xs font-normal text-secondary">
                        {VERIFICATION_METHOD[member.verificationMethod] ?? 'Method not documented.'}
                      </span>
                    </span>
                  ) : (
                    '—'
                  )}
                </DetailRow>
                <DetailRow label="Register row">
                  {registerRow ? (
                    <span className="space-y-0.5">
                      <span className="block font-mono text-xs">{registerRow.rollNumber}</span>
                      <span className="block text-xs font-normal text-secondary">
                        Printed as “{registerRow.name}” ·{' '}
                        {memberLine([
                          registerRow.departmentCode,
                          registerRow.programme,
                          registerRow.yearOfPassing ? `passed ${registerRow.yearOfPassing}` : null,
                        ])}
                      </span>
                    </span>
                  ) : (
                    <span className="font-normal text-muted">
                      No matching row loaded. Either the batch file has not arrived from the
                      examinations branch, or this account was approved before it did.
                    </span>
                  )}
                </DetailRow>
                {registerRow?.sourceFile ? (
                  <DetailRow label="Source file">
                    <span className="font-mono text-xs">{registerRow.sourceFile}</span>
                  </DetailRow>
                ) : null}
                {topCandidate ? (
                  <DetailRow label="Match confidence">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="tabular">{formatPercent(topCandidate.confidence, 1)}</span>
                      <Badge tone={topCandidate.confidence >= 0.9 ? 'success' : 'warning'}>
                        {topCandidate.confidence >= 0.9 ? 'Auto-approve band' : 'Review band'}
                      </Badge>
                    </span>
                  </DetailRow>
                ) : null}
              </dl>

              {registerRow && registerRow.name !== member.fullName ? (
                <Alert tone="info" icon={<ScrollText className="size-4" />}>
                  <p>
                    The register spelling and the portal spelling differ. That is normal — the
                    register is typed by hand from mark sheets, and surname-first order, collapsed
                    initials and dropped middle names are all common. The roll number is what carries
                    the match.
                  </p>
                </Alert>
              ) : null}

              {topCandidate?.reasons.length ? (
                <div className="rounded-lg border border-line bg-surface-sunken p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">
                    What the matcher found
                  </p>
                  <ul className="space-y-1.5 text-sm text-secondary">
                    {topCandidate.reasons.map((r) => (
                      <li key={r} className="flex gap-2">
                        <span aria-hidden="true" className="text-brand-fg">
                          ·
                        </span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                  {claim && claim.candidates.length > 1 ? (
                    <p className="mt-3 border-t border-line pt-3 text-xs text-secondary">
                      {claim.candidates.length} register rows were surfaced for this claim. The
                      approver saw all of them side by side.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {!canReview ? (
                <p className="text-xs text-muted">
                  Match confidence and the matcher&rsquo;s reasoning are shown to reviewers only.
                </p>
              ) : null}
            </CardBody>
          </Card>

          {/* Work and education */}
          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h2">Work and education</CardTitle>
              <CardDescription>Self-reported by the member. Not verified by the college.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-5 pt-4">
              <dl className="divide-y divide-line">
                <DetailRow label="Current employer">
                  {member.currentCompany ?? <span className="font-normal text-muted">Not on record</span>}
                </DetailRow>
                <DetailRow label="Designation">
                  {member.designation ?? <span className="font-normal text-muted">Not on record</span>}
                </DetailRow>
                <DetailRow label="Industry">
                  {member.industry ?? <span className="font-normal text-muted">Not on record</span>}
                </DetailRow>
                <DetailRow label="Location">
                  {location || <span className="font-normal text-muted">Not on record</span>}
                </DetailRow>
                <DetailRow label="Skills">
                  {member.skills.length ? (
                    <span className="flex flex-wrap gap-1.5">
                      {member.skills.map((s) => (
                        <Badge key={s} tone="neutral">
                          {s}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    <span className="font-normal text-muted">None listed</span>
                  )}
                </DetailRow>
              </dl>

              {member.employment.length ? (
                <div className="space-y-3">
                  <Separator label="Employment history" />
                  <ul className="space-y-3">
                    {member.employment.map((e) => (
                      <li key={e.id} className="flex gap-3">
                        <Building2 className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {memberLine([e.designation, e.company])}
                            {e.isCurrent ? (
                              <Badge tone="success" className="ml-2">
                                Current
                              </Badge>
                            ) : null}
                          </p>
                          <p className="text-xs text-secondary">
                            {memberLine([
                              e.location,
                              `${formatDate(e.startedOn)} – ${e.endedOn ? formatDate(e.endedOn) : 'present'}`,
                            ])}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {member.education.length ? (
                <div className="space-y-3">
                  <Separator label="Education" />
                  <ul className="space-y-3">
                    {member.education.map((e) => (
                      <li key={e.id} className="flex gap-3">
                        <GraduationCap className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{e.institution}</p>
                          <p className="text-xs text-secondary">
                            {memberLine([
                              e.qualification,
                              e.field,
                              `${formatDate(e.startedOn)} – ${e.endedOn ? formatDate(e.endedOn) : 'present'}`,
                            ])}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h2">Activity</CardTitle>
              <CardDescription>
                What this record shows of the person&rsquo;s engagement. Private message bodies are
                not included — no role can read them, deliberately.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-5 pt-4">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-secondary">Profile completeness</span>
                  <span className="font-display text-lg font-bold tabular">
                    {filled}/{completeness.length}
                  </span>
                </div>
                <Progress
                  value={filled}
                  max={completeness.length}
                  label="Profile completeness"
                  tone={filled >= 6 ? 'success' : filled >= 3 ? 'brand' : 'warning'}
                />
                <ul className="flex flex-wrap gap-1.5 pt-1">
                  {completeness.map((c) => (
                    <li key={c.label}>
                      <Badge tone={c.done ? 'success' : 'neutral'}>
                        {c.done ? '✓' : '—'} {c.label}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>

              <dl className="divide-y divide-line">
                <DetailRow label="Event registrations">
                  <span className="tabular">{registrations.length}</span>
                  {registrations.length ? (
                    <span className="ml-2 font-normal text-secondary">
                      · {attended} checked in on the day
                    </span>
                  ) : null}
                </DetailRow>
                <DetailRow label="Account created">
                  <span className="font-normal text-muted">
                    Not projected into the staff view — see the audit log for the registration entry
                  </span>
                </DetailRow>
              </dl>

              {registrations.length ? (
                <ul className="space-y-2 border-t border-line pt-4">
                  {registrations.slice(0, 5).map((r) => (
                    <li key={r.id} className="flex items-start gap-3 text-sm">
                      <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.eventTitle}</p>
                        <p className="text-xs text-secondary">
                          {memberLine([
                            `Registered ${formatDate(r.createdAt)}`,
                            r.guests ? `${r.guests} guest${r.guests === 1 ? '' : 's'}` : null,
                            r.checkedInAt ? 'Checked in' : 'No check-in recorded',
                          ])}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="border-t border-line pt-4 text-sm text-secondary">
                  No event registrations. Reunion invitations reach this person by email and WhatsApp;
                  nothing here means neither has landed.
                </p>
              )}
            </CardBody>
          </Card>
        </div>

        {/* ---------------------------------------------------------------
            Aside
           --------------------------------------------------------------- */}
        <aside className="space-y-6">
          {canWrite || canMerge || canVerify ? (
            <Card>
              <CardHeader className="flex-col items-start gap-1">
                <CardTitle as="h2">Staff actions</CardTitle>
                <CardDescription>
                  Every one of these writes an <span className="font-mono text-xs">audit_log</span>{' '}
                  row with your name, the reason you type and a before/after snapshot.
                </CardDescription>
              </CardHeader>
              <CardBody className="pt-4">
                <MemberActions
                  memberName={member.fullName}
                  rollNumber={member.rollNumber ?? null}
                  status={member.status}
                  statusOptions={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].label }))}
                  departments={departments.map((d) => ({ value: d.code, label: `${d.code} — ${d.name}` }))}
                  duplicates={duplicates.map((d) => ({
                    value: d.id,
                    label: memberLine([d.rollNumber, d.departmentCode, d.batchYear, d.fullName]),
                  }))}
                  profile={{
                    preferredName: member.preferredName ?? '',
                    departmentCode: member.departmentCode ?? '',
                    batchYear: member.batchYear ? String(member.batchYear) : '',
                    currentCompany: member.currentCompany ?? '',
                    city: member.city ?? '',
                  }}
                  canWrite={canWrite}
                  canMerge={canMerge}
                  canVerify={canVerify}
                />
              </CardBody>
            </Card>
          ) : null}

          {/* Roles */}
          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h2">Roles held</CardTitle>
              <CardDescription>
                Roles are a set, separate from status. One person can be alumni, faculty and HOD at
                once; the grants add up.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-3 pt-4">
              <ul className="space-y-2">
                {member.roles.map((r) => (
                  <li
                    key={`${r.role}-${r.departmentCode ?? 'all'}`}
                    className="flex items-center justify-between gap-3 rounded border border-line px-3 py-2"
                  >
                    <span className="text-sm font-medium">{ROLE_LABELS[r.role] ?? r.role}</span>
                    {r.departmentCode ? (
                      <Badge tone="brand">{r.departmentCode} only</Badge>
                    ) : (
                      <Badge tone="neutral">Tenant-wide</Badge>
                    )}
                  </li>
                ))}
              </ul>
              {can(session, 'role.manage') ? (
                <ButtonLink href="/admin/roles" variant="secondary" size="sm" className="w-full">
                  <ShieldCheck className="size-4" />
                  Manage roles
                </ButtonLink>
              ) : null}
            </CardBody>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle as="h2">Contact</CardTitle>
              <CardDescription>Held in a separate table from the profile, on purpose.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-4 pt-4">
              {canContact && member.contact ? (
                <>
                  <dl className="divide-y divide-line">
                    <DetailRow label="Email">
                      {member.contact.email ? (
                        <a href={`mailto:${member.contact.email}`} className="link break-all font-mono text-xs">
                          {member.contact.email}
                        </a>
                      ) : (
                        <span className="font-normal text-muted">Not supplied</span>
                      )}
                    </DetailRow>
                    <DetailRow label="Mobile">
                      {member.contact.mobile ? (
                        <span className="font-mono text-xs">{member.contact.mobile}</span>
                      ) : (
                        <span className="font-normal text-muted">Not supplied</span>
                      )}
                    </DetailRow>
                    <DetailRow label="LinkedIn">
                      {member.contact.linkedin ? (
                        <a
                          href={member.contact.linkedin}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="link text-xs"
                        >
                          View profile
                        </a>
                      ) : (
                        <span className="font-normal text-muted">Not supplied</span>
                      )}
                    </DetailRow>
                    <DetailRow label="Their visibility setting">
                      <span className="text-xs font-normal text-secondary">
                        {member.contact.visibility
                          ? VISIBILITY_COPY[member.contact.visibility]
                          : 'Not set'}
                      </span>
                    </DetailRow>
                  </dl>

                  <Alert tone="warning" icon={<Lock className="size-4" />}>
                    <p>
                      You see these because <span className="font-mono">directory.view.contact</span>{' '}
                      is on your account. Other members get them only under the member&rsquo;s own
                      setting above — role alone never releases contact data.
                    </p>
                  </Alert>
                </>
              ) : (
                <>
                  <dl className="divide-y divide-line">
                    <DetailRow label="Email">
                      <span className="font-mono text-xs text-secondary">
                        {maskEmail(member.contact?.email ?? null)}
                      </span>
                    </DetailRow>
                    <DetailRow label="Mobile">
                      <span className="font-mono text-xs text-secondary">
                        {maskMobile(member.contact?.mobile ?? null)}
                      </span>
                    </DetailRow>
                  </dl>
                  <Alert tone="neutral" icon={<Lock className="size-4" />}>
                    <p>
                      Reading raw contact details needs{' '}
                      <span className="font-mono">directory.view.contact</span>, which sits with the
                      college admin. You can see that details exist without seeing them.
                    </p>
                  </Alert>
                </>
              )}
            </CardBody>
          </Card>

          {/* Placement — placement-side only */}
          {canAcademic && member.isStudent ? (
            <Card>
              <CardHeader className="flex-col items-start gap-1">
                <CardTitle as="h2">Academic and placement</CardTitle>
                <CardDescription>Placement-side only. Never exposed to alumni.</CardDescription>
              </CardHeader>
              <CardBody className="space-y-3 pt-4">
                <dl className="divide-y divide-line">
                  <DetailRow label="CGPA">
                    <span className="tabular">{member.cgpa ?? '—'}</span>
                  </DetailRow>
                  <DetailRow label="Placement status">{member.placementStatus ?? '—'}</DetailRow>
                </dl>
                <p className="text-xs text-secondary">
                  Alumni post jobs on this portal. A searchable CGPA list would be a recruiting
                  shortcut nobody agreed to, so this block is behind{' '}
                  <span className="font-mono">directory.view.cgpa</span> and is never projected into
                  the directory.
                </p>
              </CardBody>
            </Card>
          ) : null}

          {/* Possible duplicates */}
          {duplicates.length ? (
            <Card>
              <CardHeader className="flex-col items-start gap-1">
                <CardTitle as="h2">Possible duplicates</CardTitle>
                <CardDescription>Same name, or the same roll number.</CardDescription>
              </CardHeader>
              <CardBody className="space-y-3 pt-4">
                <ul className="space-y-2">
                  {duplicates.map((d) => (
                    <li key={d.id} className="rounded border border-line px-3 py-2">
                      <Link href={`/admin/members/${d.id}`} className="text-sm font-medium link-quiet">
                        {d.fullName}
                      </Link>
                      <p className="font-mono text-xs text-secondary">
                        {memberLine([d.rollNumber, d.departmentCode, d.batchYear])}
                      </p>
                    </li>
                  ))}
                </ul>
                <Alert tone="warning" icon={<CircleAlert className="size-4" />}>
                  <p>
                    Two people in the same branch and year can genuinely share a name. Check the roll
                    numbers before merging — they are the only field that cannot collide.
                  </p>
                </Alert>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody className="flex gap-3">
                <Users className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                <p className="text-sm text-secondary">
                  No other record shares this name or roll number.
                </p>
              </CardBody>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
