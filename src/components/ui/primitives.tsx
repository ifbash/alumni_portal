import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

/**
 * Display primitives.
 *
 * Every one of these is a server component unless it genuinely needs
 * state. Interactive pieces live in `overlay.tsx` and are marked
 * `'use client'` there, so importing a Card into a page does not drag a
 * bundle along with it.
 *
 * None of them contains a hex colour. Everything resolves through the
 * tenant's tokens, which is what makes a new customer a JSON file.
 */

// ---------------------------------------------------------------
// Button
// ---------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold ' +
  'transition-colors duration-fast ease-brand select-none ' +
  'disabled:pointer-events-none disabled:opacity-50 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)] shadow-sm ' +
    'hover:bg-[var(--button-primary-hover)]',
  secondary:
    'bg-surface-raised text-primary border border-line ' +
    'hover:bg-surface-sunken hover:border-line-strong',
  ghost: 'text-secondary hover:bg-surface-sunken hover:text-primary',
  danger: 'bg-danger text-danger-on shadow-sm hover:brightness-95',
  inverse:
    'bg-surface-inverse text-on-inverse hover:opacity-90',
  link: 'text-brand-fg underline underline-offset-4 hover:opacity-80 h-auto p-0',
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: 'h-control-sm rounded px-3 text-sm',
  md: 'h-control rounded px-4 text-sm',
  lg: 'h-control-lg rounded-lg px-6 text-md',
  icon: 'h-control w-control rounded shrink-0',
  'icon-sm': 'h-control-sm w-control-sm rounded-sm shrink-0',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(BUTTON_BASE, BUTTON_VARIANT[variant], variant !== 'link' && BUTTON_SIZE[size], className)}
      disabled={disabled || loading}
      // Screen readers get told the control is busy rather than silently
      // ignoring the click that just happened.
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : null}
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends React.ComponentPropsWithoutRef<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(BUTTON_BASE, BUTTON_VARIANT[variant], variant !== 'link' && BUTTON_SIZE[size], className)}
      {...props}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('size-4 animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------
// Card
// ---------------------------------------------------------------

export function Card({
  className,
  as: As = 'div',
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  as?: React.ElementType;
  interactive?: boolean;
}) {
  return (
    <As
      className={cn(
        'rounded-lg border border-line bg-surface-raised shadow-sm',
        interactive &&
          'transition-shadow duration-fast ease-brand hover:shadow-md hover:border-line-strong',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-start justify-between gap-4 p-card pb-0', className)} {...props} />;
}

export function CardTitle({ className, as: As = 'h3', ...props }: React.HTMLAttributes<HTMLHeadingElement> & { as?: React.ElementType }) {
  return <As className={cn('font-display text-lg font-semibold', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-secondary', className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-card', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center gap-3 border-t border-line bg-surface px-card py-3', className)}
      {...props}
    />
  );
}

// ---------------------------------------------------------------
// Badge
// ---------------------------------------------------------------

type BadgeTone = 'neutral' | 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-secondary',
  brand: 'bg-brand-soft text-brand-soft-fg',
  accent: 'bg-accent-soft text-accent-soft-fg',
  success: 'bg-success-soft text-success-fg',
  warning: 'bg-warning-soft text-warning-fg',
  danger: 'bg-danger-soft text-danger-fg',
  info: 'bg-info-soft text-info-fg',
  outline: 'border border-line-strong text-secondary',
};

export function Badge({
  tone = 'neutral',
  className,
  dot = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; dot?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        BADGE_TONE[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------

const AVATAR_SIZE = { xs: 'size-6 text-[10px]', sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-md', xl: 'size-24 text-xl' } as const;

/**
 * Initials fallback rather than a generic silhouette.
 *
 * Most alumni will never upload a photo. A directory of identical grey
 * heads is unscannable; initials in the brand tint at least give the eye
 * something to sort by.
 */
export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof AVATAR_SIZE;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        'bg-brand-soft font-semibold text-brand-soft-fg ring-1 ring-inset ring-line',
        AVATAR_SIZE[size],
        className,
      )}
    >
      {src ? (
        // Tenant- and member-supplied URLs; see next.config.ts on why these
        // bypass the image optimiser.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <span aria-hidden="true">{initials || '·'}</span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------

type AlertTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

/**
 * Tone borders are mixed from `currentColor` rather than written with an
 * opacity modifier: the palette is CSS custom properties, and Tailwind's
 * `/25` syntax only works on colours it can decompose into channels.
 */
const TONE_BORDER = 'border-[color-mix(in_srgb,currentColor_26%,transparent)]';

const ALERT_TONE: Record<AlertTone, string> = {
  info: `bg-info-soft text-info-fg ${TONE_BORDER}`,
  success: `bg-success-soft text-success-fg ${TONE_BORDER}`,
  warning: `bg-warning-soft text-warning-fg ${TONE_BORDER}`,
  danger: `bg-danger-soft text-danger-fg ${TONE_BORDER}`,
  neutral: 'bg-surface-sunken text-secondary border-line',
};

export function Alert({
  tone = 'info',
  title,
  icon,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tone?: AlertTone; title?: string; icon?: React.ReactNode }) {
  return (
    <div
      // `alert` is assertive and interrupts a screen reader mid-sentence.
      // Correct for a failure the user just caused, wrong for a standing
      // note on the page.
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border p-4 text-sm', ALERT_TONE[tone], className)}
      {...props}
    >
      {icon ? <span className="mt-0.5 shrink-0" aria-hidden="true">{icon}</span> : null}
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="[&_a]:underline [&_a]:underline-offset-2">{children}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line',
        'bg-surface px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? (
        <span className="grid size-11 place-items-center rounded-full bg-surface-sunken text-muted" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <p className="font-display text-lg font-semibold">{title}</p>
      {description ? <p className="max-w-sm text-sm text-secondary">{description}</p> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4 w-full', className)} aria-hidden="true" />;
}

export function Progress({
  value,
  max = 100,
  label,
  tone = 'brand',
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  tone?: 'brand' | 'success' | 'warning' | 'danger';
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const fill = {
    brand: 'bg-[var(--button-primary-bg)]',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
  }[tone];

  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-sunken', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-slow ease-brand', fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------
// Layout
// ---------------------------------------------------------------

export function Separator({
  orientation = 'horizontal',
  className,
  label,
}: {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  label?: string;
}) {
  if (label) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
    );
  }
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', 'bg-line', className)}
    />
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  trend,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  trend?: { direction: 'up' | 'down' | 'flat'; label: string };
  className?: string;
}) {
  const trendTone =
    trend?.direction === 'up' ? 'text-success-fg' : trend?.direction === 'down' ? 'text-danger-fg' : 'text-muted';

  return (
    <Card className={cn('p-card', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-secondary">{label}</p>
        {icon ? <span className="text-muted" aria-hidden="true">{icon}</span> : null}
      </div>
      <p className="mt-2 font-display text-display-xs font-bold tabular">{value}</p>
      {trend || hint ? (
        <p className="mt-1 flex items-center gap-2 text-xs">
          {trend ? <span className={cn('font-semibold', trendTone)}>{trend.label}</span> : null}
          {hint ? <span className="text-muted">{hint}</span> : null}
        </p>
      ) : null}
    </Card>
  );
}

/** Key/value row used across every detail panel in the app. */
export function DetailRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-[minmax(0,10rem)_1fr] gap-4 py-2.5 text-sm', className)}>
      <dt className="text-secondary">{label}</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-sm border border-line bg-surface-sunken px-1.5 py-0.5 font-mono text-xs text-secondary">
      {children}
    </kbd>
  );
}
