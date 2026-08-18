'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Overlays — the only components in the kit that ship JavaScript.
 *
 * `Dialog` and `Sheet` are built on the native `<dialog>` element, which
 * gives focus trapping, Escape-to-close, `inert` on the background and
 * correct screen-reader semantics without a single line of our own. A
 * hand-rolled div-with-a-backdrop gets those four things wrong in four
 * different ways and is the usual reason a portal is unusable by keyboard.
 */

// ---------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  // Per instance. A hardcoded id meant two dialogs on one page shared the
  // element their `aria-labelledby` pointed at, so the second one was
  // announced with the first one's title.
  const id = React.useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Escape fires `cancel`, and the backdrop click fires on the dialog
  // itself; both have to route through the caller's state or the element
  // and React disagree about whether it is open.
  const handleCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    onClose();
  };

  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl' }[size];

  return (
    <dialog
      ref={ref}
      onCancel={handleCancel}
      onClose={() => open && onClose()}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className={cn(
        'w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface-raised p-0 text-primary shadow-lg',
        'backdrop:bg-[var(--overlay)] open:animate-scale-in',
        width,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line p-card">
        <div className="min-w-0 space-y-1">
          <h2 id={titleId} className="font-display text-lg font-semibold">
            {title}
          </h2>
          {description ? (
            <p id={descId} className="text-sm text-secondary">
              {description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="-m-1 grid size-8 shrink-0 place-items-center rounded text-muted hover:bg-surface-sunken hover:text-primary"
        >
          <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden="true">
            <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {children ? <div className="max-h-[65vh] overflow-y-auto p-card">{children}</div> : null}

      {footer ? (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface px-card py-3">
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}

/**
 * Confirmation for a destructive or hard-to-reverse action.
 *
 * `requireTyped` demands the user type an exact phrase. Reserved for the
 * genuinely irreversible — a DPDP hard delete, an annual rollover — where
 * a misclick costs a database restore.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Confirm',
  tone = 'danger',
  requireTyped,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  requireTyped?: string;
  pending?: boolean;
}) {
  const [typed, setTyped] = React.useState('');
  React.useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  const blocked = Boolean(requireTyped && typed.trim() !== requireTyped);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-control rounded border border-line px-4 text-sm font-semibold hover:bg-surface-sunken"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={blocked || pending}
            className={cn(
              'h-control rounded px-4 text-sm font-semibold disabled:opacity-50',
              tone === 'danger'
                ? 'bg-danger text-danger-on'
                : 'bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)]',
            )}
          >
            {pending ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-secondary">
        <div>{body}</div>
        {requireTyped ? (
          <div className="space-y-1.5">
            <label htmlFor="confirm-phrase" className="block text-sm font-medium text-primary">
              Type <span className="font-mono text-primary">{requireTyped}</span> to continue
            </label>
            <input
              id="confirm-phrase"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="h-control w-full rounded border border-line bg-surface px-3 font-mono text-sm focus:border-[var(--focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------
// Sheet — mobile drawer
// ---------------------------------------------------------------

export function Sheet({
  open,
  onClose,
  title,
  children,
  side = 'right',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  side?: 'left' | 'right';
}) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
      className={cn(
        'm-0 h-dvh max-h-none w-[min(20rem,85vw)] max-w-none border-line bg-surface-raised p-0 text-primary shadow-lg',
        'backdrop:bg-[var(--overlay)]',
        side === 'right' ? 'ml-auto border-l' : 'mr-auto border-r',
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-line p-4">
          <p className="font-display font-semibold">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded text-muted hover:bg-surface-sunken hover:text-primary"
          >
            <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden="true">
              <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </dialog>
  );
}

// ---------------------------------------------------------------
// Menu
// ---------------------------------------------------------------

/** Close on outside pointerdown and on Escape. Both, or neither is enough. */
function useDismiss(open: boolean, onDismiss: () => void) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };

    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onDismiss]);

  return ref;
}

export function Menu({
  trigger,
  children,
  align = 'end',
  label = 'Menu',
  className,
}: {
  trigger: (props: { open: boolean }) => React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'end';
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="contents"
      >
        {trigger({ open })}
      </button>

      {open ? (
        <div
          role="menu"
          onClick={close}
          className={cn(
            'absolute z-50 mt-1.5 min-w-52 animate-slide-down rounded-lg border border-line',
            'bg-surface-raised p-1 shadow-lg',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({
  children,
  onSelect,
  href,
  tone = 'default',
  icon,
  disabled,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  href?: string;
  tone?: 'default' | 'danger';
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  const classes = cn(
    'flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-sm',
    'transition-colors duration-fast ease-brand',
    tone === 'danger' ? 'text-danger-fg hover:bg-danger-soft' : 'text-primary hover:bg-surface-sunken',
    disabled && 'pointer-events-none opacity-50',
  );

  if (href) {
    return (
      <a role="menuitem" href={href} className={classes}>
        {icon ? <span className="shrink-0 text-muted" aria-hidden="true">{icon}</span> : null}
        {children}
      </a>
    );
  }

  return (
    <button role="menuitem" type="button" onClick={onSelect} disabled={disabled} className={classes}>
      {icon ? <span className="shrink-0 text-muted" aria-hidden="true">{icon}</span> : null}
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{children}</p>;
}

// ---------------------------------------------------------------
// Popover
// ---------------------------------------------------------------

export function Popover({
  trigger,
  children,
  align = 'start',
  className,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'end';
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = useDismiss(open, React.useCallback(() => setOpen(false), []));

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="contents">
        {trigger}
      </button>
      {open ? (
        <div
          className={cn(
            'absolute z-50 mt-1.5 w-72 animate-slide-down rounded-lg border border-line bg-surface-raised p-4 shadow-lg',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------
// Disclosure
// ---------------------------------------------------------------

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details open={defaultOpen} className={cn('group rounded-lg border border-line bg-surface-raised', className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium marker:hidden">
        {summary}
        <svg
          viewBox="0 0 20 20"
          className="size-4 shrink-0 text-muted transition-transform duration-fast group-open:rotate-180"
          fill="none"
          aria-hidden="true"
        >
          <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="border-t border-line p-4 text-sm text-secondary">{children}</div>
    </details>
  );
}

// ---------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------

/**
 * CSS-only, and deliberately supplementary: the tooltip text is also the
 * trigger's accessible name, so a touch user who can never hover still
 * gets it. Never put information here that exists nowhere else.
 */
export function Tooltip({
  label,
  children,
  side = 'top',
}: {
  label: string;
  children: React.ReactNode;
  side?: 'top' | 'bottom';
}) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-50 hidden -translate-x-1/2 whitespace-nowrap rounded',
          'bg-surface-inverse px-2 py-1 text-xs font-medium text-on-inverse shadow-md',
          'group-hover/tt:block group-focus-within/tt:block',
          side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
        )}
      >
        {label}
      </span>
    </span>
  );
}
