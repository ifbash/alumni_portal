import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Form controls.
 *
 * Every input is wrapped by `Field`, which owns the label/hint/error
 * wiring: `htmlFor`, `aria-describedby`, `aria-invalid`, and a `role`
 * that announces the error when it appears. Getting that right once here
 * is the only realistic way it stays right across forty screens.
 *
 * Server components by default — an uncontrolled input posting to a
 * server action needs no client bundle at all.
 */

const CONTROL_BASE =
  'w-full rounded border border-line bg-surface-raised text-primary ' +
  'placeholder:text-muted transition-colors duration-fast ease-brand ' +
  'hover:border-line-strong ' +
  'focus:border-[var(--focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-0 ' +
  'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-muted ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger';

// ---------------------------------------------------------------
// Field wrapper
// ---------------------------------------------------------------

export interface FieldProps {
  /** Must match the control's `id`. */
  htmlFor: string;
  label: string;
  hint?: string;
  error?: string | string[] | null;
  required?: boolean;
  /** Legally required consent copy, rendered under the control. */
  notice?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function Field({ htmlFor, label, hint, error, required, notice, className, children }: FieldProps) {
  const messages = Array.isArray(error) ? error : error ? [error] : [];
  const hasError = messages.length > 0;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-primary">
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="ml-0.5 text-danger-fg">*</span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </label>

      {hint && !hasError ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-secondary">
          {hint}
        </p>
      ) : null}

      {children}

      {hasError ? (
        <p id={`${htmlFor}-error`} role="alert" className="flex gap-1.5 text-xs font-medium text-danger-fg">
          <span aria-hidden="true">⚠</span>
          <span>{messages.join(' ')}</span>
        </p>
      ) : null}

      {notice ? <div className="pt-1 text-xs text-muted">{notice}</div> : null}
    </div>
  );
}

/** Build the `aria-describedby` a control needs, given the field state. */
export function describedBy(id: string, opts: { hint?: boolean; error?: boolean }): string | undefined {
  const parts = [opts.error ? `${id}-error` : null, opts.hint && !opts.error ? `${id}-hint` : null].filter(Boolean);
  return parts.length ? parts.join(' ') : undefined;
}

// ---------------------------------------------------------------
// Controls
// ---------------------------------------------------------------

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** Rendered inside the control on the leading edge — a search glass, a ₹. */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  sizeVariant?: 'sm' | 'md' | 'lg';
}

/**
 * `ref` is forwarded so a form can focus the control it owns — moving
 * focus to the first invalid field after a failed submit, or to the OTP
 * box on mount. Without it callers reach for `document.getElementById`,
 * which works right up until the same form is rendered twice.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, leading, trailing, sizeVariant = 'md', ...props },
  ref,
) {
  const height = { sm: 'h-control-sm text-sm', md: 'h-control text-sm', lg: 'h-control-lg text-md' }[sizeVariant];

  const control = (
    <input
      ref={ref}
      className={cn(
        CONTROL_BASE,
        height,
        'px-3',
        leading && 'pl-9',
        trailing && 'pr-9',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );

  if (!leading && !trailing) return control;

  return (
    <div className="relative">
      {leading ? (
        <span className="pointer-events-none absolute inset-y-0 left-0 grid w-9 place-items-center text-muted" aria-hidden="true">
          {leading}
        </span>
      ) : null}
      {control}
      {trailing ? (
        <span className="absolute inset-y-0 right-0 grid w-9 place-items-center text-muted">{trailing}</span>
      ) : null}
    </div>
  );
});

export function Textarea({
  className,
  invalid,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(CONTROL_BASE, 'min-h-24 resize-y px-3 py-2 text-sm leading-relaxed', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Select({
  className,
  invalid,
  children,
  sizeVariant = 'md',
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; sizeVariant?: 'sm' | 'md' | 'lg' }) {
  const height = { sm: 'h-control-sm text-sm', md: 'h-control text-sm', lg: 'h-control-lg text-md' }[sizeVariant];
  return (
    <div className="relative">
      <select
        className={cn(CONTROL_BASE, height, 'appearance-none pl-3 pr-9', className)}
        aria-invalid={invalid || undefined}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Checkbox({
  className,
  label,
  hint,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; hint?: string; id: string }) {
  return (
    <div className="flex gap-2.5">
      <input
        id={id}
        type="checkbox"
        className={cn(
          'mt-0.5 size-4 shrink-0 rounded-sm border border-line-strong bg-surface-raised',
          'accent-[var(--button-primary-bg)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...props}
      />
      <div className="min-w-0 space-y-0.5">
        <label htmlFor={id} className="block cursor-pointer text-sm text-primary">
          {label}
        </label>
        {hint ? (
          <p id={`${id}-hint`} className="text-xs text-secondary">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function Radio({
  className,
  label,
  hint,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; hint?: string; id: string }) {
  return (
    <div className="flex gap-2.5">
      <input
        id={id}
        type="radio"
        className={cn(
          'mt-0.5 size-4 shrink-0 border border-line-strong accent-[var(--button-primary-bg)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
          className,
        )}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...props}
      />
      <div className="min-w-0 space-y-0.5">
        <label htmlFor={id} className="block cursor-pointer text-sm text-primary">
          {label}
        </label>
        {hint ? (
          <p id={`${id}-hint`} className="text-xs text-secondary">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Switch.
 *
 * A real checkbox under a styled track, not a div with a click handler —
 * so it is focusable, toggles with space, submits with the form, and is
 * announced correctly without any ARIA of our own.
 */
export function Switch({
  id,
  label,
  hint,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: React.ReactNode; hint?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0 space-y-0.5">
        <label htmlFor={id} className="block cursor-pointer text-sm font-medium text-primary">
          {label}
        </label>
        {hint ? (
          <p id={`${id}-hint`} className="text-xs text-secondary">
            {hint}
          </p>
        ) : null}
      </div>

      <label htmlFor={id} className="relative mt-0.5 inline-flex shrink-0 cursor-pointer items-center">
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="peer sr-only"
          aria-describedby={hint ? `${id}-hint` : undefined}
          {...props}
        />
        <span
          className={cn(
            'h-5 w-9 rounded-full bg-line-strong transition-colors duration-fast ease-brand',
            'peer-checked:bg-[var(--button-primary-bg)]',
            'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus-ring)]',
            'peer-disabled:opacity-50',
          )}
          aria-hidden="true"
        />
        <span
          className={cn(
            'pointer-events-none absolute left-0.5 size-4 rounded-full bg-surface-raised shadow-sm',
            'transition-transform duration-fast ease-brand peer-checked:translate-x-4',
          )}
          aria-hidden="true"
        />
      </label>
    </div>
  );
}

export function Fieldset({
  legend,
  hint,
  children,
  className,
}: {
  legend: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn('space-y-3', className)}>
      <legend className="text-sm font-medium text-primary">{legend}</legend>
      {hint ? <p className="text-xs text-secondary">{hint}</p> : null}
      {children}
    </fieldset>
  );
}

/** Groups a form's actions with a consistent divider and alignment. */
export function FormActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4', className)}>
      {children}
    </div>
  );
}
