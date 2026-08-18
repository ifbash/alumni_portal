import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  BadgeCheck,
  Briefcase,
  CalendarClock,
  GraduationCap,
  Handshake,
  Lock,
  MapPin,
  Mic,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { require as requireCap, can } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getConnections, getConnectionQuota, getMemberBySlug } from '@/lib/data/repo';
import type { ConnectionKind, MemberDetail } from '@/lib/data/types';
import { formatDate, formatRelative, memberLine, yearsOut } from '@/lib/format';
import {
  Alert,
  Avatar,
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  CardBody,
  CardTitle,
  DetailRow,
  PageHeader,
  Progress,
} from '@/components/ui';
import { ContactBlock } from '@/components/members/ContactBlock';
import { RequestIntroButton } from '@/components/directory/RequestIntroButton';
import { EducationTimeline, ExperienceTimeline } from '@/components/directory/ProfileTimeline';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const session = await getSession();
  if (!session) return { title: 'Profile' };

  const { slug } = await params;
  const member = getMemberBySlug(session, slug);
  if (!member) return { title: 'Profile not found' };

  return {
    title: member.fullName,
    description: memberLine([
      member.departmentCode,
      member.batchYear ? `Batch of ${member.batchYear}` : null,
      member.currentCompany,
    ]),
  };
}

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  if (!pack.features.directory) notFound();

  if (!can(session, 'directory.search.alumni') && !can(session, 'directory.search.students')) {
    requireCap(session, 'directory.search.alumni');
  }

  const { slug } = await params;
  // Applies the tier projection and both contact gates. There is no other
  // way to reach this data, and deliberately so.
  const member = getMemberBySlug(session, slug);
  if (!member) notFound();

  const viewerIsOwner = session.memberId === member.id;
  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };

  const accepted = getConnections(session, 'accepted');
  const hasAcceptedConnection = accepted.some(
    (c) => c.from.id === member.id || c.to.id === member.id,
  );

  const sent = getConnections(session, 'sent');
  const pendingToThem = sent.find((c) => c.to.id === member.id && c.state === 'pending') ?? null;
  const declinedByThem = sent.find((c) => c.to.id === member.id && c.state === 'declined') ?? null;

  const pendingFromThem =
    getConnections(session, 'received').find(
      (c) => c.from.id === member.id && c.state === 'pending',
    ) ?? null;

  const connectionsOn = pack.features.connections && can(session, 'connection.send');
  const mayAsk =
    connectionsOn && !viewerIsOwner && !hasAcceptedConnection && !pendingToThem;
  const quota = connectionsOn && !viewerIsOwner ? getConnectionQuota(session) : null;

  const openRequests = sent.filter((c) => c.state === 'pending');
  const nextExpiry =
    openRequests
      .map((c) => c.expiresAt)
      .filter((v): v is string => Boolean(v))
      .sort()[0] ?? null;

  const kinds = offeredKinds(member);
  const identity =
    memberLine([member.designation, member.currentCompany]) ||
    (member.isStudent ? 'Final-year student' : 'No work details shared');

  const location = memberLine([
    member.city,
    member.country && member.country !== 'IN' ? member.country : member.state,
  ]);

  const canAsk = Boolean(mayAsk && quota?.canSend);

  /**
   * Exactly one instance, in the header.
   *
   * `ContactBlock` offers an `action` slot for this button and it is the
   * natural place for it — but the kit's `Dialog` hardcodes
   * `id="dialog-title"`, so two of them on one page duplicate the id the
   * dialog is labelled by. Until that id is per-instance, the button lives
   * where it is visible without scrolling on a phone.
   */
  const introButton = canAsk ? (
    <RequestIntroButton
      toMemberId={member.id}
      toName={member.fullName}
      kinds={kinds}
      defaultKind={kinds[0]!}
      quota={quota!}
    />
  ) : null;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Directory', href: '/directory' },
          {
            label: member.departmentCode ?? 'Members',
            href: member.departmentCode ? `/directory?department=${member.departmentCode}` : '/directory',
          },
          { label: member.fullName },
        ]}
      />

      <Card>
        <CardBody className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar name={member.fullName} src={member.photoUrl} size="xl" />

          <div className="min-w-0 flex-1 space-y-4">
            <PageHeader
              eyebrow={memberLine([
                member.departmentCode,
                member.batchYear ? `Batch of ${member.batchYear}` : null,
              ])}
              title={member.fullName}
              description={
                <span className="block space-y-1">
                  <span className="block">{identity}</span>
                  {location ? (
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {location}
                    </span>
                  ) : null}
                </span>
              }
              actions={introButton}
            />

            <ul className="flex flex-wrap gap-1.5">
              {viewerIsOwner ? (
                <li>
                  <Badge tone="brand">This is you</Badge>
                </li>
              ) : null}
              {hasAcceptedConnection ? (
                <li>
                  <Badge tone="success" dot>
                    Connected
                  </Badge>
                </li>
              ) : null}
              {member.isStudent ? (
                <li>
                  <Badge tone="info">Final year</Badge>
                </li>
              ) : null}
              {member.verifiedAt ? (
                <li>
                  <Badge tone="neutral">
                    <BadgeCheck className="size-3.5" aria-hidden="true" />
                    Verified
                  </Badge>
                </li>
              ) : null}
              {member.openToMentoring ? (
                <li>
                  <Badge tone="success" dot>
                    Open to mentoring
                  </Badge>
                </li>
              ) : null}
              {member.openToReferrals ? (
                <li>
                  <Badge tone="brand" dot>
                    Open to referrals
                  </Badge>
                </li>
              ) : null}
              {member.openToSpeaking ? (
                <li>
                  <Badge tone="accent" dot>
                    Open to speaking
                  </Badge>
                </li>
              ) : null}
            </ul>

            {viewerIsOwner ? (
              <p className="text-xs text-muted">
                This is your public profile as another member sees it.{' '}
                <Link href="/profile" className="link">
                  Edit your profile
                </Link>
                .
              </p>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {member.bio ? (
            <Card>
              <CardBody className="space-y-3">
                <CardTitle as="h2">About</CardTitle>
                <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed text-secondary">
                  {member.bio}
                </p>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardBody className="space-y-4">
              <CardTitle as="h2" className="flex items-center gap-2">
                <Briefcase className="size-4 text-muted" aria-hidden="true" />
                Experience
              </CardTitle>
              <ExperienceTimeline
                entries={member.employment}
                ownerName={member.fullName}
                timing={timing}
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-4">
              <CardTitle as="h2" className="flex items-center gap-2">
                <GraduationCap className="size-4 text-muted" aria-hidden="true" />
                Education
              </CardTitle>
              <EducationTimeline
                entries={member.education}
                ownerName={member.fullName}
                timing={timing}
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <CardTitle as="h2">Skills</CardTitle>
              {member.skills.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {member.skills.map((skill) => (
                    <li key={skill}>
                      {/* Every skill is a search — the useful next question
                          after "who is this" is "who else does this". */}
                      <Link
                        href={`/directory?skill=${encodeURIComponent(skill)}`}
                        className="link-quiet"
                      >
                        <Badge tone="outline">{skill}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-secondary">
                  {member.fullName.split(' ')[0]} has not listed any skills. Most profiles from the
                  older batches have not been filled in since sign-up.
                </p>
              )}
            </CardBody>
          </Card>
        </div>

        <aside className="min-w-0 space-y-6">
          <ContactBlock
            contact={member.contact}
            ownerName={member.fullName}
            visibility={member.contact?.visibility ?? null}
            hasAcceptedConnection={hasAcceptedConnection}
            viewerIsOwner={viewerIsOwner}
            action={
              canAsk ? (
                <p className="text-xs text-muted">
                  Use <span className="font-medium text-primary">Request an introduction</span> at
                  the top of this profile. {member.fullName.split(' ')[0]} sees your name, branch
                  and batch with the message.
                </p>
              ) : null
            }
          />

          {pendingFromThem ? (
            <Alert tone="info" title={`${member.fullName.split(' ')[0]} has asked you something`}>
              <p>
                Sent {formatRelative(pendingFromThem.createdAt)}.{' '}
                <Link href="/connections" className="link">
                  Read it and reply
                </Link>
                .
              </p>
            </Alert>
          ) : null}

          {pendingToThem ? (
            <Alert
              tone="neutral"
              title="Your request is waiting for a reply"
              icon={<CalendarClock className="size-4" />}
            >
              <p>
                Sent {formatRelative(pendingToThem.createdAt)}
                {pendingToThem.expiresAt ? `, expires ${formatRelative(pendingToThem.expiresAt)}` : ''}.
                One request at a time to the same person — a reminder is a second request as far as
                they are concerned.
              </p>
            </Alert>
          ) : null}

          {declinedByThem && !pendingToThem && !hasAcceptedConnection ? (
            <Alert tone="neutral" title="An earlier request was declined">
              <p>
                {member.fullName.split(' ')[0]} declined on{' '}
                {formatDate(declinedByThem.respondedAt, timing)}. You can ask again, but a second
                identical message rarely lands differently.
              </p>
            </Alert>
          ) : null}

          {/* An exhausted quota is explained, never a dead button. */}
          {mayAsk && quota && !quota.canSend ? (
            <Card>
              <CardBody className="space-y-4">
                <CardTitle as="h2" className="flex items-center gap-2">
                  <Lock className="size-4 text-muted" aria-hidden="true" />
                  You cannot send a request right now
                </CardTitle>

                <p className="text-sm text-secondary">{quota.reason}</p>

                <dl className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                      <dt className="text-secondary">Open requests</dt>
                      <dd className="tabular font-medium">
                        {quota.openRequests} of {quota.openLimit}
                      </dd>
                    </div>
                    <Progress
                      value={quota.openRequests}
                      max={quota.openLimit}
                      tone={quota.openRequests >= quota.openLimit ? 'warning' : 'brand'}
                      label="Open requests used"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                      <dt className="text-secondary">Sent this month</dt>
                      <dd className="tabular font-medium">
                        {quota.usedThisMonth} of {quota.monthlyLimit}
                      </dd>
                    </div>
                    <Progress
                      value={quota.usedThisMonth}
                      max={quota.monthlyLimit}
                      tone={quota.usedThisMonth >= quota.monthlyLimit ? 'warning' : 'brand'}
                      label="Requests sent this month"
                    />
                  </div>
                </dl>

                <p className="text-xs text-muted">
                  {quota.openRequests >= quota.openLimit
                    ? nextExpiry
                      ? `The oldest of your open requests expires ${formatRelative(nextExpiry)}, and that frees a slot. Accepting or declining frees one sooner.`
                      : 'A slot frees up as soon as one of your open requests is answered or expires.'
                    : 'The monthly count resets at the start of next month.'}{' '}
                  <Link href="/connections" className="link">
                    Review your open requests
                  </Link>
                  .
                </p>

                <p className="text-xs text-muted">
                  The limit exists so that a few hundred final-years cannot flood eight thousand
                  alumni. It is what keeps people answering.
                </p>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardBody className="space-y-3">
              <CardTitle as="h2">Open to</CardTitle>
              {member.openToMentoring || member.openToReferrals || member.openToSpeaking ? (
                <ul className="space-y-2.5 text-sm">
                  {member.openToMentoring ? (
                    <AvailabilityRow
                      icon={<UserCheck className="size-4" />}
                      title="Mentoring"
                      body="Guidance on preparation, higher studies and which way to go next."
                    />
                  ) : null}
                  {member.openToReferrals ? (
                    <AvailabilityRow
                      icon={<Handshake className="size-4" />}
                      title="Referrals"
                      body={
                        member.currentCompany
                          ? `Referrals at ${member.currentCompany}. Have the specific opening in hand before asking.`
                          : 'Referrals where they can. Have the specific opening in hand before asking.'
                      }
                    />
                  ) : null}
                  {member.openToSpeaking ? (
                    <AvailabilityRow
                      icon={<Mic className="size-4" />}
                      title="Speaking"
                      body="Campus sessions and department events."
                    />
                  ) : null}
                </ul>
              ) : (
                <p className="text-sm text-secondary">
                  {member.fullName.split(' ')[0]} has not marked themselves available for mentoring,
                  referrals or talks. A request is still possible — many people simply never opened
                  the settings page.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <CardTitle as="h2">Record</CardTitle>
              <dl className="divide-y divide-line">
                <DetailRow label="Programme">
                  {memberLine([member.programme, member.departmentName]) || '—'}
                </DetailRow>
                {member.batchYear ? (
                  <DetailRow label="Batch">
                    {member.batchYear}
                    {yearsOut(member.batchYear) ? (
                      <span className="text-muted"> · {yearsOut(member.batchYear)}</span>
                    ) : null}
                  </DetailRow>
                ) : null}
                {member.admissionYear ? (
                  <DetailRow label="Admitted">{member.admissionYear}</DetailRow>
                ) : null}
                <DetailRow label="Verification">
                  {member.verifiedAt ? (
                    <span className="flex flex-wrap items-baseline gap-x-1.5">
                      <span>{formatDate(member.verifiedAt, timing)}</span>
                      <span className="text-xs text-muted">
                        {VERIFICATION_METHODS[member.verificationMethod ?? ''] ?? 'Method not recorded'}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted">Not verified against the degree register</span>
                  )}
                </DetailRow>
                {/* Only present when the DTO carried it — the projection
                    decides, not this page. */}
                {member.rollNumber ? (
                  <DetailRow label="Roll number">
                    <span className="font-mono">{member.rollNumber}</span>
                  </DetailRow>
                ) : null}
              </dl>
            </CardBody>
          </Card>

          {member.cgpa != null || member.placementStatus ? (
            <Card>
              <CardBody className="space-y-3">
                <CardTitle as="h2" className="flex items-center gap-2">
                  <ShieldAlert className="size-4 text-warning-fg" aria-hidden="true" />
                  Placement record
                </CardTitle>

                <dl className="divide-y divide-line">
                  {member.cgpa != null ? (
                    <DetailRow label="CGPA">
                      <span className="font-mono tabular">{member.cgpa.toFixed(2)}</span>
                    </DetailRow>
                  ) : null}
                  {member.placementStatus ? (
                    <DetailRow label="Placement">{member.placementStatus}</DetailRow>
                  ) : null}
                </dl>

                <p className="text-xs text-muted">
                  {viewerIsOwner
                    ? 'Your own academic record. Alumni never see this on anyone.'
                    : 'Academic data is placement-side only. It is not shown to alumni, who post jobs here, and this view is attributable to your account.'}
                </p>
              </CardBody>
            </Card>
          ) : null}

          <ButtonLink href="/directory" variant="secondary" size="sm" className="w-full">
            Back to the directory
          </ButtonLink>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------

function AvailabilityRow({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 shrink-0 text-brand-fg" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="block text-xs text-secondary">{body}</span>
      </span>
    </li>
  );
}

/** What this person has actually said yes to, plus the generic ask. */
function offeredKinds(member: MemberDetail): ConnectionKind[] {
  const kinds: ConnectionKind[] = [];
  if (member.openToMentoring) kinds.push('mentorship');
  if (member.openToReferrals) kinds.push('referral');
  if (member.openToSpeaking) kinds.push('speaking');
  kinds.push('introduction');
  return kinds;
}

const VERIFICATION_METHODS: Record<string, string> = {
  auto_roll_match: 'Matched against the degree register',
  admin_manual: 'Checked by the alumni cell',
  bulk_import: 'Loaded from college records',
  placement_cell_import: 'Loaded by the placement cell',
};
