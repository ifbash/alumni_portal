import { IS_FIXTURE } from '@/lib/config';
import { Badge, Tooltip } from '@/components/ui';

/**
 * The fixture-mode marker: a quiet "Demo data" badge in the top bar.
 *
 * Fixture honesty lives here and in `outcomeToast`, never in page copy, so
 * no screen has to narrate that it is not connected. It is a badge only,
 * from `sm` up: a strip under the bar on phones would eat the first
 * viewport of every demo screenshot (owner decision 14). Hidden in print.
 *
 * Renders nothing outside fixture mode.
 */
export function DemoRibbon() {
  if (!IS_FIXTURE) return null;

  return (
    <span data-print-hide="" className="mr-1 hidden sm:inline-flex">
      <Tooltip label="Sample data. Changes are checked, then not saved." side="bottom">
        {/* Focusable so a keyboard reaches the tooltip; the sentence is
            also in the badge for screen readers, since a tooltip must
            never be the only place a fact lives. */}
        <Badge tone="outline" tabIndex={0} className="cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
          Demo data
          <span className="sr-only">. Sample data. Changes are checked, then not saved.</span>
        </Badge>
      </Tooltip>
    </span>
  );
}
