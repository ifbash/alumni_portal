import * as React from 'react';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * The packs already shipped in `brands/`.
 *
 * A new tenant starting from a blank form picks eleven values badly. A new
 * tenant starting from an existing pack changes two and inherits a
 * complete, accessible design system for the rest — including the things
 * no browser form exposes: self-hosted font faces, locale, the copy on the
 * empty states.
 *
 * "Start from nothing" is a real option, not a placeholder. It resolves to
 * the neutral default pack, which is a portal rather than unstyled HTML.
 */

export interface BasePackOption {
  id: string;
  portalName: string;
  institutionName: string;
  primary: string;
}

export function PresetGallery({
  packs,
  value,
  onSelect,
  currentId,
  name = 'base-pack',
  className,
}: {
  packs: BasePackOption[];
  /** `null` means the neutral default pack. */
  value: string | null;
  onSelect: (id: string | null) => void;
  /** The pack this tenant is served from today. */
  currentId?: string | null;
  name?: string;
  className?: string;
}) {
  return (
    <fieldset className={cn('space-y-3', className)}>
      <legend className="sr-only">Base brand pack</legend>

      <div className="grid gap-2 sm:grid-cols-2">
        {packs.map((pack) => (
          <PresetCard
            key={pack.id}
            name={name}
            checked={value === pack.id}
            onSelect={() => onSelect(pack.id)}
            title={pack.portalName}
            subtitle={pack.institutionName}
            swatch={pack.primary}
            id={`preset-${pack.id}`}
            badge={currentId === pack.id ? 'Serving this tenant' : undefined}
            footnote={`brands/${pack.id}.json`}
          />
        ))}

        <PresetCard
          name={name}
          checked={value === null}
          onSelect={() => onSelect(null)}
          title="Start from nothing"
          subtitle="The neutral default pack. Plain, legible, and unmistakably not yet branded."
          id="preset-blank"
          footnote="No file — built into the product"
        />
      </div>

      <p className="text-xs text-muted">
        Choosing one loads its values into every control below, and it becomes the base your changes
        are a delta from. Change the primary colour and nothing else, and you inherit that
        pack&rsquo;s type, spacing, locale and wording unchanged — including the parts no form
        exposes, like self-hosted font faces.
      </p>
    </fieldset>
  );
}

function PresetCard({
  id,
  name,
  checked,
  onSelect,
  title,
  subtitle,
  swatch,
  badge,
  footnote,
}: {
  id: string;
  name: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  swatch?: string;
  badge?: string;
  footnote: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'relative flex cursor-pointer gap-3 rounded-lg border p-3',
        'transition-colors duration-fast ease-brand',
        checked
          ? 'border-[var(--button-primary-bg)] bg-brand-soft'
          : 'border-line bg-surface-raised hover:border-line-strong hover:bg-surface-sunken',
        'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus-ring)]',
      )}
    >
      <input
        id={id}
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />

      {/* The swatch shows the pack's own colour, so nothing is drawn on top
          of it — a tick mark on an arbitrary customer hue is a contrast
          gamble. Selection is carried by the card's border and by a tick
          set in a token colour beside the title. */}
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 size-8 shrink-0 rounded-full border border-line-strong',
          !swatch && 'border-dashed',
          checked && 'ring-2 ring-offset-2 ring-offset-[var(--brand-soft)]',
        )}
        style={swatch ? { background: swatch } : undefined}
      />

      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {checked ? (
            <Check className="size-4 shrink-0 text-brand-soft-fg" strokeWidth={3} aria-hidden="true" />
          ) : null}
          <span className={cn('font-display text-sm font-semibold', checked && 'text-brand-soft-fg')}>
            {title}
          </span>
          {badge ? <Badge tone="accent">{badge}</Badge> : null}
        </span>
        <span className="block text-xs text-secondary">{subtitle}</span>
        <span className="block font-mono text-xs text-muted">{footnote}</span>
      </span>
    </label>
  );
}
