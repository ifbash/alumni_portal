import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { Avatar, ButtonLink, Card, CardBody } from '@/components/ui';
import { BandChip, PageBand } from '@/components/brand/PageBand';
import { EventSummary } from '@/components/content';
import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { getEvents, getOwnProfile, searchDirectory } from '@/lib/data/repo';
import { CONNECTION_LIMITS, NOTICE_VERSION } from '@/lib/config';
import { authPhoto } from '@/lib/branding/media';
import { firstNameOf, identityLine, viewerBatchYear, viewerBranch } from '@/lib/identity';
import { profileChecks } from '../profile/completeness';
import { StartSetupButton, WelcomeWizard, type WelcomeAudience } from './WelcomeWizard';

/**
 * First run.
 *
 * The screen a member sees once, after their first sign-in, and again
 * whenever the home page's "Finish setting up" sends them back. It opens
 * on the college: a welcome band (the college's sign-in photo when it has
 * one) with what the portal will do for them, and two equal choices, set
 * up now or skip. Then four short steps, each skippable and each saved on
 * its own, and a last screen with their batch and the next event.
 *
 * The band, the in-step header and the last screen are rendered here, on
 * the server, and handed to the wizard as finished pieces: the wizard only
 * decides which one is showing. Nothing about another member reaches the
 * client except the batch avatars, from the same guarded directory search
 * the home page uses.
 */

export const metadata: Metadata = {
  title: 'Welcome',
};

export default async function WelcomePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Every step of this wizard writes the member's own record. A staff role
  // without that capability has nothing to complete here, and /api/profile
  // would refuse the save regardless — better to say so at the door.
  requireCap(session, 'profile.write.own');

  const profile = getOwnProfile(session);
  if (!profile) notFound();

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const { pack } = resolved.brand;
  const { copy, features, locale } = pack;

  const checks = profileChecks(profile);

  const first = firstNameOf(profile.fullName, profile.preferredName);
  const alumnus = session.roles.some((r) => r.role === 'alumni');
  const audience: WelcomeAudience = profile.isStudent ? 'student' : alumnus ? 'alumni' : 'faculty';
  const dept = profile.departmentName ?? profile.departmentCode;

  const lead =
    audience === 'student'
      ? [dept, 'final year'].filter(Boolean).join(', ')
      : audience === 'alumni' && profile.batchYear
        ? [dept, `Batch of ${profile.batchYear}`].filter(Boolean).join(', ')
        : identityLine({
            roles: session.roles,
            departmentCode: viewerBranch(session),
            departmentName: null,
            batchYear: null,
            designation: profile.designation,
            isStudent: false,
          });

  // What the portal will show them, for the features this college has on.
  // Nothing here says anyone will be told anything: nothing is sent yet.
  const chips: string[] =
    audience === 'student'
      ? [
          features.directory ? 'Find alumni from your branch' : null,
          features.jobs ? 'See roles graduates are hiring for' : null,
          features.events ? 'See upcoming events' : null,
        ].filter((c): c is string => c !== null)
      : [
          features.directory ? (audience === 'alumni' ? 'Find your batch' : 'Find graduates of your department') : null,
          features.events ? `See what ${copy.shortName} is running` : null,
          features.connections ? 'Help a final-year student' : null,
        ].filter((c): c is string => c !== null);

  // ---- The last screen ----------------------------------------------
  const canSearch = features.directory && can(session, 'directory.search.alumni');
  const batchYear = viewerBatchYear(session);
  const batch =
    canSearch && batchYear
      ? searchDirectory(session, {
          cohort: 'alumni',
          batchFrom: batchYear,
          batchTo: batchYear,
          sort: 'recent',
          perPage: 8,
        })
      : null;
  const batchmates = batch ? batch.items.filter((m) => m.id !== session.memberId).slice(0, 6) : [];
  const nextEvent =
    features.events && can(session, 'event.register')
      ? (getEvents(session, { when: 'upcoming' })[0] ?? null)
      : null;

  const intro = (
    <PageBand
      pack={pack}
      photo={authPhoto(pack)}
      photoOnPhones
      eyebrow={copy.portalName}
      title={`Welcome, ${first}`}
      lead={lead}
      meta={chips.length ? chips.map((c) => <BandChip key={c}>{c}</BandChip>) : undefined}
      actions={
        <>
          <StartSetupButton />
          <ButtonLink href="/dashboard" variant="band-outline" className="min-h-11">
            Skip for now
          </ButtonLink>
        </>
      }
    />
  );

  const header = (
    <PageBand pack={pack} size="compact" eyebrow={copy.portalName} title={`Welcome, ${first}`} />
  );

  const done = (
    <Card as="section" aria-labelledby="welcome-done-title">
      <CardBody className="space-y-6">
        <div className="flex items-start gap-3">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-full bg-success-soft text-success-fg"
            aria-hidden="true"
          >
            <CheckCircle2 className="size-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 id="welcome-done-title" className="font-display text-xl font-semibold">
              You are in.
            </h2>
            <p className="text-sm text-secondary">Anything you set here can be changed from your profile.</p>
          </div>
        </div>

        {batch && batchYear && batch.total > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            {batchmates.length ? (
              <ul className="flex -space-x-2" aria-label={`Some of the ${batchYear} batch`}>
                {batchmates.map((m) => (
                  <li key={m.id}>
                    <Avatar name={m.fullName} src={m.photoUrl} size="md" className="ring-2 ring-[var(--surface-raised)]" />
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-sm text-secondary">
              <span className="font-semibold tabular text-primary">{batch.total.toLocaleString('en-IN')}</span> of the{' '}
              {batchYear} batch {batch.total === 1 ? 'is' : 'are'} here
            </p>
          </div>
        ) : null}

        {nextEvent ? (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-secondary">Next at {copy.shortName}</h3>
            <EventSummary
              event={nextEvent}
              href={`/events/${nextEvent.slug}`}
              locale={locale}
              variant="row"
              className="py-1"
            />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          {batch && batchYear ? (
            <ButtonLink href={`/directory/batch/${batchYear}`} className="min-h-11">
              See your batch
            </ButtonLink>
          ) : null}
          <ButtonLink href="/dashboard" variant={batch && batchYear ? 'secondary' : 'primary'} className="min-h-11">
            Open home
          </ButtonLink>
        </div>
      </CardBody>
    </Card>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <WelcomeWizard
        intro={intro}
        header={header}
        done={done}
        name={profile.fullName}
        audience={audience}
        checks={checks}
        noticeVersion={NOTICE_VERSION}
        shortName={pack.copy.shortName}
        officeName={copy.officeName}
        openLimit={CONNECTION_LIMITS.studentOpenRequests}
        // Feature flags decide what the copy may honestly promise. Telling
        // an alumnus that students will send mentorship requests, on a
        // tenant where connections are switched off, is a lie the switch
        // itself cannot deliver on.
        connectionsOn={pack.features.connections}
        mentorshipOn={pack.features.mentorship}
        directoryOn={pack.features.directory}
        values={{
          photoUrl: profile.photoUrl ?? '',
          currentCompany: profile.currentCompany ?? '',
          designation: profile.designation ?? '',
          industry: profile.industry ?? '',
          city: profile.city ?? '',
          state: profile.state ?? '',
          country: profile.country ?? 'IN',
          skills: profile.skills,
          openToMentoring: profile.openToMentoring,
          openToReferrals: profile.openToReferrals,
          openToSpeaking: profile.openToSpeaking,
          visibility: profile.contact?.visibility ?? 'on_accept',
        }}
      />
    </div>
  );
}
