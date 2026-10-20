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
  Sparkles,
  UserCheck,
  UserRound,
} from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { require as requireCap, can, type Session } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getConnections, getConnectionQuota, getMemberBySlug, searchDirectory } from '@/lib/data/repo';
import type { ConnectionKind, MemberDetail } from '@/lib/data/types';
import { displayNow, formatDate, formatRelative, memberLine, yearsOut } from '@/lib/format';
import { firstNameOf, viewerBranch } from '@/lib/identity';
import { availabilityCopy } from '@/lib/availability-copy';
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
  Disclosure,
  Progress,
} from '@/components/ui';
import { ContactBlock } from '@/components/members/ContactBlock';
import { MemberRow } from '@/components/members/MemberCard';
import { RequestIntroButton } from '@/components/directory/RequestIntroButton';
import { EducationTimeline, ExperienceTimeline } from '@/components/directory/ProfileTimeline';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const session = await getSession();
  if (!session) return { title: 'Profile' };

  // The same gate as the page body. Metadata renders before the body's
  // `requireCap`, so without it the <title> named the member to roles the
  // page itself refuses — finance, which holds no directory capability.
  if (!can(session, 'directory.search.alumni') && !can(session, 'directory.search.students')) {
    return { title: 'Profile' };
  }

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
  // Narrowed for final-year students: they hold no `connection.receive`,
  // so a request to one would land nowhere.
  const mayAsk =
    connectionsOn && !viewerIsOwner && !hasAcceptedConnection && !pendingToThem && !member.isStudent;
  const quota = connectionsOn && !viewerIsOwner ? getConnectionQuota(session) : null;

  const openRequests = sent.filter((c) => c.state === 'pending');
  const nextExpiry =
    openRequests
      .map((c) => c.expiresAt)
      .filter((v): v is string => Boolean(v))
      .sort()[0] ?? null;

  const { shortName } = pack.copy;
  const first = firstNameOf(member.fullName, member.preferredName);
  const kinds = offeredKinds(member);
  const identity = memberLine([member.designation, member.currentCompany]);
  const location = memberLine([
    member.city,
    member.country && member.country !== 'IN' ? member.country : member.state,
  ]);

  const canAsk = Boolean(mayAsk && quota?.canSend);
  const viewerIsStudent = session.roles.some((r) => r.role === 'student');
  const edit = (anchor: string) => (viewerIsOwner ? `/profile/edit#${anchor}` : undefined);

  // A batch is an alumni fact. A staff record seeded from an alumni row
  // keeps a batch year, and "Batch of 2019" under a Head of Department is
  // a statement about somebody else.
  const showBatch = Boolean(member.batchYear) && member.roles.some((r) => r.role === 'alumni') && !member.isStudent;

  // Which gate opened, in the order `releaseContact()` checks them.
  const releasedBecause: 'connection' | 'visibility' | 'role' | 'owner' | undefined = !member.contact
    ? undefined
    : viewerIsOwner
      ? 'owner'
      : can(session, 'directory.view.contact')
        ? 'role'
        : hasAcceptedConnection && member.contactVisibility === 'on_accept'
          ? 'connection'
          : 'visibility';

  const placeholder = introPlaceholder(session, shortName);
  const intro = (props: { label?: string; variant?: 'primary' | 'secondary'; size?: 'sm' | 'md'; className?: string }) =>
    canAsk ? (
      <RequestIntroButton
        toMemberId={member.id}
        toName={member.fullName}
        kinds={kinds}
        defaultKind={kinds[0]!}
        quota={quota!}
        placeholder={placeholder}
        {...props}
      />
    ) : null;

  const bio = member.bio?.trim() ?? '';
  // A short bio reads in full in the header; a long one gets an excerpt
  // there and its own section below, never the same words twice.
  const longBio = bio.length > 180;

  const batchmates =
    showBatch && member.batchYear
      ? searchDirectory(session, { batchFrom: member.batchYear, batchTo: member.batchYear, perPage: 5 })
          .items.filter((m) => m.id !== member.id)
          .slice(0, 4)
      : [];

  // ---- The header's one action, chosen by where things stand ------------

  let headerAction: React.ReactNode = null;
  if (viewerIsOwner) {
    headerAction = (
      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/profile/edit" variant="secondary" className="min-h-11 sm:min-h-0">
          Edit your profile
        </ButtonLink>
        <ButtonLink href="/profile/preview" variant="ghost" className="min-h-11 sm:min-h-0">
          What others see
        </ButtonLink>
      </div>
    );
  } else if (pendingFromThem) {
    headerAction = (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ButtonLink href="/connections" className="min-h-11 sm:min-h-0">
          Reply to {first}
        </ButtonLink>
        <p className="text-sm text-secondary">
          {first} asked you {formatRelative(pendingFromThem.createdAt)}.
        </p>
      </div>
    );
  } else if (canAsk) {
    headerAction = intro({ className: 'min-h-11 sm:min-h-0' });
  } else if (pendingToThem) {
    headerAction = (
      <p className="flex items-center gap-2 text-sm text-secondary">
        <CalendarClock className="size-4 shrink-0 text-muted" aria-hidden="true" />
        <span>
          Your request is waiting for a reply.{' '}
          <Link href="/connections?tab=sent" className="link">
            See your requests
          </Link>
        </span>
      </p>
    );
  } else if (mayAsk && quota && !quota.canSend) {
    headerAction = (
      <p className="flex items-center gap-2 text-sm text-secondary">
        <Lock className="size-4 shrink-0 text-muted" aria-hidden="true" />
        <span>
          You cannot send a request right now.{' '}
          <a href="#quota" className="link">
            See why
          </a>
        </span>
      </p>
    );
  } else if (connectionsOn && member.isStudent && !viewerIsOwner && member.contact) {
    // When contact is withheld the rail's contact card says this instead.
    headerAction = (
      <p className="text-sm text-secondary">
        Final-year students cannot receive requests. Reach them through the placement cell.
      </p>
    );
  }

  // ---- Chips under the name -------------------------------------------------

  const availCtx = { audience: 'alumni' as const, company: member.currentCompany, officeName: pack.copy.officeName, openLimit: 0 };
  const openTo = [
    member.openToMentoring
      ? { key: 'mentoring', tone: 'success' as const, icon: <UserCheck className="size-4" />, chip: availabilityCopy('mentoring', availCtx)!.chip, body: 'Advice for final-year students on preparation, higher studies and what to do next.' }
      : null,
    member.openToReferrals
      ? { key: 'referrals', tone: 'brand' as const, icon: <Handshake className="size-4" />, chip: availabilityCopy('referrals', availCtx)!.chip, body: 'Have the specific opening in hand before you ask.' }
      : null,
    member.openToSpeaking
      ? { key: 'speaking', tone: 'accent' as const, icon: <Mic className="size-4" />, chip: availabilityCopy('speaking', availCtx)!.chip, body: 'Open to invitations to speak to students, on campus or online.' }
      : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);

  // ---- How to reach, rendered twice: above the main column on phones, in
  //      the rail from lg ----------------------------------------------------

  const contactAction = canAsk
    ? intro({ label: 'Send a request', variant: 'secondary', size: 'sm', className: 'min-h-11 sm:min-h-0' })
    : null;

  // Every withheld reason `ContactBlock` knows ends in a request, and a
  // final-year student cannot receive one. Their withheld state says where
  // to go instead.
  const studentWithheld = member.isStudent && !member.contact && !viewerIsOwner;

  const reach = (
    <>
      <section aria-label={viewerIsOwner ? 'Your contact details' : `How to reach ${first}`} className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-secondary">
          {viewerIsOwner ? 'Your contact details' : `How to reach ${first}`}
        </p>
        {studentWithheld ? (
          <Card>
            <CardBody className="space-y-4">
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-sunken text-secondary ring-1 ring-inset ring-line"
                >
                  <Lock className="size-4" />
                </span>
                <CardTitle as="h2">Contact</CardTitle>
              </div>
              <div className="rounded-lg bg-surface-sunken p-3.5 text-sm">
                <p className="font-medium text-primary">Email and mobile are private</p>
                <p className="mt-1 text-secondary">
                  Final-year students cannot receive requests. Reach them through the placement cell.
                </p>
              </div>
            </CardBody>
          </Card>
        ) : (
          <ContactBlock
            contact={member.contact}
            ownerName={member.fullName}
            ownerFirstName={first}
            visibility={member.contactVisibility}
            hasAcceptedConnection={hasAcceptedConnection}
            viewerIsOwner={viewerIsOwner}
            releasedBecause={releasedBecause}
            viewerIsStudent={viewerIsStudent}
            shortName={shortName}
            action={contactAction}
          />
        )}

        {pendingToThem ? (
          <Alert tone="neutral" icon={<CalendarClock className="size-4" />}>
            <p>
              You asked {formatRelative(pendingToThem.createdAt)}
              {pendingToThem.expiresAt ? `. It closes ${formatRelative(pendingToThem.expiresAt)} if unanswered.` : '.'}
            </p>
          </Alert>
        ) : null}

        {declinedByThem && !pendingToThem && !hasAcceptedConnection ? (
          <Alert tone="neutral">
            <p>
              Your earlier request was closed on {formatDate(declinedByThem.respondedAt, timing)}. You can ask
              again.
            </p>
          </Alert>
        ) : null}
      </section>

      <Card>
        <CardBody className="space-y-3">
          <CardTitle as="h2">Open to</CardTitle>
          {openTo.length ? (
            <ul className="space-y-3 text-sm">
              {openTo.map((o) => (
                <li key={o.key} className="flex gap-2.5">
                  <span className="mt-0.5 shrink-0 text-brand-fg" aria-hidden="true">
                    {o.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{o.chip}</span>
                    <span className="block text-secondary">{o.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyLine
              text={
                viewerIsOwner
                  ? 'You are not marked as open to anything.'
                  : `Not marked as open to anything.${mayAsk ? ' You can still send a request.' : ''}`
              }
              add={edit('availability')}
              addLabel="Choose what you are open to"
            />
          )}
        </CardBody>
      </Card>
    </>
  );

  const resetsOn = firstOfNextMonth(pack.locale.locale, pack.locale.timeZone);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Directory', href: '/directory' },
          ...(member.departmentCode
            ? [{ label: member.departmentCode, href: `/directory/branch/${encodeURIComponent(member.departmentCode)}` }]
            : []),
          { label: member.fullName },
        ]}
      />

      <Card className="overflow-hidden">
        {/* The cover: the college's two hues, washed, with paper grain. Pure token mixes, no photograph, so it is
            the same on every college and never claims a picture of the person. */}
        <div
          aria-hidden="true"
          className="grain h-24 bg-[linear-gradient(115deg,color-mix(in_srgb,var(--brand-500)_30%,var(--surface-raised)),color-mix(in_srgb,var(--accent-500)_26%,var(--surface-raised)))] sm:h-36"
        />
        <CardBody className="relative -mt-14 flex flex-col gap-5 px-5 pt-0 sm:-mt-[4.5rem] sm:px-8 sm:pb-8">
          <div className="flex items-end gap-3">
            <span className="inline-grid shrink-0 place-items-center rounded-full bg-surface-raised p-1.5 shadow-md">
              <Avatar
                name={member.fullName}
                src={member.photoUrl}
                size="xl"
                className="size-24 text-3xl sm:size-32 sm:text-4xl"
              />
            </span>
            {viewerIsOwner && !member.photoUrl ? (
              <Link href="/profile/edit#photo" className="link mb-2 inline-flex min-h-11 items-center text-xs font-medium sm:min-h-0">
                Add a photo
              </Link>
            ) : null}
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-secondary">
                {member.departmentCode ? (
                  <Link
                    href={`/directory/branch/${encodeURIComponent(member.departmentCode)}`}
                    className="font-semibold text-brand-fg hover:underline"
                    title={member.departmentName ?? undefined}
                  >
                    {member.departmentCode}
                  </Link>
                ) : null}
                {member.departmentCode && (showBatch || member.isStudent) ? (
                  <span className="text-muted" aria-hidden="true">
                    {' · '}
                  </span>
                ) : null}
                {showBatch ? (
                  <Link href={`/directory/batch/${member.batchYear}`} className="font-semibold text-brand-fg hover:underline">
                    Batch of {member.batchYear}
                  </Link>
                ) : member.isStudent ? (
                  <span>Final year</span>
                ) : null}
              </p>
              <h1 className="font-display text-display-sm font-bold">{member.fullName}</h1>
              {identity ? (
                <p className="text-lg text-primary">{identity}</p>
              ) : viewerIsOwner ? (
                <Link href="/profile/edit#company" className="link inline-flex min-h-11 items-center text-sm sm:min-h-0">
                  Add where you work
                </Link>
              ) : null}
              {location ? (
                <p className="flex items-center gap-1.5 text-sm text-secondary">
                  <MapPin className="size-4 shrink-0 text-muted" aria-hidden="true" />
                  {location}
                </p>
              ) : viewerIsOwner ? (
                <Link href="/profile/edit#city" className="link inline-flex min-h-11 items-center text-sm sm:min-h-0">
                  Add your city
                </Link>
              ) : null}
            </div>

            {viewerIsOwner || hasAcceptedConnection || member.verifiedAt || openTo.length ? (
              <ul className="flex flex-wrap gap-1.5" aria-label="About this profile">
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
                {openTo.map((o) => (
                  <li key={o.key}>
                    <Badge tone={o.tone} dot>
                      {o.chip}
                    </Badge>
                  </li>
                ))}
                {member.verifiedAt ? (
                  <li>
                    <Badge tone="neutral">
                      <BadgeCheck className="size-3.5" aria-hidden="true" />
                      Verified
                    </Badge>
                  </li>
                ) : null}
              </ul>
            ) : null}

            {bio ? (
              <p className={`max-w-prose text-sm leading-relaxed text-secondary ${longBio ? 'line-clamp-2' : ''}`}>
                {bio}
              </p>
            ) : null}
            {longBio ? (
              <a href="#about" className="link -mt-2 inline-flex min-h-11 items-center text-sm sm:min-h-0">
                Read more
              </a>
            ) : null}

            {headerAction}
          </div>
        </CardBody>
      </Card>

      <div className="space-y-6 lg:hidden">{reach}</div>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {longBio || (viewerIsOwner && !bio) ? (
            <Card id="about" className="scroll-mt-20">
              <CardBody className="space-y-3">
                <CardTitle as="h2" className="flex items-center gap-2.5">
                  <SectionIcon>
                    <UserRound className="size-4" />
                  </SectionIcon>
                  About
                </CardTitle>
                {bio ? (
                  <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed text-secondary">{bio}</p>
                ) : (
                  <EmptyLine text="You have not written a bio." add={edit('bio')} addLabel="Write a bio" />
                )}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardBody className="space-y-4">
              <CardTitle as="h2" className="flex items-center gap-2.5">
                <SectionIcon>
                  <Briefcase className="size-4" />
                </SectionIcon>
                Experience
              </CardTitle>
              <ExperienceTimeline
                entries={member.employment}
                ownerName={first}
                timing={timing}
                addHref={edit('employment')}
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-4">
              <CardTitle as="h2" className="flex items-center gap-2.5">
                <SectionIcon>
                  <GraduationCap className="size-4" />
                </SectionIcon>
                Education
              </CardTitle>
              <EducationTimeline
                entries={member.education}
                ownerName={first}
                timing={timing}
                addHref={edit('education')}
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <CardTitle as="h2" className="flex items-center gap-2.5">
                <SectionIcon>
                  <Sparkles className="size-4" />
                </SectionIcon>
                Skills
              </CardTitle>
              {member.skills.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {member.skills.map((skill) => (
                    <li key={skill}>
                      {/* Every skill is a search — the useful next question
                          after "who is this" is "who else does this". */}
                      <Link
                        href={`/directory?skill=${encodeURIComponent(skill)}`}
                        className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface-sunken px-3.5 text-sm font-medium text-secondary transition-colors duration-fast ease-brand hover:border-line-strong hover:bg-brand-soft hover:text-brand-soft-fg sm:min-h-8"
                      >
                        {skill}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine text="No skills listed yet." add={edit('skills')} addLabel="Add skills" />
              )}
            </CardBody>
          </Card>
        </div>

        <aside aria-label={`More about ${first}`} className="flex min-w-0 flex-col gap-6">
          <div className="hidden space-y-6 lg:block">{reach}</div>

          {/* An exhausted quota is explained, never a dead button. */}
          {mayAsk && quota && !quota.canSend ? (
            <Card id="quota" className="scroll-mt-20">
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

                <p className="text-xs text-secondary">
                  {quota.openRequests >= quota.openLimit
                    ? `A slot frees when one of your open requests is answered or expires.${
                        nextExpiry ? ` The oldest closes ${formatRelative(nextExpiry)}.` : ''
                      }`
                    : `Your monthly count resets on ${resetsOn}.`}{' '}
                  <Link href="/connections?tab=sent" className="link">
                    Review your open requests
                  </Link>
                  .
                </p>
              </CardBody>
            </Card>
          ) : null}

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

                <p className="text-xs text-secondary">
                  {viewerIsOwner
                    ? 'Your own academic record. Alumni never see this on anyone.'
                    : 'Academic data is placement-side only. It is not shown to alumni, who post jobs here.'}
                </p>
              </CardBody>
            </Card>
          ) : null}

          {batchmates.length ? (
            <Card>
              <CardBody className="space-y-2">
                <CardTitle as="h2" className="text-md">
                  More from the {member.batchYear} batch
                </CardTitle>
                <ul className="divide-y divide-line">
                  {batchmates.map((m) => (
                    <li key={m.id}>
                      <MemberRow member={m} />
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/directory/batch/${member.batchYear}`}
                  className="link inline-flex min-h-11 items-center text-sm font-medium lg:min-h-0"
                >
                  See the {member.batchYear} batch
                </Link>
              </CardBody>
            </Card>
          ) : null}

          <Disclosure summary="Verification and record">
            <dl className="-my-1 divide-y divide-line">
              {member.programme || member.departmentName ? (
                <DetailRow label="Programme" className={STACKED}>
                  {memberLine([member.programme, member.departmentName])}
                </DetailRow>
              ) : null}
              {showBatch ? (
                <DetailRow label="Batch" className={STACKED}>
                  {member.batchYear}
                  {yearsOut(member.batchYear) ? (
                    <span className="font-normal text-secondary"> · {yearsOut(member.batchYear)}</span>
                  ) : null}
                </DetailRow>
              ) : null}
              {member.admissionYear ? (
                <DetailRow label="Admitted" className={STACKED}>
                  {member.admissionYear}
                </DetailRow>
              ) : null}
              <DetailRow label="Verification" className={STACKED}>
                {member.verifiedAt ? (
                  <span className="block">
                    {formatDate(member.verifiedAt, timing)}
                    <span className="block text-xs font-normal text-secondary">
                      {verificationMethod(member.verificationMethod, pack.copy.officeName)}
                    </span>
                  </span>
                ) : (
                  <span className="font-normal text-secondary">Not yet verified</span>
                )}
              </DetailRow>
              {/* Only present when the DTO carried it — the projection
                  decides, not this page. */}
              {member.rollNumber ? (
                <DetailRow label="Roll number" className={STACKED}>
                  <span className="font-mono">{member.rollNumber}</span>
                </DetailRow>
              ) : null}
            </dl>
          </Disclosure>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------

/** In a 20rem rail a label beside its value squeezes both; stack them. */
const STACKED = 'grid-cols-1 gap-0.5 py-2';

/** The brand-tinted tile that leads a section heading. Decorative. */
function SectionIcon({ children }: { children: React.ReactNode }) {
  return (
    <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-soft-fg">
      {children}
    </span>
  );
}

function EmptyLine({ text, add, addLabel }: { text: string; add?: string; addLabel: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-secondary">
      <span>{text}</span>
      {add ? (
        <Link href={add} className="link inline-flex min-h-11 items-center font-medium sm:min-h-0">
          {addLabel}
        </Link>
      ) : null}
    </p>
  );
}

/**
 * The request dialog's example message, in the viewer's own voice.
 * Built here because the page knows who is asking; the dialog does not.
 */
function introPlaceholder(session: Session, shortName: string): string {
  const roles = new Set(session.roles.map((r) => r.role));
  const dept = viewerBranch(session);
  const ask = 'I would like to ask about…';

  if (roles.has('student')) {
    return `I am in final year ${dept ? `${dept} ` : ''}at ${shortName}. ${ask}`;
  }
  if (roles.has('alumni') && session.batchYear) {
    return `I am from the ${session.batchYear}${dept ? ` ${dept}` : ''} batch. ${ask}`;
  }
  if (roles.has('faculty')) {
    return `I teach ${dept ? `${dept} ` : ''}at ${shortName}. ${ask}`;
  }
  return `I am writing from ${shortName}. ${ask}`;
}

/** "1 September": when a monthly allowance starts again, in the college's time zone. */
function firstOfNextMonth(locale: string, timeZone: string): string {
  const now = displayNow();
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m = Number(parts.find((p) => p.type === 'month')?.value);
  // Noon UTC on the 1st is the 1st in every Indian and most other zones.
  const next = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1, 12));
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone }).format(next);
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

function verificationMethod(method: string | null, officeName: string): string {
  switch (method) {
    case 'auto_roll_match':
      return 'Matched against the degree register';
    case 'admin_manual':
      return `Checked by the ${officeName}`;
    case 'bulk_import':
      return 'Loaded from college records';
    case 'placement_cell_import':
      return 'Loaded by the placement cell';
    default:
      return 'Method not recorded';
  }
}
