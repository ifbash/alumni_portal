import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Check, Clock, Eye, Lock, ScrollText, ShieldCheck, X } from 'lucide-react';
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  DefinitionCard,
  Section,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { getSession } from '@/lib/auth/session';
import { requireSession } from '@/lib/auth/guard';
import { getNotifications, getOwnProfile } from '@/lib/data/repo';
import { roleHas, type Role } from '@/lib/auth/permissions';
import { NOTICE_VERSION } from '@/lib/config';
import { formatDate } from '@/lib/format';
import type { ContactVisibility } from '@/lib/data/types';
import { VisibilityForm } from './VisibilityForm';

/**
 * Privacy — the DPDP surface.
 *
 * Two things are being demonstrated here, and they are the product's
 * differentiators against every portal a college has been shown before:
 *
 *  1. **Consent is a setting the member holds**, with the consequence of
 *     each option written next to it in words a 2014 graduate can act on.
 *     "Contact visibility: on_accept" is a database value, not a choice.
 *  2. **The role table is derived from the capability matrix**, not
 *     written by hand. It cannot drift away from what the code enforces,
 *     because it is reading the same grants `can()` reads. Telling a
 *     member what staff can see, truthfully, is the part everyone skips.
 */

export const metadata: Metadata = {
  title: 'Privacy settings',
};

type Access = 'yes' | 'no' | 'on_accept' | 'never';

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

  // ---- Consent records ------------------------------------------------

  const noticeUpdate = getNotifications(session).find(
    (n) => n.kind === 'system' && n.title.toLowerCase().includes('privacy notice'),
  );

  return (
    <>
      {/* ---- The setting ----------------------------------------------- */}

      <Section
        title="Who can reach you"
        description="Your contact details live in a separate table from your profile. Releasing them needs two things to be true at once: the person asking must be entitled, and you must have agreed. This setting is your half."
      >
        <Alert tone="info" title={`Right now: ${SUMMARY[visibility].title}`} icon={<ShieldCheck className="size-4" />}>
          {SUMMARY[visibility].body}
        </Alert>

        <Card>
          <CardBody>
            <VisibilityForm initial={visibility} />
          </CardBody>
        </Card>
      </Section>

      {/* ---- The truth table -------------------------------------------- */}

      <Section
        title="What each role can see about you"
        description="Read from the college's capability matrix at the moment this page loaded — not a summary somebody typed once and forgot to update."
      >
        <TableWrap
          caption="What each role at the college can see about your record"
          className="hidden sm:block"
        >
          <Table>
            <caption className="sr-only">
              Roles down the side, the data they can reach across the top.
            </caption>
            <THead>
              <TR>
                <TH className="min-w-44">Role</TH>
                <TH>Name, branch, batch</TH>
                <TH>Bio, skills, employer</TH>
                <TH>Email</TH>
                <TH>Mobile</TH>
                {isStudent ? <TH>CGPA, placement</TH> : null}
                <TH>Your message text</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.role}>
                  <TH scope="row" className="text-left font-semibold normal-case tracking-normal text-primary">
                    {r.label}
                    {r.note ? (
                      <span className="block text-xs font-normal normal-case text-muted">
                        {r.note}
                      </span>
                    ) : null}
                  </TH>
                  <TD>
                    <AccessCell value={r.identity} />
                  </TD>
                  <TD>
                    <AccessCell value={r.detail} />
                  </TD>
                  <TD>
                    <AccessCell value={r.email} />
                  </TD>
                  <TD>
                    <AccessCell value={r.mobile} />
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
              title={r.label}
              subtitle={r.note}
              rows={[
                { label: 'Name, branch, batch', value: <AccessCell value={r.identity} /> },
                { label: 'Bio, skills, employer', value: <AccessCell value={r.detail} /> },
                { label: 'Email', value: <AccessCell value={r.email} /> },
                { label: 'Mobile', value: <AccessCell value={r.mobile} /> },
                ...(isStudent
                  ? [{ label: 'CGPA, placement', value: <AccessCell value={r.academic} /> }]
                  : []),
                { label: 'Your message text', value: <AccessCell value={r.messages} /> },
              ]}
            />
          ))}
        </div>

        <div className="space-y-3">
          <Alert tone="neutral" title="Three things no setting on this page changes" icon={<Lock className="size-4" />}>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>
                <strong>Nobody reads your messages.</strong> There is no capability for it in the
                system, for any role, deliberately — so there is no switch an administrator could
                be persuaded to flip.
              </li>
              <li>
                <strong>The college admin can export contact details in bulk</strong>, for things
                like a NAAC submission. It is the only role that can, every export is written to the
                audit log with who did it and why, and you can ask to see that log.
              </li>
              <li>
                <strong>The directory is never public.</strong> Every viewer is a signed-in,
                verified member of your college. Nothing here is indexed by a search engine, and
                there is no anonymous view of it to be found.
              </li>
            </ul>
          </Alert>

          {!isStudent ? (
            <p className="text-xs text-muted">
              CGPA and placement status exist only for current students and are visible only to the
              placement cell. They are never shown to alumni — alumni post jobs on this portal, and
              a searchable marks list is a recruiting shortcut nobody agreed to.
            </p>
          ) : null}
        </div>
      </Section>

      {/* ---- Consent history --------------------------------------------- */}

      <Section
        title="Your consent record"
        description="Append-only. Withdrawing consent adds a line; it never removes one. That is what makes the log evidence rather than a preference screen."
      >
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle as="h3" className="text-md">
                Notice version in force
              </CardTitle>
              <CardDescription>
                Every consent is recorded against the exact notice you were shown.
              </CardDescription>
            </div>
            <Badge tone="brand">
              <ScrollText className="size-3.5" aria-hidden="true" />
              {NOTICE_VERSION}
            </Badge>
          </CardHeader>

          <CardBody>
            <ol className="space-y-4">
              {noticeUpdate ? (
                <ConsentRow
                  title={`Privacy notice ${NOTICE_VERSION} published`}
                  when={noticeUpdate.createdAt}
                  version={NOTICE_VERSION}
                  state={
                    noticeUpdate.readAt
                      ? { tone: 'success', label: `Acknowledged ${formatDate(noticeUpdate.readAt)}` }
                      : { tone: 'warning', label: 'Not acknowledged yet' }
                  }
                  detail="Replaces the notice you accepted at sign-up. Nothing about how your data is used changed without this line existing."
                />
              ) : null}

              <ConsentRow
                title="Contact sharing"
                when={null}
                version={NOTICE_VERSION}
                state={{ tone: 'brand', label: SUMMARY[visibility].title }}
                detail="Current setting. Changing it above appends a new record and leaves this one in place."
              />

              <ConsentRow
                title="Directory listing"
                when={profile.verifiedAt}
                version={NOTICE_VERSION}
                state={{ tone: 'success', label: 'Given' }}
                detail={
                  isStudent
                    ? 'Recorded when the placement cell added you to the portal. Your name, branch and batch are visible to alumni so they know who is asking.'
                    : 'Recorded when your membership was verified against the degree register. Your name, branch and batch are visible to other verified members.'
                }
              />
            </ol>
          </CardBody>
        </Card>

        <p className="text-sm text-secondary">
          To see the college&rsquo;s side of this — every time your record was read, exported or
          changed by staff — ask for an access log through{' '}
          <Link href="/settings/data" className="link">
            your data requests
          </Link>
          . The college has 30 days to answer.
        </p>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------

function AccessCell({ value }: { value: Access }) {
  if (value === 'yes') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm">
        <Eye className="size-3.5 shrink-0 text-brand-fg" aria-hidden="true" />
        Yes
      </span>
    );
  }
  if (value === 'on_accept') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-warning-fg">
        <Clock className="size-3.5 shrink-0" aria-hidden="true" />
        Only if you accept
      </span>
    );
  }
  if (value === 'never') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
        <Lock className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
        Never
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted">
      <X className="size-3.5 shrink-0" aria-hidden="true" />
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
        className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-surface-sunken text-muted"
        aria-hidden="true"
      >
        <Check className="size-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{title}</p>
          <Badge tone={state.tone}>{state.label}</Badge>
        </div>
        <p className="text-sm text-secondary">{detail}</p>
        <p className="text-xs text-muted">
          {when ? formatDate(when) : 'Current'} · notice {version}
        </p>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------
// Copy
// ---------------------------------------------------------------

const SUMMARY: Record<ContactVisibility, { title: string; body: string }> = {
  private: {
    title: 'Nobody sees your contact details',
    body: 'No member can see your email or mobile through the portal. People can still send you a connection request, and you can reply from your own inbox if you want to.',
  },
  on_accept: {
    title: 'Released only when you accept a request',
    body: 'Someone who asks sees a masked address and a note explaining that release is your decision, not a restriction the college applied to them. Accepting releases your email and mobile to that one person.',
  },
  alumni_only: {
    title: 'Alumni and faculty only',
    body: 'Alumni and faculty can see your email and mobile without asking. Students cannot — this setting is the reason they are told to send a request instead.',
  },
  all_members: {
    title: 'Every verified member',
    body: 'Any signed-in, verified member of the portal — students included — can see your email. Your mobile number stays out of the directory regardless.',
  },
};

const ROLE_ROWS: Array<{ role: Role; label: string; note?: string }> = [
  { role: 'student', label: 'Final-year students' },
  { role: 'alumni', label: 'Other alumni' },
  { role: 'faculty', label: 'Faculty' },
  {
    role: 'hod',
    label: 'Head of department',
    note: 'Verification and communications are scoped to their own branch; reading a profile is not.',
  },
  {
    role: 'placement_officer',
    label: 'Placement officer',
    note: 'Student-side role. Sees current students, not the alumni directory.',
  },
  { role: 'alumni_cell_operator', label: 'Alumni cell staff', note: 'Cannot export in bulk, by design.' },
  { role: 'finance', label: 'Finance', note: 'Donations and reconciliation only. No directory access at all.' },
  {
    role: 'college_admin',
    label: 'College admin',
    note: 'The only role that can export contact details in bulk. Every export is audit-logged with a reason.',
  },
  {
    role: 'platform_admin',
    label: 'Platform admin (ifBash)',
    note: 'Provisions colleges. Deliberately holds no capability that reads member data.',
  },
];
