import { cn } from '@/lib/cn';

/**
 * The public surface's section opener: a numbered eyebrow, a display
 * heading and one sentence.
 *
 * The number is a CSS counter, not a prop. Most sections on the landing
 * page appear only when the college has the content for them (events,
 * announcements, campus photos, a message), so a hard-coded "03" would
 * skip a number whenever one is absent. Wrap the sections in an element
 * with `[counter-reset:sec]` and each eyebrow takes the next number; a
 * section that is `display: none` at a breakpoint (the desktop-only quick
 * links) does not count there either. The number is decoration, so it is
 * `aria-hidden`.
 */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('eyebrow text-brand-fg [&::before]:order-2', className)}>
      <span
        aria-hidden="true"
        className="order-1 tabular [counter-increment:sec] after:content-[counter(sec,decimal-leading-zero)]"
      />
      <span className="order-3">{children}</span>
    </p>
  );
}

export function SectionHead({
  id,
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  id?: string;
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-10', className)}>
      <div className="min-w-0 max-w-2xl">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 id={id} className="mt-2 font-display text-display-md md:mt-3 font-bold tracking-tight">
          {title}
        </h2>
        {description ? <p className="mt-2 text-base text-secondary md:mt-3 md:text-md">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

/**
 * Drop-in for the kit's `Section` on the interior pages (About, Contact,
 * Events): the same title / description / actions, opened the way the
 * landing page opens its sections.
 */
export function EditorialSection({
  id,
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: {
  id?: string;
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn('space-y-6', className)}>
      <SectionHead eyebrow={eyebrow} title={title} description={description} actions={actions} />
      {children}
    </section>
  );
}
