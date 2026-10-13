import { redirect, notFound } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { can, require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import {
  searchDirectory,
  getDepartments,
  getDegreeRegisterStats,
  getEvents,
  getEventBySlug,
} from '@/lib/data/repo';
import { getNews } from '@/lib/data/content';
import type { DirectoryQuery, EventItem } from '@/lib/data/types';
import { PageHeader, Breadcrumbs } from '@/components/ui';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { siteOrigin } from '@/lib/share';
import { eventShareText, portalShareText, storyShareText } from '@/lib/share-text';
import { capitalise, deskFor } from '@/lib/branding/copy';
import { daysUntil, formatDate, formatDateRange } from '@/lib/format';
import { ComposeForm, type Segment, type StartingPoint } from './ComposeForm';

export const metadata = { title: 'New message · Staff console' };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function NewCommsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolved = await getTenantBrand();
  if (!resolved) notFound();
  const pack = resolved.brand.pack;

  const all = can(session, 'comms.send.all');
  const segmentCap = can(session, 'comms.send.segment');
  const departmentCap = can(session, 'comms.send.department');
  if (!all && !segmentCap && !departmentCap) requireCap(session, 'comms.send.department');

  const tier: 'all' | 'segment' | 'department' = all ? 'all' : segmentCap ? 'segment' : 'department';
  const myDepartment = session.roles.find((r) => r.role === 'hod')?.departmentId ?? session.departmentId;
  const studentsAddressable = can(session, 'directory.search.students');

  const params = await searchParams;
  const raw = {
    // An account that cannot reach students writes to alumni, so that is
    // where it starts. Narrowing only: the server refuses students anyway.
    cohort: studentsAddressable ? one(params.cohort) : 'alumni',
    department: one(params.department) ?? '',
    batchFrom: one(params.batchFrom) ?? '',
    batchTo: one(params.batchTo) ?? '',
    city: one(params.city) ?? '',
    availability: one(params.availability) ?? '',
  };

  /**
   * The department is clamped here, on the server, before the count is
   * computed. An HOD cannot widen their audience by editing the query
   * string, and the composer is handed the clamped value so the control
   * shows the truth rather than a rejected wish.
   */
  const lockedDepartment = tier === 'department' ? (myDepartment ?? '') : null;

  const segment: Segment = {
    cohort: raw.cohort === 'alumni' || raw.cohort === 'students' ? raw.cohort : 'all',
    department: lockedDepartment ?? raw.department,
    batchFrom: /^\d{4}$/.test(raw.batchFrom) ? raw.batchFrom : '',
    batchTo: /^\d{4}$/.test(raw.batchTo) ? raw.batchTo : '',
    city: raw.city,
    availability:
      raw.availability === 'mentoring' || raw.availability === 'referrals' || raw.availability === 'speaking'
        ? raw.availability
        : '',
  };

  const query: DirectoryQuery = {
    cohort: segment.cohort,
    ...(segment.department ? { department: segment.department } : {}),
    ...(segment.batchFrom ? { batchFrom: Number(segment.batchFrom) } : {}),
    ...(segment.batchTo ? { batchTo: Number(segment.batchTo) } : {}),
    ...(segment.city ? { city: segment.city } : {}),
    ...(segment.availability === 'mentoring' ? { mentoring: true } : {}),
    ...(segment.availability === 'referrals' ? { referrals: true } : {}),
    ...(segment.availability === 'speaking' ? { speaking: true } : {}),
    perPage: 4,
    sort: 'name',
  };

  // Two reads: the segment as chosen, and the widest audience this viewer
  // could reach, which is what the filter option lists are drawn from.
  const result = searchDirectory(session, query);
  const scope = searchDirectory(session, {
    ...(lockedDepartment ? { department: lockedDepartment } : {}),
    perPage: 1,
  });

  const departments = getDepartments();
  const registerStats = getDegreeRegisterStats();

  const departmentOptions = lockedDepartment
    ? departments
        .filter((d) => d.code === lockedDepartment)
        .map((d) => ({ value: d.code, label: `${d.code} — ${d.name}` }))
    : [
        { value: '', label: 'Every branch' },
        ...scope.facets.departments.map((f) => ({
          value: f.value,
          label: `${f.value} — ${f.label} (${f.count.toLocaleString('en-IN')})`,
        })),
      ];

  const lockedDepartmentName = lockedDepartment
    ? (departments.find((d) => d.code === lockedDepartment)?.name ?? lockedDepartment)
    : null;

  // ---------------------------------------------------------------
  // Starting points: an event invite or a story, written out once here so
  // the composer only fills fields. The API is unchanged — this is text.
  // ---------------------------------------------------------------

  const origin = await siteOrigin();
  const timing = { locale: pack.locale.locale, timeZone: pack.locale.timeZone };
  const held = new Set(session.roles.map((r) => r.role as string));
  const myDepartmentName = myDepartment
    ? (departments.find((d) => d.code === myDepartment)?.name ?? myDepartment)
    : null;
  const signOff = held.has('college_admin')
    ? deskFor(pack.copy, 'college_admin')
    : held.has('alumni_cell_operator')
      ? deskFor(pack.copy, 'alumni_cell_operator')
      : held.has('placement_officer')
        ? deskFor(pack.copy, 'placement_officer')
        : myDepartmentName
          ? `Department of ${myDepartmentName}`
          : capitalise(pack.copy.officeName);

  const eventPoint = (e: EventItem): StartingPoint => {
    const url = `${origin}/events/${e.slug}`;
    const past = daysUntil(e.startsAt, timing.timeZone) < 0;
    if (past) {
      return {
        key: `event:${e.slug}`,
        kind: 'event',
        label: e.title,
        hint: `Held ${formatDate(e.startsAt, timing)}`,
        subject: `Thank you for coming to ${e.title}`,
        body: `Dear {{first_name}},\n\nThank you for coming to ${e.title}. The event page stays up with what comes next:\n${url}\n\n${signOff}`,
        whatsapp: `Thank you to everyone who came to ${e.title}. What comes next: ${url}`,
      };
    }
    return {
      key: `event:${e.slug}`,
      kind: 'event',
      label: e.title,
      hint: formatDate(e.startsAt, timing),
      subject: `You are invited: ${e.title}`,
      body: `Dear {{first_name}},\n\nYou are invited to ${e.title}.\n\n${formatDateRange(e.startsAt, e.endsAt, timing)}\n${e.venue ?? 'Venue to be announced'}\n\nRegister on ${pack.copy.portalName}:\n${url}\n\n${signOff}`,
      whatsapp: `${eventShareText(pack, e)} ${url}`,
    };
  };

  const eventParam = one(params.event);
  const storyParam = one(params.story);

  const upcoming = pack.features.events ? getEvents(session, { when: 'upcoming' }).slice(0, 10) : [];
  // A past event arrives only by name, for "Thank the people who came".
  const named = eventParam && pack.features.events ? getEventBySlug(session, eventParam) : null;
  const eventsForStart =
    named && named.published && !upcoming.some((e) => e.id === named.id) ? [named, ...upcoming] : upcoming;

  // Obituaries are never broadcast: the news desk publishes them without a
  // notification, and a message about one would undo that.
  const stories = pack.features.news ? getNews().filter((n) => n.kind !== 'obituary').slice(0, 10) : [];

  const starts: StartingPoint[] = [
    ...eventsForStart.map(eventPoint),
    ...stories.map((n) => {
      const url = `${origin}/news/${n.slug}`;
      return {
        key: `story:${n.slug}`,
        kind: 'story' as const,
        label: n.title,
        hint: formatDate(n.publishedAt, timing),
        subject: n.title,
        body: `Dear {{first_name}},\n\n${n.summary}\n\nRead the full story on ${pack.copy.portalName}:\n${url}\n\n${signOff}`,
        whatsapp: `${storyShareText(pack, n)} ${url}`,
      };
    }),
  ];

  const initialKey =
    (eventParam && starts.some((s) => s.key === `event:${eventParam}`) ? `event:${eventParam}` : null) ??
    (storyParam && starts.some((s) => s.key === `story:${storyParam}`) ? `story:${storyParam}` : null);
  const startParam = one(params.start);
  const initialStart = initialKey
    ? (initialKey.split(':')[0] as 'event' | 'story')
    : startParam === 'event' || startParam === 'story'
      ? startParam
      : 'blank';

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Staff console', href: '/admin' },
              { label: 'Messages', href: '/admin/comms' },
              { label: 'New message' },
            ]}
          />
        }
        eyebrow="Messages"
        title="New message"
        description="Choose the channel, then who, then what. The count is checked again when you send."
      />

      <ComposeForm
        tier={tier}
        segment={segment}
        lockedDepartment={lockedDepartment}
        lockedDepartmentName={lockedDepartmentName}
        recipientCount={result.total}
        scopeTotal={scope.total}
        sampleNames={result.items.slice(0, 3).map((m) => m.fullName)}
        departmentOptions={departmentOptions}
        cityOptions={scope.facets.cities.map((f) => ({
          value: f.value,
          label: `${f.label} (${f.count.toLocaleString('en-IN')})`,
        }))}
        batchYears={scope.facets.batches.map((f) => f.value)}
        studentsAddressable={studentsAddressable}
        whatsappEnabled={pack.features.whatsapp}
        portalName={pack.copy.portalName}
        institutionName={pack.copy.institutionName}
        supportEmail={pack.copy.supportEmail ?? null}
        unclaimedRegisterRows={registerStats.unclaimed}
        starts={starts}
        initialStart={initialStart}
        initialStartKey={initialKey}
        initialMode={one(params.channel) === 'whatsapp-draft' ? 'draft' : 'send'}
        groupText={`${portalShareText(pack)} ${origin}/`}
        brandHeader={<Logo pack={pack} height={24} />}
        brandMark={<LogoMark pack={pack} size={32} />}
      />
    </div>
  );
}
