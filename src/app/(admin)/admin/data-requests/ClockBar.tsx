import { Progress } from '@/components/ui';
import { RESPONSE_WINDOW_DAYS, type DueStatus } from './dpdp';

/**
 * The statutory clock as a bar: how much of the response window has been
 * used. It fills towards the deadline and keeps the status tone, so an
 * overdue request reads as a full danger bar. The words beside it carry the
 * meaning; the bar is the second carrier.
 */
export function ClockBar({ due, className }: { due: DueStatus; className?: string }) {
  if (!due.open) return null;

  const used = Math.min(RESPONSE_WINDOW_DAYS, Math.max(0, RESPONSE_WINDOW_DAYS - due.days));
  const tone = due.tone === 'danger' ? 'danger' : due.tone === 'warning' ? 'warning' : 'brand';

  return (
    <Progress
      value={due.overdue ? RESPONSE_WINDOW_DAYS : used}
      max={RESPONSE_WINDOW_DAYS}
      tone={tone}
      label={`${used} of ${RESPONSE_WINDOW_DAYS} days used`}
      className={className}
    />
  );
}
