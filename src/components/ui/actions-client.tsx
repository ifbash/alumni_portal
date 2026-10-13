'use client';

import * as React from 'react';
import { Check, Copy, MessageCircle, Share2, Upload } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button, ButtonLink } from './primitives';
import { useToast } from './toast';

/**
 * Sharing and file controls — the kit's interactive actions.
 *
 * WhatsApp first: an Indian alumni network spreads through batch groups,
 * so every share is a plain `wa.me` link built on the server
 * (`whatsappShareUrl`), then Copy link, then the phone's own share sheet
 * where the browser has one. No SDK, no tracking, no Business API call.
 */

type Size = 'sm' | 'md' | 'lg';

/**
 * Copy text to the clipboard, falling back to a selected read-only field
 * when the clipboard is refused (some in-app browsers refuse it outright,
 * and a silent no-op there looks like a broken button).
 */
function useCopy(text: string, copiedTitle: string) {
  const toast = useToast();
  const [copied, setCopied] = React.useState(false);
  const [manual, setManual] = React.useState(false);

  const copy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(copiedTitle);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setManual(true);
      toast.info('Could not reach the clipboard', 'Select the text in the box and copy it.');
    }
  }, [text, copiedTitle, toast]);

  return { copied, manual, copy };
}

function ManualCopy({ text, label }: { text: string; label: string }) {
  return (
    <input
      readOnly
      value={text}
      aria-label={label}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      className="h-control w-full min-w-0 rounded border border-line bg-surface px-3 font-mono text-sm text-primary focus:border-[var(--focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
    />
  );
}

/**
 * Share on WhatsApp, Copy link, and (where the browser offers it) the
 * system share sheet. The page supplies both URLs: `url` is what gets
 * copied and shared, `whatsappHref` is the prebuilt `wa.me` link.
 *
 * `band` switches the buttons to the band variants, for use inside
 * `.band-surface` only.
 */
export function ShareActions({
  url,
  whatsappHref,
  title,
  size = 'md',
  band = false,
  className,
}: {
  url: string;
  whatsappHref: string;
  /** The share sheet's title; also names what is being shared. */
  title: string;
  size?: Size;
  band?: boolean;
  className?: string;
}) {
  const { copied, manual, copy } = useCopy(url, 'Link copied');
  // Only after mount: the server cannot know whether the browser has a
  // share sheet, and guessing would mismatch on hydration.
  const [canShare, setCanShare] = React.useState(false);
  React.useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  const primary = band ? 'band' : 'primary';
  const secondary = band ? 'band-outline' : 'secondary';

  const share = async () => {
    try {
      await navigator.share({ title, url });
    } catch {
      // Dismissing the sheet rejects; that is not an error worth a toast.
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink
          href={whatsappHref}
          target="_blank"
          rel="noreferrer noopener"
          variant={primary}
          size={size}
          className="min-h-11"
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          Share on WhatsApp
          <span className="sr-only"> (opens WhatsApp)</span>
        </ButtonLink>
        <Button type="button" variant={secondary} size={size} className="min-h-11" onClick={copy}>
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        {canShare ? (
          <Button type="button" variant={secondary} size={size} className="min-h-11" onClick={share}>
            <Share2 className="size-4" aria-hidden="true" />
            Share
          </Button>
        ) : null}
      </div>
      {manual ? (
        <div className={cn(band && 'band-exit')}>
          <ManualCopy text={url} label={`Link to ${title}`} />
        </div>
      ) : null}
    </div>
  );
}

/** Copies `text` (a link, a formatted WhatsApp message) with the same clipboard fallback. */
export function CopyButton({
  text,
  label = 'Copy',
  copiedLabel = 'Copied',
  variant = 'secondary',
  size = 'md',
  className,
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'band' | 'band-outline';
  size?: Size;
  className?: string;
}) {
  const { copied, manual, copy } = useCopy(text, copiedLabel);

  return (
    <span className={cn('inline-flex max-w-full flex-col gap-2', className)}>
      <Button type="button" variant={variant} size={size} className="min-h-11" onClick={copy}>
        {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        {copied ? copiedLabel : label}
      </Button>
      {manual ? <ManualCopy text={text} label={label} /> : null}
    </span>
  );
}

/**
 * A file picker that also takes a drop.
 *
 * A real `<input type="file">`, visually hidden and tied to the label, plus
 * a keyboard-operable button that opens it, so it works by keyboard and
 * screen reader as well as by drag. When disabled it says why in text
 * rather than greying out a mystery.
 */
export function DropZone({
  id,
  label,
  accept,
  hint,
  onFile,
  disabled = false,
  disabledReason,
}: {
  id: string;
  label: string;
  accept: string;
  hint?: string;
  onFile?: (file: File) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const [name, setName] = React.useState<string | null>(null);

  const take = (file: File | undefined) => {
    if (!file || disabled) return;
    setName(file.name);
    onFile?.(file);
  };

  return (
    <div
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files?.[0]);
      }}
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-line-strong bg-surface px-4 py-8 text-center',
        over && 'border-[var(--focus-ring)] bg-brand-soft',
        disabled && 'opacity-70',
      )}
    >
      <label htmlFor={id} className="text-sm font-medium text-primary">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        aria-describedby={hint || (disabled && disabledReason) ? `${id}-hint` : undefined}
        onChange={(e) => take(e.target.files?.[0])}
      />
      <Button
        type="button"
        variant="secondary"
        className="min-h-11"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4" aria-hidden="true" />
        Choose a file
      </Button>
      {name ? <p className="text-sm text-primary">{name}</p> : null}
      {disabled && disabledReason ? (
        <p id={`${id}-hint`} className="max-w-sm text-sm text-secondary">
          {disabledReason}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="max-w-sm text-xs text-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
