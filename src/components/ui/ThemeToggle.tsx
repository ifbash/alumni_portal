'use client';

import * as React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';

type Theme = 'light' | 'dark' | 'system';

/**
 * Theme toggle.
 *
 * Three states, not two. "System" has to be reachable — a user who set
 * dark once and cannot get back to following the OS is stuck with a
 * choice they made by accident.
 *
 * The preference is written to localStorage and read by a blocking script
 * in the document head (see `layout.tsx`), so a returning user never sees
 * a light frame before the swap.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = React.useState<Theme>('system');

  React.useEffect(() => {
    const stored = window.localStorage.getItem('theme');
    setTheme(stored === 'light' || stored === 'dark' ? stored : 'system');
  }, []);

  const apply = (next: Theme) => {
    setTheme(next);
    if (next === 'system') {
      window.localStorage.removeItem('theme');
      document.documentElement.removeAttribute('data-theme');
    } else {
      window.localStorage.setItem('theme', next);
      document.documentElement.setAttribute('data-theme', next);
    }
  };

  const options: Array<{ value: Theme; icon: React.ReactNode; label: string }> = [
    { value: 'light', icon: <Sun className="size-3.5" />, label: 'Light' },
    { value: 'dark', icon: <Moon className="size-3.5" />, label: 'Dark' },
    { value: 'system', icon: <Monitor className="size-3.5" />, label: 'System' },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn('inline-flex rounded-full border border-line bg-surface-sunken p-0.5', className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          onClick={() => apply(o.value)}
          title={o.label}
          className={cn(
            'grid size-7 place-items-center rounded-full transition-colors duration-fast ease-brand',
            theme === o.value
              ? 'bg-surface-raised text-primary shadow-sm'
              : 'text-muted hover:text-primary',
          )}
        >
          {o.icon}
          <span className="sr-only">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
