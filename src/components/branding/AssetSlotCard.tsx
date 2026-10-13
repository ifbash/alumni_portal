'use client';

import * as React from 'react';
import { ImagePlus } from 'lucide-react';
import { Badge, Field, Input, describedBy } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * One media slot of the brand pack, as the college sees it.
 *
 * What is there now (a thumbnail — logos on both a light ground and the
 * college band, because a crest drawn for paper disappears on a navy band),
 * what the slot wants (format and size), where it appears ("Used on"), and,
 * when empty, a designed ask: what the portal shows instead and what to
 * request from the college. Nothing here uploads; until file upload exists
 * a slot the form can save takes a path or URL, and every other slot is
 * shown read-only from the pack file.
 *
 * The studio owns the value and the errors. The only state here is whether
 * the image at the given address actually loaded: a path to a file that is
 * not there says so, rather than drawing a broken image.
 */

export interface AssetSlotEdit {
  id: string;
  value: string;
  onChange: (next: string) => void;
  error?: string | null;
  placeholder: string;
}

export function AssetSlotCard({
  label,
  format,
  usedOn,
  src,
  kind = 'mark',
  focus,
  emptyAsk,
  edit,
  readOnlyNote,
  children,
  className,
}: {
  label: string;
  /** "SVG or 1024px transparent PNG". */
  format: string;
  /** Where the slot appears: "Header", "Sign-in panel". */
  usedOn: string[];
  /** The current value, draft or pack. Empty means not supplied. */
  src?: string | null;
  /**
   * `mark` draws the image contained on light and band grounds; `photo`
   * draws it cropped as it will be; `file` (a video) names the file.
   */
  kind?: 'mark' | 'photo' | 'file';
  /** `object-position` for a photo. */
  focus?: string;
  /** What shows instead, and what to ask for. One or two sentences. */
  emptyAsk: string;
  /** Present only for slots the Publish form can save. */
  edit?: AssetSlotEdit;
  /** Shown instead of an input when the slot lives in the pack file. */
  readOnlyNote?: string;
  /** Read-only facts about the slot (alt text, focus, tags). */
  children?: React.ReactNode;
  className?: string;
}) {
  const value = src?.trim() || '';
  const supplied = value.length > 0;
  const [broken, setBroken] = React.useState<string | null>(null);
  const failed = supplied && broken === value;
  const onError = () => setBroken(value);
  // An image that failed before hydration never fires `error` again, so a
  // mounted image that finished with no pixels counts as failed too.
  const checkLoaded = (el: HTMLImageElement | null) => {
    // SVGs without intrinsic dimensions report no width even when fine.
    if (el && el.complete && el.naturalWidth === 0 && !/\.svg(\?|$)/i.test(value)) setBroken(value);
  };

  return (
    <article className={cn('space-y-3 rounded-lg border border-line bg-surface-raised p-4', className)}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-primary">{label}</h3>
          <p className="text-xs text-secondary">{format}</p>
        </div>
        {supplied ? (
          <Badge tone={failed ? 'warning' : 'success'} className="shrink-0 whitespace-nowrap">
            {failed ? 'Cannot be loaded' : 'Supplied'}
          </Badge>
        ) : null}
      </header>

      {failed ? (
        <p className="rounded border border-line bg-surface px-3 py-2.5 text-sm text-warning-fg">
          Nothing loads from this address. Check the path, or ask your vendor to put the file in place.
        </p>
      ) : supplied ? (
        kind === 'file' ? (
          <p className="rounded border border-line bg-surface px-3 py-2.5 font-mono text-xs text-secondary">
            {value.split('/').pop()}
          </p>
        ) : kind === 'mark' ? (
          <div className="grid grid-cols-2 gap-2">
            <figure className="m-0 space-y-1">
              <div className="grid h-20 place-items-center rounded border border-line bg-neutral-50 p-2">
                {/* Tenant-supplied path or URL. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={value} alt="" onError={onError} ref={checkLoaded} className="max-h-full max-w-full object-contain" />
              </div>
              <figcaption className="text-xs text-secondary">On a light page</figcaption>
            </figure>
            <figure className="m-0 space-y-1">
              <div className="grid h-20 place-items-center rounded border border-line bg-band p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={value} alt="" onError={onError} ref={checkLoaded} className="max-h-full max-w-full object-contain" />
              </div>
              <figcaption className="text-xs text-secondary">On the college band</figcaption>
            </figure>
          </div>
        ) : (
          <div className="overflow-hidden rounded border border-line bg-surface-sunken">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt=""
              onError={onError} ref={checkLoaded}
              className="aspect-[2/1] w-full object-cover"
              style={focus ? { objectPosition: focus } : undefined}
            />
          </div>
        )
      ) : (
        <p className="flex items-start gap-2 rounded border border-line bg-surface px-3 py-2.5 text-sm text-secondary">
          <ImagePlus className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
          <span>{emptyAsk}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-secondary">Used on</span>
        {usedOn.map((u) => (
          <Badge key={u} tone="neutral" className="whitespace-nowrap">
            {u}
          </Badge>
        ))}
      </div>

      {children}

      {edit ? (
        <Field htmlFor={edit.id} label={`${label}: path or URL`} error={edit.error ?? null}>
          <Input
            id={edit.id}
            value={edit.value}
            onChange={(e) => edit.onChange(e.target.value)}
            placeholder={edit.placeholder}
            spellCheck={false}
            autoComplete="off"
            invalid={Boolean(edit.error)}
            className="font-mono text-xs"
            aria-describedby={describedBy(edit.id, { error: Boolean(edit.error) })}
          />
        </Field>
      ) : readOnlyNote ? (
        <p className="text-xs text-secondary">{readOnlyNote}</p>
      ) : null}
    </article>
  );
}
