import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * A page's primary action, pinned to the bottom of the screen on phones.
 *
 * Below `lg` only: on a desktop the action is already in view. It sits
 * above the phone tab bar (`--shell-tabbar-h`, 0 where there is none) and
 * renders a spacer in the flow, so the last line of the page is never
 * hidden under it. Hidden in print.
 */
export function StickyActionBar({
  children,
  label = 'Page actions',
  className,
}: {
  children: React.ReactNode;
  /** The region's accessible name. */
  label?: string;
  className?: string;
}) {
  return (
    <>
      <div aria-hidden="true" className="h-20 lg:hidden" data-print-hide="" />
      <div
        role="region"
        aria-label={label}
        data-print-hide=""
        className={cn(
          'fixed inset-x-0 bottom-[var(--shell-tabbar-h,0px)] z-30 border-t border-line bg-surface-raised',
          'px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-lg lg:hidden',
          className,
        )}
      >
        <div className="flex items-center gap-2 [&>*]:min-h-11 [&>*]:flex-1">{children}</div>
      </div>
    </>
  );
}
