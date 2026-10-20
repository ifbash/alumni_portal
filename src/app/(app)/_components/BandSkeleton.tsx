import { cn } from '@/lib/cn';

/**
 * A band, mid-load, drawn in the band colour: that is what arrives, so the
 * block of colour does not jump. The bars are tints of the band's own
 * foreground, never page-surface skeletons on a dark slab.
 *
 * `tall` is for the detail pages whose band carries a date leaf or a photo
 * (an event, an album); the default is the shape of `PageBand`.
 */
export function BandSkeleton({ tall = false, className }: { tall?: boolean; className?: string }) {
  const bar = 'rounded bg-[color-mix(in_srgb,var(--band-fg)_20%,transparent)]';
  return (
    <div
      aria-hidden="true"
      className={cn(
        'band-surface -mx-4 flex flex-col gap-5 px-5 py-6 sm:mx-0 sm:rounded-xl sm:px-8 lg:py-10',
        tall ? 'lg:min-h-[18rem] lg:flex-row lg:items-end lg:gap-8' : null,
        className,
      )}
    >
      {tall ? <div className={cn(bar, 'h-28 w-24 shrink-0 rounded-xl sm:w-28')} /> : null}
      <div className="min-w-0 flex-1 space-y-3">
        <div className={cn(bar, 'h-3.5 w-32')} />
        <div className={cn(bar, 'h-9 w-full max-w-xl')} />
        <div className={cn(bar, 'h-4 w-full max-w-md opacity-75')} />
        <div className="flex gap-2 pt-1">
          <div className={cn(bar, 'h-8 w-28 rounded-full')} />
          <div className={cn(bar, 'h-8 w-24 rounded-full')} />
        </div>
      </div>
    </div>
  );
}
