import { can, type Session } from './auth/guard';
import type { BrandPack } from './branding/pack';
import { getDataRequests, getDonations, getJobs, getPendingEventProposals, getVerificationClaims } from './data/repo';
import { getGroups } from './data/groups';
import { countReportedPosts } from './data/feed';
import { countPendingBusinesses } from './data/businesses';
import { countPendingShowcase } from './data/showcase';
import { countOpenTickets } from './data/helpdesk';
import { daysUntil, formatRelative } from './format';
import type { TaskItem } from '@/components/ui/tasks';

/**
 * The staff queues, as tasks: the one source for every count a staff
 * member is shown as "needs you" — the console's Today page, the home
 * page's strip, the badges. Three different "waiting" numbers on three
 * screens is how nobody trusts any of them.
 *
 * Server only (it reads the repo). Not marked `server-only`, so the suite
 * can import it; nothing under `src/app/**` is imported from here.
 *
 * Every read sits behind an explicit capability check, the same one the
 * queue's own page applies. `getDataRequests` and `getDonations` take no
 * session, so the check here is the only thing between them and a viewer;
 * a count must never reach somebody who could not open the list behind
 * it.
 *
 * The last two tasks are information only: nothing in the product issues
 * receipts or settles payments yet, so their verb is "See the list".
 */

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function staffTasks(session: Session, pack: BrandPack): TaskItem[] {
  const tz = pack.locale.timeZone;
  const fmt = { locale: pack.locale.locale, timeZone: tz };
  const tasks: TaskItem[] = [];

  // ---- Registrations ------------------------------------------------
  if (can(session, 'verification.review.any') || can(session, 'verification.review.department')) {
    // Scoped by the repo: an HOD sees only their own department's claims.
    const queued = getVerificationClaims(session, { status: 'queued' });
    if (queued.length) {
      const oldest = queued.reduce((a, c) => (c.submittedAt < a ? c.submittedAt : a), queued[0]!.submittedAt);
      tasks.push({
        key: 'verification',
        count: queued.length,
        label: plural(queued.length, 'registration to review', 'registrations to review'),
        detail: `oldest ${formatRelative(oldest, fmt)}`,
        href: '/admin/verification',
        action: 'Review',
        tone: daysUntil(oldest, tz) < -14 ? 'attention' : 'default',
      });
    }
  }

  // ---- Job moderation -------------------------------------------------
  if (pack.features.jobs && can(session, 'job.moderate')) {
    const pending = getJobs(session, { state: 'pending_moderation' });
    if (pending.length) {
      const oldest = pending.reduce((a, j) => (j.createdAt < a ? j.createdAt : a), pending[0]!.createdAt);
      tasks.push({
        key: 'moderation',
        count: pending.length,
        label: plural(pending.length, 'job posting to moderate', 'job postings to moderate'),
        detail: `oldest ${formatRelative(oldest, fmt)}`,
        href: '/admin/jobs',
        action: 'Moderate',
      });
    }
  }

  // ---- The community modules ------------------------------------------
  //
  // Each behind its own capability and the module switch, and each count
  // function returns 0 to anyone without the capability, so a number never
  // reaches somebody who could not open the queue behind it.

  if (pack.features.events && can(session, 'event.create.any')) {
    const proposals = getPendingEventProposals(session);
    if (proposals.length) {
      tasks.push({
        key: 'event-proposals',
        count: proposals.length,
        label: plural(proposals.length, 'event proposed by a member', 'events proposed by members'),
        detail: `next starts ${formatRelative(proposals[0]!.startsAt, fmt)}`,
        href: '/admin/events#proposals',
        action: 'Decide',
      });
    }
  }

  if (pack.features.helpdesk) {
    const { open, oldestAt } = countOpenTickets(session);
    if (open) {
      tasks.push({
        key: 'helpdesk',
        count: open,
        label: plural(open, 'question waiting for an answer', 'questions waiting for an answer'),
        detail: oldestAt ? `oldest ${formatRelative(oldestAt, fmt)}` : undefined,
        href: '/admin/helpdesk',
        action: 'Answer',
        tone: oldestAt && daysUntil(oldestAt, tz) < -7 ? 'attention' : 'default',
      });
    }
  }

  if (pack.features.businesses) {
    const n = countPendingBusinesses(session);
    if (n) {
      tasks.push({ key: 'businesses', count: n, label: plural(n, 'business listing to review', 'business listings to review'), href: '/admin/businesses', action: 'Review' });
    }
  }

  if (pack.features.showcase) {
    const n = countPendingShowcase(session);
    if (n) {
      tasks.push({ key: 'showcase', count: n, label: plural(n, 'achievement to review', 'achievements to review'), href: '/admin/showcase', action: 'Review' });
    }
  }

  if (pack.features.feed) {
    const n = countReportedPosts(session);
    if (n) {
      tasks.push({ key: 'reports', count: n, label: plural(n, 'reported post still live', 'reported posts still live'), href: '/admin/community', action: 'Moderate', tone: 'attention' });
    }
  }

  if (pack.features.groups && can(session, 'group.manage')) {
    const unled = getGroups(session).filter((g) => g.leads.length === 0 && !g.archived).length;
    if (unled) {
      tasks.push({ key: 'groups', count: unled, label: plural(unled, 'group with no lead', 'groups with no lead'), href: '/admin/groups', action: 'Appoint' });
    }
  }

  // ---- Data requests (DPDP) -------------------------------------------
  if (can(session, 'data_request.manage')) {
    const due = getDataRequests().filter(
      (r) => (r.state === 'received' || r.state === 'in_progress') && daysUntil(r.dueAt, tz) <= 7,
    );
    if (due.length) {
      const overdue = due.filter((r) => daysUntil(r.dueAt, tz) < 0).length;
      tasks.push({
        key: 'data-requests',
        count: due.length,
        label: plural(due.length, 'data request due this week', 'data requests due this week'),
        detail: overdue ? `${overdue} overdue` : undefined,
        href: '/admin/data-requests',
        action: 'Open',
        tone: overdue ? 'attention' : 'default',
      });
    }
  }

  // ---- Donations (information only) -----------------------------------
  if (can(session, 'donation.report')) {
    const donations = getDonations();

    const unconfirmed = donations.filter((d) => d.state === 'initiated').length;
    if (unconfirmed) {
      tasks.push({
        key: 'payments',
        count: unconfirmed,
        label: plural(unconfirmed, 'payment not confirmed', 'payments not confirmed'),
        href: '/admin/giving?state=initiated',
        action: 'See the list',
      });
    }

    const noReceipt = donations.filter(
      (d) => d.state === 'succeeded' && !d.isForeignContribution && !d.receipt80gNo,
    ).length;
    if (noReceipt) {
      tasks.push({
        key: 'receipts',
        count: noReceipt,
        label: plural(noReceipt, 'gift without a receipt number', 'gifts without a receipt number'),
        href: '/admin/giving?origin=domestic&state=succeeded',
        action: 'See the list',
      });
    }
  }

  return tasks;
}
