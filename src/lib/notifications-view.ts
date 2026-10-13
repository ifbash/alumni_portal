import type { NotificationItem } from './data/types';

/**
 * The verb on a notification's link, by what the notification is about.
 * Null when there is nowhere to go, so the row renders no dead button.
 */
const ACTION: Record<NotificationItem['kind'], string> = {
  connection: 'Reply',
  event: 'See event',
  job: 'See posting',
  verification: 'Open',
  system: 'Review',
};

export function notificationAction(n: Pick<NotificationItem, 'kind' | 'href'>): string | null {
  if (!n.href) return null;
  return ACTION[n.kind] ?? 'Open';
}
