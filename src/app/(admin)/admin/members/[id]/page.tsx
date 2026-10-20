import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { BadgeCheck, Building2, CalendarDays, GraduationCap, ShieldCheck, Users } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { canOpen, ROLE_LABELS } from '@/lib/navigation';
import {
  getDepartments,
  getEventRegistrations,
  getAuditLog,
  getEvents,
  getMemberForAdminView,
  getMembersForAdminView,
  getVerificationClaims,
  searchDegreeRegister,
} from '@/lib/data/repo';
import {
  Avatar,
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DetailRow,
  Disclosure,
  Progress,
  Separator,
} from '@/components/ui';
import { firstNameOf } from '@/lib/identity';
import { formatDate, maskEmail, maskMobile, memberLine } from '@/lib/format';
import type { ContactVisibility } from '@/lib/data/types';
import { STATUS_META, STATUS_ORDER } from '../status';
import { evidenceWords, methodLabel, reasonLabel, reasonTone, sourceFileLabel } from '../../_shared/verification-labels';
import { AuditTimeline } from './AuditTimeline';
import { MemberActions } from './MemberActions';

export const metadata = { title: 'Member record · Staff console' };

/** The owner's own setting, said the way `releaseContact()` applies it. */
const VISIBILITY_COPY: Record<ContactVisibility, string> = {
  private: 'Nobody',
  on_accept: 'People whose request they accept',
  alumni_only: 'Alumni and faculty',
  all_members: 'Alumni and faculty, email only',
};

/**
 * One member record, staff view.
 *
 * The person first: who they are and what they do now. The verification
 * behind the record is one line with its evidence a click away. Contact
 * and academic data are each behind their own capability, rendered here
 * on the server — being able to open a record is not the same as being
 * entitled to everything inside it.
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

  // Out of the viewer's department reads exactly like a record that does not
  // exist: a 404 either way, so the URL answers nothing about other branches.
  const member = getMemberForAdminView(session, id);
  if (!member) notFound();

  const departments = getDepartments();
  const status = STATUS_META[member.status];

  const canContact = can(session, 'directory.view.contact');
  const canAcademic = can(session, 'directory.view.cgpa');
  const canWrite = can(session, 'profile.write.any');
  const canMerge = can(session, 'profile.merge');
  const canReview = can(session, 'verification.review.any') || can(session, 'verification.review.department');
  const canVerify = can(session, 'verification.override') || can(session, 'verification.review.any');

  const resolved = await getTenantBrand();
  if (!resolved) redirect('/login');
  const pack = resolved.brand.pack;
  const fmt = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };
  const openRegister = canOpen(session, pack, '/admin/degree-register');

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
  // Searched through the same scoped read as the record itself, so the
  // duplicates panel cannot name a member the viewer could not open.
  const candidates = new Map(
    [member.fullName, member.rollNumber]
      .filter((q): q is string => Boolean(q))
      .flatMap((q) => getMembersForAdminView(session, { q, perPage: 100 }).items)
      .map((m) => [m.id, m] as const),
  );
  const duplicates = [...candidates.values()].filter(
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
  const missing = completeness.filter((c) => !c.done).map((c) => c.label);

  const availability = [
    member.openToMentoring ? 'Mentors students' : null,
    member.openToReferrals ? 'Gives referrals' : null,
    member.openToSpeaking ? 'Speaks at events' : null,
  ].filter(Boolean) as string[];

  const location = memberLine([member.city, member.state, member.country !== 'IN' ? member.country : null]);
  const first = firstNameOf(member.fullName, member.preferredName);
  const work =
    member.designation && member.currentCompany
      ? `${member.designation} at ${member.currentCompany}`
      : (member.designation ?? member.currentCompany);
  const identity = memberLine([
    member.departmentCode,
    member.batchYear ? (member.isStudent ? `Final year, ${member.batchYear}` : `Batch of ${member.batchYear}`) : null,
    work,
    member.city,
  ]);

  const method = methodLabel(member.verificationMethod);

  // The record's own history, for those who may read the log at all.
  const canAudit = can(session, 'audit.read');
  const history = canAudit
    ? getAuditLog({ limit: 10000 })
        .filter((e) => e.resourceId === member.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 8)
    : [];

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Staff console', href: '/admin' },
          { label: 'Members', href: '/admin/members' },
          { label: member.fullName },
        ]}
      />

      {/* ---------------------------------------------------------------
          Header
         --------------------------------------------------------------- */}
      <Card>
        <CardBody className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar name={member.fullName} src={member.photoUrl} size="xl" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1">
              <h1 className="font-display text-display-xs font-bold">{member.fullName}</h1>
              {member.preferredName ? <p className="text-sm text-secondary">Goes by {member.preferredName}</p> : null}
              {identity ? <p className="text-md text-secondary">{identity}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={status.tone} dot>
                {status.label}
              </Badge>
              {member.verifiedAt ? (
                <Badge tone="success">
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
            {member.roles.length ? (
              <ul className="flex flex-wrap items-center gap-1.5" aria-label="Roles held">
                {member.roles.map((r) => (
                  <li key={`${r.role}-${r.departmentCode ?? 'all'}`}>
                    <Badge tone="brand">
                      <ShieldCheck className="size-3.5" aria-hidden="true" />
                      {ROLE_LABELS[r.role] ?? r.role}
                      {r.departmentCode ? ` · ${r.departmentCode} only` : ''}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap items-start gap-2 pt-1">
              {canWrite || canMerge || canVerify ? (
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
              ) : null}
              <ButtonLink href={`/directory/${member.slug}`} variant="secondary">
                View as a member sees it
              </ButtonLink>
              {can(session, 'role.manage') ? (
                <ButtonLink href="/admin/roles" variant="ghost">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  Manage roles
                </ButtonLink>
              ) : null}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        {/* ---------------------------------------------------------------
            Main column
           --------------------------------------------------------------- */}
        <div className="min-w-0 space-y-6">
          {/* Work and education */}
          <Card>
            <CardHeader variant="stack">
              <CardTitle as="h2" className="text-md">
                Work and education
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-5 pt-3">
              {member.bio ? <p className="max-w-prose text-sm text-secondary">{member.bio}</p> : null}
              <dl className="divide-y divide-line">
                <DetailRow label="Current employer">
                  {member.currentCompany ?? <span className="font-normal text-secondary">Not on record</span>}
                </DetailRow>
                <DetailRow label="Designation">
                  {member.designation ?? <span className="font-normal text-secondary">Not on record</span>}
                </DetailRow>
                <DetailRow label="Industry">
                  {member.industry ?? <span className="font-normal text-secondary">Not on record</span>}
                </DetailRow>
                <DetailRow label="Location">
                  {location || <span className="font-normal text-secondary">Not on record</span>}
                </DetailRow>
                {member.skills.length ? (
                  <DetailRow label="Skills">
                    <span className="flex flex-wrap gap-1.5">
                      {member.skills.map((s) => (
                        <Badge key={s} tone="neutral">
                          {s}
                        </Badge>
                      ))}
                    </span>
                  </DetailRow>
                ) : null}
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
                              `${formatDate(e.startedOn, fmt)} – ${e.endedOn ? formatDate(e.endedOn, fmt) : 'present'}`,
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
                              `${formatDate(e.startedOn, fmt)} – ${e.endedOn ? formatDate(e.endedOn, fmt) : 'present'}`,
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

          {/* Verification */}
          <Card>
            <CardHeader variant="stack">
              <CardTitle as="h2" className="text-md">
                Verification
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3 pt-3">
              <p className="flex items-start gap-2 text-sm">
                <BadgeCheck
                  className={member.verifiedAt ? 'mt-0.5 size-4 shrink-0 text-success-fg' : 'mt-0.5 size-4 shrink-0 text-muted'}
                  aria-hidden="true"
                />
                <span>
                  {member.verifiedAt ? (
                    <>
                      {method ?? 'Verified'} on {formatDate(member.verifiedAt, fmt)}
                      {registerRow ? (
                        <>
                          {' '}
                          against row <span className="font-mono">{registerRow.rollNumber}</span>
                        </>
                      ) : (
                        ', with no register row loaded for this roll number yet'
                      )}
                      .
                    </>
                  ) : (
                    'Not verified yet.'
                  )}
                </span>
              </p>

              {registerRow && (topCandidate || registerRow.name !== member.fullName) ? (
                <Disclosure summary="The evidence">
                  <dl className="divide-y divide-line">
                    <DetailRow label="In the register as">{registerRow.name}</DetailRow>
                    <DetailRow label="Loaded from">
                      {sourceFileLabel(registerRow.sourceFile).replace(/^the /, 'The ')}
                    </DetailRow>
                    {canReview ? (
                      <DetailRow label="Match score">
                        {topCandidate ? (
                          <span className="tabular">
                            {evidenceWords(topCandidate.confidence)} · {Math.round(topCandidate.confidence * 100)}%
                          </span>
                        ) : (
                          'No score'
                        )}
                      </DetailRow>
                    ) : null}
                  </dl>
                  {canReview && topCandidate?.reasons.length ? (
                    <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="What the matcher found">
                      {topCandidate.reasons.map((r) => (
                        <li key={r}>
                          <Badge tone={reasonTone(r)}>{reasonLabel(r)}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </Disclosure>
              ) : null}

              {registerRow && openRegister ? (
                <ButtonLink href={`/admin/degree-register/${registerRow.id}`} variant="ghost" size="sm" className="min-h-11 sm:min-h-0">
                  Open the register row
                </ButtonLink>
              ) : null}
            </CardBody>
          </Card>

          {/* Identity details */}
          <Card>
            <CardHeader variant="stack">
              <CardTitle as="h2" className="text-md">
                Identity details
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-3">
              <dl className="divide-y divide-line">
                <DetailRow label="Full name">{member.fullName}</DetailRow>
                <DetailRow label="Preferred name">
                  {member.preferredName ?? <span className="font-normal text-secondary">Not set</span>}
                </DetailRow>
                <DetailRow label="Roll number">
                  {member.rollNumber ? (
                    <span className="font-mono">{member.rollNumber}</span>
                  ) : (
                    <span className="font-normal text-secondary">Not on record</span>
                  )}
                </DetailRow>
                <DetailRow label="Programme">
                  {memberLine([member.programme, member.departmentName]) || '—'}
                </DetailRow>
                <DetailRow label="Admission year">{member.admissionYear ?? '—'}</DetailRow>
                <DetailRow label="Year of passing">{member.batchYear ?? '—'}</DetailRow>
              </dl>
            </CardBody>
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader variant="stack">
              <CardTitle as="h2" className="text-md">
                Activity
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-5 pt-3">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-secondary">Profile filled in</span>
                  <span className="text-sm font-semibold tabular">
                    {filled} of {completeness.length}
                  </span>
                </div>
                <Progress
                  value={filled}
                  max={completeness.length}
                  label="Profile filled in"
                  tone={filled >= 6 ? 'success' : filled >= 3 ? 'brand' : 'warning'}
                />
                {missing.length ? (
                  <p className="text-xs text-secondary">Missing: {missing.map((m) => (m === 'LinkedIn' ? m : m.toLowerCase())).join(', ')}.</p>
                ) : null}
              </div>

              {registrations.length ? (
                <div className="space-y-2">
                  <p className="text-sm text-secondary">
                    {registrations.length} event {registrations.length === 1 ? 'registration' : 'registrations'} ·{' '}
                    {attended} checked in on the day
                  </p>
                  <ul className="space-y-2">
                    {registrations.slice(0, 5).map((r) => (
                      <li key={r.id} className="flex items-start gap-3 text-sm">
                        <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{r.eventTitle}</p>
                          <p className="text-xs text-secondary">
                            {memberLine([
                              `Registered ${formatDate(r.createdAt, fmt)}`,
                              r.guests ? `${r.guests} guest${r.guests === 1 ? '' : 's'}` : null,
                              r.checkedInAt ? 'Checked in' : null,
                            ])}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-secondary">No event registrations yet.</p>
              )}
            </CardBody>
          </Card>

          {canAudit ? (
            <Card>
              <CardHeader variant="stack">
                <CardTitle as="h2" className="text-md">
                  History
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-3 pt-3">
                <AuditTimeline entries={history} fmt={fmt} />
                <Link href="/admin/audit" className="link inline-flex min-h-11 items-center text-sm sm:min-h-0">
                  Open the audit log
                </Link>
              </CardBody>
            </Card>
          ) : null}
        </div>

        {/* ---------------------------------------------------------------
            Aside
           --------------------------------------------------------------- */}
        <aside aria-label="Roles and contact" className="min-w-0 space-y-6">
          {/* Contact */}
          <Card>
            <CardHeader variant="stack">
              <CardTitle as="h2" className="text-md">
                Contact
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4 pt-3">
              {canContact && member.contact ? (
                <>
                  <dl className="divide-y divide-line">
                    <DetailRow className="grid-cols-[6rem_minmax(0,1fr)]" label="Email">
                      {member.contact.email ? (
                        <a href={`mailto:${member.contact.email}`} className="link break-words font-mono text-xs">
                          {member.contact.email}
                        </a>
                      ) : (
                        <span className="font-normal text-secondary">Not supplied</span>
                      )}
                    </DetailRow>
                    <DetailRow className="grid-cols-[6rem_minmax(0,1fr)]" label="Mobile">
                      {member.contact.mobile ? (
                        <span className="break-words font-mono text-xs">{member.contact.mobile}</span>
                      ) : (
                        <span className="font-normal text-secondary">Not supplied</span>
                      )}
                    </DetailRow>
                    <DetailRow className="grid-cols-[6rem_minmax(0,1fr)]" label="LinkedIn">
                      {member.contact.linkedin ? (
                        <a
                          href={member.contact.linkedin}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="link break-words text-xs"
                        >
                          View profile
                        </a>
                      ) : (
                        <span className="font-normal text-secondary">Not supplied</span>
                      )}
                    </DetailRow>
                    <DetailRow className="grid-cols-[6rem_minmax(0,1fr)]" label="Shared with">
                      <span className="break-words text-xs font-normal text-secondary">
                        {member.contact.visibility
                          ? VISIBILITY_COPY[member.contact.visibility]
                          : 'Not set'}
                      </span>
                    </DetailRow>
                  </dl>

                  <p className="text-xs text-secondary">
                    Shown to you as college admin. Other members see it only if {first} allows.
                  </p>
                </>
              ) : (
                <>
                  <dl className="divide-y divide-line">
                    <DetailRow className="grid-cols-[6rem_minmax(0,1fr)]" label="Email">
                      <span className="break-words font-mono text-xs text-secondary">
                        {maskEmail(member.contact?.email ?? null)}
                      </span>
                    </DetailRow>
                    <DetailRow className="grid-cols-[6rem_minmax(0,1fr)]" label="Mobile">
                      <span className="break-words font-mono text-xs text-secondary">
                        {maskMobile(member.contact?.mobile ?? null)}
                      </span>
                    </DetailRow>
                  </dl>
                  <p className="text-xs text-secondary">
                    Contact details are on file. Only the college admin can see them.
                  </p>
                </>
              )}
            </CardBody>
          </Card>

          {/* Placement — placement-side only */}
          {canAcademic && member.isStudent ? (
            <Card>
              <CardHeader variant="stack">
                <CardTitle as="h2" className="text-md">
                  Academic and placement
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-3 pt-3">
                <dl className="divide-y divide-line">
                  <DetailRow label="CGPA">
                    <span className="tabular">{member.cgpa ?? '—'}</span>
                  </DetailRow>
                  <DetailRow label="Placement status">{member.placementStatus ?? '—'}</DetailRow>
                </dl>
                <p className="text-xs text-secondary">Placement staff only. Never shown to alumni.</p>
              </CardBody>
            </Card>
          ) : null}

          {/* Possible duplicates */}
          {duplicates.length ? (
            <Card>
              <CardHeader variant="stack">
                <CardTitle as="h2" className="text-md">
                  Possible duplicates
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-3 pt-3">
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
                <p className="text-xs text-secondary">
                  Two people in one branch and year can share a name. Check the roll numbers before merging.
                </p>
              </CardBody>
            </Card>
          ) : (
            <p className="flex items-start gap-2 px-1 text-sm text-secondary">
              <Users className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
              No other record shares this name or roll number.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
